import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Droplet,
  Paintbrush,
  Ruler,
  Sparkles,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEditor } from '@/store/editorStore';
import type { BrushPreset } from '@/hooks/useFabricCanvas';
import ColorPicker from './ColorPicker';

interface BrushPanelProps {
  open: boolean;
  onColorChange: (color: string) => void;
}

type BrushParameter = 'size' | 'opacity';

const PRESETS: { id: BrushPreset; label: string; icon: LucideIcon; description: string }[] = [
  { id: 'standard', label: 'Paint', icon: Paintbrush, description: 'A clean, solid freehand stroke.' },
  { id: 'glow', label: 'Neon', icon: Sparkles, description: 'A bright stroke with a soft neon bloom.' },
  { id: 'airbrush', label: 'Airbrush', icon: Wind, description: 'A soft, feathered spray effect.' },
];

export default function BrushPanel({ open, onColorChange }: BrushPanelProps) {
  const { state, dispatch } = useEditor();
  const [activeParameter, setActiveParameter] = useState<BrushParameter>('size');
  const [expanded, setExpanded] = useState(false);
  const activePreset = PRESETS.find((preset) => preset.id === state.brushPreset) ?? PRESETS[0];
  const ActivePresetIcon = activePreset.icon;
  const parameterValue = activeParameter === 'size'
    ? state.brushSize
    : state.brushPreset === 'glow'
      ? state.neonIntensity
      : state.brushOpacity;
  const parameterLabel = state.brushPreset === 'glow' ? 'Glow' : 'Opacity';
  const ParameterIcon = activeParameter === 'size' ? Ruler : state.brushPreset === 'glow' ? Sparkles : Droplet;

  if (!open) return null;

  const setParameterValue = (value: number) => {
    if (activeParameter === 'size') {
      dispatch({ type: 'SET_BRUSH_SIZE', payload: value });
    } else if (state.brushPreset === 'glow') {
      dispatch({ type: 'SET_NEON_INTENSITY', payload: value });
    } else {
      dispatch({ type: 'SET_BRUSH_OPACITY', payload: value });
    }
  };

  return (
    <div
      className="absolute bottom-full left-1/2 z-[9999] mb-2 w-[min(420px,calc(100vw-16px))] -translate-x-1/2"
      data-testid="brush-panel"
    >
      <div
        className={`overflow-hidden rounded-2xl transition-all duration-300 ease-in-out ${
          expanded ? 'mb-2 max-h-[min(62vh,560px)] overflow-y-auto opacity-100' : 'pointer-events-none max-h-0 opacity-0'
        }`}
        style={{
          background: '#11141A',
          border: expanded ? '1px solid rgba(0,245,255,0.25)' : '1px solid transparent',
          boxShadow: expanded ? '0 -8px 30px rgba(0,0,0,0.45)' : 'none',
        }}
        aria-hidden={!expanded}
        data-testid="brush-studio-drawer"
      >
        <div className="space-y-3 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Paintbrush size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Brush Studio</span>
              <span className="rounded-full border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-[10px] text-primary">
                {activePreset.label}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">{activePreset.description}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Brush color</span>
              <span className="font-mono text-[10px] text-muted-foreground">{state.brushColor.toUpperCase()}</span>
            </div>
            <ColorPicker value={state.brushColor} onChange={onColorChange} />
          </div>
        </div>
      </div>

      <div
        className="flex h-12 w-full items-center gap-2 rounded-2xl border border-primary/30 bg-[#11141A] px-2 shadow-[0_4px_24px_rgba(0,0,0,0.55),0_0_18px_rgba(0,245,255,0.08)]"
        data-testid="brush-compact-pill"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-12 max-w-[48px] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-primary transition-colors hover:bg-primary/10"
              aria-label={`Brush type: ${activePreset.label}`}
              title={activePreset.label}
              data-testid="brush-preset-selector"
            >
              <ActivePresetIcon size={16} className="shrink-0" aria-hidden="true" />
              <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-44 border-cyan-400/20 bg-[#11141A] text-foreground">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">Brush type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={state.brushPreset}
              onValueChange={(value) => dispatch({ type: 'SET_BRUSH_PRESET', payload: value as BrushPreset })}
            >
              {PRESETS.map((preset) => {
                const PresetIcon = preset.icon;
                const isActive = preset.id === state.brushPreset;
                return (
                  <DropdownMenuRadioItem
                    key={preset.id}
                    value={preset.id}
                    className="gap-2 text-xs data-[state=checked]:text-primary"
                  >
                    <PresetIcon
                      size={16}
                      className={`shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                      aria-hidden="true"
                    />
                    <span>{preset.label}</span>
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-12 max-w-[48px] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-primary transition-colors hover:bg-primary/10"
              aria-label={`Brush parameter: ${activeParameter === 'size' ? 'Size' : 'Opacity or glow'}`}
              title={activeParameter === 'size' ? 'Size' : 'Opacity / Glow'}
              data-testid="brush-parameter-selector"
            >
              <ParameterIcon size={15} aria-hidden="true" />
              <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-48 border-cyan-400/20 bg-[#11141A] text-foreground">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">Brush parameter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={activeParameter}
              onValueChange={(value) => setActiveParameter(value as BrushParameter)}
            >
              <DropdownMenuRadioItem value="size" className="gap-2 text-xs">
                <Ruler size={14} className="text-primary" />
                <span>Size</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">1–100 px</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="opacity" className="gap-2 text-xs">
                {state.brushPreset === 'glow'
                  ? <Sparkles size={14} className="text-primary" />
                  : <Droplet size={14} className="text-primary" />}
                <span>Opacity / Glow</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">0–100%</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="min-w-[48px] flex-1 px-1">
          <Slider
            min={activeParameter === 'size' ? 1 : 0}
            max={100}
            step={1}
            value={[parameterValue]}
            onValueChange={([value]) => setParameterValue(value)}
            aria-label={activeParameter === 'size' ? 'Brush size in pixels' : `Brush ${parameterLabel.toLowerCase()} percentage`}
            className="w-full"
            data-testid="brush-parameter-slider"
          />
        </div>
        <span
          className="min-w-[44px] shrink-0 text-right font-mono text-[10px] tabular-nums text-primary"
          data-testid="brush-parameter-value"
        >
          {activeParameter === 'size' ? `${parameterValue}px` : `${parameterValue}%`}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] transition-colors hover:border-primary/40 hover:bg-primary/10"
          style={{ backgroundColor: state.brushColor }}
          aria-label="Open Brush Studio color controls"
          title="Brush color"
          data-testid="brush-color-shortcut"
        >
          <span className="sr-only">Open Brush Studio color controls</span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
          aria-label={expanded ? 'Collapse Brush Studio drawer' : 'Expand Brush Studio drawer'}
          aria-expanded={expanded}
          data-testid="brush-studio-toggle"
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>
    </div>
  );
}