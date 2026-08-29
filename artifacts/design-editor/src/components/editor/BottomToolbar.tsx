import { useState } from 'react';
import {
  MousePointer2, Plus, Layers, SlidersHorizontal, Download,
  PenTool, X, Paintbrush, Palette, Spline, Type, Layers2, SlidersVertical, Crosshair,
  PenLine, Layers3, Box, GitBranch, Hand, ZoomIn, Image, Crop, ImagePlus,
  Droplet, SquareRoundCorner, ChevronUp,
} from 'lucide-react';
import { useEditor, ActivePanel } from '@/store/editorStore';
import { Slider } from '@/components/ui/slider';
import type { BrushPreset } from '@/hooks/useFabricCanvas';

const BRUSH_MENU_PRESETS: { id: BrushPreset; label: string; desc: string }[] = [
  { id: 'standard', label: 'Paint',    desc: 'Freehand stroke' },
  { id: 'glow',     label: 'Neon',     desc: 'Glow emission'   },
  { id: 'airbrush', label: 'Airbrush', desc: 'Feathered spray' },
];

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
  onBrushColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onNeonIntensityChange?: (v: number) => void;
  onVectorEditStart?: () => void;
  onVectorEditEnd?: () => void;
  brushColorPickerOpen?: boolean;
  onToggleBrushColorPicker?: () => void;
  onImportImages?: () => void;
  onFillWithImage?: () => void;
  onCropImage?: () => void;
  isRect?: boolean;
}

const PRESET_LABELS: Record<BrushPreset, string> = {
  standard: 'Paint',
  glow: 'Neon',
  airbrush: 'Airbrush',
};

