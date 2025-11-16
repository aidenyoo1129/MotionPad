import { useEffect, useRef, useState, useCallback } from 'react';

export interface HandPosition {
  x: number;
  y: number;
  isFist: boolean;
  isOpen: boolean;
}

export interface HandTrackingState {
  leftHand: HandPosition | null;
  rightHand: HandPosition | null;
  gesture: 'grab' | 'release' | 'pan' | null;
}

const FIST_THRESHOLD = 0.7; // Finger curl threshold for fist detection

function detectFist(landmarks: any[]): boolean {
  // Check if index and middle fingers are curled
  // Landmarks: 8 (index tip), 12 (middle tip), 5 (index pip), 9 (middle pip)
  if (landmarks.length < 13) return false;

  const indexTip = landmarks[8];
  const indexPip = landmarks[5];
  const middleTip = landmarks[12];
  const middlePip = landmarks[9];

  // Check if tips are below PIP joints (curled)
  const indexCurl = indexTip.y > indexPip.y;
  const middleCurl = middleTip.y > middlePip.y;

  return indexCurl && middleCurl;
}

function detectOpenHand(landmarks: any[]): boolean {
  if (landmarks.length < 13) return false;

  const indexTip = landmarks[8];
  const indexPip = landmarks[5];
  const middleTip = landmarks[12];
  const middlePip = landmarks[9];

  // Check if tips are above PIP joints (extended)
  const indexOpen = indexTip.y < indexPip.y;
  const middleOpen = middleTip.y < middlePip.y;

  return indexOpen && middleOpen;
}

