import {
  MousePointer2, Plus, Layers, SlidersHorizontal, Download,
  PenTool, X, Paintbrush, Palette, Spline, Type, Layers2, SlidersVertical, Move,
  PenLine, Layers3, Box, GitBranch, Hand, ZoomIn, Image, Crop, ImagePlus,
  Droplet, SquareRoundCorner, Maximize2,
} from 'lucide-react';
import { useEditor, ActivePanel } from '@/store/editorStore';

interface BottomToolbarProps {
  hasSelection: boolean;
  penActive: boolean;
  brushActive: boolean;
  selectedIsPath?: boolean;
  selectedIsText?: boolean;
  selectedIsImage?: boolean;
  vectorEditActive?: boolean;
  panActive?: boolean;
  onPenCancel: () => void;
  onBrushDone: () => void;
  onVectorEditStart?: () => void;
  onVectorEditEnd?: () => void;
  onImportImages?: () => void;
  onFillWithImage?: () => void;
  onCropImage?: () => void;
  isRect?: boolean;
}

export default function BottomToolbar({
  hasSelection, penActive, brushActive,
  selectedIsPath = false,
  selectedIsImage = false,
  vectorEditActive = false,
  panActive = false,
  onPenCancel, onBrushDone,
  onVectorEditStart, onVectorEditEnd,
  onImportImages,
  onFillWithImage,
  onCropImage,
  isRect = false,
}: BottomToolbarProps) {
  const { state, dispatch } = useEditor();

  const toolbarBg = penActive
    ? { borderTop: '1px solid rgba(255,107,107,0.4)' }
    : brushActive
    ? { borderTop: '1px solid rgba(0,245,255,0.6)' }
    : { borderTop: '1px solid rgba(0,245,255,0.15)' };

  /* ── Vector Edit Mode ── */
  if (vectorEditActive) {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center gap-2 px-4"
        style={{ minHeight: '40px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))', background: '#11141A', ...toolbarBg }}
      >
        <Spline size={14} style={{ color: '#00F5FF', filter: 'drop-shadow(0 0 4px #00F5FF80)' }} />
        <span className="text-[11px] font-medium tracking-wide" style={{ color: '#00F5FF' }}>Vector Node Editor</span>
      </div>
    );
  }

  /* ── Pen Active Mode ── */
  if (penActive) {
    return (
      <div
        className="flex-shrink-0 flex items-start justify-around px-2 pt-3"
        style={{ minHeight: '64px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: '#11141A', ...toolbarBg }}
      >
        <button onClick={onPenCancel} className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl" style={{ color: '#ff6b6b' }}>
          <X size={22} />
          <span className="text-[10px] font-medium leading-none">Cancel</span>
        </button>
        <div className="flex flex-col items-center gap-1 px-4 py-2">
          <PenTool size={22} style={{ color: '#00F5FF', filter: 'drop-shadow(0 0 6px #00F5FF80)' }} />
          <span className="text-[10px] font-medium leading-none" style={{ color: '#00F5FF' }}>Pen Tool</span>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_TOOL', payload: 'select' })}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl"
          style={{ color: '#6b7280' }}
        >
          <MousePointer2 size={22} />
          <span className="text-[10px] font-medium leading-none">Done</span>
        </button>
      </div>
    );
  }

  /* ── Normal Toolbar ── */
  type ToolId = ActivePanel | 'select' | 'pan-tool' | 'zoom-tool' | 'photos' | 'fill-image' | 'brush' | 'crop';

  const tools: {
    id: ToolId;
    icon: React.ReactNode;
    label: string;
    action: () => void;
    disabled?: boolean;
    accent?: string;
  }[] = [
    {
      id: 'select',
      icon: <MousePointer2 size={22} />,
      label: 'Select',
      action: () => {
        dispatch({ type: 'SET_TOOL', payload: 'select' });
        dispatch({ type: 'CLOSE_PANEL' });
      },
    },
    {
      id: 'pan-tool',
      icon: <Hand size={22} />,
      label: 'Pan',
      action: () => {
        const next = state.activeTool === 'pan' ? 'select' : 'pan';
        dispatch({ type: 'SET_TOOL', payload: next });
        if (next !== 'pan') dispatch({ type: 'CLOSE_PANEL' });
      },
      accent: '#00F5FF',
    },
    {
      id: 'zoom-tool',
      icon: <ZoomIn size={22} />,
      label: 'Zoom',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'zoom' }),
      accent: '#00F5FF',
    },
    { id: 'add', icon: <Plus size={24} />, label: 'Add', action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'add' }) },
    { id: 'text', icon: <Type size={22} />, label: 'Text', action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'text' }) },
    {
      id: 'vectors',
      icon: <GitBranch size={22} />,
      label: 'Vectors',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'vectors' }),
      accent: '#7B2FFF',
    },
    {
      id: 'photos',
      icon: <ImagePlus size={22} />,
      label: 'Photos',
      action: () => onImportImages?.(),
    },
    {
      id: 'fill-image',
      icon: <Image size={22} />,
      label: 'Fill Img',
      action: () => onFillWithImage?.(),
      disabled: !hasSelection || selectedIsImage,
    },
    {
      id: 'brush',
      icon: <Paintbrush size={22} />,
      label: 'Brush',
      action: () => {
        if (brushActive) {
          onBrushDone();
          return;
        }
        dispatch({ type: 'SET_TOOL', payload: 'brush' });
        dispatch({ type: 'CLOSE_PANEL' });
      },
    },
    {
      id: 'transform',
      icon: <Maximize2 size={22} />,
      label: 'Transform',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'transform' }),
      disabled: !hasSelection,
    },
    {
      id: 'nudge',
      icon: <Move size={22} />,
      label: 'Nudge',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'nudge' }),
      disabled: !hasSelection,
    },
    {
      id: 'colorStudio',
      icon: <Palette size={22} />,
      label: 'Colors',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'colorStudio' }),
    },
    {
      id: 'crop',
      icon: <Crop size={22} />,
      label: 'Crop',
      action: () => onCropImage?.(),
    },
    {
      id: 'stroke',
      icon: <PenLine size={22} />,
      label: 'Stroke',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'stroke' }),
      disabled: !hasSelection,
    },
    {
      id: 'opacity-tool',
      icon: <Droplet size={22} />,
      label: 'Opacity',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'opacity-tool' }),
      disabled: !hasSelection,
      accent: '#00F5FF',
    },
    {
      id: 'radius-tool',
      icon: <SquareRoundCorner size={22} />,
      label: 'Radius',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'radius-tool' }),
      disabled: !hasSelection || !isRect,
      accent: '#00F5FF',
    },
    {
      id: 'adjust',
      icon: <SlidersVertical size={22} />,
      label: 'Adjust',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'adjust' }),
      disabled: !hasSelection,
    },
    {
      id: 'properties',
      icon: <SlidersHorizontal size={22} />,
      label: 'Style',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'properties' }),
      disabled: !hasSelection,
    },
    {
      id: 'shapeModifiers',
      icon: <Layers2 size={22} />,
      label: 'Modifiers',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'shapeModifiers' }),
    },
    {
      id: 'shadows',
      icon: <Layers3 size={22} />,
      label: 'Shadows',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'shadows' }),
      disabled: !hasSelection,
    },
    {
      id: 'threeD',
      icon: <Box size={22} />,
      label: '3D',
      accent: '#00F5FF',
      action: () => {
        dispatch({ type: 'SET_TOOL', payload: '3d' });
        dispatch({ type: 'TOGGLE_PANEL', payload: 'threeD' });
      },
    },
    { id: 'layers', icon: <Layers size={22} />, label: 'Layers', action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'layers' }) },
    { id: 'export', icon: <Download size={22} />, label: 'Export', action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'export' }) },
  ];

  return (
    <div
      className="flex-shrink-0"
      style={{ background: '#11141A', ...toolbarBg }}
      data-testid="bottom-toolbar"
    >
      {/* ── Scrollable icon row ── */}
      <div className="overflow-x-auto scrollbar-hide">
        <div
          className="flex items-start px-1 pt-3 gap-0"
          style={{ minWidth: 'max-content', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          {tools.map((tool) => {
            const isActive =
              tool.id === 'select'
                ? state.activeTool === 'select' && state.activePanel === null
                : tool.id === 'pan-tool'
                ? state.activeTool === 'pan'
                : tool.id === 'zoom-tool'
                ? state.activePanel === 'zoom'
                : tool.id === 'brush'
                ? brushActive
                : state.activePanel === tool.id;

            const activeColor = tool.accent ?? '#00F5FF';

            return (
              <button
                key={tool.id}
                onClick={tool.disabled ? undefined : () => {
                  if (brushActive && tool.id !== 'brush') onBrushDone();
                  tool.action();
                }}
                disabled={tool.disabled}
                data-testid={`toolbar-${tool.id}`}
                className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 disabled:opacity-30 flex-shrink-0 min-w-[60px]"
                style={{
                  color: isActive ? activeColor : '#6b7280',
                  filter: isActive ? `drop-shadow(0 0 6px ${activeColor}80)` : 'none',
                }}
              >
                {tool.icon}
                <span className="text-[10px] font-medium leading-none whitespace-nowrap">{tool.label}</span>
                {isActive && (
                  <span
                    className="absolute bottom-1 w-1 h-1 rounded-full"
                    style={{ background: activeColor, boxShadow: `0 0 4px ${activeColor}` }}
                    data-testid={`toolbar-active-indicator-${tool.id}`}
                  />
                )}
              </button>
            );
          })}

          {/* Vector anchor editor — only shown when a path object is selected */}
          {selectedIsPath && hasSelection && (
            <button
              onClick={onVectorEditStart}
              className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 flex-shrink-0 min-w-[60px]"
              style={{ color: '#7B2FFF' }}
              title="Edit anchor points"
            >
              <Spline size={22} />
              <span className="text-[10px] font-medium leading-none whitespace-nowrap">Points</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
