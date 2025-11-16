'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { CanvasObject, CanvasState } from '@/lib/whiteboard-types';
import { findNearestObjectAt } from '@/lib/whiteboard-reducer';

interface WhiteboardCanvasProps {
  state: CanvasState;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onPan: (deltaX: number, deltaY: number) => void;
  leftHand?: { x: number; y: number } | null;
  rightHand?: { x: number; y: number } | null;
  gesture?: 'grab' | 'release' | 'pan' | null;
}

export function WhiteboardCanvas({
  state,
  onSelect,
  onMove,
  onPan,
  leftHand,
  rightHand,
  gesture,
}: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragObjectRef = useRef<string | null>(null);
  const lastHandPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastPanMidpointRef = useRef<{ x: number; y: number } | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  
  // Get active hand for single-hand gestures
  const activeHand = leftHand || rightHand;
  
  // Calculate hand position on screen for visual feedback
  const handScreenPos = activeHand && canvasRef.current
    ? (() => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return {
          x: activeHand.x * rect.width,
          y: activeHand.y * rect.height,
        };
      })()
    : null;

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 };

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (screenX - rect.left - state.panX) / state.zoom;
      const y = (screenY - rect.top - state.panY) / state.zoom;

      return { x, y };
    },
    [state.panX, state.panY, state.zoom]
  );

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number): { x: number; y: number } => {
      return {
        x: canvasX * state.zoom + state.panX,
        y: canvasY * state.zoom + state.panY,
      };
    },
    [state.panX, state.panY, state.zoom]
  );

  // Handle hand gesture interactions
  useEffect(() => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();

    // Handle panning with two hands
    if (gesture === 'pan' && leftHand && rightHand) {
      const PAN_SENSITIVITY = 1.5; // Adjust panning sensitivity
      
      const midX = ((leftHand.x + rightHand.x) / 2) * rect.width;
      const midY = ((leftHand.y + rightHand.y) / 2) * rect.height;

      if (lastPanMidpointRef.current) {
        const deltaX = (midX - lastPanMidpointRef.current.x) * PAN_SENSITIVITY;
        const deltaY = (midY - lastPanMidpointRef.current.y) * PAN_SENSITIVITY;
        onPan(deltaX, deltaY);
      }

      lastPanMidpointRef.current = { x: midX, y: midY };
      return;
    } else {
      lastPanMidpointRef.current = null;
    }

    // Handle single-hand gestures (grab/release/move)
    if (!activeHand) {
      setHoveredObjectId(null);
      return;
    }

    const screenX = activeHand.x * rect.width;
    const screenY = activeHand.y * rect.height;
    const canvasPos = screenToCanvas(screenX, screenY);

    // Find nearest object for proximity feedback (even when not grabbing)
    const nearest = findNearestObjectAt(state.objects, canvasPos.x, canvasPos.y, 80);
    if (nearest && !nearest.locked && gesture !== 'grab' && !isDraggingRef.current) {
      setHoveredObjectId(nearest.id);
    } else if (!nearest || gesture === 'grab' || isDraggingRef.current) {
      setHoveredObjectId(null);
    }

    if (gesture === 'grab' && !isDraggingRef.current) {
      // Find nearest object
      if (nearest && !nearest.locked) {
        isDraggingRef.current = true;
        dragObjectRef.current = nearest.id;
        setHoveredObjectId(nearest.id);
        onSelect(nearest.id);
        lastHandPosRef.current = canvasPos;
      }
    } else if (gesture === 'release') {
      if (isDraggingRef.current && dragObjectRef.current) {
        isDraggingRef.current = false;
        dragObjectRef.current = null;
        lastHandPosRef.current = null;
        setHoveredObjectId(null);
      }
    } else if (isDraggingRef.current && dragObjectRef.current && lastHandPosRef.current) {
      // Move object with sensitivity multiplier for easier control
      const SENSITIVITY = 2.5; // Increase this to make movements more responsive (try 2-4)
      
      // Calculate movement in screen space first for more intuitive control
      const currentScreenX = activeHand.x * rect.width;
      const currentScreenY = activeHand.y * rect.height;
      
      // Convert last canvas position to screen coordinates
      const lastScreenX = lastHandPosRef.current.x * state.zoom + state.panX;
      const lastScreenY = lastHandPosRef.current.y * state.zoom + state.panY;
      
      // Calculate delta in screen space and apply sensitivity
      const screenDeltaX = (currentScreenX - lastScreenX) * SENSITIVITY;
      const screenDeltaY = (currentScreenY - lastScreenY) * SENSITIVITY;
      
      // Convert screen delta to canvas delta
      const canvasDeltaX = screenDeltaX / state.zoom;
      const canvasDeltaY = screenDeltaY / state.zoom;
      
      const obj = state.objects.find((o) => o.id === dragObjectRef.current);
      if (obj) {
        onMove(dragObjectRef.current, obj.x + canvasDeltaX, obj.y + canvasDeltaY);
      }
      
      // Update last position in canvas coordinates
      lastHandPosRef.current = canvasPos;
    }
  }, [leftHand, rightHand, activeHand, gesture, state.objects, state.zoom, onSelect, onMove, onPan, screenToCanvas]);

  const renderObject = (obj: CanvasObject) => {
    const isSelected = obj.id === state.selectedId;
    const isHovered = obj.id === hoveredObjectId;
    const isDragging = obj.id === dragObjectRef.current && isDraggingRef.current;
    
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${obj.x}px`,
      top: `${obj.y}px`,
      width: `${obj.width}px`,
      height: `${obj.height}px`,
      backgroundColor: obj.color,
      border: isSelected 
        ? '4px solid #60a5fa' 
        : isHovered 
        ? '3px solid #93c5fd' 
        : '2px solid rgba(0,0,0,0.2)',
      borderRadius: obj.type === 'circle' ? '50%' : obj.type === 'sticky' ? '4px' : '2px',
      boxShadow: isDragging
        ? '0 0 20px rgba(96,165,250,0.8), 0 0 40px rgba(96,165,250,0.4)'
        : isSelected
        ? '0 0 15px rgba(96,165,250,0.6), 0 0 30px rgba(96,165,250,0.3)'
        : isHovered
        ? '0 0 10px rgba(147,197,253,0.5)'
        : '0 2px 4px rgba(0,0,0,0.1)',
      cursor: obj.locked ? 'not-allowed' : 'move',
      opacity: obj.locked ? 0.6 : isDragging ? 0.9 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: obj.type === 'textbox' || obj.type === 'sticky' ? '8px' : '0',
      fontSize: '14px',
      color: '#000',
      wordWrap: 'break-word',
      overflow: 'hidden',
      transform: isDragging ? 'scale(1.05)' : 'scale(1)',
      transition: isDragging ? 'none' : 'transform 0.1s ease, box-shadow 0.2s ease, border 0.2s ease',
      zIndex: isDragging ? 1000 : isSelected ? 100 : isHovered ? 50 : 1,
    };

    switch (obj.type) {
      case 'box':
        return (
          <div key={obj.id} style={style}>
            {obj.text}
          </div>
        );

      case 'sticky':
        return (
          <div key={obj.id} style={style}>
            {obj.text || 'Sticky Note'}
          </div>
        );

      case 'circle':
        return (
          <div key={obj.id} style={style}>
            {obj.text}
          </div>
        );

      case 'arrow':
        return (
          <div
            key={obj.id}
            style={{
              ...style,
              backgroundColor: 'transparent',
              border: 'none',
              width: `${obj.width}px`,
              height: `${obj.height}px`,
            }}
          >
            <svg
              width={obj.width}
              height={obj.height}
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              <defs>
                <marker
                  id={`arrowhead-${obj.id}`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill={obj.color} />
                </marker>
              </defs>
              <line
                x1="0"
                y1={obj.height / 2}
                x2={obj.width}
                y2={obj.height / 2}
                stroke={obj.color}
                strokeWidth="3"
                markerEnd={`url(#arrowhead-${obj.id})`}
              />
            </svg>
            {obj.text && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                {obj.text}
              </div>
            )}
          </div>
        );

      case 'textbox':
        return (
          <div key={obj.id} style={style}>
            {obj.text || 'Text'}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
        `,
        backgroundSize: `${10 * state.zoom}px ${10 * state.zoom}px`,
        backgroundPosition: `${state.panX % (10 * state.zoom)}px ${state.panY % (10 * state.zoom)}px`,
      }}
    >
      <div
        style={{
          transform: `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`,
          transformOrigin: '0 0',
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        {state.objects.map(renderObject)}
      </div>
      
      {/* Hand position indicator */}
      {handScreenPos && (
        <div
          style={{
            position: 'absolute',
            left: `${handScreenPos.x}px`,
            top: `${handScreenPos.y}px`,
            transform: 'translate(-50%, -50%)',
            width: gesture === 'grab' ? '40px' : '30px',
            height: gesture === 'grab' ? '40px' : '30px',
            borderRadius: '50%',
            border: gesture === 'grab' 
              ? '3px solid #ef4444' 
              : gesture === 'pan'
              ? '3px solid #3b82f6'
              : '2px solid #10b981',
            backgroundColor: gesture === 'grab'
              ? 'rgba(239, 68, 68, 0.2)'
              : gesture === 'pan'
              ? 'rgba(59, 130, 246, 0.2)'
              : 'rgba(16, 185, 129, 0.2)',
            pointerEvents: 'none',
            zIndex: 2000,
            transition: 'all 0.1s ease',
            boxShadow: '0 0 10px rgba(255,255,255,0.5)',
          }}
        >
          {/* Gesture icon */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: gesture === 'grab' ? '20px' : '16px',
              color: gesture === 'grab' ? '#ef4444' : gesture === 'pan' ? '#3b82f6' : '#10b981',
              fontWeight: 'bold',
            }}
          >
            {gesture === 'grab' ? '✊' : gesture === 'pan' ? '✋' : '👆'}
          </div>
        </div>
      )}
      
      {/* Proximity indicator - shows which object is near hand */}
      {handScreenPos && hoveredObjectId && !isDraggingRef.current && gesture !== 'grab' && (
        (() => {
          const hoveredObj = state.objects.find(o => o.id === hoveredObjectId);
          if (!hoveredObj) return null;
          const screenPos = canvasToScreen(hoveredObj.x + hoveredObj.width / 2, hoveredObj.y + hoveredObj.height / 2);
          return (
            <div
              style={{
                position: 'absolute',
                left: `${screenPos.x}px`,
                top: `${screenPos.y}px`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(hoveredObj.width, hoveredObj.height) + 20}px`,
                height: `${Math.max(hoveredObj.width, hoveredObj.height) + 20}px`,
                borderRadius: hoveredObj.type === 'circle' ? '50%' : '8px',
                border: '2px dashed #93c5fd',
                pointerEvents: 'none',
                zIndex: 1500,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          );
        })()
      )}
      
      {/* Dragging indicator - shows connection between hand and object */}
      {handScreenPos && isDraggingRef.current && dragObjectRef.current && (
        (() => {
          const draggedObj = state.objects.find(o => o.id === dragObjectRef.current);
          if (!draggedObj) return null;
          const objScreenPos = canvasToScreen(draggedObj.x + draggedObj.width / 2, draggedObj.y + draggedObj.height / 2);
          return (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1800,
              }}
            >
              <line
                x1={handScreenPos.x}
                y1={handScreenPos.y}
                x2={objScreenPos.x}
                y2={objScreenPos.y}
                stroke="#60a5fa"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.6"
              />
            </svg>
          );
        })()
      )}
      
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse {
            0%, 100% {
              opacity: 0.4;
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              opacity: 0.7;
              transform: translate(-50%, -50%) scale(1.05);
            }
          }
        `
      }} />
    </div>
  );
}

