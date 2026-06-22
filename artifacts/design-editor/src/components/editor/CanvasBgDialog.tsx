import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { FlipHorizontal2, Trash2, Plus } from 'lucide-react';
import { useEditor, CanvasBgConfig } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import ColorPicker from './ColorPicker';

interface CanvasBgDialogProps { controller: CanvasController }

interface Stop { offset: number; color: string }

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

/* ─── Gradient bar with draggable stop markers ─── */
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

const PRESET_COLORS = [
  '#ffffff', '#000000', '#0B0C10', '#1a1a2e', '#16213e',
  '#f8f9fa', '#e9ecef', '#dee2e6', '#ff6b6b', '#ffd93d',
  '#6bcb77', '#4d96ff', '#7B2FFF', '#ff922b', '#f06595',
];

const GRADIENT_PRESETS = [
  { name: 'Cyber',  stops: [{ offset: 0, color: '#00F5FF' }, { offset: 1, color: '#7B2FFF' }] },
  { name: 'Sunset', stops: [{ offset: 0, color: '#ff6b6b' }, { offset: 1, color: '#ffd93d' }] },
  { name: 'Ocean',  stops: [{ offset: 0, color: '#006994' }, { offset: 1, color: '#00d4ff' }] },
  { name: 'Forest', stops: [{ offset: 0, color: '#134e5e' }, { offset: 1, color: '#71b280' }] },
  { name: 'Fire',   stops: [{ offset: 0, color: '#f7971e' }, { offset: 1, color: '#ffd200' }] },
  { name: 'Night',  stops: [{ offset: 0, color: '#0f0c29' }, { offset: 1, color: '#302b63' }] },
];

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2 text-xs font-medium rounded-lg transition-all"
      style={{
        background: active ? 'rgba(0,245,255,0.15)' : 'transparent',
        color: active ? '#00F5FF' : '#6b7280',
        border: active ? '1px solid rgba(0,245,255,0.3)' : '1px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

function readBgHistory(): CanvasBgConfig[] {
  try { return JSON.parse(localStorage.getItem('cs_bg_history') || '[]'); } catch { return []; }
}
function saveBgHistory(h: CanvasBgConfig[]) {
  try { localStorage.setItem('cs_bg_history', JSON.stringify(h)); } catch { /* ignore */ }
}

function BgSwatch({ cfg, onClick }: { cfg: CanvasBgConfig; onClick: () => void }) {
  let bg = cfg.color;
  if (cfg.type === 'transparent') {
    bg = `repeating-conic-gradient(#888 0% 25%, #bbb 0% 50%) 0 0 / 10px 10px`;
  } else if (cfg.type === 'gradient' && cfg.gradientStops.length >= 2) {
    const stops = cfg.gradientStops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ');
    bg = cfg.gradientType === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(90deg, ${stops})`;
  }
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-border hover:scale-105 transition-transform flex-shrink-0"
      style={{ width: 36, height: 36, background: bg }}
      title={cfg.type}
    />
  );
}

export default function CanvasBgDialog({ controller }: CanvasBgDialogProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'canvasBg';
  const [cfg, setCfg] = useState<CanvasBgConfig>(state.canvasBg);
  const [bgHistory, setBgHistory] = useState<CanvasBgConfig[]>(readBgHistory);
  const [selectedStop, setSelectedStop] = useState(0);

  useEffect(() => { setCfg(state.canvasBg); }, [state.canvasBg]);

  const apply = useCallback((newCfg: CanvasBgConfig) => {
    setCfg(newCfg);
    dispatch({ type: 'SET_CANVAS_BG', payload: newCfg });
    controller.setCanvasBackground(newCfg);
    const key = JSON.stringify(newCfg);
    setBgHistory((prev) => {
      const deduped = [newCfg, ...prev.filter((b) => JSON.stringify(b) !== key)].slice(0, 5);
      saveBgHistory(deduped);
      return deduped;
    });
  }, [dispatch, controller]);

  const setType = (type: CanvasBgConfig['type']) => apply({ ...cfg, type });
  const setColor = (color: string) => apply({ ...cfg, color });
  const setGradientType = (t: 'linear' | 'radial') => apply({ ...cfg, gradientType: t });

  /* ── Gradient stop manipulation ── */
  const handleMoveStop = useCallback((idx: number, offset: number) => {
    const stops = cfg.gradientStops.map((s, i) => i === idx ? { ...s, offset } : s);
    apply({ ...cfg, gradientStops: stops });
  }, [cfg, apply]);

  const handleAddStop = useCallback((offset: number) => {
    const color = lerpStopColor(cfg.gradientStops, offset);
    const stops = [...cfg.gradientStops, { offset, color }].sort((a, b) => a.offset - b.offset);
    const newIdx = stops.findIndex((s) => s.offset === offset && s.color === color);
    setSelectedStop(newIdx >= 0 ? newIdx : 0);
    apply({ ...cfg, gradientStops: stops });
  }, [cfg, apply]);

  const handleDeleteStop = useCallback(() => {
    if (cfg.gradientStops.length <= 2) return;
    const stops = cfg.gradientStops.filter((_, i) => i !== selectedStop);
    setSelectedStop(Math.min(selectedStop, stops.length - 1));
    apply({ ...cfg, gradientStops: stops });
  }, [cfg, selectedStop, apply]);

  const handleFlipGradient = useCallback(() => {
    const stops = cfg.gradientStops.map((s) => ({ ...s, offset: 1 - s.offset })).sort((a, b) => a.offset - b.offset);
    apply({ ...cfg, gradientStops: stops });
  }, [cfg, apply]);

  const handleStopColorChange = useCallback((color: string) => {
    const stops = cfg.gradientStops.map((s, i) => i === selectedStop ? { ...s, color } : s);
    apply({ ...cfg, gradientStops: stops });
  }, [cfg, selectedStop, apply]);

  const currentStopColor = cfg.gradientStops[selectedStop]?.color ?? '#00F5FF';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '82vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold">Canvas Background</SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          {/* Recent backgrounds */}
          {bgHistory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recent Backgrounds</p>
              <div className="flex gap-2 flex-wrap">
                {bgHistory.map((b, i) => <BgSwatch key={i} cfg={b} onClick={() => apply(b)} />)}
              </div>
            </div>
          )}

          {/* Type tabs */}
          <div className="flex gap-2">
            <Tab active={cfg.type === 'transparent'} onClick={() => setType('transparent')}>Transparent</Tab>
            <Tab active={cfg.type === 'solid'} onClick={() => setType('solid')}>Solid</Tab>
            <Tab active={cfg.type === 'gradient'} onClick={() => setType('gradient')}>Gradient</Tab>
          </div>

          {/* Transparent preview */}
          {cfg.type === 'transparent' && (
            <div className="rounded-xl overflow-hidden border border-border" style={{ height: 80 }}>
              <div className="w-full h-full" style={{
                background: `repeating-conic-gradient(#888 0% 25%, #bbb 0% 50%) 0 0 / 16px 16px`
              }} />
            </div>
          )}

          {/* ── Solid ── */}
          {cfg.type === 'solid' && (
            <div className="space-y-4">
              <ColorPicker value={cfg.color} onChange={setColor} />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Presets</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="rounded-lg border-2 transition-transform active:scale-90 hover:scale-110"
                      style={{
                        width: 32, height: 32,
                        background: c,
                        borderColor: cfg.color === c ? '#00F5FF' : 'rgba(255,255,255,0.1)',
                        boxShadow: cfg.color === c ? `0 0 8px ${c}60` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Gradient ── */}
          {cfg.type === 'gradient' && (
            <div className="space-y-3">
              {/* Linear / Radial tabs */}
              <div className="flex gap-2">
                <Tab active={cfg.gradientType === 'linear'} onClick={() => setGradientType('linear')}>Linear</Tab>
                <Tab active={cfg.gradientType === 'radial'} onClick={() => setGradientType('radial')}>Radial</Tab>
              </div>

              {/* Interactive gradient bar with draggable stops */}
              <GradientBar
                stops={cfg.gradientStops}
                selectedIdx={selectedStop}
                onSelectStop={setSelectedStop}
                onMoveStop={handleMoveStop}
                onAddStop={handleAddStop}
              />

              {/* Stop toolbar */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground flex-1">
                  Stop {selectedStop + 1} / {cfg.gradientStops.length}
                </span>
                <button
                  onClick={handleFlipGradient}
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
                  Add
                </button>
                <button
                  onClick={handleDeleteStop}
                  disabled={cfg.gradientStops.length <= 2}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all disabled:opacity-30"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Selected stop color picker */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#00F5FF' }}>
                  Stop {selectedStop + 1} — Color
                </p>
                <ColorPicker value={currentStopColor} onChange={handleStopColorChange} />
              </div>

              {/* Gradient presets */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Presets</p>
                <div className="grid grid-cols-3 gap-2">
                  {GRADIENT_PRESETS.map((p) => (
                    <button key={p.name}
                      onClick={() => { apply({ ...cfg, gradientStops: p.stops }); setSelectedStop(0); }}
                      className="h-10 rounded-lg text-xs font-medium border border-border"
                      style={{
                        background: `linear-gradient(90deg, ${p.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})`,
                        color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
