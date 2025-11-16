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

        if (isRight) {
          rightHand = handPos;
        } else {
          leftHand = handPos;
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

    // DIAGNOSTIC: Log gesture detection
    const gestureLog = {
      leftHand: leftHand ? { isFist: leftIsFist, isOpen: leftIsOpen } : null,
      rightHand: rightHand ? { isFist: rightIsFist, isOpen: rightIsOpen } : null,
    };

    if (leftIsFist || rightIsFist) {
      gesture = 'grab';
      console.log('[Hand Tracking Debug] Gesture: GRAB', gestureLog);
    } else if (leftIsOpen && rightIsOpen && leftHand && rightHand) {
      gesture = 'pan';
      // Calculate midpoint for panning
      const midX = ((leftHand.x + rightHand.x) / 2);
      const midY = ((leftHand.y + rightHand.y) / 2);
      
      if (lastMidpointRef.current) {
        // Delta will be calculated in the component using this hook
        lastMidpointRef.current = { x: midX, y: midY };
      } else {
        lastMidpointRef.current = { x: midX, y: midY };
      }
      console.log('[Hand Tracking Debug] Gesture: PAN', gestureLog);
    } else if ((leftIsOpen && !rightHand) || (rightIsOpen && !leftHand)) {
      gesture = 'release';
      console.log('[Hand Tracking Debug] Gesture: RELEASE', gestureLog);
    } else {
      // Log when no gesture detected (throttled)
      if (Math.random() < 0.01) {
        console.log('[Hand Tracking Debug] Gesture: NONE', gestureLog);
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
        .then((modules) => {
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
            
            // Wrap in try-catch to handle MediaPipe initialization errors
            let hands;
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
            } catch (initError: any) {
              console.error('[MediaPipe Debug] Hands constructor error:', initError);
              console.error('[MediaPipe Debug] Error stack:', initError?.stack);
              console.error('[MediaPipe Debug] Error name:', initError?.name);
              console.error('[MediaPipe Debug] Error message:', initError?.message);
              throw initError;
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
      const camera = new Camera(video, {
        onFrame: async () => {
          frameCount++;
          if (frameCount % 30 === 0) {
            console.log('[Hand Tracking Debug] Processing frame #', frameCount, 'Video ready:', video.readyState);
          }
          
          if (handsRef.current && video.readyState === video.HAVE_ENOUGH_DATA) {
            try {
              await handsRef.current.send({ image: video });
            } catch (error) {
              console.error('[Hand Tracking Debug] Error sending frame to MediaPipe:', error);
            }
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