export default function BottomToolbar({
  hasSelection, penActive, brushActive,
  selectedIsPath = false,
  selectedIsImage = false,
  vectorEditActive = false,
  panActive = false,
  onPenCancel, onBrushDone, onBrushColorChange: _onBrushColorChange, onBrushSizeChange,
  onNeonIntensityChange,
  onVectorEditStart, onVectorEditEnd,
  brushColorPickerOpen = false,
  onToggleBrushColorPicker,
  onImportImages,
  onFillWithImage,
  onCropImage,
  isRect = false,
}: BottomToolbarProps) {
  const { state, dispatch } = useEditor();
  const [brushMenuOpen, setBrushMenuOpen] = useState(false);

  const startBrush = (preset: BrushPreset) => {
    dispatch({ type: 'SET_BRUSH_PRESET', payload: preset });
    dispatch({ type: 'SET_TOOL', payload: 'brush' });
    setBrushMenuOpen(false);
  };

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

  /* ── Brush Active Mode ── */
  if (brushActive) {
    const isNeonPreset = state.brushPreset === 'glow';
    return (
      <div
        className="flex-shrink-0 px-4 pt-2"
        style={{
          background: '#11141A', ...toolbarBg,
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Paintbrush size={15} style={{ color: '#00F5FF', filter: 'drop-shadow(0 0 6px #00F5FF80)' }} />
            <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#00F5FF' }}>
              {PRESET_LABELS[state.brushPreset]} Brush
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground">Color</span>
            <button
              onClick={onToggleBrushColorPicker}
              className="w-7 h-7 rounded border-2 transition-all flex-shrink-0"
              style={{
                background: state.brushColor,
                borderColor: brushColorPickerOpen ? '#00F5FF' : 'rgba(255,255,255,0.25)',
                boxShadow: brushColorPickerOpen ? `0 0 8px ${state.brushColor}60` : 'none',
              }}
              aria-label="Open brush color picker"
            />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
            {(['standard', 'glow', 'airbrush'] as BrushPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => dispatch({ type: 'SET_BRUSH_PRESET', payload: p })}
                className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: state.brushPreset === p ? 'rgba(0,245,255,0.2)' : 'rgba(255,255,255,0.06)',
                  color: state.brushPreset === p ? '#00F5FF' : '#6b7280',
                  border: `1px solid ${state.brushPreset === p ? '#00F5FF' : 'transparent'}`,
                }}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
            <button
              onClick={onBrushDone}
              className="px-3 py-1 rounded-lg text-xs font-medium flex-shrink-0 ml-1"
              style={{ background: 'rgba(0,245,255,0.12)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.4)' }}
            >
              Done
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground shrink-0">Size: {state.brushSize}px</span>
          <Slider min={1} max={80} step={1} value={[state.brushSize]} onValueChange={([v]) => onBrushSizeChange(v)} className="flex-1" />
        </div>
        {isNeonPreset && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] shrink-0" style={{ color: '#00F5FF' }}>Glow: {state.neonIntensity}%</span>
            <Slider
              min={10} max={100} step={1}
              value={[state.neonIntensity]}
              onValueChange={([v]) => onNeonIntensityChange?.(v)}
              className="flex-1"
            />
          </div>
        )}
      </div>
    );
  }

  /* ── Normal Toolbar ── */
  type ToolId = ActivePanel | 'select' | 'pan-tool' | 'zoom-tool';

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
    {
      id: 'vectors',
      icon: <GitBranch size={22} />,
      label: 'Vectors',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'vectors' }),
      accent: '#7B2FFF',
    },
    { id: 'text', icon: <Type size={22} />, label: 'Text', action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'text' }) },
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
      id: 'shapeModifiers',
      icon: <Layers2 size={22} />,
      label: 'Modifiers',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'shapeModifiers' }),
    },
    {
      id: 'adjust',
      icon: <SlidersVertical size={22} />,
      label: 'Adjust',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'adjust' }),
      disabled: !selectedIsImage,
    },
    {
      id: 'nudge',
      icon: <Crosshair size={22} />,
      label: 'Nudge',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'nudge' }),
      disabled: !hasSelection,
    },
    { id: 'layers', icon: <Layers size={22} />, label: 'Layers', action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'layers' }) },
    {
      id: 'properties',
      icon: <SlidersHorizontal size={22} />,
      label: 'Style',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'properties' }),
      disabled: !hasSelection,
    },
    {
      id: 'stroke',
      icon: <PenLine size={22} />,
      label: 'Stroke',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'stroke' }),
      disabled: !hasSelection,
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
      action: () => {
        dispatch({ type: 'SET_TOOL', payload: '3d' });
        dispatch({ type: 'TOGGLE_PANEL', payload: 'threeD' });
      },
    },
    {
      id: 'colorStudio',
      icon: <Palette size={22} />,
      label: 'Colors',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'colorStudio' }),
    },
    { id: 'export', icon: <Download size={22} />, label: 'Export', action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'export' }) },
  ];

  return (
    <div
      className="flex-shrink-0"
      style={{ background: '#11141A', ...toolbarBg }}
      data-testid="bottom-toolbar"
    >
      {/* ── Brush contextual popup ── */}
      {brushMenuOpen && (
        <div
          className="px-4 py-3 space-y-3"
          style={{ borderTop: '1px solid rgba(0,245,255,0.25)', background: '#11141A' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#00F5FF' }}>
              <Paintbrush size={11} className="inline mr-1" />Brush
            </span>
            <button
              onClick={() => setBrushMenuOpen(false)}
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ color: '#6b7280', background: 'rgba(255,255,255,0.05)' }}
            >✕</button>
          </div>
          <div className="flex gap-2">
            {BRUSH_MENU_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => startBrush(p.id)}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all active:scale-95"
                style={{
                  background: state.brushPreset === p.id
                    ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${state.brushPreset === p.id ? '#00F5FF' : 'rgba(255,255,255,0.1)'}`,
                  color: state.brushPreset === p.id ? '#00F5FF' : '#9ca3af',
                }}
              >
                <Paintbrush size={16} />
                <span className="text-[10px] font-medium leading-none">{p.label}</span>
                <span className="text-[9px] text-muted-foreground leading-none">{p.desc}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground shrink-0">Size: {state.brushSize}px</span>
            <Slider
              min={1} max={80} step={1}
              value={[state.brushSize]}
              onValueChange={([v]) => dispatch({ type: 'SET_BRUSH_SIZE', payload: v })}
              className="flex-1"
            />
          </div>
        </div>
      )}

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
                : state.activePanel === tool.id;

            const activeColor = tool.accent ?? '#00F5FF';

            return (
              <button
                key={tool.id}
                onClick={tool.disabled ? undefined : tool.action}
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
                  />
                )}
              </button>
            );
          })}

          {/* Brush tool button */}
          <button
            onClick={() => { setBrushMenuOpen((o) => !o); dispatch({ type: 'CLOSE_PANEL' }); }}
            className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 flex-shrink-0 min-w-[60px]"
            style={{
              color: brushMenuOpen ? '#00F5FF' : '#6b7280',
              filter: brushMenuOpen ? 'drop-shadow(0 0 6px #00F5FF80)' : 'none',
            }}
            data-testid="toolbar-brush"
          >
            <Paintbrush size={22} />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">Brush</span>
            {brushMenuOpen && (
              <>
                <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ background: '#00F5FF', boxShadow: '0 0 4px #00F5FF' }} />
                <ChevronUp size={10} className="absolute top-1 right-1 opacity-60" style={{ color: '#00F5FF' }} />
              </>
            )}
          </button>

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

          {/* Image tools */}
          <button
            onClick={onImportImages}
            className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 flex-shrink-0 min-w-[60px]"
            style={{ color: '#6b7280' }}
            title="Import images"
          >
            <ImagePlus size={22} />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">Photos</span>
          </button>

          {hasSelection && !selectedIsImage && (
            <button
              onClick={onFillWithImage}
              className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 flex-shrink-0 min-w-[60px]"
              style={{ color: '#6b7280' }}
              title="Fill shape with image"
            >
              <Image size={22} />
              <span className="text-[10px] font-medium leading-none whitespace-nowrap">Fill Img</span>
            </button>
          )}

          {/* Crop supports images plus rasterized shapes, vectors, text, and groups.
              Keep it visible even when there is no active selection. */}
          <button
            onClick={() => onCropImage?.()}
            className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 flex-shrink-0 min-w-[60px]"
            style={{ color: '#6b7280' }}
            title="Crop selected object"
          >
            <Crop size={22} />
            <span className="text-[10px] font-medium leading-none whitespace-nowrap">Crop</span>
          </button>
        </div>
      </div>
    </div>
  );
}
