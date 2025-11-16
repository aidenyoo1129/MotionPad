import { useEffect, useRef, useState, useCallback } from 'react';

export interface VoiceCommand {
  type: string;
  payload?: any;
}

const COMMAND_PATTERNS: Array<{ pattern: RegExp; type: string; extractPayload?: (match: RegExpMatchArray) => any }> = [
  // Create commands - more flexible patterns
  { pattern: /create\s+(?:a\s+)?box/i, type: 'CREATE_BOX' },
  { pattern: /(?:make|add)\s+(?:a\s+)?box/i, type: 'CREATE_BOX' },
  { pattern: /create\s+(?:a\s+)?sticky\s+(?:note)?/i, type: 'CREATE_STICKY' },
  { pattern: /(?:make|add)\s+(?:a\s+)?sticky/i, type: 'CREATE_STICKY' },
  { pattern: /create\s+(?:a\s+)?circle/i, type: 'CREATE_CIRCLE' },
  { pattern: /(?:make|add)\s+(?:a\s+)?circle/i, type: 'CREATE_CIRCLE' },
  { pattern: /create\s+(?:an\s+)?arrow/i, type: 'CREATE_ARROW' },
  { pattern: /(?:make|add)\s+(?:an\s+)?arrow/i, type: 'CREATE_ARROW' },
  { pattern: /create\s+(?:a\s+)?text\s+box/i, type: 'CREATE_TEXTBOX' },
  { pattern: /(?:make|add)\s+(?:a\s+)?text\s+box/i, type: 'CREATE_TEXTBOX' },
  { pattern: /create\s+(?:a\s+)?textbox/i, type: 'CREATE_TEXTBOX' },
  
  // Delete and duplicate
  { pattern: /delete\s+(?:the\s+)?(?:object|item|selected)?/i, type: 'DELETE' },
  { pattern: /remove\s+(?:the\s+)?(?:object|item|selected)?/i, type: 'DELETE' },
  { pattern: /duplicate\s+(?:the\s+)?(?:object|item|selected)?/i, type: 'DUPLICATE' },
  { pattern: /copy\s+(?:the\s+)?(?:object|item|selected)?/i, type: 'DUPLICATE' },
  
  // Color change - more flexible
  { pattern: /change\s+color\s+to\s+(\w+)/i, type: 'COLOR', extractPayload: (match) => ({ color: match[1] }) },
  { pattern: /set\s+color\s+to\s+(\w+)/i, type: 'COLOR', extractPayload: (match) => ({ color: match[1] }) },
  { pattern: /color\s+(?:it\s+)?(\w+)/i, type: 'COLOR', extractPayload: (match) => ({ color: match[1] }) },
  { pattern: /make\s+it\s+(\w+)/i, type: 'COLOR', extractPayload: (match) => ({ color: match[1] }) },
  
  // Text - only explicit commands to avoid matching "create box" or other phrases
  { pattern: /add\s+text[:\s]+(.+)/i, type: 'TEXT', extractPayload: (match) => ({ text: match[1] }) },
  { pattern: /set\s+text[:\s]+(.+)/i, type: 'TEXT', extractPayload: (match) => ({ text: match[1] }) },
  { pattern: /enter\s+text[:\s]+(.+)/i, type: 'TEXT', extractPayload: (match) => ({ text: match[1] }) },
  { pattern: /type\s+text[:\s]+(.+)/i, type: 'TEXT', extractPayload: (match) => ({ text: match[1] }) },
  // Removed generic /text[:\s]+(.+)/i pattern to prevent false matches with "create box" etc.
  
  // Lock/unlock
  { pattern: /lock\s+(?:this|it|the\s+object)?/i, type: 'LOCK' },
  { pattern: /unlock\s+(?:this|it|the\s+object)?/i, type: 'UNLOCK' },
  
  // Undo/redo
  { pattern: /undo/i, type: 'UNDO' },
  { pattern: /redo/i, type: 'REDO' },
  
  // Zoom
  { pattern: /zoom\s+in/i, type: 'ZOOM_IN' },
  { pattern: /zoom\s+out/i, type: 'ZOOM_OUT' },
  { pattern: /reset\s+canvas/i, type: 'RESET_CANVAS' },
  { pattern: /reset\s+(?:the\s+)?view/i, type: 'RESET_CANVAS' },
];

