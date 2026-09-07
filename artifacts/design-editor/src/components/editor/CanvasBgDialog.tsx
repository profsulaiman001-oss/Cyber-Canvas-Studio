import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Pipette, FlipHorizontal2, Trash2, Plus } from 'lucide-react';
import { useEditor, CanvasBgConfig } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import ColorPicker from './ColorPicker';
import {
  ColorHistory,
  GradientBar,
  GradientPreview,
  readColorHistory,
  recentEntryKey,
  saveColorHistory,
  type FillMode,
  type RecentColorEntry,
  type Stop,
} from './ColorStudioPanel';

export interface BackgroundEyedropperContext {
  mode: FillMode;
  selectedStop: number;
}

interface CanvasBgDialogProps {
  controller: CanvasController;
  eyedropperActive: boolean;
  onEyedropper: (context: BackgroundEyedropperContext) => void;
  sampledColor?: string | null;
  sampledColorCommitted?: string | null;
}

const DEFAULT_STOPS: Stop[] = [
  { offset: 0, color: '#00F5FF' },
  { offset: 1, color: '#7B2FFF' },
];

function normalizeConfig(config: CanvasBgConfig): CanvasBgConfig {
  return {
    type: config.type ?? 'solid',
    color: config.color ?? '#ffffff',
    gradientType: config.gradientType ?? 'linear',
    gradientStops: config.gradientStops?.length
      ? config.gradientStops.map((stop) => ({ ...stop }))
      : DEFAULT_STOPS.map((stop) => ({ ...stop })),
    gradientAngle: config.gradientAngle ?? 0,
    gradientOrigin: {
      x: config.gradientOrigin?.x ?? 0.5,
      y: config.gradientOrigin?.y ?? 0.5,
    },
    radialRadius: config.radialRadius ?? 540,
  };
}

function lerpStopColor(stops: Stop[], position: number): string {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  if (!sorted.length) return '#888888';
  if (position <= sorted[0].offset) return sorted[0].color;
  if (position >= sorted[sorted.length - 1].offset) return sorted[sorted.length - 1].color;
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const first = sorted[index];
    const second = sorted[index + 1];
    if (position < first.offset || position > second.offset) continue;
    const ratio = (position - first.offset) / Math.max(0.0001, second.offset - first.offset);
    const parse = (color: string) => {
      const value = color.replace('#', '');
      const expanded = value.length === 3 ? value.split('').map((part) => part + part).join('') : value;
      return [
        parseInt(expanded.slice(0, 2), 16) || 0,
        parseInt(expanded.slice(2, 4), 16) || 0,
        parseInt(expanded.slice(4, 6), 16) || 0,
      ];
    };
    const a = parse(first.color);
    const b = parse(second.color);
    return `#${a.map((channel, channelIndex) => (
      Math.round(channel + (b[channelIndex] - channel) * ratio)
    ).toString(16).padStart(2, '0')).join('')}`;
  }
  return '#888888';
}

