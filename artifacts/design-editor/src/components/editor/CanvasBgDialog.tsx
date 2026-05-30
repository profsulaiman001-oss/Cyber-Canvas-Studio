import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useEditor, CanvasBgConfig } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';

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

export default function CanvasBgDialog({ controller }: CanvasBgDialogProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'canvasBg';
  const [cfg, setCfg] = useState<CanvasBgConfig>(state.canvasBg);

  useEffect(() => { setCfg(state.canvasBg); }, [state.canvasBg]);

  const apply = (newCfg: CanvasBgConfig) => {
    setCfg(newCfg);
    dispatch({ type: 'SET_CANVAS_BG', payload: newCfg });
    controller.setCanvasBackground(newCfg);
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
        style={{ maxHeight: '70vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold">Canvas Background</SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

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

          {/* Solid */}
          {cfg.type === 'solid' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input type="color" value={cfg.color} onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border border-border bg-transparent p-0.5 flex-shrink-0" />
                <div className="flex-1 rounded-xl h-12 border border-border" style={{ background: cfg.color }} />
              </div>
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
              {/* Gradient preview */}
              <div className="rounded-xl h-14 border border-border" style={{
                background: cfg.gradientType === 'linear'
                  ? `linear-gradient(90deg, ${cfg.gradientStops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`
                  : `radial-gradient(circle, ${cfg.gradientStops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`,
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
                        background: `linear-gradient(90deg, ${p.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`,
                        color: '#fff',
                        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color stops */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Color Stops</p>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={addStop}>+ Add Stop</Button>
                </div>
                <div className="space-y-3">
                  {cfg.gradientStops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="color" value={stop.color}
                        onChange={(e) => setStop(i, 'color', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent p-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <Label className="text-xs text-muted-foreground">Position</Label>
                          <span className="text-xs text-muted-foreground">{Math.round(stop.offset * 100)}%</span>
                        </div>
                        <Slider min={0} max={1} step={0.01} value={[stop.offset]}
                          onValueChange={([v]) => setStop(i, 'offset', v)} />
                      </div>
                      {cfg.gradientStops.length > 2 && (
                        <button onClick={() => removeStop(i)} className="text-destructive text-xs px-1 hover:opacity-75">✕</button>
                      )}
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
