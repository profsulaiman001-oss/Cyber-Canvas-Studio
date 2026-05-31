import { MousePointer2, Plus, Layers, SlidersHorizontal, Download, PenTool, X, Paintbrush, Pipette } from 'lucide-react';
import { useEditor, ActivePanel } from '@/store/editorStore';
import { Slider } from '@/components/ui/slider';
import type { BrushPreset } from '@/hooks/useFabricCanvas';

interface BottomToolbarProps {
  hasSelection: boolean;
  penActive: boolean;
  brushActive: boolean;
  eyedropperActive: boolean;
  onPenCancel: () => void;
  onBrushDone: () => void;
  onBrushColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onEyedropper: () => void;
}

const PRESET_LABELS: Record<BrushPreset, string> = {
  standard: 'Paint',
  glow: 'Neon',
  airbrush: 'Airbrush',
};

export default function BottomToolbar({
  hasSelection, penActive, brushActive, eyedropperActive,
  onPenCancel, onBrushDone, onBrushColorChange, onBrushSizeChange, onEyedropper,
}: BottomToolbarProps) {
  const { state, dispatch } = useEditor();

  const toolbarBg = penActive
    ? { borderTop: '1px solid rgba(255,107,107,0.4)' }
    : brushActive
    ? { borderTop: '1px solid rgba(0,245,255,0.6)' }
    : { borderTop: '1px solid rgba(0,245,255,0.15)' };

  /* ── Pen Active Mode ── */
  if (penActive) {
    return (
      <div
        className="flex-shrink-0 flex items-start justify-around px-2 pt-3"
        style={{ minHeight: '64px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: '#11141A', ...toolbarBg }}
      >
        <button onClick={onPenCancel}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl" style={{ color: '#ff6b6b' }}>
          <X size={22} />
          <span className="text-[10px] font-medium leading-none">Cancel</span>
        </button>
        <div className="flex flex-col items-center gap-1 px-4 py-2">
          <PenTool size={22} style={{ color: '#00F5FF', filter: 'drop-shadow(0 0 6px #00F5FF80)' }} />
          <span className="text-[10px] font-medium leading-none" style={{ color: '#00F5FF' }}>Pen Tool</span>
        </div>
        <button onClick={() => dispatch({ type: 'SET_TOOL', payload: 'select' })}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl" style={{ color: '#6b7280' }}>
          <MousePointer2 size={22} />
          <span className="text-[10px] font-medium leading-none">Done</span>
        </button>
      </div>
    );
  }

  /* ── Brush Active Mode ── */
  if (brushActive) {
    return (
      <div
        className="flex-shrink-0 px-4 pt-2"
        style={{ minHeight: '80px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: '#11141A', ...toolbarBg }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Paintbrush size={16} style={{ color: '#00F5FF', filter: 'drop-shadow(0 0 6px #00F5FF80)' }} />
            <span className="text-xs font-semibold" style={{ color: '#00F5FF' }}>
              {PRESET_LABELS[state.brushPreset]} Brush
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Brush color */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Color</span>
              <input
                type="color"
                value={state.brushColor}
                onChange={(e) => onBrushColorChange(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0.5"
              />
            </div>
            {/* Preset switcher */}
            {(['standard', 'glow', 'airbrush'] as BrushPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => dispatch({ type: 'SET_BRUSH_PRESET', payload: p })}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: state.brushPreset === p ? 'rgba(0,245,255,0.2)' : 'rgba(255,255,255,0.06)',
                  color: state.brushPreset === p ? '#00F5FF' : '#6b7280',
                  border: `1px solid ${state.brushPreset === p ? '#00F5FF' : 'transparent'}`,
                }}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
            {/* Done */}
            <button
              onClick={onBrushDone}
              className="px-3 py-1 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(0,245,255,0.12)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.4)' }}
            >
              Done
            </button>
          </div>
        </div>
        {/* Size slider */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground shrink-0">Size: {state.brushSize}px</span>
          <Slider
            min={1} max={80} step={1} value={[state.brushSize]}
            onValueChange={([v]) => onBrushSizeChange(v)}
            className="flex-1"
          />
        </div>
      </div>
    );
  }

  /* ── Normal Toolbar ── */
  const tools: { id: ActivePanel | 'select'; icon: React.ReactNode; label: string; action: () => void; disabled?: boolean }[] = [
    {
      id: 'select',
      icon: <MousePointer2 size={22} />,
      label: 'Select',
      action: () => { dispatch({ type: 'SET_TOOL', payload: 'select' }); dispatch({ type: 'CLOSE_PANEL' }); },
    },
    {
      id: 'add',
      icon: <Plus size={24} />,
      label: 'Add',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'add' }),
    },
    {
      id: 'layers',
      icon: <Layers size={22} />,
      label: 'Layers',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'layers' }),
    },
    {
      id: 'properties',
      icon: <SlidersHorizontal size={22} />,
      label: 'Style',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'properties' }),
      disabled: !hasSelection,
    },
    {
      id: 'export',
      icon: <Download size={22} />,
      label: 'Export',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'export' }),
    },
  ];

  return (
    <div
      className="flex-shrink-0 flex items-start justify-around px-1 pt-3"
      style={{
        minHeight: '64px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: '#11141A',
        ...toolbarBg,
      }}
      data-testid="bottom-toolbar"
    >
      {tools.map((tool) => {
        const isActive =
          tool.id === 'select'
            ? state.activeTool === 'select' && state.activePanel === null
            : state.activePanel === tool.id;
        return (
          <button
            key={tool.id}
            onClick={tool.disabled ? undefined : tool.action}
            disabled={tool.disabled}
            data-testid={`toolbar-${tool.id}`}
            className="relative flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-200 disabled:opacity-30"
            style={{
              color: isActive ? '#00F5FF' : '#6b7280',
              filter: isActive ? 'drop-shadow(0 0 6px #00F5FF80)' : 'none',
            }}
          >
            {tool.icon}
            <span className="text-[10px] font-medium leading-none">{tool.label}</span>
            {isActive && (
              <span className="absolute bottom-1 w-1 h-1 rounded-full"
                style={{ background: '#00F5FF', boxShadow: '0 0 4px #00F5FF' }} />
            )}
          </button>
        );
      })}

      {/* Eyedropper */}
      <button
        onClick={onEyedropper}
        data-testid="toolbar-eyedropper"
        className="relative flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-200"
        style={{
          color: eyedropperActive ? '#FFD700' : '#6b7280',
          filter: eyedropperActive ? 'drop-shadow(0 0 6px #FFD70080)' : 'none',
        }}
      >
        <Pipette size={22} />
        <span className="text-[10px] font-medium leading-none">Pick</span>
        {eyedropperActive && (
          <span className="absolute bottom-1 w-1 h-1 rounded-full"
            style={{ background: '#FFD700', boxShadow: '0 0 4px #FFD700' }} />
        )}
      </button>
    </div>
  );
}
