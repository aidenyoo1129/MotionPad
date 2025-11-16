'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { CanvasObject, CanvasState } from '@/lib/whiteboard-types';
import { findNearestObjectAt } from '@/lib/whiteboard-reducer';

interface WhiteboardCanvasProps {
  state: CanvasState;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onPan: (deltaX: number, deltaY: number) => void;
  leftHand?: { x: number; y: number } | null;
  rightHand?: { x: number; y: number } | null;
  gesture?: 'grab' | 'release' | 'pan' | 'pointing' | null;
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
  // Use useMemo to avoid recalculating on every render
  const handScreenPos = useMemo(() => {
    if (!activeHand || !canvasRef.current) return null;
    
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (1 - activeHand.x) * rect.width,  // Mirror X: 1 - x
      y: activeHand.y * rect.height,
    };
  }, [activeHand?.x, activeHand?.y, activeHand]);

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
    if (!canvasRef.current) {
      console.log('[Canvas Debug] Canvas ref not available');
      return;
    }

    console.log('[Canvas Debug] Hand gesture effect triggered:', {
      gesture,
      hasLeftHand: !!leftHand,
      hasRightHand: !!rightHand,
      objectsCount: state.objects.length,
      selectedId: state.selectedId,
      snapGuidesCount: state.snapGuides?.length || 0,
      isDragging: isDraggingRef.current,
      dragObjectId: dragObjectRef.current,
    });

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

    // Find nearest object for proximity feedback (when pointing or hovering)
    const nearest = findNearestObjectAt(state.objects, canvasPos.x, canvasPos.y, 80);
    
    // Handle pointing gesture for hover/preview
    if (gesture === 'pointing' && nearest && !nearest.locked) {
      setHoveredObjectId(nearest.id);
    } else if (gesture === 'pointing' && !nearest) {
      setHoveredObjectId(null);
    }
    
    // Handle proximity feedback when not grabbing or pointing
    if (nearest && !nearest.locked && gesture !== 'grab' && gesture !== 'pointing' && !isDraggingRef.current) {
      setHoveredObjectId(nearest.id);
    } else if (!nearest || gesture === 'grab' || isDraggingRef.current) {
      if (gesture !== 'pointing') {
        setHoveredObjectId(null);
      }
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
    
    // Apple-style shadows and borders
    const getShadow = () => {
      if (isDragging) {
        return '0 20px 60px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(0, 0, 0, 0.2)';
      }
      if (isSelected) {
        return '0 12px 40px rgba(0, 122, 255, 0.25), 0 4px 12px rgba(0, 122, 255, 0.15)';
      }
      if (isHovered) {
        // Enhanced hover shadow for better visual feedback
        return '0 12px 32px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)';
      }
      return '0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06)';
    };
    
    const getBorder = () => {
      // No borders - only shadows for visual feedback
      return 'none';
    };
    
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${obj.x}px`,
      top: `${obj.y}px`,
      width: `${obj.width}px`,
      height: `${obj.height}px`,
      backgroundColor: obj.color,
      border: getBorder(),
      borderRadius: obj.type === 'circle' ? '50%' : obj.type === 'sticky' ? '12px' : '12px',
      boxShadow: getShadow(),
      cursor: obj.locked ? 'not-allowed' : 'move',
      opacity: obj.locked ? 0.5 : isDragging ? 0.95 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: obj.type === 'textbox' || obj.type === 'sticky' ? '12px' : '0',
      fontSize: '15px',
      fontWeight: 500,
      color: '#000',
      wordWrap: 'break-word',
      overflow: 'hidden',
      transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      transition: isDragging 
        ? 'none' 
        : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), border 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
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
        // Calculate shadow parameters based on state
        const shadowBlur = isDragging ? 8 : isSelected ? 6 : isHovered ? 4 : 2;
        const shadowOffset = isDragging ? 4 : isSelected ? 3 : isHovered ? 2 : 1;
        const shadowOpacity = isDragging ? 0.3 : isSelected ? 0.25 : isHovered ? 0.18 : 0.1;
        const hasShadow = isDragging || isSelected || isHovered;
        
        return (
          <div
            key={obj.id}
            style={{
              position: 'absolute',
              left: `${obj.x}px`,
              top: `${obj.y}px`,
              width: `${obj.width}px`,
              height: `${obj.height}px`,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: obj.locked ? 'not-allowed' : 'move',
              opacity: obj.locked ? 0.5 : isDragging ? 0.95 : 1,
              transform: isDragging ? 'scale(1.02)' : 'scale(1)',
              transition: isDragging 
                ? 'none' 
                : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: isDragging ? 1000 : isSelected ? 100 : isHovered ? 50 : 1,
              pointerEvents: obj.locked ? 'none' : 'all',
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
                  markerWidth="12"
                  markerHeight="12"
                  refX="10"
                  refY="6"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path
                    d="M 0 0 L 12 6 L 0 12 Z"
                    fill={obj.color}
                    opacity={obj.locked ? 0.5 : 1}
                  />
                </marker>
                {/* Shadow filter that follows the arrow shape (line + arrowhead) */}
                {hasShadow && (
                  <filter id={`arrow-shadow-${obj.id}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation={shadowBlur} />
                    <feOffset dx="0" dy={shadowOffset} result="offsetblur" />
                    <feComponentTransfer>
                      <feFuncA type="linear" slope={shadowOpacity * 10} />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                )}
                {/* Colored shadow for selected state */}
                {isSelected && (
                  <filter id={`arrow-selected-shadow-${obj.id}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
                    <feOffset dx="0" dy="3" result="offsetblur" />
                    <feFlood floodColor="rgba(0, 122, 255, 0.25)" />
                    <feComposite in2="offsetblur" operator="in" />
                    <feGaussianBlur stdDeviation="4" />
                    <feOffset dx="0" dy="2" />
                    <feComponentTransfer>
                      <feFuncA type="linear" slope="0.15" />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                )}
              </defs>
              {/* Shadow layer - rendered first if shadow is needed */}
              {hasShadow && (
                <line
                  x1="8"
                  y1={obj.height / 2}
                  x2={obj.width - 8}
                  y2={obj.height / 2}
                  stroke={isSelected ? 'rgba(0, 122, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)'}
                  strokeWidth={isDragging ? 4 : isSelected ? 3.5 : 3}
                  markerEnd={`url(#arrowhead-${obj.id})`}
                  opacity={0.4}
                  filter={isSelected ? `url(#arrow-selected-shadow-${obj.id})` : `url(#arrow-shadow-${obj.id})`}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* Main arrow - always visible */}
              <line
                x1="8"
                y1={obj.height / 2}
                x2={obj.width - 8}
                y2={obj.height / 2}
                stroke={obj.color}
                strokeWidth={isDragging ? 4 : isSelected ? 3.5 : 3}
                markerEnd={`url(#arrowhead-${obj.id})`}
                opacity={obj.locked ? 0.5 : 1}
                style={{
                  transition: isDragging 
                    ? 'none' 
                    : 'stroke-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </svg>
            {obj.text && (
              <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                fontSize: '15px',
                fontWeight: 500,
                color: '#000',
                userSelect: 'none',
              }}>
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
        backgroundColor: '#f2f2f7',
        backgroundImage: `
          linear-gradient(rgba(142, 142, 147, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(142, 142, 147, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: `${20 * state.zoom}px ${20 * state.zoom}px`,
        backgroundPosition: `${state.panX % (20 * state.zoom)}px ${state.panY % (20 * state.zoom)}px`,
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
      
      {/* Hand position indicator - Apple Style Glass */}
      {handScreenPos && (
        <div
          className="glass-strong"
          style={{
            position: 'absolute',
            left: `${handScreenPos.x}px`,
            top: `${handScreenPos.y}px`,
            transform: 'translate(-50%, -50%)',
            width: gesture === 'grab' ? '48px' : gesture === 'pointing' ? '32px' : '40px',
            height: gesture === 'grab' ? '48px' : gesture === 'pointing' ? '32px' : '40px',
            borderRadius: '50%',
            border: gesture === 'grab' 
              ? '2px solid #ff3b30' 
              : gesture === 'pan'
              ? '2px solid #007aff'
              : gesture === 'pointing'
              ? '2px solid #ff9500'
              : '2px solid #34c759',
            backgroundColor: gesture === 'grab'
              ? 'rgba(255, 59, 48, 0.15)'
              : gesture === 'pan'
              ? 'rgba(0, 122, 255, 0.15)'
              : gesture === 'pointing'
              ? 'rgba(255, 149, 0, 0.15)'
              : 'rgba(52, 199, 89, 0.15)',
            pointerEvents: 'none',
            zIndex: 2000,
            // Only transition non-position properties for smooth visual changes
            // Position changes should be instant for real-time tracking
            transition: 'width 0.15s ease-out, height 0.15s ease-out, border-color 0.15s ease-out, background-color 0.15s ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Gesture icon */}
          <div
            style={{
              fontSize: gesture === 'grab' ? '22px' : gesture === 'pointing' ? '16px' : '18px',
              lineHeight: 1,
            }}
          >
            {gesture === 'grab' ? '🤏' : gesture === 'pan' ? '🤏🤏' : gesture === 'pointing' ? '👆' : '👋'}
          </div>
        </div>
      )}
      
      
      {/* Dragging indicator - Apple Style */}
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
                stroke="#007aff"
                strokeWidth="2.5"
                strokeDasharray="6,4"
                opacity="0.5"
                strokeLinecap="round"
              />
            </svg>
          );
        })()
      )}
      
      {/* Snap guides - blue lines showing alignment */}
      {isDraggingRef.current && state.snapGuides && state.snapGuides.length > 0 && (
        (() => {
          console.log('[Canvas Debug] Snap guides rendering check:', {
            isDragging: isDraggingRef.current,
            dragObjectId: dragObjectRef.current,
            snapGuidesCount: state.snapGuides?.length || 0,
            objectsCount: state.objects.length,
            snapGuides: state.snapGuides,
          });
          
          const draggedObj = state.objects.find(o => o.id === dragObjectRef.current);
          if (!draggedObj) {
            console.warn('[Canvas Debug] Dragged object not found:', {
              dragObjectId: dragObjectRef.current,
              availableObjectIds: state.objects.map(o => o.id),
            });
            return null;
          }
          
          // Get bounding box of all objects involved in snapping
          const allObjects = [draggedObj, ...state.snapGuides.map(g => {
            const obj = state.objects.find(o => o.id === g.toObject.id);
            if (!obj) {
              console.warn('[Canvas Debug] Snap guide references non-existent object:', {
                guide: g,
                referencedObjectId: g.toObject.id,
                availableObjectIds: state.objects.map(o => o.id),
              });
            }
            return obj;
          }).filter(Boolean) as CanvasObject[]];
          
          console.log('[Canvas Debug] All objects for snap guides:', {
            draggedObj: draggedObj.id,
            guideObjects: allObjects.slice(1).map(o => o.id),
            totalObjects: allObjects.length,
          });
          
          if (allObjects.length === 0) {
            console.warn('[Canvas Debug] No objects found for snap guide rendering');
            return null;
          }
          
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
                      stroke="#007aff"
                      strokeWidth="2"
                      opacity="0.6"
                      strokeDasharray="4,4"
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
                      stroke="#007aff"
                      strokeWidth="2"
                      opacity="0.6"
                      strokeDasharray="4,4"
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
              opacity: 0.3;
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              opacity: 0.6;
              transform: translate(-50%, -50%) scale(1.02);
            }
          }
        `
      }} />
    </div>
  );
}

