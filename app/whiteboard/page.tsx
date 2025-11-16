'use client';

import { useReducer, useEffect, useCallback, useState } from 'react';
import { canvasReducer, findNearestObjectAt } from '@/lib/whiteboard-reducer';
import { CanvasState, CanvasAction, ObjectType } from '@/lib/whiteboard-types';
import { useVoiceCommands, VoiceCommand } from '@/hooks/useVoiceCommands';
import { useHandTracking } from '@/hooks/useHandTracking';
import { WhiteboardCanvas } from '@/components/WhiteboardCanvas';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const initialState: CanvasState = {
  objects: [],
  selectedId: null,
  panX: 0,
  panY: 0,
  zoom: 1,
  history: [[]],
  historyIndex: 0,
  snapGuides: [],
};

export default function WhiteboardPage() {
  const [state, dispatch] = useReducer(canvasReducer, initialState);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get hand positions for canvas interaction
  const handTracking = useHandTracking();

  // Handle voice commands
  const handleVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      console.log('Executing command:', command); // Debug log
      
      // Convert screen center to canvas coordinates
      const screenX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
      const screenY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
      
      // Account for pan and zoom to get canvas coordinates
      const canvasX = (screenX - state.panX) / state.zoom;
      const canvasY = (screenY - state.panY) / state.zoom;

      switch (command.type) {
        case 'CREATE_BOX':
          dispatch({ type: 'CREATE', payload: { objectType: 'box', x: canvasX, y: canvasY } });
          dispatch({ type: 'SAVE_SNAPSHOT' });
          break;

        case 'CREATE_STICKY':
          dispatch({ type: 'CREATE', payload: { objectType: 'sticky', x: canvasX, y: canvasY } });
          dispatch({ type: 'SAVE_SNAPSHOT' });
          break;

        case 'CREATE_CIRCLE':
          dispatch({ type: 'CREATE', payload: { objectType: 'circle', x: canvasX, y: canvasY } });
          dispatch({ type: 'SAVE_SNAPSHOT' });
          break;

        case 'CREATE_ARROW':
          dispatch({ type: 'CREATE', payload: { objectType: 'arrow', x: canvasX, y: canvasY } });
          dispatch({ type: 'SAVE_SNAPSHOT' });
          break;

        case 'CREATE_TEXTBOX':
          dispatch({ type: 'CREATE', payload: { objectType: 'textbox', x: canvasX, y: canvasY } });
          dispatch({ type: 'SAVE_SNAPSHOT' });
          break;

        case 'DELETE':
          if (state.selectedId) {
            dispatch({ type: 'DELETE', payload: { id: state.selectedId } });
            dispatch({ type: 'SAVE_SNAPSHOT' });
          }
          break;

        case 'DUPLICATE':
          if (state.selectedId) {
            dispatch({ type: 'DUPLICATE', payload: { id: state.selectedId } });
            dispatch({ type: 'SAVE_SNAPSHOT' });
          }
          break;

        case 'COLOR':
          if (state.selectedId && command.payload?.color) {
            const colorMap: Record<string, string> = {
              red: '#ef4444',
              blue: '#3b82f6',
              green: '#10b981',
              yellow: '#fbbf24',
              purple: '#8b5cf6',
              orange: '#f97316',
              pink: '#ec4899',
              black: '#000000',
              white: '#ffffff',
            };
            const color = colorMap[command.payload.color.toLowerCase()] || command.payload.color;
            dispatch({ type: 'COLOR', payload: { id: state.selectedId, color } });
            dispatch({ type: 'SAVE_SNAPSHOT' });
          }
          break;

        case 'TEXT':
          if (state.selectedId && command.payload?.text) {
            dispatch({ type: 'TEXT', payload: { id: state.selectedId, text: command.payload.text } });
            dispatch({ type: 'SAVE_SNAPSHOT' });
          }
          break;

        case 'LOCK':
          if (state.selectedId) {
            dispatch({ type: 'LOCK', payload: { id: state.selectedId } });
            dispatch({ type: 'SAVE_SNAPSHOT' });
          }
          break;

        case 'UNLOCK':
          if (state.selectedId) {
            dispatch({ type: 'UNLOCK', payload: { id: state.selectedId } });
            dispatch({ type: 'SAVE_SNAPSHOT' });
          }
          break;

        case 'UNDO':
          dispatch({ type: 'UNDO' });
          break;

        case 'REDO':
          dispatch({ type: 'REDO' });
          break;

        case 'ZOOM_IN':
          dispatch({ type: 'ZOOM', payload: { delta: 0.1 } });
          break;

        case 'ZOOM_OUT':
          dispatch({ type: 'ZOOM', payload: { delta: -0.1 } });
          break;

        case 'RESET_CANVAS':
          dispatch({ type: 'RESET_CANVAS' });
          break;

        default:
          console.warn('Unknown command type:', command.type);
          break;
      }
    },
    [state.selectedId, state.panX, state.panY, state.zoom]
  );

  const voiceCommands = useVoiceCommands(handleVoiceCommand);

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized && typeof window !== 'undefined') {
      console.log('[Whiteboard Debug] Initializing whiteboard...');
      console.log('[Whiteboard Debug] Hand tracking state:', {
        isActive: handTracking.isActive,
        hasLeftHand: !!handTracking.leftHand,
        hasRightHand: !!handTracking.rightHand,
        gesture: handTracking.gesture,
      });
      
      // Voice commands will auto-start (or show button if browser requires user interaction)
      // Delay hand tracking start to ensure MediaPipe is loaded (if available)
      setTimeout(() => {
        console.log('[Whiteboard Debug] Attempting to start hand tracking...');
        try {
          handTracking.startTracking();
          console.log('[Whiteboard Debug] Hand tracking start called');
        } catch (err) {
          console.warn('[Whiteboard Debug] Hand tracking not available:', err);
          // Continue without hand tracking
        }
      }, 1000); // Increased delay to allow MediaPipe to initialize
      setIsInitialized(true);
    }
  }, [isInitialized, handTracking]);

  // Handle canvas interactions
  const handleSelect = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT', payload: { id } });
  }, []);

  const handleMove = useCallback((id: string, x: number, y: number) => {
    dispatch({ type: 'MOVE', payload: { id, x, y } });
  }, []);

  // Save snapshot and clear snap guides when gesture releases (after moving an object)
  useEffect(() => {
    if (handTracking.gesture === 'release' && state.selectedId) {
      dispatch({ type: 'SAVE_SNAPSHOT' });
      dispatch({ type: 'CLEAR_SNAP_GUIDES' });
    }
  }, [handTracking.gesture, state.selectedId]);

  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    dispatch({ type: 'PAN', payload: { deltaX, deltaY } });
  }, []);

  // Panning is handled in WhiteboardCanvas component via gesture prop

  return (
    <ErrorBoundary>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          overflow: 'hidden',
        }}
      >
      <WhiteboardCanvas
        state={state}
        onSelect={handleSelect}
        onMove={handleMove}
        onPan={handlePan}
        leftHand={handTracking.leftHand}
        rightHand={handTracking.rightHand}
        gesture={handTracking.gesture}
      />

      {/* Status Overlays */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: 'monospace',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <strong>Voice:</strong> {voiceCommands.status}
          {!voiceCommands.isListening && voiceCommands.status !== 'Listening...' && (
            <>
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Button clicked, starting voice recognition...');
                  try {
                    await voiceCommands.startListening();
                    console.log('Voice recognition started successfully');
                  } catch (error) {
                    console.error('Failed to start listening:', error);
                  }
                }}
                style={{
                  padding: '4px 12px',
                  backgroundColor: voiceCommands.status.includes('permission') || voiceCommands.status.includes('denied') || voiceCommands.status.includes('not found')
                    ? '#ef4444' 
                    : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                {voiceCommands.status.includes('permission') || voiceCommands.status.includes('denied')
                  ? 'Enable Microphone'
                  : voiceCommands.status.includes('not found')
                  ? 'Retry'
                  : 'Start Listening'}
              </button>
              {voiceCommands.status.includes('not found') && (
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Try to reset permissions by opening settings
                    console.log('Attempting to reset microphone permissions...');
                    try {
                      // For Chrome/Edge: Try to open site settings
                      if (navigator.userAgent.includes('Chrome')) {
                        alert('To fix microphone access:\n\n1. Click the lock/info icon in the address bar\n2. Set Microphone to "Allow"\n3. Refresh the page\n4. Click "Start Listening" again');
                      } else if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
                        alert('To fix microphone access in Safari:\n\n1. Go to Safari > Settings > Websites > Microphone\n2. Find localhost and set to "Allow"\n3. Refresh the page\n4. Click "Start Listening" again');
                      } else {
                        alert('To fix microphone access:\n\n1. Check browser settings for microphone permissions\n2. Ensure localhost is allowed\n3. Refresh the page\n4. Click "Start Listening" again');
                      }
                    } catch (err) {
                      console.error('Error showing help:', err);
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                  title="Get help fixing microphone access"
                >
                  Help
                </button>
              )}
            </>
          )}
        </div>
        <div>
          <strong>Gesture:</strong> {handTracking.gesture || 'None'}
          {!handTracking.isActive && (
            <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px' }}>
              (Tracking: {handTracking.isActive ? 'Active' : 'Inactive'})
            </span>
          )}
          {(handTracking.leftHand || handTracking.rightHand) && (
            <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px' }}>
              ({handTracking.leftHand ? 'L' : ''}{handTracking.leftHand && handTracking.rightHand ? '/' : ''}{handTracking.rightHand ? 'R' : ''})
            </span>
          )}
        </div>
        {state.selectedId && (
          <div>
            <strong>Selected:</strong> {state.selectedId.slice(0, 8)}...
          </div>
        )}
        {(handTracking.leftHand || handTracking.rightHand) && (
          <div>
            <strong>Hands:</strong>{' '}
            {handTracking.leftHand && 'L'}
            {handTracking.leftHand && handTracking.rightHand && '/'}
            {handTracking.rightHand && 'R'}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '12px',
          maxWidth: '300px',
          zIndex: 1000,
        }}
      >
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Voice Commands:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div>• &quot;Create box&quot; / &quot;Create sticky note&quot;</div>
          <div>• &quot;Create circle&quot; / &quot;Create arrow&quot;</div>
          <div>• &quot;Delete object&quot; / &quot;Duplicate object&quot;</div>
          <div>• &quot;Change color to [color]&quot;</div>
          <div>• &quot;Add text: [content]&quot;</div>
          <div>• &quot;Lock this&quot; / &quot;Unlock this&quot;</div>
          <div>• &quot;Zoom in&quot; / &quot;Zoom out&quot;</div>
          <div>• &quot;Undo&quot; / &quot;Redo&quot;</div>
        </div>
        <div style={{ marginTop: '12px', fontWeight: 'bold' }}>Gestures:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div>• Closed fist = grab object</div>
          <div>• Open hand = release</div>
          <div>• Two open hands = pan canvas</div>
        </div>
      </div>
      </div>
    </ErrorBoundary>
  );
}