export function useHandTracking() {
  const [state, setState] = useState<HandTrackingState>({
    leftHand: null,
    rightHand: null,
    gesture: null,
  });
  const [isActive, setIsActive] = useState(false);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastMidpointRef = useRef<{ x: number; y: number } | null>(null);

  const processResults = useCallback((results: any) => {
    let leftHand: HandPosition | null = null as HandPosition | null;
    let rightHand: HandPosition | null = null as HandPosition | null;

    // DIAGNOSTIC: Log raw MediaPipe results
    const resultCount = results.multiHandLandmarks?.length || 0;
    if (resultCount > 0) {
      console.log('[Hand Tracking Debug] MediaPipe detected', resultCount, 'hand(s)');
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks: any[], index: number) => {
        const handedness = results.multiHandedness?.[index];
        const isRight = handedness?.label === 'Right';
        const wrist = landmarks[0];
        
        const isFist = detectFist(landmarks);
        const isOpen = detectOpenHand(landmarks);
        
        const handPos: HandPosition = {
          x: wrist.x, // Normalized 0-1
          y: wrist.y, // Normalized 0-1
          isFist,
          isOpen,
        };

        // DIAGNOSTIC: Log hand detection details
        console.log('[Hand Tracking Debug] Hand detected:', {
          hand: isRight ? 'Right' : 'Left',
          position: { x: wrist.x.toFixed(3), y: wrist.y.toFixed(3) },
          isFist,
          isOpen,
          landmarksCount: landmarks.length,
        });

        // Note: MediaPipe's handedness is relative to camera view, not user perspective.
        // For mirrored front-facing cameras, we swap left/right to match user's perspective.
        if (isRight) {
          leftHand = handPos;  // Swapped: MediaPipe's "Right" = user's left hand
        } else {
          rightHand = handPos;  // Swapped: MediaPipe's "Left" = user's right hand
        }
      });
    } else {
      // Log when no hands detected (throttled)
      if (Math.random() < 0.01) { // Log ~1% of the time to avoid spam
        console.log('[Hand Tracking Debug] No hands detected in frame');
      }
    }

    // Determine gesture
    let gesture: 'grab' | 'release' | 'pan' | null = null;

    const leftIsFist = leftHand?.isFist ?? false;
    const rightIsFist = rightHand?.isFist ?? false;
    const leftIsOpen = leftHand?.isOpen ?? false;
    const rightIsOpen = rightHand?.isOpen ?? false;

    // Determine gesture with improved logic
    // Priority: GRAB > PAN > RELEASE > NONE
    
    if (leftIsFist || rightIsFist) {
      // Any fist = grab
      gesture = 'grab';
      console.log('[Hand Tracking Debug] ✅ GRAB detected', {
        leftFist: leftIsFist,
        rightFist: rightIsFist,
        leftHand: leftHand ? 'present' : 'none',
        rightHand: rightHand ? 'present' : 'none',
      });
    } else if (leftHand && rightHand && leftIsOpen && rightIsOpen) {
      // Both hands open = pan
      gesture = 'pan';
      const midX = ((leftHand.x + rightHand.x) / 2);
      const midY = ((leftHand.y + rightHand.y) / 2);
      
      if (lastMidpointRef.current) {
        lastMidpointRef.current = { x: midX, y: midY };
      } else {
        lastMidpointRef.current = { x: midX, y: midY };
      }
      console.log('[Hand Tracking Debug] ✅ PAN detected (both hands open)');
    } else if (leftHand && leftIsOpen && !rightHand) {
      // Single open hand (left) = release
      gesture = 'release';
      console.log('[Hand Tracking Debug] ✅ RELEASE detected (left hand open, no right)');
    } else if (rightHand && rightIsOpen && !leftHand) {
      // Single open hand (right) = release
      gesture = 'release';
      console.log('[Hand Tracking Debug] ✅ RELEASE detected (right hand open, no left)');
    } else {
      // No clear gesture
      gesture = null;
      // Only log occasionally to reduce noise
      if (Math.random() < 0.05) {
        console.log('[Hand Tracking Debug] ⚠️ No gesture', {
          leftHand: leftHand ? (leftIsFist ? 'fist' : leftIsOpen ? 'open' : 'other') : 'none',
          rightHand: rightHand ? (rightIsFist ? 'fist' : rightIsOpen ? 'open' : 'other') : 'none',
        });
      }
    }

    setState({
      leftHand,
      rightHand,
      gesture,
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;
    let initializationAttempted = false;

    // DIAGNOSTIC: Set up global error handler to catch async MediaPipe errors
    const originalErrorHandler = window.onerror;
    const mediaPipeErrorHandler: OnErrorEventHandler = (message, source, lineno, colno, error) => {
      const messageStr = String(message || '');
      const sourceStr = String(source || '');
      if (messageStr.includes('mediapipe') || messageStr.includes('MediaPipe') || 
          messageStr.includes('hands_solution') || sourceStr.includes('mediapipe')) {
        console.error('[MediaPipe Debug] Global error caught:', {
          message: messageStr,
          source: sourceStr,
          lineno,
          colno,
          error,
        });
      }
      if (originalErrorHandler) {
        return originalErrorHandler.call(window, message, source, lineno, colno, error);
      }
      return false;
    };
    window.onerror = mediaPipeErrorHandler;

    // DIAGNOSTIC: Also catch unhandled promise rejections
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('mediapipe') || 
          event.reason?.message?.includes('MediaPipe') ||
          event.reason?.stack?.includes('mediapipe')) {
        console.error('[MediaPipe Debug] Unhandled promise rejection:', {
          reason: event.reason,
          message: event.reason?.message,
          stack: event.reason?.stack,
        });
      }
    };
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    // Delay initialization slightly to ensure DOM is ready
    const initTimer = setTimeout(() => {
      if (initializationAttempted || !isMounted) return;
      initializationAttempted = true;

      // Dynamically import MediaPipe to avoid SSR issues
      // Wrap in additional try-catch to handle any runtime errors
      Promise.resolve()
        .then(async () => {
          try {
            return await Promise.all([
              import('@mediapipe/hands').catch((err) => {
                console.error('Failed to import @mediapipe/hands:', err);
                return null;
              }),
              import('@mediapipe/camera_utils').catch((err) => {
                console.error('Failed to import @mediapipe/camera_utils:', err);
                return null;
              }),
            ]);
          } catch (err) {
            console.error('Error during MediaPipe import:', err);
            return [null, null];
          }
        })
        .then(async (modules) => {
          if (!modules || !isMounted) return;
          const [handsModule, cameraModule] = modules;
          
          console.log('[MediaPipe Debug] Modules loaded:', {
            handsModule: !!handsModule,
            cameraModule: !!cameraModule,
            handsModuleKeys: handsModule ? Object.keys(handsModule) : [],
            cameraModuleKeys: cameraModule ? Object.keys(cameraModule) : [],
          });
          
          if (!handsModule || !cameraModule) {
            console.warn('[MediaPipe Debug] MediaPipe modules failed to load. Hand tracking will be disabled.');
            return;
          }

          const { Hands } = handsModule;
          const { Camera } = cameraModule;

          // DIAGNOSTIC: Check for expected globals before initialization
          console.log('[MediaPipe Debug] Checking environment before initialization...');
          console.log('[MediaPipe Debug] window.Module exists:', typeof (window as any).Module !== 'undefined');
          console.log('[MediaPipe Debug] window.Module value:', (window as any).Module);
          console.log('[MediaPipe Debug] Hands constructor type:', typeof Hands);
          console.log('[MediaPipe Debug] Hands constructor:', Hands);
          console.log('[MediaPipe Debug] Camera type:', typeof Camera);

          try {
            // DIAGNOSTIC: Log what locateFile receives
            let locateFileCallCount = 0;
            const locateFileLog: string[] = [];
            
            // Ensure MediaPipe's Module object exists before initialization
            // This is required for asset loading
            if (typeof (window as any).Module === 'undefined') {
              console.log('[MediaPipe Debug] Initializing Module object...');
              (window as any).Module = {
                locateFile: (file: string) => {
                  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                },
              };
            }
            
            // Wrap in try-catch to handle MediaPipe initialization errors
            let hands;
            const createHands = () => {
              try {
                console.log('[MediaPipe Debug] Creating Hands instance...');
                hands = new Hands({
                  locateFile: (file: string) => {
                    locateFileCallCount++;
                    const url = `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                    locateFileLog.push(`Call ${locateFileCallCount}: file="${file}" -> url="${url}"`);
                    
                    if (locateFileCallCount <= 5) {
                      console.log(`[MediaPipe Debug] locateFile called #${locateFileCallCount}:`, { file, url });
                    }
                    
                    return url;
                  },
                });
                console.log('[MediaPipe Debug] Hands instance created successfully');
                console.log('[MediaPipe Debug] locateFile was called', locateFileCallCount, 'times');
                if (locateFileLog.length > 0) {
                  console.log('[MediaPipe Debug] First few locateFile calls:', locateFileLog.slice(0, 5));
                }
                return true;
              } catch (initError: any) {
                console.error('[MediaPipe Debug] Hands constructor error:', initError);
                console.error('[MediaPipe Debug] Error stack:', initError?.stack);
                console.error('[MediaPipe Debug] Error name:', initError?.name);
                console.error('[MediaPipe Debug] Error message:', initError?.message);
                return false;
              }
            };
            
            // Try to create Hands, with retry if needed
            if (!createHands()) {
              console.log('[MediaPipe Debug] Initial attempt failed, retrying after delay...');
              // Wait a bit for MediaPipe to fully initialize, then retry
              await new Promise<void>(resolve => {
                setTimeout(() => {
                  if (!createHands()) {
                    console.error('[MediaPipe Debug] Failed to create Hands after retry');
                    throw new Error('Failed to initialize MediaPipe Hands');
                  } else {
                    console.log('[MediaPipe Debug] Hands created successfully on retry');
                  }
                  resolve();
                }, 500);
              });
            }

            console.log('[MediaPipe Debug] Setting Hands options...');
            try {
              hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
              });
              console.log('[MediaPipe Debug] Options set successfully');
            } catch (optionsError: any) {
              console.error('[MediaPipe Debug] setOptions error:', optionsError);
              throw optionsError;
            }

            console.log('[MediaPipe Debug] Setting up onResults callback...');
            try {
              hands.onResults(processResults);
              console.log('[MediaPipe Debug] onResults callback set successfully');
            } catch (onResultsError: any) {
              console.error('[MediaPipe Debug] onResults error:', onResultsError);
              throw onResultsError;
            }

            handsRef.current = hands;
            
            // Store Camera class for later use
            (window as any).__MediaPipeCamera = Camera;
            
            // Mark MediaPipe as ready after a short delay to ensure WASM is fully loaded
            // This helps prevent "Assertion failed" errors when sending frames
            setTimeout(() => {
              (window as any).__MediaPipeReady = true;
              console.log('[MediaPipe Debug] MediaPipe marked as ready');
            }, 1000);
            
            console.log('MediaPipe Hands initialized successfully');
          } catch (error: any) {
            console.error('Failed to initialize MediaPipe Hands:', error);
            // Don't crash - just disable hand tracking
            handsRef.current = null;
          }
        })
        .catch((error) => {
          console.error('Failed to load MediaPipe:', error);
          // Hand tracking will be disabled, but app continues
        });
    }, 500); // Increased delay to ensure everything is ready

    return () => {
      clearTimeout(initTimer);
      isMounted = false;
      
      // Restore original error handler
      window.onerror = originalErrorHandler;
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
      
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      if (handsRef.current) {
        try {
          handsRef.current.close();
        } catch (e) {
          // Ignore cleanup errors
        }
        handsRef.current = null;
      }
    };
  }, [processResults]);

  const startTracking = useCallback(async () => {
    console.log('[Hand Tracking Debug] startTracking called');
    console.log('[Hand Tracking Debug] Environment check:', {
      windowExists: typeof window !== 'undefined',
      handsRefExists: !!handsRef.current,
      isActive,
    });

    if (typeof window === 'undefined') {
      console.warn('[Hand Tracking Debug] Cannot start: window is undefined');
      return;
    }

    if (!handsRef.current) {
      console.warn('[Hand Tracking Debug] Cannot start: MediaPipe Hands not initialized. Hand tracking is disabled.');
      setIsActive(false);
      return;
    }

    try {
      console.log('[Hand Tracking Debug] Requesting camera access...');
      
      // First check camera permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log('[Hand Tracking Debug] Camera permission granted');
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
      } catch (permErr: any) {
        console.error('[Hand Tracking Debug] Camera permission denied:', permErr);
        setIsActive(false);
        return;
      }

      // Dynamically import Camera if not already available
      let Camera = (window as any).__MediaPipeCamera;
      if (!Camera) {
        console.log('[Hand Tracking Debug] Loading Camera module...');
        const cameraModule = await import('@mediapipe/camera_utils');
        Camera = cameraModule.Camera;
        console.log('[Hand Tracking Debug] Camera module loaded');
      }

      console.log('[Hand Tracking Debug] Creating video element...');
      const video = document.createElement('video');
      video.style.display = 'none';
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      document.body.appendChild(video);
      videoRef.current = video;

          let frameCount = 0;
          let isProcessingFrame = false;
          const camera = new Camera(video, {
            onFrame: async () => {
              frameCount++;
              if (frameCount % 30 === 0) {
                console.log('[Hand Tracking Debug] Processing frame #', frameCount, 'Video ready:', video.readyState);
              }
              
              // Prevent concurrent frame processing and ensure MediaPipe is ready
              if (isProcessingFrame || !handsRef.current || video.readyState !== video.HAVE_ENOUGH_DATA) {
                return;
              }
              
              // Check if MediaPipe is fully initialized (WASM loaded)
              if (!(window as any).__MediaPipeReady) {
                // Skip frames until MediaPipe is ready to avoid "Assertion failed" errors
                if (frameCount % 60 === 0) {
                  console.log('[Hand Tracking Debug] Waiting for MediaPipe to fully initialize...');
                }
                return;
              }
              
              // Check if MediaPipe is ready by verifying the instance exists and has necessary methods
              if (!handsRef.current || typeof handsRef.current.send !== 'function') {
                console.warn('[Hand Tracking Debug] MediaPipe Hands not ready, skipping frame');
                return;
              }
              
              // DIAGNOSTIC: Check video element dimensions before sending
              const videoWidth = video.videoWidth || 0;
              const videoHeight = video.videoHeight || 0;
              const elementWidth = video.width || 0;
              const elementHeight = video.height || 0;
              
              // Log video dimensions on first frame and periodically
              if (frameCount === 1 || frameCount % 60 === 0) {
                console.log('[Hand Tracking Debug] Video element state:', {
                  frameCount,
                  readyState: video.readyState,
                  videoWidth,
                  videoHeight,
                  elementWidth,
                  elementHeight,
                  hasValidDimensions: videoWidth > 0 && videoHeight > 0,
                  videoSrc: video.src || 'no src',
                  videoCurrentTime: video.currentTime,
                });
              }
              
              // CRITICAL: Don't send frame if video dimensions are invalid
              if (videoWidth === 0 || videoHeight === 0) {
                if (frameCount % 30 === 0) {
                  console.warn('[Hand Tracking Debug] ⚠️ Skipping frame - video dimensions are 0', {
                    videoWidth,
                    videoHeight,
                    readyState: video.readyState,
                  });
                }
                isProcessingFrame = false;
                return;
              }
              
              isProcessingFrame = true;
              try {
                // DIAGNOSTIC: Log what we're sending to MediaPipe
                if (frameCount === 1 || frameCount % 60 === 0) {
                  console.log('[Hand Tracking Debug] Sending frame to MediaPipe:', {
                    frameCount,
                    videoWidth,
                    videoHeight,
                    imageType: typeof video,
                    imageConstructor: video.constructor.name,
                  });
                }
                
                await handsRef.current.send({ image: video });
              } catch (error: any) {
                // Log all errors with full context for debugging
                console.error('[Hand Tracking Debug] ❌ Error sending frame to MediaPipe:', {
                  error,
                  errorMessage: error?.message,
                  errorName: error?.name,
                  frameCount,
                  videoWidth,
                  videoHeight,
                  readyState: video.readyState,
                  isMemoryError: error?.message?.includes('memory') || error?.message?.includes('out of bounds'),
                });
              } finally {
                isProcessingFrame = false;
              }
            },
            width: 640,
            height: 480,
          });

      console.log('[Hand Tracking Debug] Starting camera...');
      camera.start();
      cameraRef.current = camera;
      setIsActive(true);
      console.log('[Hand Tracking Debug] Camera started successfully');
    } catch (error: any) {
      console.error('[Hand Tracking Debug] Failed to start camera tracking:', {
        error,
        message: error?.message,
        stack: error?.stack,
      });
      setIsActive(false);
    }
  }, [isActive]);

  const stopTracking = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    if (videoRef.current) {
      document.body.removeChild(videoRef.current);
      videoRef.current = null;
    }
    setIsActive(false);
    setState({
      leftHand: null,
      rightHand: null,
      gesture: null,
    });
  }, []);

  return {
    ...state,
    isActive,
    startTracking,
    stopTracking,
  };
}

