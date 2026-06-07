import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject } from 'fabric';
import { PenLine } from 'lucide-react';
import ColorPicker from './ColorPicker';

interface StrokePanelProps { controller: CanvasController }

function SliderRow({ label, value, min, max, step = 1, onChange, unit = '' }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs text-muted-foreground">{Math.round(value * 100) / 100}{unit}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} className="w-full" />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-1">{children}</p>;
}

const DASH_PRESETS: { id: string; label: string; array: number[] | null }[] = [
  { id: 'solid',  label: 'Solid',  array: null },
  { id: 'dash',   label: 'Dash',   array: [12, 6] },
  { id: 'dot',    label: 'Dot',    array: [2, 8] },
  { id: 'dashdot',label: 'Mix',    array: [12, 4, 2, 4] },
];

export default function StrokePanel({ controller }: StrokePanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'stroke';
  const obj = controller.selectedObject;

  const [enabled, setEnabled] = useState(false);
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const [dashPreset, setDashPreset] = useState('solid');
  const [colorOpen, setColorOpen] = useState(false);

  const syncFromObj = useCallback(() => {
    if (!obj) return;
    const o = obj as FabricObject & Record<string, unknown>;
    const sw = typeof o.strokeWidth === 'number' ? o.strokeWidth : 0;
    setEnabled(sw > 0);
    setWidth(sw > 0 ? sw : 2);
    setColor(typeof o.stroke === 'string' && o.stroke ? o.stroke : '#000000');
    const da = (o as FabricObject & { strokeDashArray?: number[] | null }).strokeDashArray;
    if (!da || da.length === 0) { setDashPreset('solid'); return; }
    const key = DASH_PRESETS.find(p => p.array && JSON.stringify(p.array) === JSON.stringify(da));
    setDashPreset(key?.id || 'dash');
  }, [obj]);

  useEffect(() => { syncFromObj(); }, [syncFromObj]);

  const applyStroke = useCallback((en: boolean, c: string, w: number, dash: string) => {
    if (!obj) return;
    const preset = DASH_PRESETS.find(p => p.id === dash);
    obj.set({
      stroke: en ? c : undefined,
      strokeWidth: en ? w : 0,
      strokeDashArray: en ? (preset?.array ?? null) : null,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).setDirty?.(true);
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
  }, [obj, controller]);

  if (!obj) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '72vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="stroke-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <PenLine size={15} className="text-primary" />
            Stroke
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <SectionLabel>Border Stroke</SectionLabel>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => {
                setEnabled(v);
                applyStroke(v, color, width, dashPreset);
              }}
            />
          </div>

          {enabled && (
            <>
              {/* Color */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <button
                  className="flex items-center gap-3 w-full py-1"
                  onClick={() => setColorOpen(o => !o)}
                >
                  <div className="w-8 h-8 rounded border border-border flex-shrink-0" style={{ background: color }} />
                  <span className="text-xs font-mono text-muted-foreground">{color.toUpperCase()}</span>
                </button>
                {colorOpen && (
                  <ColorPicker value={color} onChange={(v) => {
                    setColor(v);
                    applyStroke(true, v, width, dashPreset);
                  }} />
                )}
              </div>

              {/* Width */}
              <SliderRow
                label="Width" value={width} min={0.5} max={30} step={0.5} unit="px"
                onChange={(v) => { setWidth(v); applyStroke(true, color, v, dashPreset); }}
              />

              {/* Dash pattern */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Pattern</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {DASH_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setDashPreset(p.id); applyStroke(true, color, width, p.id); }}
                      className="py-2 rounded-lg text-xs transition-all border"
                      style={{
                        background: dashPreset === p.id ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
                        borderColor: dashPreset === p.id ? '#00F5FF' : 'rgba(255,255,255,0.1)',
                        color: dashPreset === p.id ? '#00F5FF' : '#9ca3af',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* Visual preview */}
                <svg width="100%" height="18" style={{ overflow: 'visible' }}>
                  <line
                    x1="0" y1="9" x2="100%" y2="9"
                    stroke={color}
                    strokeWidth={Math.min(width, 6)}
                    strokeDasharray={DASH_PRESETS.find(p => p.id === dashPreset)?.array?.join(' ') || ''}
                  />
                </svg>
              </div>
            </>
          )}

          <div className="h-1" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