export function useVoiceCommands(onCommand: (command: VoiceCommand) => void) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string>('');
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const shouldRestartRef = useRef<boolean>(true); // Track if we should auto-restart

  const normalizeText = useCallback((text: string): string => {
    return text.toLowerCase().trim();
  }, []);

  const parseCommand = useCallback((text: string): VoiceCommand | null => {
    const normalized = normalizeText(text);
    
    for (const { pattern, type, extractPayload } of COMMAND_PATTERNS) {
      const match = normalized.match(pattern);
      if (match) {
        const payload = extractPayload ? extractPayload(match) : undefined;
        return { type, payload };
      }
    }
    
    return null;
  }, [normalizeText]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setStatus('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('[Voice Debug] Recognition started');
      setIsListening(true);
      setStatus('Listening...');
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join(' ')
        .trim();

      console.log('[Voice Debug] Voice transcript received:', transcript);
      transcriptRef.current = transcript;
      const command = parseCommand(transcript);
      
      if (command) {
        console.log('[Voice Debug] Command recognized:', command);
        setStatus(`Command: ${command.type}`);
        onCommand(command);
        // Clear transcript after processing
        transcriptRef.current = '';
        // Reset status to "Listening..." after showing the command
        setTimeout(() => {
          if (isListening || shouldRestartRef.current) {
            setStatus('Listening...');
          }
        }, 1500);
        // Note: Recognition will continue automatically due to continuous: true
        // and onend handler will restart if needed
      } else {
        console.log('[Voice Debug] No command matched for:', transcript);
        setStatus(`Heard: "${transcript}"`);
        // Keep listening - status will reset to "Listening..." after a moment
        setTimeout(() => {
          if (isListening || shouldRestartRef.current) {
            setStatus('Listening...');
          }
        }, 2000);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        setStatus('No speech detected');
      } else if (event.error === 'not-allowed') {
        setStatus('Microphone permission denied. Click to enable.');
        setIsListening(false);
      } else if (event.error === 'aborted') {
        // Recognition was stopped, don't show error
        return;
      } else {
        setStatus(`Error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log('[Voice Debug] Recognition ended. Should restart:', shouldRestartRef.current);
      
      setIsListening(false);
      
      // Only show "Stopped" if we're not going to restart
      if (!shouldRestartRef.current) {
        setStatus('Stopped');
        return;
      }
      
      // Restart automatically if we should
      // Add a small delay to avoid rapid restart loops
      setTimeout(() => {
        if (recognitionRef.current && shouldRestartRef.current) {
          try {
            console.log('[Voice Debug] Auto-restarting recognition...');
            recognitionRef.current.start();
            setStatus('Restarting...');
          } catch (e: any) {
            console.log('[Voice Debug] Restart failed:', e.message);
            // If it says "already started", that's fine - it will trigger onstart
            if (e.message?.includes('already started')) {
              // Already starting, that's fine
              return;
            }
            // Other error - stop auto-restarting
            shouldRestartRef.current = false;
            setStatus('Stopped - Click to restart');
          }
        }
      }, 100);
    };

    recognitionRef.current = recognition;

    // Auto-start after a short delay to ensure everything is ready
    // Note: Some browsers require user interaction before allowing microphone access
    const autoStartTimer = setTimeout(async () => {
      if (recognitionRef.current) {
        try {
          // Try to get permission first
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
          } catch (permErr) {
            // Permission denied or not available - user will need to click button
            setStatus('Click to enable microphone');
            return;
          }
          
          // Permission granted, start recognition
          recognitionRef.current.start();
        } catch (e: any) {
          console.log('Auto-start failed:', e.message);
          setStatus('Click to start listening');
        }
      }
    }, 500);

    return () => {
      clearTimeout(autoStartTimer);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [onCommand, parseCommand]);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) {
      setStatus('Recognition not initialized');
      return;
    }

    // Enable auto-restart when manually starting
    shouldRestartRef.current = true;

    // DIAGNOSTIC: Check browser API availability
    console.log('[Microphone Debug] Checking browser API availability...');
    console.log('[Microphone Debug] navigator.mediaDevices exists:', !!navigator.mediaDevices);
    console.log('[Microphone Debug] navigator.mediaDevices.getUserMedia exists:', !!navigator.mediaDevices?.getUserMedia);
    console.log('[Microphone Debug] navigator.mediaDevices.enumerateDevices exists:', !!navigator.mediaDevices?.enumerateDevices);
    
    // Check if mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('[Microphone Debug] MediaDevices API not available');
      setStatus('Microphone API not available in this browser');
      return;
    }

    // DIAGNOSTIC: Check permission state
    console.log('[Microphone Debug] Checking permission state...');
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('[Microphone Debug] Microphone permission state:', {
        state: permissionStatus.state,
        onchange: typeof permissionStatus.onchange,
      });
      permissionStatus.onchange = () => {
        console.log('[Microphone Debug] Permission state changed to:', permissionStatus.state);
      };
    } catch (err) {
      console.warn('[Microphone Debug] Could not check permission state (API may not be supported):', err);
    }

    // DIAGNOSTIC: Check device enumeration BEFORE permission (baseline)
    console.log('[Microphone Debug] Enumerating devices BEFORE permission request...');
    try {
      const devicesBefore = await navigator.mediaDevices.enumerateDevices();
      const audioDevicesBefore = devicesBefore.filter(device => device.kind === 'audioinput');
      console.log('[Microphone Debug] Devices BEFORE permission:', {
        totalDevices: devicesBefore.length,
        audioInputDevices: audioDevicesBefore.length,
        audioDevices: audioDevicesBefore.map(d => ({
          deviceId: d.deviceId,
          label: d.label || '(no label - permission required)',
          kind: d.kind,
          groupId: d.groupId,
        })),
      });
    } catch (err) {
      console.warn('[Microphone Debug] Could not enumerate devices before permission:', err);
    }

    // Request microphone permission first (this will also detect if a mic exists)
    // On some systems, you need permission before devices are visible
    let stream: MediaStream | null = null;
    try {
      console.log('[Microphone Debug] Requesting microphone access with getUserMedia...');
      setStatus('Requesting microphone access...');
      
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      // Permission granted and mic is working!
      console.log('[Microphone Debug] getUserMedia SUCCESS - Permission granted and device found');
      console.log('[Microphone Debug] Stream details:', {
        id: stream.id,
        active: stream.active,
        tracks: stream.getTracks().map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
      });
      
      // DIAGNOSTIC: Check what devices we have access to AFTER permission
      console.log('[Microphone Debug] Enumerating devices AFTER permission...');
      try {
        const devicesAfter = await navigator.mediaDevices.enumerateDevices();
        const audioDevicesAfter = devicesAfter.filter(device => device.kind === 'audioinput');
        console.log('[Microphone Debug] Devices AFTER permission:', {
          totalDevices: devicesAfter.length,
          audioInputDevices: audioDevicesAfter.length,
          audioDevices: audioDevicesAfter.map(d => ({
            deviceId: d.deviceId,
            label: d.label,
            kind: d.kind,
          })),
        });
      } catch (err) {
        console.warn('[Microphone Debug] Could not enumerate devices after permission:', err);
      }
      
      // Stop the stream (we just needed permission and to verify the mic works)
      stream.getTracks().forEach(track => {
        console.log('[Microphone Debug] Stopping track:', track.label);
        track.stop();
      });
      stream = null;
      
    } catch (err: any) {
      console.error('[Microphone Debug] getUserMedia FAILED:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        constraint: err.constraint,
        error: err,
      });
      
      // Clean up stream if it was partially created
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // DIAGNOSTIC: Detailed error analysis
      console.log('[Microphone Debug] Error analysis:', {
        isNotAllowedError: err.name === 'NotAllowedError',
        isPermissionDeniedError: err.name === 'PermissionDeniedError',
        isNotFoundError: err.name === 'NotFoundError',
        isDevicesNotFoundError: err.name === 'DevicesNotFoundError',
        isNotReadableError: err.name === 'NotReadableError',
        isTrackStartError: err.name === 'TrackStartError',
        isOverconstrainedError: err.name === 'OverconstrainedError',
        errorName: err.name,
        errorMessage: err.message,
      });
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('Microphone permission denied. Please allow access and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        // DIAGNOSTIC: Before showing "not found", try multiple approaches
        console.log('[Microphone Debug] NotFoundError - trying alternative approaches...');
        
        // Try 1: Simple audio constraint
        console.log('[Microphone Debug] Attempt 1: Simple { audio: true }...');
        try {
          const simpleStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('[Microphone Debug] SUCCESS with simple audio constraint!');
          simpleStream.getTracks().forEach(track => track.stop());
          setStatus('Microphone found but constraints failed. Retrying...');
          // Retry with the original constraints
          return;
        } catch (simpleErr: any) {
          console.error('[Microphone Debug] Simple constraint failed:', {
            name: simpleErr.name,
            message: simpleErr.message,
          });
        }
        
        // Try 2: Check if devices exist but need different approach
        console.log('[Microphone Debug] Attempt 2: Checking all available devices...');
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const allAudio = allDevices.filter(d => d.kind === 'audioinput');
          console.log('[Microphone Debug] All audio input devices:', allAudio);
          
          if (allAudio.length > 0) {
            // Try with specific deviceId
            console.log('[Microphone Debug] Attempt 3: Trying with specific deviceId...');
            try {
              const deviceStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: allAudio[0].deviceId } }
              });
              console.log('[Microphone Debug] SUCCESS with specific deviceId!');
              deviceStream.getTracks().forEach(track => track.stop());
              setStatus('Microphone found with device selection. Retrying...');
              return;
            } catch (deviceErr: any) {
              console.error('[Microphone Debug] Specific deviceId failed:', deviceErr);
            }
          }
        } catch (enumErr) {
          console.error('[Microphone Debug] Could not enumerate for retry:', enumErr);
        }
        
        // Try 3: Check browser-specific issues
        console.log('[Microphone Debug] Attempt 4: Browser compatibility check...');
        const userAgent = navigator.userAgent;
        const isChrome = userAgent.includes('Chrome');
        const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
        const isFirefox = userAgent.includes('Firefox');
        const isHTTPS = window.location.protocol === 'https:';
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        console.log('[Microphone Debug] Browser info:', {
          userAgent,
          isChrome,
          isSafari,
          isFirefox,
          isHTTPS,
          isLocalhost,
        });
        
        // Final error message with helpful guidance
        let errorGuidance = 'No microphone found. ';
        if (!isHTTPS && !isLocalhost) {
          errorGuidance += 'Note: Microphone access requires HTTPS (or localhost). ';
        }
        if (isSafari) {
          errorGuidance += 'Safari may require explicit permission in Safari Settings > Websites > Microphone. ';
        }
        errorGuidance += 'Please check: 1) System microphone settings, 2) Browser permissions, 3) That a microphone is connected.';
        
        // Check permission state one more time for final diagnosis
        let finalPermissionState = 'unknown';
        try {
          const finalPermCheck = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          finalPermissionState = finalPermCheck.state;
          console.log('[Microphone Debug] Final permission state:', finalPermissionState);
        } catch (permErr) {
          console.warn('[Microphone Debug] Could not check final permission state:', permErr);
        }
        
        setStatus(errorGuidance);
        console.error('[Microphone Debug] All attempts failed. Final diagnosis:', {
          originalError: err,
          browser: { isChrome, isSafari, isFirefox },
          isHTTPS,
          isLocalhost,
          finalPermissionState,
        });
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setStatus('Microphone is being used by another application.');
      } else if (err.name === 'OverconstrainedError') {
        setStatus('Microphone does not support required settings.');
      } else {
        setStatus(`Microphone error: ${err.message || err.name || 'Unknown error'}`);
      }
      return;
    }

    // Now start speech recognition
    try {
      recognitionRef.current.start();
      setStatus('Starting...');
      console.log('Speech recognition started');
    } catch (e: any) {
      console.error('Failed to start recognition:', e);
      const errorMsg = e.message || String(e);
      if (errorMsg.includes('already started') || errorMsg.includes('started')) {
        // Already running, that's fine
        setStatus('Already listening...');
        return;
      }
      setStatus(`Recognition error: ${errorMsg}`);
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false; // Disable auto-restart when manually stopping
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setStatus('Stopped');
    }
  }, [isListening]);

  return {
    isListening,
    status,
    startListening,
    stopListening,
  };
}