function Tab({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 py-2 rounded-xl text-xs capitalize font-medium transition-all"
      style={{
        background: active ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
        color: active ? '#00F5FF' : '#9ca3af',
        border: `1px solid ${active ? '#00F5FF' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {children}
    </button>
  );
}

function backgroundEntry(config: CanvasBgConfig): RecentColorEntry | null {
  if (config.type === 'solid') {
    return { kind: 'solid', color: config.color };
  }
  if (config.type !== 'gradient') return null;
  return {
    kind: 'gradient',
    mode: config.gradientType,
    stops: config.gradientStops.map((stop) => ({ ...stop })),
    angle: config.gradientAngle,
    origin: { ...config.gradientOrigin },
    radialRadius: config.radialRadius,
  };
}

export default function CanvasBgDialog({
  controller,
  eyedropperActive,
  onEyedropper,
  sampledColor,
  sampledColorCommitted,
}: CanvasBgDialogProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'canvasBg';
  const [cfg, setCfg] = useState<CanvasBgConfig>(() => normalizeConfig(state.canvasBg));
  const [colorHistory, setColorHistory] = useState<RecentColorEntry[]>(readColorHistory);
  const [selectedStop, setSelectedStop] = useState(0);
  const eyedropperReturnContextRef = useRef<BackgroundEyedropperContext | null>(null);

  useEffect(() => {
    setCfg(normalizeConfig(state.canvasBg));
  }, [state.canvasBg]);

  useEffect(() => {
    if (!sampledColor) return;
    const context = eyedropperReturnContextRef.current;
    const mode = context?.mode ?? (cfg.type === 'gradient' ? cfg.gradientType : 'solid');
    const stopIndex = context?.selectedStop ?? selectedStop;
    setCfg((previous) => {
      if (mode === 'solid' || previous.type !== 'gradient') {
        return { ...previous, type: 'solid', color: sampledColor };
      }
      return {
        ...previous,
        gradientStops: previous.gradientStops.map((stop, index) => (
          index === stopIndex ? { ...stop, color: sampledColor } : stop
        )),
      };
    });
    if (context) {
      setSelectedStop(context.selectedStop);
      eyedropperReturnContextRef.current = null;
    }
  }, [sampledColor, cfg.type, cfg.gradientType, selectedStop]);

  useEffect(() => {
    if (!sampledColorCommitted) return;
    setColorHistory((previous) => {
      const entry: RecentColorEntry = { kind: 'solid', color: sampledColorCommitted };
      const next = [entry, ...previous.filter((candidate) => recentEntryKey(candidate) !== recentEntryKey(entry))].slice(0, 8);
      saveColorHistory(next);
      return next;
    });
  }, [sampledColorCommitted]);

  const preview = useCallback((next: CanvasBgConfig) => {
    const safeNext = normalizeConfig(next);
    setCfg(safeNext);
    dispatch({ type: 'SET_CANVAS_BG', payload: safeNext });
    controller.setCanvasBackground(safeNext);
  }, [controller, dispatch]);

  const pushHistory = useCallback((entry: RecentColorEntry) => {
    setColorHistory((previous) => {
      const next = [entry, ...previous.filter((candidate) => recentEntryKey(candidate) !== recentEntryKey(entry))].slice(0, 8);
      saveColorHistory(next);
      return next;
    });
  }, []);

  const applyCurrent = useCallback((next: CanvasBgConfig = cfg) => {
    const safeNext = normalizeConfig(next);
    preview(safeNext);
    const entry = backgroundEntry(safeNext);
    if (entry?.kind === 'gradient') {
      const stop = safeNext.gradientStops[selectedStop] ?? safeNext.gradientStops[0];
      if (stop) pushHistory({ kind: 'solid', color: stop.color });
    }
    if (entry) pushHistory(entry);
    controller.commitChange();
  }, [cfg, controller, preview, pushHistory, selectedStop]);

  const handleHistoryPick = useCallback((entry: RecentColorEntry) => {
    if (entry.kind === 'solid') {
      const next = cfg.type === 'gradient'
        ? {
            ...cfg,
            gradientStops: cfg.gradientStops.map((stop, index) => (
              index === selectedStop ? { ...stop, color: entry.color ?? '#00F5FF' } : stop
            )),
          }
        : { ...cfg, type: 'solid' as const, color: entry.color ?? '#00F5FF' };
      preview(next);
    } else if (entry.mode && entry.stops?.length) {
      preview({
        ...cfg,
        type: 'gradient',
        gradientType: entry.mode,
        gradientStops: entry.stops.map((stop) => ({ ...stop })),
        gradientAngle: entry.angle ?? cfg.gradientAngle,
        gradientOrigin: entry.origin ? { ...entry.origin } : cfg.gradientOrigin,
        radialRadius: entry.radialRadius ?? cfg.radialRadius,
      });
      setSelectedStop(0);
    }
    pushHistory(entry);
    controller.commitChange();
  }, [cfg, controller, preview, pushHistory, selectedStop]);

  const setType = (type: CanvasBgConfig['type']) => {
    if (type === 'transparent') {
      preview({ ...cfg, type });
    } else if (type === 'gradient') {
      preview({ ...cfg, type, gradientStops: cfg.gradientStops.length >= 2 ? cfg.gradientStops : DEFAULT_STOPS });
    } else {
      preview({ ...cfg, type });
    }
  };

  const setGradientType = (gradientType: CanvasBgConfig['gradientType']) => {
    preview({ ...cfg, type: 'gradient', gradientType });
  };

  const handleMoveStop = useCallback((index: number, offset: number) => {
    preview({
      ...cfg,
      gradientStops: cfg.gradientStops.map((stop, stopIndex) => (
        stopIndex === index ? { ...stop, offset } : stop
      )),
    });
  }, [cfg, preview]);

  const handleAddStop = useCallback((offset: number) => {
    const color = lerpStopColor(cfg.gradientStops, offset);
    const stops = [...cfg.gradientStops, { offset, color }].sort((a, b) => a.offset - b.offset);
    const newIndex = stops.findIndex((stop) => stop.offset === offset && stop.color === color);
    setSelectedStop(newIndex >= 0 ? newIndex : 0);
    preview({ ...cfg, gradientStops: stops });
  }, [cfg, preview]);

  const handleDeleteStop = useCallback(() => {
    if (cfg.gradientStops.length <= 2) return;
    const stops = cfg.gradientStops.filter((_stop, index) => index !== selectedStop);
    setSelectedStop(Math.min(selectedStop, stops.length - 1));
    preview({ ...cfg, gradientStops: stops });
  }, [cfg, preview, selectedStop]);

  const handleStopColorChange = useCallback((color: string) => {
    preview({
      ...cfg,
      gradientStops: cfg.gradientStops.map((stop, index) => (
        index === selectedStop ? { ...stop, color } : stop
      )),
    });
  }, [cfg, preview, selectedStop]);

  const handleFlip = useCallback(() => {
    preview({
      ...cfg,
      gradientStops: cfg.gradientStops
        .map((stop) => ({ ...stop, offset: 1 - stop.offset }))
        .sort((a, b) => a.offset - b.offset),
    });
  }, [cfg, preview]);

  const currentStopColor = cfg.gradientStops[selectedStop]?.color ?? '#00F5FF';
  const isGradient = cfg.type === 'gradient';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '90vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="canvas-background-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between" style={{ paddingRight: '2.75rem' }}>
            <SheetTitle className="text-sm font-semibold">Canvas Background</SheetTitle>
            <button
              type="button"
              onClick={() => {
                const context = {
                  mode: isGradient ? cfg.gradientType : 'solid',
                  selectedStop,
                } satisfies BackgroundEyedropperContext;
                eyedropperReturnContextRef.current = context;
                onEyedropper(context);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0"
              style={{
                background: eyedropperActive ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)',
                color: eyedropperActive ? '#FFD700' : '#9ca3af',
                border: `1px solid ${eyedropperActive ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              <Pipette size={13} />
              <span>Eyedropper</span>
            </button>
          </div>
        </SheetHeader>

        <div className="px-4 space-y-4 pb-10">
          <div className="flex gap-1.5">
            <Tab active={cfg.type === 'transparent'} onClick={() => setType('transparent')}>Transparent</Tab>
            <Tab active={cfg.type === 'solid'} onClick={() => setType('solid')}>Solid</Tab>
            <Tab active={cfg.type === 'gradient'} onClick={() => setType('gradient')}>Gradient</Tab>
          </div>

          {cfg.type === 'transparent' && (
            <div
              className="rounded-2xl overflow-hidden border border-border"
              style={{ height: 178, background: 'repeating-conic-gradient(#888 0% 25%, #bbb 0% 50%) 0 0 / 24px 24px' }}
            />
          )}

          {cfg.type === 'solid' && (
            <>
              <ColorPicker value={cfg.color} onChange={(color) => preview({ ...cfg, color })} />
              <ColorHistory
                history={colorHistory.filter((entry) => entry.kind === 'solid')}
                label="Recent Colors"
                onPick={handleHistoryPick}
              />
              <ColorHistory
                history={colorHistory.filter((entry) => entry.kind === 'gradient')}
                label="Recent Gradients"
                onPick={handleHistoryPick}
              />
            </>
          )}

          {isGradient && (
            <>
              <div className="flex gap-1.5">
                {(['linear', 'radial', 'angular'] as const).map((mode) => (
                  <Tab
                    key={mode}
                    active={cfg.gradientType === mode}
                    onClick={() => setGradientType(mode)}
                  >
                    {mode}
                  </Tab>
                ))}
              </div>

              <GradientBar
                stops={cfg.gradientStops}
                selectedIdx={selectedStop}
                onSelectStop={setSelectedStop}
                onMoveStop={handleMoveStop}
                onAddStop={handleAddStop}
              />

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground flex-1">
                  Stop {selectedStop + 1} / {cfg.gradientStops.length}
                </span>
                <button
                  type="button"
                  onClick={handleFlip}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <FlipHorizontal2 size={13} />
                  Flip
                </button>
                <button
                  type="button"
                  onClick={() => handleAddStop(0.5)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{ background: 'rgba(0,245,255,0.08)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.25)' }}
                >
                  <Plus size={13} />
                  Add Stop
                </button>
                <button
                  type="button"
                  onClick={handleDeleteStop}
                  disabled={cfg.gradientStops.length <= 2}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-30"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Stop {selectedStop + 1} — Color
              </p>
              <ColorPicker value={currentStopColor} onChange={handleStopColorChange} />
              <ColorHistory
                history={colorHistory.filter((entry) => entry.kind === 'solid')}
                label="Recent Colors"
                onPick={handleHistoryPick}
              />
              <ColorHistory
                history={colorHistory.filter((entry) => entry.kind === 'gradient')}
                label="Recent Gradients"
                onPick={handleHistoryPick}
              />

              <GradientPreview
                mode={cfg.gradientType}
                stops={cfg.gradientStops}
                angle={cfg.gradientAngle}
                origin={cfg.gradientOrigin}
                onAngleChange={(angle) => preview({ ...cfg, gradientAngle: angle })}
                onOriginChange={(origin) => preview({ ...cfg, gradientOrigin: origin })}
              />

              {cfg.gradientType === 'angular' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sweep start</span>
                    <span className="text-xs text-primary font-medium">{Math.round(cfg.gradientAngle)}°</span>
                  </div>
                  <Slider
                    min={0}
                    max={360}
                    step={1}
                    value={[cfg.gradientAngle]}
                    onValueChange={([value]) => preview({ ...cfg, gradientAngle: value })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0°</span>
                    <span>360°</span>
                  </div>
                </div>
              )}

              {cfg.gradientType === 'radial' && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Radial Radius</span>
                    <span className="text-xs text-muted-foreground">{Math.round(cfg.radialRadius)}px</span>
                  </div>
                  <Slider
                    min={20}
                    max={1200}
                    step={5}
                    value={[cfg.radialRadius]}
                    onValueChange={([value]) => preview({ ...cfg, radialRadius: value })}
                    className="w-full"
                  />
                </div>
              )}
            </>
          )}

          <Button
            type="button"
            onClick={() => applyCurrent()}
            className="w-full rounded-xl py-3 text-sm font-semibold"
            style={{
              background: 'linear-gradient(135deg, rgba(0,245,255,0.95), rgba(123,47,255,0.95))',
              color: '#061016',
              border: '1px solid rgba(0,245,255,0.75)',
              boxShadow: '0 0 18px rgba(0,245,255,0.2)',
            }}
            data-testid="apply-background-button"
          >
            Apply Background
          </Button>
          <p className="text-center text-[10px] text-muted-foreground -mt-2">
            Live preview updates immediately; Apply saves this background to Recent.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}