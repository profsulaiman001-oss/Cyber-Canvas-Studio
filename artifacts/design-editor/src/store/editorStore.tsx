import { createContext, useContext, useReducer, ReactNode } from 'react';

export type ActivePanel = 'layers' | 'properties' | 'add' | 'export' | 'project' | 'canvasSize' | null;
export type ActiveTool = 'select' | 'pan';

export interface EditorState {
  activeTool: ActiveTool;
  activePanel: ActivePanel;
  selectedObjectIds: string[];
  canvasSize: { width: number; height: number };
  projectName: string;
  customFonts: string[];
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

type EditorAction =
  | { type: 'SET_TOOL'; payload: ActiveTool }
  | { type: 'TOGGLE_PANEL'; payload: ActivePanel }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SET_SELECTED'; payload: string[] }
  | { type: 'SET_CANVAS_SIZE'; payload: { width: number; height: number } }
  | { type: 'SET_PROJECT_NAME'; payload: string }
  | { type: 'ADD_CUSTOM_FONT'; payload: string }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SET_UNDO_REDO'; payload: { canUndo: boolean; canRedo: boolean } };

const initialState: EditorState = {
  activeTool: 'select',
  activePanel: null,
  selectedObjectIds: [],
  canvasSize: { width: 1080, height: 1080 },
  projectName: 'Untitled Design',
  customFonts: [],
  isDirty: false,
  canUndo: false,
  canRedo: false,
};

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, activeTool: action.payload };
    case 'TOGGLE_PANEL':
      return { ...state, activePanel: state.activePanel === action.payload ? null : action.payload };
    case 'CLOSE_PANEL':
      return { ...state, activePanel: null };
    case 'SET_SELECTED':
      return { ...state, selectedObjectIds: action.payload };
    case 'SET_CANVAS_SIZE':
      return { ...state, canvasSize: action.payload };
    case 'SET_PROJECT_NAME':
      return { ...state, projectName: action.payload };
    case 'ADD_CUSTOM_FONT':
      return state.customFonts.includes(action.payload)
        ? state
        : { ...state, customFonts: [...state.customFonts, action.payload] };
    case 'SET_DIRTY':
      return { ...state, isDirty: action.payload };
    case 'SET_UNDO_REDO':
      return { ...state, canUndo: action.payload.canUndo, canRedo: action.payload.canRedo };
    default:
      return state;
  }
}

interface EditorContextType {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <EditorContext.Provider value={{ state, dispatch }}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
