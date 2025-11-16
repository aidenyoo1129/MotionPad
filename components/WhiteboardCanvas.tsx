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
  const grabOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  
  // Get active hand for single-hand gestures
  const activeHand = leftHand || rightHand;
  
  // Calculate hand position on screen for visual feedback
  // Note: Mirror X coordinate for front-facing camera (MediaPipe coordinates are relative to video frame, not mirrored view)
  const handScreenPos = activeHand && canvasRef.current
    ? (() => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return {
          x: (1 - activeHand.x) * rect.width,  // Mirror X: 1 - x
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
      
      // Mirror X coordinates for front-facing camera
      const midX = ((1 - leftHand.x + 1 - rightHand.x) / 2) * rect.width;
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

    // Mirror X coordinate for front-facing camera
    const screenX = (1 - activeHand.x) * rect.width;
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
        
        // Calculate offset between hand position and object center
        // This offset will be maintained as the hand moves
        const objCenterX = nearest.x + nearest.width / 2;
        const objCenterY = nearest.y + nearest.height / 2;
        grabOffsetRef.current = {
          x: canvasPos.x - objCenterX,
          y: canvasPos.y - objCenterY,
        };
        
        lastHandPosRef.current = canvasPos;
      }
    } else if (gesture === 'release') {
      if (isDraggingRef.current && dragObjectRef.current) {
        isDraggingRef.current = false;
        dragObjectRef.current = null;
        lastHandPosRef.current = null;
        grabOffsetRef.current = null; // Clear grab offset
        setHoveredObjectId(null);
      }
    } else if (isDraggingRef.current && dragObjectRef.current && grabOffsetRef.current) {
      // Position object so the grab point stays exactly under the hand
      const obj = state.objects.find((o) => o.id === dragObjectRef.current);
      if (obj) {
        // Calculate where the object center should be to maintain the grab offset
        // Object center = hand position - grab offset
        const newCenterX = canvasPos.x - grabOffsetRef.current.x;
        const newCenterY = canvasPos.y - grabOffsetRef.current.y;
        
        // Convert center position to top-left position (object coordinates)
        const newX = newCenterX - obj.width / 2;
        const newY = newCenterY - obj.height / 2;
        
        onMove(dragObjectRef.current, newX, newY);
      }
      
      // Update last position
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
      
      {/* Snap guides - blue lines showing alignment */}
      {isDraggingRef.current && state.snapGuides && state.snapGuides.length > 0 && (
        (() => {
          const draggedObj = state.objects.find(o => o.id === dragObjectRef.current);
          if (!draggedObj) return null;
          
          // Get bounding box of all objects involved in snapping
          const allObjects = [draggedObj, ...state.snapGuides.map(g => 
            state.objects.find(o => o.id === g.toObject.id)
          ).filter(Boolean) as CanvasObject[]];
          
          if (allObjects.length === 0) return null;
          
          // Calculate bounds
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const obj of allObjects) {
            minX = Math.min(minX, obj.x);
            maxX = Math.max(maxX, obj.x + obj.width);
            minY = Math.min(minY, obj.y);
            maxY = Math.max(maxY, obj.y + obj.height);
          }
          
          // Extend bounds for guide lines
          const padding = 50;
          minX -= padding;
          maxX += padding;
          minY -= padding;
          maxY += padding;
          
          // Convert to screen coordinates
          const screenMinX = canvasToScreen(minX, 0).x;
          const screenMaxX = canvasToScreen(maxX, 0).x;
          const screenMinY = canvasToScreen(0, minY).y;
          const screenMaxY = canvasToScreen(0, maxY).y;
          
          return (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1900,
              }}
            >
              {state.snapGuides.map((guide, index) => {
                if (guide.type === 'vertical') {
                  const screenX = canvasToScreen(guide.position, 0).x;
                  return (
                    <line
                      key={`guide-${index}`}
                      x1={screenX}
                      y1={screenMinY}
                      x2={screenX}
                      y2={screenMaxY}
                      stroke="#3b82f6"
                      strokeWidth="2"
                      opacity="0.8"
                    />
                  );
                } else {
                  const screenY = canvasToScreen(0, guide.position).y;
                  return (
                    <line
                      key={`guide-${index}`}
                      x1={screenMinX}
                      y1={screenY}
                      x2={screenMaxX}
                      y2={screenY}
                      stroke="#3b82f6"
                      strokeWidth="2"
                      opacity="0.8"
                    />
                  );
                }
              })}
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

