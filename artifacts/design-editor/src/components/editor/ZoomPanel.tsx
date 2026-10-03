import { useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { useEditor } from '@/store/editorStore';
import type { CanvasController } from '@/hooks/useFabricCanvas';
import {
  ChevronDown,
  ChevronUp,
  Hand,
  Maximize2,
  Minus,
  Plus,
  ZoomIn,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ZoomPanelProps {
  controller: CanvasController;
}

const EXTRA_PRESETS = [
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: '100%', value: 100 },
  { label: '125%', value: 125 },
  { label: '150%', value: 150 },
  { label: '200%', value: 200 },
];

export default function ZoomPanel({ controller }: ZoomPanelProps) {
  const { state, dispatch } = useEditor();
  const [expanded, setExpanded] = useState(false);
  const zoomPercent = Math.round(controller.zoom * 100);
  const isOpen = state.activePanel === 'zoom';
  const panEnabled = state.activeTool === 'pan';

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const setZoomPreset = (percent: number) => controller.setZoomLevel(percent);
  const togglePanMode = () => {
    dispatch({ type: 'SET_TOOL', payload: panEnabled ? 'select' : 'pan' });
  };

  return (
    <div
      className="absolute bottom-full left-1/2 z-[9999] mb-2 flex w-[min(720px,calc(100vw-20px))] -translate-x-1/2 flex-col"
      data-testid="zoom-panel"
    >
      <div
        className={`overflow-hidden rounded-2xl transition-all duration-300 ${
          expanded
            ? 'mb-2 max-h-[min(72vh,650px)] overflow-y-auto opacity-100'
            : 'pointer-events-none max-h-0 opacity-0'
        }`}
        style={{
          background: '#11141A',
          border: expanded ? '1px solid rgba(0,245,255,0.25)' : '1px solid transparent',
          boxShadow: expanded ? '0 -8px 30px rgba(0,0,0,0.45)' : 'none',
        }}
        aria-hidden={!expanded}
        data-testid="zoom-studio"
      >
        <div className="space-y-4 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ZoomIn size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Zoom &amp; Pan Studio</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Canvas navigation
            </span>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                Zoom presets
              </span>
              <button
                type="button"
                onClick={controller.resetZoom}
                className="rounded-lg border border-primary/20 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
              >
                Fit Canvas
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {EXTRA_PRESETS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setZoomPreset(value)}
                  className={`rounded-lg border px-2 py-2 text-[10px] font-mono transition-colors ${
                    zoomPercent === value
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-white/10 bg-white/[0.035] text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                  aria-pressed={zoomPercent === value}
                  data-testid={`zoom-preset-${value}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={controller.zoomOut}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              <Minus size={13} />
              Zoom Out
            </button>
            <button
              type="button"
              onClick={controller.zoomIn}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              <Plus size={13} />
              Zoom In
            </button>
            <button
              type="button"
              onClick={togglePanMode}
              aria-pressed={panEnabled}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[11px] transition-colors ${
                panEnabled
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-primary/30 hover:text-primary'
              }`}
              data-testid="zoom-pan-toggle"
            >
              <Hand size={13} />
              {panEnabled ? 'Pan Mode On' : 'Pan Canvas'}
            </button>
          </div>
          {panEnabled && (
            <p className="text-[10px] text-muted-foreground">
              Drag the canvas to reposition it. Select an object to return to editing.
            </p>
          )}
        </div>
      </div>

      <div
        className="flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2.5"
        style={{
          background: '#11141A',
          borderColor: 'rgba(0,245,255,0.3)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
        }}
        data-testid="zoom-compact-pill"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-12 max-w-[48px] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-primary hover:bg-primary/10"
              aria-label="Choose zoom preset"
              title="Zoom presets"
            >
              <ZoomIn size={14} aria-hidden="true" />
              <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-52 border-cyan-400/20 bg-[#11141A] text-foreground">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">
              Zoom preset
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={controller.resetZoom} className="gap-2 text-xs">
              <Maximize2 size={14} className="text-primary" />
              <span>Fit Canvas</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setZoomPreset(100)} className="gap-2 text-xs">
              <ZoomIn size={14} className="text-primary" />
              <span>100% (1:1)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setZoomPreset(200)} className="gap-2 text-xs">
              <Plus size={14} className="text-primary" />
              <span>200%</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setZoomPreset(50)} className="gap-2 text-xs">
              <Minus size={14} className="text-primary" />
              <span>50%</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="min-w-0 w-full flex-1">
          <Slider
            min={10}
            max={200}
            step={5}
            value={[zoomPercent]}
            onValueChange={([value]) => controller.setZoomLevel(value)}
            className="w-full"
            aria-label="Canvas zoom"
            data-testid="zoom-slider"
          />
        </div>
        <span className="min-w-[42px] shrink-0 text-right font-mono text-[10px] text-primary" data-testid="zoom-value">
          {zoomPercent}%
        </span>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
          aria-label={expanded ? 'Collapse zoom controls' : 'Expand zoom controls'}
          aria-expanded={expanded}
          data-testid="zoom-expand-toggle"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
    </div>
  );
}