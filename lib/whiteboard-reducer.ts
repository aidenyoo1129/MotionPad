import { CanvasState, CanvasAction, CanvasObject, ObjectType } from './whiteboard-types';

const GRID_SIZE = 10;
const SNAP_THRESHOLD = 15; // Distance in pixels to trigger snapping
const DEFAULT_COLORS: Record<ObjectType, string> = {
  box: '#6596F3',      // Blue
  sticky: '#EAD094',   // Yellow
  circle: '#F24E1E',   // Red
  arrow: '#D3A4EA',    // Purple
  textbox: '#83B366',  // Green
};

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number; // x for vertical, y for horizontal
  fromObject: { id: string; edge: 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY' };
  toObject: { id: string; edge: 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY' };
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

/**
 * Calculate snap points for an object being moved
 * Returns the snapped position and visual guides
 */
export function calculateSnap(
  draggedObject: CanvasObject,
  newX: number,
  newY: number,
  otherObjects: CanvasObject[]
): SnapResult {
  const guides: SnapGuide[] = [];
  let snappedX = newX;
  let snappedY = newY;

  // Calculate edges and centers of the dragged object at new position
  const draggedLeft = newX;
  const draggedRight = newX + draggedObject.width;
  const draggedTop = newY;
  const draggedBottom = newY + draggedObject.height;
  const draggedCenterX = newX + draggedObject.width / 2;
  const draggedCenterY = newY + draggedObject.height / 2;

  // Track best snap candidates
  let bestXSnap: { distance: number; position: number; guide: SnapGuide | null } | null = null;
  let bestYSnap: { distance: number; position: number; guide: SnapGuide | null } | null = null;

  // Check against all other objects
  for (const other of otherObjects) {
    if (other.id === draggedObject.id || other.locked) continue;

    const otherLeft = other.x;
    const otherRight = other.x + other.width;
    const otherTop = other.y;
    const otherBottom = other.y + other.height;
    const otherCenterX = other.x + other.width / 2;
    const otherCenterY = other.y + other.height / 2;

    // Check vertical alignment (X-axis snapping)
    const alignmentsX = [
      { pos: otherLeft, edge: 'left' as const, otherEdge: 'left' as const },
      { pos: otherRight, edge: 'right' as const, otherEdge: 'right' as const },
      { pos: otherCenterX, edge: 'centerX' as const, otherEdge: 'centerX' as const },
    ];

    for (const align of alignmentsX) {
      // Check if dragged object's left edge should snap
      const distLeft = Math.abs(draggedLeft - align.pos);
      if (distLeft < SNAP_THRESHOLD) {
        if (!bestXSnap || distLeft < bestXSnap.distance) {
          bestXSnap = {
            distance: distLeft,
            position: align.pos,
            guide: {
              type: 'vertical',
              position: align.pos,
              fromObject: { id: draggedObject.id, edge: 'left' },
              toObject: { id: other.id, edge: align.otherEdge },
            },
          };
        }
      }

      // Check if dragged object's right edge should snap
      const distRight = Math.abs(draggedRight - align.pos);
      if (distRight < SNAP_THRESHOLD) {
        if (!bestXSnap || distRight < bestXSnap.distance) {
          bestXSnap = {
            distance: distRight,
            position: align.pos - draggedObject.width,
            guide: {
              type: 'vertical',
              position: align.pos,
              fromObject: { id: draggedObject.id, edge: 'right' },
              toObject: { id: other.id, edge: align.otherEdge },
            },
          };
        }
      }

      // Check if dragged object's center should snap
      const distCenter = Math.abs(draggedCenterX - align.pos);
      if (distCenter < SNAP_THRESHOLD) {
        if (!bestXSnap || distCenter < bestXSnap.distance) {
          bestXSnap = {
            distance: distCenter,
            position: align.pos - draggedObject.width / 2,
            guide: {
              type: 'vertical',
              position: align.pos,
              fromObject: { id: draggedObject.id, edge: 'centerX' },
              toObject: { id: other.id, edge: align.otherEdge },
            },
          };
        }
      }
    }

    // Check horizontal alignment (Y-axis snapping)
    const alignmentsY = [
      { pos: otherTop, edge: 'top' as const, otherEdge: 'top' as const },
      { pos: otherBottom, edge: 'bottom' as const, otherEdge: 'bottom' as const },
      { pos: otherCenterY, edge: 'centerY' as const, otherEdge: 'centerY' as const },
    ];

    for (const align of alignmentsY) {
      // Check if dragged object's top edge should snap
      const distTop = Math.abs(draggedTop - align.pos);
      if (distTop < SNAP_THRESHOLD) {
        if (!bestYSnap || distTop < bestYSnap.distance) {
          bestYSnap = {
            distance: distTop,
            position: align.pos,
            guide: {
              type: 'horizontal',
              position: align.pos,
              fromObject: { id: draggedObject.id, edge: 'top' },
              toObject: { id: other.id, edge: align.otherEdge },
            },
          };
        }
      }

      // Check if dragged object's bottom edge should snap
      const distBottom = Math.abs(draggedBottom - align.pos);
      if (distBottom < SNAP_THRESHOLD) {
        if (!bestYSnap || distBottom < bestYSnap.distance) {
          bestYSnap = {
            distance: distBottom,
            position: align.pos - draggedObject.height,
            guide: {
              type: 'horizontal',
              position: align.pos,
              fromObject: { id: draggedObject.id, edge: 'bottom' },
              toObject: { id: other.id, edge: align.otherEdge },
            },
          };
        }
      }

      // Check if dragged object's center should snap
      const distCenter = Math.abs(draggedCenterY - align.pos);
      if (distCenter < SNAP_THRESHOLD) {
        if (!bestYSnap || distCenter < bestYSnap.distance) {
          bestYSnap = {
            distance: distCenter,
            position: align.pos - draggedObject.height / 2,
            guide: {
              type: 'horizontal',
              position: align.pos,
              fromObject: { id: draggedObject.id, edge: 'centerY' },
              toObject: { id: other.id, edge: align.otherEdge },
            },
          };
        }
      }
    }
  }

  // Apply best snaps
  if (bestXSnap) {
    snappedX = bestXSnap.position;
    if (bestXSnap.guide) {
      guides.push(bestXSnap.guide);
    }
  } else {
    // Fallback to grid snapping if no object snap
    snappedX = snapToGrid(snappedX);
  }

  if (bestYSnap) {
    snappedY = bestYSnap.position;
    if (bestYSnap.guide) {
      guides.push(bestYSnap.guide);
    }
  } else {
    // Fallback to grid snapping if no object snap
    snappedY = snapToGrid(snappedY);
  }

  return { x: snappedX, y: snappedY, guides };
}

// Helper to ensure snapGuides is always defined in state
function ensureSnapGuides(state: CanvasState): CanvasState {
  if (!state.snapGuides) {
    return { ...state, snapGuides: [] };
  }
  return state;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createObject(type: ObjectType, x: number, y: number): CanvasObject {
  const baseSize = 100;
  return {
    id: generateId(),
    type,
    x: snapToGrid(x),
    y: snapToGrid(y),
    width: type === 'circle' ? baseSize : baseSize * 1.5,
    height: type === 'circle' ? baseSize : baseSize,
    color: DEFAULT_COLORS[type],
    text: type === 'textbox' || type === 'sticky' ? '' : undefined,
    locked: false,
  };
}

function findNearestObject(
  objects: CanvasObject[],
  x: number,
  y: number,
  threshold: number = 50
): CanvasObject | null {
  let nearest: CanvasObject | null = null;
  let minDist = threshold;

  for (const obj of objects) {
    if (obj.locked) continue;

    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

    if (dist < minDist) {
      minDist = dist;
      nearest = obj;
    }
  }

  return nearest;
}

export function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  let newState: CanvasState;

  switch (action.type) {
    case 'CREATE': {
      const newObject = createObject(action.payload.objectType, action.payload.x, action.payload.y);
      newState = {
        ...state,
        objects: [...state.objects, newObject],
        selectedId: newObject.id,
        snapGuides: [],
      };
      break;
    }

    case 'MOVE': {
      console.log('[Reducer Debug] MOVE action:', {
        objectId: action.payload.id,
        newPosition: { x: action.payload.x, y: action.payload.y },
        objectsCount: state.objects.length,
        availableObjectIds: state.objects.map(o => o.id),
        hasSelectedId: !!state.selectedId,
        selectedId: state.selectedId,
      });
      
      const obj = state.objects.find((o) => o.id === action.payload.id);
      if (!obj || obj.locked) {
        console.warn('[Reducer Debug] MOVE failed - object not found or locked:', {
          objectId: action.payload.id,
          objectExists: !!obj,
          isLocked: obj?.locked,
          objectsCount: state.objects.length,
        });
        return state;
      }

      // Calculate snap with object-to-object alignment
      const otherObjects = state.objects.filter((o) => o.id !== action.payload.id);
      console.log('[Reducer Debug] Calculating snap:', {
        draggedObjectId: obj.id,
        otherObjectsCount: otherObjects.length,
        otherObjectIds: otherObjects.map(o => o.id),
      });
      
      const snapResult = calculateSnap(obj, action.payload.x, action.payload.y, otherObjects);
      
      console.log('[Reducer Debug] Snap result:', {
        snappedPosition: { x: snapResult.x, y: snapResult.y },
        guidesCount: snapResult.guides.length,
        guideObjectIds: snapResult.guides.map(g => g.toObject.id),
      });

      newState = {
        ...state,
        objects: state.objects.map((o) =>
          o.id === action.payload.id
            ? { ...o, x: snapResult.x, y: snapResult.y }
            : o
        ),
        // Store snap guides for visual feedback
        snapGuides: snapResult.guides,
      };
      break;
    }

    case 'DELETE': {
      if (state.selectedId === action.payload.id) {
        newState = {
          ...state,
          objects: state.objects.filter((o) => o.id !== action.payload.id),
          selectedId: null,
        };
      } else {
        newState = {
          ...state,
          objects: state.objects.filter((o) => o.id !== action.payload.id),
        };
      }
      break;
    }

    case 'DUPLICATE': {
      const obj = state.objects.find((o) => o.id === action.payload.id);
      if (!obj) return state;

      const duplicated: CanvasObject = {
        ...obj,
        id: generateId(),
        x: snapToGrid(obj.x + 20),
        y: snapToGrid(obj.y + 20),
      };

      newState = {
        ...state,
        objects: [...state.objects, duplicated],
        selectedId: duplicated.id,
      };
      break;
    }

    case 'COLOR': {
      newState = {
        ...state,
        objects: state.objects.map((o) =>
          o.id === action.payload.id ? { ...o, color: action.payload.color } : o
        ),
      };
      break;
    }

    case 'TEXT': {
      newState = {
        ...state,
        objects: state.objects.map((o) =>
          o.id === action.payload.id ? { ...o, text: action.payload.text } : o
        ),
      };
      break;
    }

    case 'LOCK': {
      newState = {
        ...state,
        objects: state.objects.map((o) =>
          o.id === action.payload.id ? { ...o, locked: true } : o
        ),
      };
      break;
    }

    case 'UNLOCK': {
      newState = {
        ...state,
        objects: state.objects.map((o) =>
          o.id === action.payload.id ? { ...o, locked: false } : o
        ),
      };
      break;
    }

    case 'SELECT': {
      newState = {
        ...state,
        selectedId: action.payload.id,
        snapGuides: [], // Clear guides when selecting
      };
      break;
    }

    case 'CLEAR_SNAP_GUIDES': {
      newState = {
        ...state,
        snapGuides: [],
      };
      break;
    }

    case 'PAN': {
      newState = {
        ...state,
        panX: state.panX + action.payload.deltaX,
        panY: state.panY + action.payload.deltaY,
        snapGuides: [], // Clear guides when panning
      };
      break;
    }

    case 'ZOOM': {
      const newZoom = Math.max(0.1, Math.min(3, state.zoom + action.payload.delta));
      newState = {
        ...state,
        zoom: newZoom,
      };
      break;
    }

    case 'RESET_CANVAS': {
      newState = {
        ...state,
        panX: 0,
        panY: 0,
        zoom: 1,
      };
      break;
    }

    case 'SAVE_SNAPSHOT': {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(state.objects)));
      newState = {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
      break;
    }

    case 'UNDO': {
      if (state.historyIndex > 0) {
        const prevIndex = state.historyIndex - 1;
        newState = {
          ...state,
          objects: JSON.parse(JSON.stringify(state.history[prevIndex])),
          historyIndex: prevIndex,
          selectedId: null,
        };
      } else {
        return state;
      }
      break;
    }

    case 'REDO': {
      if (state.historyIndex < state.history.length - 1) {
        const nextIndex = state.historyIndex + 1;
        newState = {
          ...state,
          objects: JSON.parse(JSON.stringify(state.history[nextIndex])),
          historyIndex: nextIndex,
          selectedId: null,
        };
      } else {
        return state;
      }
      break;
    }

    default:
      return state;
  }

  // Ensure snapGuides is always defined
  return ensureSnapGuides(newState);
}

export function findNearestObjectAt(
  objects: CanvasObject[],
  x: number,
  y: number,
  threshold: number = 50
): CanvasObject | null {
  return findNearestObject(objects, x, y, threshold);
}

