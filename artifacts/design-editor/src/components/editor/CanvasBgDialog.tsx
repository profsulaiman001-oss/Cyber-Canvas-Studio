import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useEditor, CanvasBgConfig } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import ColorPicker from './ColorPicker';

interface CanvasBgDialogProps { controller: CanvasController }

const PRESET_COLORS = [
  '#ffffff', '#000000', '#0B0C10', '#1a1a2e', '#16213e',
  '#f8f9fa', '#e9ecef', '#dee2e6', '#ff6b6b', '#ffd93d',
  '#6bcb77', '#4d96ff', '#7B2FFF', '#ff922b', '#f06595',
];

const GRADIENT_PRESETS = [
  { name: 'Cyber', stops: [{ offset: 0, color: '#00F5FF' }, { offset: 1, color: '#7B2FFF' }] },
  { name: 'Sunset', stops: [{ offset: 0, color: '#ff6b6b' }, { offset: 1, color: '#ffd93d' }] },
  { name: 'Ocean', stops: [{ offset: 0, color: '#006994' }, { offset: 1, color: '#00d4ff' }] },
  { name: 'Forest', stops: [{ offset: 0, color: '#134e5e' }, { offset: 1, color: '#71b280' }] },
  { name: 'Fire', stops: [{ offset: 0, color: '#f7971e' }, { offset: 1, color: '#ffd200' }] },
  { name: 'Night', stops: [{ offset: 0, color: '#0f0c29' }, { offset: 1, color: '#302b63' }] },
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

/* Expandable color field showing swatch + opens ColorPicker */
function BgColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="flex items-center justify-between w-full py-1"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border border-border flex-shrink-0" style={{ background: value }} />
          <span className="text-xs font-mono text-muted-foreground">{value.toUpperCase()}</span>
        </div>
      </button>
      {open && (
        <div className="mt-2 mb-1">
          <ColorPicker value={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function readBgHistory(): CanvasBgConfig[] {
  try { return JSON.parse(localStorage.getItem('cs_bg_history') || '[]'); } catch { return []; }
}
function saveBgHistory(h: CanvasBgConfig[]) {
  try { localStorage.setItem('cs_bg_history', JSON.stringify(h)); } catch { /* ignore */ }
}

/* Background history swatch */
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

  useEffect(() => { setCfg(state.canvasBg); }, [state.canvasBg]);

  const apply = (newCfg: CanvasBgConfig) => {
    setCfg(newCfg);
    dispatch({ type: 'SET_CANVAS_BG', payload: newCfg });
    controller.setCanvasBackground(newCfg);
    // Add to history (deduplicate by JSON key)
    const key = JSON.stringify(newCfg);
    setBgHistory((prev) => {
      const deduped = [newCfg, ...prev.filter((b) => JSON.stringify(b) !== key)].slice(0, 5);
      saveBgHistory(deduped);
      return deduped;
    });
  };

  const setType = (type: CanvasBgConfig['type']) => apply({ ...cfg, type });
  const setColor = (color: string) => apply({ ...cfg, color });
  const setGradientType = (t: 'linear' | 'radial') => apply({ ...cfg, gradientType: t });
  const setStop = (idx: number, field: 'color' | 'offset', val: string | number) => {
    const stops = cfg.gradientStops.map((s, i) => i === idx ? { ...s, [field]: val } : s);
    apply({ ...cfg, gradientStops: stops });
  };
  const addStop = () => {
    const stops = [...cfg.gradientStops, { offset: 0.5, color: '#888888' }];
    apply({ ...cfg, gradientStops: stops });
  };
  const removeStop = (idx: number) => {
    if (cfg.gradientStops.length <= 2) return;
    const stops = cfg.gradientStops.filter((_, i) => i !== idx);
    apply({ ...cfg, gradientStops: stops });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '80vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold">Canvas Background</SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          {/* Background history */}
          {bgHistory.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recent Backgrounds</p>
              <div className="flex gap-2 flex-wrap">
                {bgHistory.map((b, i) => (
                  <BgSwatch key={i} cfg={b} onClick={() => apply(b)} />
                ))}
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

          {/* Solid — use the full HSB ColorPicker */}
          {cfg.type === 'solid' && (
            <div className="space-y-4">
              <ColorPicker value={cfg.color} onChange={setColor} />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Presets</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)}
                      className="w-8 h-8 rounded-lg border-2 transition-transform active:scale-90"
                      style={{ background: c, borderColor: cfg.color === c ? '#00F5FF' : 'rgba(255,255,255,0.1)' }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Gradient */}
          {cfg.type === 'gradient' && (
            <div className="space-y-3">
              {/* Preview bar */}
              <div className="rounded-xl h-14 border border-border" style={{
                background: cfg.gradientType === 'linear'
                  ? `linear-gradient(90deg, ${cfg.gradientStops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})`
                  : `radial-gradient(circle, ${cfg.gradientStops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})`,
              }} />

              {/* Gradient type */}
              <div className="flex gap-2">
                <Tab active={cfg.gradientType === 'linear'} onClick={() => setGradientType('linear')}>Linear</Tab>
                <Tab active={cfg.gradientType === 'radial'} onClick={() => setGradientType('radial')}>Radial</Tab>
              </div>

              {/* Presets */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Presets</p>
                <div className="grid grid-cols-3 gap-2">
                  {GRADIENT_PRESETS.map((p) => (
                    <button key={p.name}
                      onClick={() => apply({ ...cfg, gradientStops: p.stops })}
                      className="h-10 rounded-lg text-xs font-medium border border-border"
                      style={{
                        background: `linear-gradient(90deg, ${p.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})`,
                        color: '#fff',
                        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color stops — using expandable BgColorField + position slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Color Stops</p>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={addStop}>+ Add Stop</Button>
                </div>
                <div className="space-y-4">
                  {cfg.gradientStops.map((stop, i) => (
                    <div key={i} className="space-y-2 p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center justify-between">
                        <BgColorField
                          label={`Stop ${i + 1}`}
                          value={stop.color}
                          onChange={(v) => setStop(i, 'color', v)}
                        />
                        {cfg.gradientStops.length > 2 && (
                          <button onClick={() => removeStop(i)} className="text-destructive text-xs px-2 py-0.5 hover:opacity-75 flex-shrink-0">✕</button>
                        )}
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Position</span>
                          <span className="text-xs text-muted-foreground">{Math.round(stop.offset * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0} max={100} step={1}
                          value={Math.round(stop.offset * 100)}
                          onChange={(e) => setStop(i, 'offset', parseInt(e.target.value) / 100)}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: '#00F5FF' }}
                        />
                      </div>
                    </div>
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
