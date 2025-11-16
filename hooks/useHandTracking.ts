import { useEffect, useRef, useState, useCallback } from 'react';

export interface HandPosition {
  x: number;
  y: number;
  isFist: boolean;
  isOpen: boolean;
  isPinch: boolean;
  isPointing: boolean;
}

export interface HandTrackingState {
  leftHand: HandPosition | null;
  rightHand: HandPosition | null;
  gesture: 'grab' | 'release' | 'pan' | 'pointing' | null;
}

const PINCH_THRESHOLD = 0.05; // Distance threshold for pinch detection (normalized 0-1)

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

/**
 * Detect pinch gesture (thumb and index finger touching)
 * Returns true if thumb tip and index tip are close together
 */
function detectPinch(landmarks: any[]): boolean {
  if (landmarks.length < 9) return false;

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];

  // Calculate Euclidean distance in normalized coordinates
  const distance = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) + 
    Math.pow(thumbTip.y - indexTip.y, 2)
  );

  return distance < PINCH_THRESHOLD;
}

/**
 * Detect pointing gesture (index finger extended, others curled)
 * This is useful for hover/preview interactions
 */
function detectPointing(landmarks: any[]): boolean {
  if (landmarks.length < 13) return false;

  const indexTip = landmarks[8];
  const indexPip = landmarks[5];
  const middleTip = landmarks[12];
  const middlePip = landmarks[9];
  const ringTip = landmarks[16];
  const ringPip = landmarks[13];
  const pinkyTip = landmarks[20];
  const pinkyPip = landmarks[17];

  // Index finger extended (tip above PIP)
  const indexExtended = indexTip.y < indexPip.y;
  
  // Other fingers curled (tips below PIP)
  const middleCurl = middleTip.y > middlePip.y;
  const ringCurl = ringTip.y > ringPip.y;
  const pinkyCurl = pinkyTip.y > pinkyPip.y;

  return indexExtended && middleCurl && ringCurl && pinkyCurl;
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
  const lastGestureRef = useRef<'grab' | 'release' | 'pan' | 'pointing' | null>(null);

  const processResults = useCallback((results: any) => {
    let leftHand: HandPosition | null = null as HandPosition | null;
    let rightHand: HandPosition | null = null as HandPosition | null;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks: any[], index: number) => {
        const handedness = results.multiHandedness?.[index];
        const isRight = handedness?.label === 'Right';
        const wrist = landmarks[0];
        
        const isFist = detectFist(landmarks);
        const isOpen = detectOpenHand(landmarks);
        const isPinch = detectPinch(landmarks);
        const isPointing = detectPointing(landmarks);
        
        const handPos: HandPosition = {
          x: wrist.x, // Normalized 0-1
          y: wrist.y, // Normalized 0-1
          isFist,
          isOpen,
          isPinch,
          isPointing,
        };

        // Note: MediaPipe's handedness is relative to camera view, not user perspective.
        // For mirrored front-facing cameras, we swap left/right to match user's perspective.
        if (isRight) {
          leftHand = handPos;  // Swapped: MediaPipe's "Right" = user's left hand
        } else {
          rightHand = handPos;  // Swapped: MediaPipe's "Left" = user's right hand
        }
      });
    }

    // Determine gesture with pinch-based system
    // Priority: PINCH (grab) > TWO-HAND PINCH (pan) > POINTING > RELEASE > NONE
    let gesture: 'grab' | 'release' | 'pan' | 'pointing' | null = null;

    const leftIsPinch = leftHand?.isPinch ?? false;
    const rightIsPinch = rightHand?.isPinch ?? false;
    const leftIsPointing = leftHand?.isPointing ?? false;
    const rightIsPointing = rightHand?.isPointing ?? false;
    const leftIsOpen = leftHand?.isOpen ?? false;
    const rightIsOpen = rightHand?.isOpen ?? false;
    const wasGrabbing = lastGestureRef.current === 'grab';

    if (leftIsPinch && rightIsPinch && leftHand && rightHand) {
      // Both hands pinching = pan
      gesture = 'pan';
      const midX = ((leftHand.x + rightHand.x) / 2);
      const midY = ((leftHand.y + rightHand.y) / 2);
      
      if (lastMidpointRef.current) {
        lastMidpointRef.current = { x: midX, y: midY };
      } else {
        lastMidpointRef.current = { x: midX, y: midY };
      }
    } else if (leftIsPinch || rightIsPinch) {
      // Single hand pinch = grab
      gesture = 'grab';
    } else if (leftIsPointing || rightIsPointing) {
      // Pointing gesture = hover/preview
      gesture = 'pointing';
    } else if (wasGrabbing && (leftIsOpen || rightIsOpen || (!leftHand && !rightHand))) {
      // Release: was grabbing and now hand is open or gone
      gesture = 'release';
    } else if ((leftIsOpen && !rightHand) || (rightIsOpen && !leftHand)) {
      // Single open hand (no pinch, no pointing) = release
      gesture = 'release';
    } else {
      // No clear gesture
      gesture = null;
    }

    // Update last gesture for next frame
    lastGestureRef.current = gesture;

    setState({
      leftHand,
      rightHand,
      gesture,
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    // Dynamically import MediaPipe to avoid SSR issues
    Promise.resolve()
      .then(async () => {
        try {
          return await Promise.all([
            import('@mediapipe/hands'),
            import('@mediapipe/camera_utils'),
          ]);
        } catch (err) {
          console.error('Error during MediaPipe import:', err);
          return [null, null];
        }
      })
      .then(async (modules) => {
        if (!modules || !isMounted) return;
        const [handsModule, cameraModule] = modules;
        
        if (!handsModule || !cameraModule) {
          console.warn('MediaPipe modules failed to load. Hand tracking will be disabled.');
          return;
        }

        const { Hands } = handsModule;
        const { Camera } = cameraModule;

        try {
          const hands = new Hands({
            locateFile: (file: string) => {
              return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            },
          });

          hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          hands.onResults(processResults);
          handsRef.current = hands;
          
          // Store Camera class for later use
          (window as any).__MediaPipeCamera = Camera;
          
          // Mark MediaPipe as ready
          setTimeout(() => {
            (window as any).__MediaPipeReady = true;
          }, 1000);
          
          console.log('MediaPipe Hands initialized successfully');
        } catch (error: any) {
          console.error('Failed to initialize MediaPipe Hands:', error);
          handsRef.current = null;
        }
      })
      .catch((error) => {
        console.error('Failed to load MediaPipe:', error);
      });

    return () => {
      isMounted = false;
      
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
    if (typeof window === 'undefined') {
      return;
    }

    if (!handsRef.current) {
      console.warn('MediaPipe Hands not initialized. Hand tracking is disabled.');
      setIsActive(false);
      return;
    }

    try {
      // Check camera permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (permErr: any) {
        console.error('Camera permission denied:', permErr);
        setIsActive(false);
        return;
      }

      // Dynamically import Camera if not already available
      let Camera = (window as any).__MediaPipeCamera;
      if (!Camera) {
        const cameraModule = await import('@mediapipe/camera_utils');
        Camera = cameraModule.Camera;
      }

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
          
          // Prevent concurrent frame processing and ensure MediaPipe is ready
          if (isProcessingFrame || !handsRef.current || video.readyState !== video.HAVE_ENOUGH_DATA) {
            return;
          }
          
          // Check if MediaPipe is fully initialized (WASM loaded)
          if (!(window as any).__MediaPipeReady) {
            return;
          }
          
          // Check if MediaPipe is ready by verifying the instance exists and has necessary methods
          if (!handsRef.current || typeof handsRef.current.send !== 'function') {
            return;
          }
          
          // Don't send frame if video dimensions are invalid
          const videoWidth = video.videoWidth || 0;
          const videoHeight = video.videoHeight || 0;
          
          if (videoWidth === 0 || videoHeight === 0) {
            isProcessingFrame = false;
            return;
          }
          
          isProcessingFrame = true;
          try {
            await handsRef.current.send({ image: video });
          } catch (error: any) {
            console.error('Error sending frame to MediaPipe:', error);
          } finally {
            isProcessingFrame = false;
          }
        },
        width: 640,
        height: 480,
      });

      camera.start();
      cameraRef.current = camera;
      setIsActive(true);
    } catch (error: any) {
      console.error('Failed to start camera tracking:', error);
      setIsActive(false);
    }
  }, []);

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
