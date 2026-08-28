import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Pipette, FlipHorizontal2, Trash2, Plus, Move, RotateCw } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import ColorPicker from './ColorPicker';

interface Stop { offset: number; color: string }

interface ColorStudioProps {
  controller: CanvasController;
  eyedropperActive: boolean;
  onEyedropper: () => void;
}

/* ─── Color helpers ─── */
function hexToRgbArr(hex: string): [number, number, number] {
  const c = hex.replace(/^#+/, '');
  const clean = c.length === 3 ? c[0]+c[0]+c[1]+c[1]+c[2]+c[2] : c;
  if (clean.length !== 6) return [0, 0, 0];
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}
function rgbToHexStr(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
function lerpStopColor(stops: Stop[], pos: number): string {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  if (!sorted.length) return '#888888';
  if (pos <= sorted[0].offset) return sorted[0].color;
  if (pos >= sorted[sorted.length - 1].offset) return sorted[sorted.length - 1].color;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (pos >= sorted[i].offset && pos <= sorted[i + 1].offset) {
      const t = (pos - sorted[i].offset) / (sorted[i + 1].offset - sorted[i].offset);
      const [r1, g1, b1] = hexToRgbArr(sorted[i].color);
      const [r2, g2, b2] = hexToRgbArr(sorted[i + 1].color);
      return rgbToHexStr(
        Math.round(r1 + (r2 - r1) * t),
        Math.round(g1 + (g2 - g1) * t),
        Math.round(b1 + (b2 - b1) * t),
      );
    }
  }
  return '#888888';
}

function readColorHistory(): string[] {
  try { return JSON.parse(localStorage.getItem('cs_color_history') || '[]'); } catch { return []; }
}
function saveColorHistory(h: string[]) {
  try { localStorage.setItem('cs_color_history', JSON.stringify(h)); } catch { /* ignore */ }
}

/* ─── Gradient bar with individually draggable stop markers ─── */
function GradientBar({
  stops, selectedIdx, onSelectStop, onMoveStop, onAddStop,
}: {
  stops: Stop[];
  selectedIdx: number;
  onSelectStop: (i: number) => void;
  onMoveStop: (i: number, offset: number) => void;
  onAddStop: (offset: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragIdxRef = useRef<number | null>(null);
  const onMoveRef = useRef(onMoveStop);
  useEffect(() => { onMoveRef.current = onMoveStop; }, [onMoveStop]);

  const sortedStops = useMemo(() => [...stops].sort((a, b) => a.offset - b.offset), [stops]);
  const gradCSS = sortedStops.length >= 2
    ? `linear-gradient(to right, ${sortedStops.map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`).join(', ')})`
    : (sortedStops[0]?.color ?? '#888');

  const getBarOffset = useCallback((clientX: number): number => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (dragIdxRef.current === null) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      onMoveRef.current(dragIdxRef.current, getBarOffset(clientX));
    };
    const onUp = () => { dragIdxRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [getBarOffset]);

  const handleBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const offset = getBarOffset(e.clientX);
    let nearestIdx = -1; let nearestDist = Infinity;
    stops.forEach((s, i) => {
      const d = Math.abs(s.offset - offset);
      if (d < 0.08 && d < nearestDist) { nearestDist = d; nearestIdx = i; }
    });
    if (nearestIdx >= 0) {
      onSelectStop(nearestIdx);
      dragIdxRef.current = nearestIdx;
    } else {
      onAddStop(offset);
    }
  };

  const handleStopMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    onSelectStop(idx);
    dragIdxRef.current = idx;
  };
  const handleStopTouchStart = (e: React.TouchEvent, idx: number) => {
    e.stopPropagation();
    onSelectStop(idx);
    dragIdxRef.current = idx;
  };

  return (
    <div className="relative select-none" style={{ paddingBottom: 36 }}>
      <div
        ref={barRef}
        className="h-10 rounded-xl w-full"
        style={{
          background: gradCSS,
          border: '1px solid rgba(255,255,255,0.12)',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
        onMouseDown={handleBarMouseDown}
      />
      {stops.map((stop, i) => (
        <div
          key={i}
          className="absolute flex flex-col items-center"
          style={{
            left: `${stop.offset * 100}%`,
            top: 42,
            transform: 'translateX(-50%)',
            cursor: 'ew-resize',
            touchAction: 'none',
            zIndex: selectedIdx === i ? 2 : 1,
          }}
          onMouseDown={(e) => handleStopMouseDown(e, i)}
          onTouchStart={(e) => handleStopTouchStart(e, i)}
        >
          <div style={{
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderBottom: `7px solid ${selectedIdx === i ? '#00F5FF' : 'rgba(255,255,255,0.4)'}`,
          }} />
          <div style={{
            width: 18, height: 18,
            background: stop.color,
            border: `2.5px solid ${selectedIdx === i ? '#00F5FF' : 'rgba(255,255,255,0.3)'}`,
            borderRadius: 4,
            boxShadow: selectedIdx === i ? '0 0 0 1.5px rgba(0,245,255,0.35)' : 'none',
          }} />
        </div>
      ))}
    </div>
  );
}

/* ─── Large live gradient preview with draggable origin + direction handles ─── */
function GradientPreview({
  mode,
  stops,
  angle,
  origin,
  onAngleChange,
  onOriginChange,
}: {
  mode: 'linear' | 'radial' | 'angular';
  stops: Stop[];
  angle: number;
  origin: { x: number; y: number };
  onAngleChange: (angle: number) => void;
  onOriginChange: (origin: { x: number; y: number }) => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'angle' | 'origin' | null>(null);
  const sortedStops = useMemo(() => [...stops].sort((a, b) => a.offset - b.offset), [stops]);
  const stopCss = sortedStops.map((stop) => `${stop.color} ${(stop.offset * 100).toFixed(1)}%`).join(', ');
  const cssAngle = (angle + 90) % 360;
  const background = mode === 'angular'
    ? `conic-gradient(from ${cssAngle}deg at ${(origin.x * 100).toFixed(1)}% ${(origin.y * 100).toFixed(1)}%, ${stopCss})`
    : mode === 'radial'
      ? `radial-gradient(circle at ${(origin.x * 100).toFixed(1)}% ${(origin.y * 100).toFixed(1)}%, ${stopCss})`
      : `linear-gradient(${cssAngle}deg, ${stopCss})`;
  const radians = (angle * Math.PI) / 180;
  const handleLength = 42;
  const angleHandleStyle = {
    left: `calc(${origin.x * 100}% + ${Math.cos(radians) * handleLength}px)`,
    top: `calc(${origin.y * 100}% + ${Math.sin(radians) * handleLength}px)`,
  };

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (dragRef.current === 'origin') {
      onOriginChange({
        x: Math.max(0.08, Math.min(0.92, (clientX - rect.left) / rect.width)),
        y: Math.max(0.08, Math.min(0.92, (clientY - rect.top) / rect.height)),
      });
      return;
    }
    if (dragRef.current === 'angle') {
      const ox = rect.left + origin.x * rect.width;
      const oy = rect.top + origin.y * rect.height;
      const nextAngle = (Math.atan2(clientY - oy, clientX - ox) * 180) / Math.PI;
      onAngleChange((nextAngle + 360) % 360);
    }
  }, [onAngleChange, onOriginChange, origin.x, origin.y]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (dragRef.current) updateFromPointer(event.clientX, event.clientY);
    };
    const onPointerUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [updateFromPointer]);

  const startDrag = (kind: 'angle' | 'origin') => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = kind;
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-primary uppercase tracking-wider font-semibold">Live Preview</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Drag the handles to reshape the gradient</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          {mode === 'angular' ? <RotateCw size={11} /> : <Move size={11} />}
          {mode === 'angular' ? 'Sweep' : 'Direction'}
        </span>
      </div>
      <div
        ref={previewRef}
        className="relative w-full overflow-hidden rounded-2xl"
        style={{
          height: 178,
          background,
          border: '1px solid rgba(255,255,255,0.16)',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15), 0 12px 30px rgba(0,0,0,0.18)',
          touchAction: 'none',
        }}
        onPointerDown={(event) => updateFromPointer(event.clientX, event.clientY)}
      >
        <div
          aria-hidden="true"
          className="absolute pointer-events-none"
          style={{
            left: `${origin.x * 100}%`,
            top: `${origin.y * 100}%`,
            width: handleLength,
            height: 2,
            background: 'rgba(255,255,255,0.82)',
            transformOrigin: '0 50%',
            transform: `rotate(${angle}deg)`,
            boxShadow: '0 0 8px rgba(0,0,0,0.45)',
          }}
        />
        <button
          type="button"
          aria-label="Drag to change gradient direction"
          className="absolute z-10 rounded-full"
          style={{
            ...angleHandleStyle,
            width: 18,
            height: 18,
            transform: 'translate(-50%, -50%)',
            background: '#11141A',
            border: '2px solid #fff',
            boxShadow: '0 0 0 3px rgba(0,245,255,0.5), 0 2px 8px rgba(0,0,0,0.4)',
            cursor: 'crosshair',
            touchAction: 'none',
          }}
          onPointerDown={startDrag('angle')}
        />
        <button
          type="button"
          aria-label="Drag to change gradient origin"
          className="absolute z-10 rounded-full flex items-center justify-center"
          style={{
            left: `${origin.x * 100}%`,
            top: `${origin.y * 100}%`,
            width: 24,
            height: 24,
            transform: 'translate(-50%, -50%)',
            background: 'rgba(17,20,26,0.88)',
            border: '2px solid #00F5FF',
            boxShadow: '0 0 12px rgba(0,245,255,0.55)',
            cursor: 'move',
            touchAction: 'none',
          }}
          onPointerDown={startDrag('origin')}
        >
          <span className="block w-1.5 h-1.5 rounded-full bg-white" />
        </button>
        <span className="absolute bottom-2 left-2 rounded-md px-2 py-1 text-[10px] font-medium text-white/80 bg-black/25 backdrop-blur-sm">
          {Math.round(angle)}°
        </span>
      </div>
    </div>
  );
}

/* ─── Recent-color history swatches ─── */
function ColorHistory({ history, onPick }: { history: string[]; onPick: (c: string) => void }) {
  if (!history.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recent</p>
      <div className="flex flex-wrap gap-1.5">
        {history.map((c) => (
          <button
            key={c}
            title={c.toUpperCase()}
            onClick={() => onPick(c)}
            className="rounded-md border border-border hover:scale-110 transition-transform"
            style={{ width: 24, height: 24, background: c, flexShrink: 0 }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Main Color Studio Panel ─── */
export default function ColorStudioPanel({ controller, eyedropperActive, onEyedropper }: ColorStudioProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'colorStudio';
  const obj = controller.selectedObject;

  const [fillMode, setFillMode] = useState<'solid' | 'linear' | 'radial' | 'angular'>('solid');
  const [solidColor, setSolidColor] = useState('#00F5FF');
  const [stops, setStops] = useState<Stop[]>([
    { offset: 0, color: '#00F5FF' },
    { offset: 1, color: '#7B2FFF' },
  ]);
  const [selectedStop, setSelectedStop] = useState(0);
  const [radialRadius, setRadialRadius] = useState(200);
  const [gradientAngle, setGradientAngle] = useState(0);
  const [gradientOrigin, setGradientOrigin] = useState({ x: 0.5, y: 0.5 });
  const [colorHistory, setColorHistory] = useState<string[]>(readColorHistory);

  const pushHistory = useCallback((color: string) => {
    setColorHistory((prev) => {
      const deduped = [color, ...prev.filter((c) => c.toLowerCase() !== color.toLowerCase())].slice(0, 8);
      saveColorHistory(deduped);
      return deduped;
    });
  }, []);

  useEffect(() => {
    if (!isOpen || !obj) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fill = obj.fill as any;
    const storedGradient = obj as typeof obj & {
      _gradientConfig?: {
        type?: 'linear' | 'radial' | 'angular';
        stops?: Stop[];
        radialRadius?: number | null;
        angleDeg?: number;
        origin?: { x: number; y: number };
      };
    };
    const config = storedGradient._gradientConfig;
    if (config?.type) {
      const gradientType = config.type;
      setFillMode(gradientType);
      if (config.stops?.length) setStops(config.stops.map((stop) => ({ ...stop })));
      if (typeof config.radialRadius === 'number') setRadialRadius(config.radialRadius);
      if (typeof config.angleDeg === 'number') setGradientAngle(config.angleDeg);
      if (config.origin) setGradientOrigin({ ...config.origin });
      return;
    }
    if (typeof fill === 'string') {
      setFillMode('solid');
      setSolidColor(fill);
    } else if (fill && typeof fill === 'object') {
      const gt: string = fill.type ?? '';
      if (gt === 'linear' || gt === 'radial') {
        setFillMode(gt as 'linear' | 'radial');
        const cs: { offset: number; color: string }[] = (fill.colorStops ?? [])
          .slice()
          .sort((a: { offset: number }, b: { offset: number }) => a.offset - b.offset);
        if (cs.length >= 2) setStops(cs.map((s) => ({ offset: s.offset, color: s.color })));
        if (gt === 'radial' && fill.coords?.r2 > 0) setRadialRadius(fill.coords.r2);
      }
    }
  }, [isOpen, obj]);

  const pushFill = useCallback((
    mode: 'solid' | 'linear' | 'radial' | 'angular',
    color: string,
    ss: Stop[],
    rr: number,
    angle: number,
    origin: { x: number; y: number },
  ) => {
    if (!obj) return;
    if (mode === 'solid') {
      obj.set('fill', color);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (obj as any)._gradientConfig;
      controller.getCanvas()?.renderAll();
      controller.syncObjects();
    } else {
      controller.applyGradientFill(obj, mode, ss, rr, angle, origin);
    }
  }, [obj, controller]);

  const handleSolidChange = useCallback((color: string) => {
    setSolidColor(color);
    pushFill('solid', color, stops, radialRadius, gradientAngle, gradientOrigin);
    pushHistory(color);
  }, [pushFill, stops, radialRadius, gradientAngle, gradientOrigin, pushHistory]);

  const handleHistoryPick = useCallback((color: string) => {
    setSolidColor(color);
    setFillMode('solid');
    pushFill('solid', color, stops, radialRadius, gradientAngle, gradientOrigin);
    pushHistory(color);
  }, [pushFill, stops, radialRadius, gradientAngle, gradientOrigin, pushHistory]);

  const handleStopColorChange = useCallback((color: string) => {
    const ns = stops.map((s, i) => i === selectedStop ? { ...s, color } : s);
    setStops(ns);
    pushFill(fillMode, solidColor, ns, radialRadius, gradientAngle, gradientOrigin);
    pushHistory(color);
  }, [stops, selectedStop, fillMode, solidColor, radialRadius, gradientAngle, gradientOrigin, pushFill, pushHistory]);

  const handleMoveStop = useCallback((idx: number, offset: number) => {
    const ns = stops.map((s, i) => i === idx ? { ...s, offset } : s);
    setStops(ns);
    pushFill(fillMode, solidColor, ns, radialRadius, gradientAngle, gradientOrigin);
  }, [stops, fillMode, solidColor, radialRadius, gradientAngle, gradientOrigin, pushFill]);

  const handleAddStop = useCallback((offset: number) => {
    const color = lerpStopColor(stops, offset);
    const ns = [...stops, { offset, color }].sort((a, b) => a.offset - b.offset);
    const newIdx = ns.findIndex((s) => s.offset === offset && s.color === color);
    setStops(ns);
    setSelectedStop(newIdx >= 0 ? newIdx : 0);
    pushFill(fillMode, solidColor, ns, radialRadius, gradientAngle, gradientOrigin);
  }, [stops, fillMode, solidColor, radialRadius, gradientAngle, gradientOrigin, pushFill]);

  const handleDeleteStop = useCallback(() => {
    if (stops.length <= 2) return;
    const ns = stops.filter((_, i) => i !== selectedStop);
    setStops(ns);
    setSelectedStop(Math.min(selectedStop, ns.length - 1));
    pushFill(fillMode, solidColor, ns, radialRadius, gradientAngle, gradientOrigin);
  }, [stops, selectedStop, fillMode, solidColor, radialRadius, gradientAngle, gradientOrigin, pushFill]);

  const handleFlip = useCallback(() => {
    const ns = stops.map((s) => ({ ...s, offset: 1 - s.offset })).sort((a, b) => a.offset - b.offset);
    setStops(ns);
    pushFill(fillMode, solidColor, ns, radialRadius, gradientAngle, gradientOrigin);
  }, [stops, fillMode, solidColor, radialRadius, gradientAngle, gradientOrigin, pushFill]);

  const handleModeChange = useCallback((mode: 'solid' | 'linear' | 'radial' | 'angular') => {
    setFillMode(mode);
    pushFill(mode, solidColor, stops, radialRadius, gradientAngle, gradientOrigin);
  }, [solidColor, stops, radialRadius, gradientAngle, gradientOrigin, pushFill]);

  const handleRadiusChange = useCallback((r: number) => {
    setRadialRadius(r);
    if (fillMode === 'radial') pushFill('radial', solidColor, stops, r, gradientAngle, gradientOrigin);
  }, [fillMode, solidColor, stops, gradientAngle, gradientOrigin, pushFill]);

  const handleAngleChange = useCallback((angle: number) => {
    setGradientAngle(angle);
    if (fillMode !== 'solid') pushFill(fillMode, solidColor, stops, radialRadius, angle, gradientOrigin);
  }, [fillMode, solidColor, stops, radialRadius, gradientOrigin, pushFill]);

  const handleOriginChange = useCallback((origin: { x: number; y: number }) => {
    setGradientOrigin(origin);
    if (fillMode !== 'solid') pushFill(fillMode, solidColor, stops, radialRadius, gradientAngle, origin);
  }, [fillMode, solidColor, stops, radialRadius, gradientAngle, pushFill]);

  const currentStopColor = stops[selectedStop]?.color ?? '#00F5FF';
  const isGradient = fillMode !== 'solid';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '90vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="color-studio-panel"
      >
        {/* ── Header: title left, eyedropper right with explicit gap from Sheet's close button ── */}
        <SheetHeader className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between" style={{ paddingRight: '2.75rem' }}>
            <SheetTitle className="text-sm font-semibold">Color Studio</SheetTitle>
            <button
              onClick={onEyedropper}
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

          {/* Fill mode tabs */}
          <div className="flex gap-1.5">
            {(['solid', 'linear', 'radial', 'angular'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className="flex-1 py-2 rounded-xl text-xs capitalize font-medium transition-all"
                style={{
                  background: fillMode === mode ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
                  color: fillMode === mode ? '#00F5FF' : '#9ca3af',
                  border: `1px solid ${fillMode === mode ? '#00F5FF' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* ── Solid mode ── */}
          {fillMode === 'solid' && (
            <>
              <ColorPicker value={solidColor} onChange={handleSolidChange} />
              <ColorHistory history={colorHistory} onPick={handleHistoryPick} />
            </>
          )}

          {/* ── Gradient mode ── */}
          {isGradient && (
            <>
              <GradientBar
                stops={stops}
                selectedIdx={selectedStop}
                onSelectStop={setSelectedStop}
                onMoveStop={handleMoveStop}
                onAddStop={handleAddStop}
              />

              {/* Stop toolbar */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground flex-1">
                  Stop {selectedStop + 1} / {stops.length}
                </span>
                <button
                  onClick={handleFlip}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <FlipHorizontal2 size={13} />
                  Flip
                </button>
                <button
                  onClick={() => handleAddStop(0.5)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                  style={{ background: 'rgba(0,245,255,0.08)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.25)' }}
                >
                  <Plus size={13} />
                  Add Stop
                </button>
                <button
                  onClick={handleDeleteStop}
                  disabled={stops.length <= 2}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all disabled:opacity-30"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <Separator />

              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Stop {selectedStop + 1} — Color
              </p>
              <ColorPicker value={currentStopColor} onChange={handleStopColorChange} />
              <ColorHistory history={colorHistory} onPick={handleStopColorChange} />

              <GradientPreview
                mode={fillMode}
                stops={stops}
                angle={gradientAngle}
                origin={gradientOrigin}
                onAngleChange={handleAngleChange}
                onOriginChange={handleOriginChange}
              />

              {fillMode === 'angular' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Sweep start</span>
                      <span className="text-xs text-primary font-medium">{Math.round(gradientAngle)}°</span>
                    </div>
                    <Slider
                      min={0}
                      max={360}
                      step={1}
                      value={[gradientAngle]}
                      onValueChange={([value]) => handleAngleChange(value)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0°</span>
                      <span>360°</span>
                    </div>
                  </div>
                </>
              )}

              {fillMode === 'radial' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Radial Radius</span>
                      <span className="text-xs text-muted-foreground">{radialRadius}px</span>
                    </div>
                    <Slider
                      min={20} max={800} step={5}
                      value={[radialRadius]}
                      onValueChange={([v]) => handleRadiusChange(v)}
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {!obj && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Select a shape or text on the canvas to apply colors.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
