export type ObjectType = 'box' | 'sticky' | 'circle' | 'arrow' | 'textbox';

export interface CanvasObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  locked?: boolean;
}

export interface CanvasState {
  objects: CanvasObject[];
  selectedId: string | null;
  panX: number;
  panY: number;
  zoom: number;
  history: CanvasObject[][];
  historyIndex: number;
}

export type CanvasAction =
  | { type: 'CREATE'; payload: { objectType: ObjectType; x: number; y: number } }
  | { type: 'MOVE'; payload: { id: string; x: number; y: number } }
  | { type: 'DELETE'; payload: { id: string } }
  | { type: 'DUPLICATE'; payload: { id: string } }
  | { type: 'COLOR'; payload: { id: string; color: string } }
  | { type: 'TEXT'; payload: { id: string; text: string } }
  | { type: 'LOCK'; payload: { id: string } }
  | { type: 'UNLOCK'; payload: { id: string } }
  | { type: 'SELECT'; payload: { id: string | null } }
  | { type: 'PAN'; payload: { deltaX: number; deltaY: number } }
  | { type: 'ZOOM'; payload: { delta: number } }
  | { type: 'RESET_CANVAS' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SAVE_SNAPSHOT' };

