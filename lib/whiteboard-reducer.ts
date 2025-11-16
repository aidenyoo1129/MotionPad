import { CanvasState, CanvasAction, CanvasObject, ObjectType } from './whiteboard-types';

const GRID_SIZE = 10;
const DEFAULT_COLORS: Record<ObjectType, string> = {
  box: '#3b82f6',
  sticky: '#fbbf24',
  circle: '#ef4444',
  arrow: '#8b5cf6',
  textbox: '#10b981',
};

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
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
      };
      break;
    }

    case 'MOVE': {
      const obj = state.objects.find((o) => o.id === action.payload.id);
      if (!obj || obj.locked) return state;

      newState = {
        ...state,
        objects: state.objects.map((o) =>
          o.id === action.payload.id
            ? { ...o, x: snapToGrid(action.payload.x), y: snapToGrid(action.payload.y) }
            : o
        ),
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
      };
      break;
    }

    case 'PAN': {
      newState = {
        ...state,
        panX: state.panX + action.payload.deltaX,
        panY: state.panY + action.payload.deltaY,
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

  return newState;
}

export function findNearestObjectAt(
  objects: CanvasObject[],
  x: number,
  y: number,
  threshold: number = 50
): CanvasObject | null {
  return findNearestObject(objects, x, y, threshold);
}

