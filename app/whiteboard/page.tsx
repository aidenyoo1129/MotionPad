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

  // State change monitoring (silent)
  useEffect(() => {
    // State monitoring without console output
  }, [state]);

  // Get hand positions for canvas interaction
  const handTracking = useHandTracking();

  // Handle voice commands
  const handleVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      
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
              blue: '#6596F3',
              red: '#F24E1E',
              yellow: '#EAD094',
              green: '#83B366',
              orange: '#F25016',
              purple: '#D3A4EA',
              pink: '#FF7262',
              black: '#000000',
              white: '#FFFFFF',
              gray: '#A0A0A0',
              grey: '#A0A0A0',
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
          // Unknown command type - silently ignore
          break;
      }
    },
    [state.selectedId, state.panX, state.panY, state.zoom]
  );

  const voiceCommands = useVoiceCommands(handleVoiceCommand);

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized && typeof window !== 'undefined') {
      // Voice commands will auto-start (or show button if browser requires user interaction)
      // Delay hand tracking start to ensure MediaPipe is loaded (if available)
      setTimeout(() => {
        try {
          handTracking.startTracking();
        } catch (err) {
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
          backgroundColor: '#f2f2f7',
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

      {/* Status Overlays - Apple Style Glass Panel */}
      <div
        className="glass"
        style={{
          position: 'fixed',
          top: '24px',
          left: '24px',
          color: '#000',
          padding: '16px 20px',
          borderRadius: '16px',
          fontSize: '13px',
          fontWeight: 500,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minWidth: '200px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: '#8e8e93' }}>Voice</span>
            <span style={{ color: '#000' }}>{voiceCommands.status}</span>
          </div>
          {!voiceCommands.isListening && voiceCommands.status !== 'Listening...' && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    await voiceCommands.startListening();
                  } catch (error) {
                    // Failed to start listening
                  }
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: voiceCommands.status.includes('permission') || voiceCommands.status.includes('denied') || voiceCommands.status.includes('not found')
                    ? '#ff3b30' 
                    : '#007aff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.98)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
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
                    try {
                      if (navigator.userAgent.includes('Chrome')) {
                        alert('To fix microphone access:\n\n1. Click the lock/info icon in the address bar\n2. Set Microphone to "Allow"\n3. Refresh the page\n4. Click "Start Listening" again');
                      } else if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
                        alert('To fix microphone access in Safari:\n\n1. Go to Safari > Settings > Websites > Microphone\n2. Find localhost and set to "Allow"\n3. Refresh the page\n4. Click "Start Listening" again');
                      } else {
                        alert('To fix microphone access:\n\n1. Check browser settings for microphone permissions\n2. Ensure localhost is allowed\n3. Refresh the page\n4. Click "Start Listening" again');
                      }
                    } catch (err) {
                      // Error showing help
                    }
                  }}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: 'rgba(142, 142, 147, 0.2)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(142, 142, 147, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(142, 142, 147, 0.2)';
                  }}
                  title="Get help fixing microphone access"
                >
                  Help
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 600, color: '#8e8e93' }}>Gesture</span>
          <span style={{ 
            color: '#000',
            padding: '4px 10px',
            backgroundColor: handTracking.gesture ? 'rgba(0, 122, 255, 0.1)' : 'rgba(142, 142, 147, 0.1)',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            {handTracking.gesture || 'None'}
          </span>
          {!handTracking.isActive && (
            <span style={{ fontSize: '11px', color: '#8e8e93', marginLeft: '4px' }}>
              (Inactive)
            </span>
          )}
        </div>
        {state.selectedId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 600, color: '#8e8e93' }}>Selected</span>
            <span style={{ color: '#000', fontFamily: 'monospace', fontSize: '11px' }}>
              {state.selectedId.slice(0, 8)}...
            </span>
          </div>
        )}
        {(handTracking.leftHand || handTracking.rightHand) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 600, color: '#8e8e93' }}>Hands</span>
            <span style={{ color: '#000' }}>
              {handTracking.leftHand && 'L'}
              {handTracking.leftHand && handTracking.rightHand && '/'}
              {handTracking.rightHand && 'R'}
            </span>
          </div>
        )}
      </div>

      {/* Instructions - Apple Style Glass Panel */}
      <div
        className="glass"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          color: '#000',
          padding: '20px',
          borderRadius: '16px',
          fontSize: '12px',
          maxWidth: '320px',
          zIndex: 1000,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ marginBottom: '16px', fontWeight: 600, fontSize: '14px', color: '#000' }}>
          Voice Commands
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • &quot;Create box&quot; / &quot;Create sticky note&quot;
          </div>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • &quot;Create circle&quot; / &quot;Create arrow&quot;
          </div>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • &quot;Delete object&quot; / &quot;Duplicate object&quot;
          </div>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • &quot;Change color to [color]&quot;
          </div>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • &quot;Add text: [content]&quot;
          </div>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • &quot;Lock this&quot; / &quot;Unlock this&quot;
          </div>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • &quot;Zoom in&quot; / &quot;Zoom out&quot;
          </div>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • &quot;Undo&quot; / &quot;Redo&quot;
          </div>
        </div>
        <div style={{ marginTop: '16px', marginBottom: '12px', fontWeight: 600, fontSize: '14px', color: '#000' }}>
          Gestures
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • Pinch (thumb + index) = grab & move object
          </div>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • Point (index extended) = hover/select
          </div>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • Two-hand pinch = pan canvas
          </div>
          <div style={{ color: '#3a3a3c', lineHeight: '1.5' }}>
            • Open hand = release
          </div>
        </div>
      </div>
      </div>
    </ErrorBoundary>
  );
}

