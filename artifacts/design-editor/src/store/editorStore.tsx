import { createContext, useContext, useReducer, ReactNode } from 'react';
import type { BrushPreset } from '@/hooks/useFabricCanvas';

export type ActivePanel =
  | 'layers' | 'properties' | 'add' | 'export' | 'project'
  | 'canvasSize' | 'alignment' | 'canvasBg' | 'colorStudio'
  | 'text' | 'shapeModifiers' | 'adjust' | 'nudge' | null;

export type ActiveTool = 'select' | 'pan' | 'pen' | 'brush';

export interface CanvasBgConfig {
  type: 'solid' | 'transparent' | 'gradient';
  color: string;
  gradientType: 'linear' | 'radial';
  gradientStops: { offset: number; color: string }[];
}

export interface EditorState {
  activeTool: ActiveTool;
  activePanel: ActivePanel;
  selectedObjectIds: string[];
  canvasSize: { width: number; height: number };
  projectName: string;
  customFonts: string[];
  recentFonts: string[];
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  gridEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
  gridLocked: boolean;
  guides: { h: number[]; v: number[] };
  canvasBg: CanvasBgConfig;
  brushPreset: BrushPreset;
  brushColor: string;
  brushSize: number;
  neonIntensity: number;
}

type EditorAction =
  | { type: 'SET_TOOL'; payload: ActiveTool }
  | { type: 'TOGGLE_PANEL'; payload: ActivePanel }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SET_SELECTED'; payload: string[] }
  | { type: 'SET_CANVAS_SIZE'; payload: { width: number; height: number } }
  | { type: 'SET_PROJECT_NAME'; payload: string }
  | { type: 'ADD_CUSTOM_FONT'; payload: string }
  | { type: 'REMOVE_CUSTOM_FONT'; payload: string }
  | { type: 'SET_RECENT_FONTS'; payload: string[] }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SET_UNDO_REDO'; payload: { canUndo: boolean; canRedo: boolean } }
  | { type: 'TOGGLE_GRID' }
  | { type: 'TOGGLE_SNAP' }
  | { type: 'SET_GRID_SIZE'; payload: number }
  | { type: 'TOGGLE_GRID_LOCKED' }
  | { type: 'SET_GUIDES'; payload: { h: number[]; v: number[] } }
  | { type: 'ADD_GUIDE'; payload: { axis: 'h' | 'v'; pos: number } }
  | { type: 'REMOVE_GUIDE'; payload: { axis: 'h' | 'v'; idx: number } }
  | { type: 'SET_CANVAS_BG'; payload: CanvasBgConfig }
  | { type: 'SET_BRUSH_PRESET'; payload: BrushPreset }
  | { type: 'SET_BRUSH_COLOR'; payload: string }
  | { type: 'SET_BRUSH_SIZE'; payload: number }
  | { type: 'SET_NEON_INTENSITY'; payload: number };

const defaultBg: CanvasBgConfig = {
  type: 'solid',
  color: '#ffffff',
  gradientType: 'linear',
  gradientStops: [
    { offset: 0, color: '#00F5FF' },
    { offset: 1, color: '#7B2FFF' },
  ],
};

function loadRecentFonts(): string[] {
  try { return JSON.parse(localStorage.getItem('cs_recent_fonts') || '[]'); } catch { return []; }
}

const initialState: EditorState = {
  activeTool: 'select',
  activePanel: null,
  selectedObjectIds: [],
  canvasSize: { width: 1080, height: 1080 },
  projectName: 'Untitled Design',
  customFonts: [],
  recentFonts: loadRecentFonts(),
  isDirty: false,
  canUndo: false,
  canRedo: false,
  gridEnabled: false,
  snapToGrid: false,
  gridSize: 20,
  gridLocked: false,
  guides: { h: [], v: [] },
  canvasBg: defaultBg,
  brushPreset: 'standard',
  brushColor: '#00F5FF',
  brushSize: 8,
  neonIntensity: 60,
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
    case 'REMOVE_CUSTOM_FONT':
      return { ...state, customFonts: state.customFonts.filter((f) => f !== action.payload) };
    case 'SET_RECENT_FONTS': {
      try { localStorage.setItem('cs_recent_fonts', JSON.stringify(action.payload)); } catch { /* ignore */ }
      return { ...state, recentFonts: action.payload };
    }
    case 'SET_DIRTY':
      return { ...state, isDirty: action.payload };
    case 'SET_UNDO_REDO':
      return { ...state, canUndo: action.payload.canUndo, canRedo: action.payload.canRedo };
    case 'TOGGLE_GRID':
      return { ...state, gridEnabled: !state.gridEnabled };
    case 'TOGGLE_SNAP':
      return { ...state, snapToGrid: !state.snapToGrid };
    case 'SET_GRID_SIZE':
      return { ...state, gridSize: action.payload };
    case 'TOGGLE_GRID_LOCKED':
      return { ...state, gridLocked: !state.gridLocked };
    case 'SET_GUIDES':
      return { ...state, guides: action.payload };
    case 'ADD_GUIDE': {
      const axis = action.payload.axis;
      return { ...state, guides: { ...state.guides, [axis]: [...state.guides[axis], action.payload.pos] } };
    }
    case 'REMOVE_GUIDE': {
      const axis = action.payload.axis;
      const idx = action.payload.idx;
      return { ...state, guides: { ...state.guides, [axis]: state.guides[axis].filter((_v, i) => i !== idx) } };
    }
    case 'SET_CANVAS_BG':
      return { ...state, canvasBg: action.payload };
    case 'SET_BRUSH_PRESET':
      return { ...state, brushPreset: action.payload };
    case 'SET_BRUSH_COLOR':
      return { ...state, brushColor: action.payload };
    case 'SET_BRUSH_SIZE':
      return { ...state, brushSize: action.payload };
    case 'SET_NEON_INTENSITY':
      return { ...state, neonIntensity: action.payload };
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
