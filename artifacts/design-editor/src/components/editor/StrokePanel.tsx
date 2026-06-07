import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject } from 'fabric';
import { PenLine } from 'lucide-react';
import ColorPicker from './ColorPicker';

interface StrokePanelProps { controller: CanvasController }

function SliderRow({ label, value, min, max, step = 1, onChange, unit = '', decimals = 0 }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string; decimals?: number;
}) {
  const display = decimals > 0 ? value.toFixed(decimals) : Math.round(value);
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs text-muted-foreground">{display}{unit}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} className="w-full" />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-1">{children}</p>;
}

/* Dash presets — gap is controlled separately via the spacing slider */
const DASH_PRESETS: { id: string; label: string; dashLen: number | null; dotLen: number | null }[] = [
  { id: 'solid',   label: 'Solid',  dashLen: null, dotLen: null },
  { id: 'dash',    label: 'Dash',   dashLen: 12,   dotLen: null },
  { id: 'dot',     label: 'Dot',    dashLen: 2,    dotLen: null },
  { id: 'mix',     label: 'Mix',    dashLen: 12,   dotLen: 2   },
];

/** Build the strokeDashArray for a given preset + gap value */
function buildDashArray(presetId: string, gap: number): number[] | null {
  const p = DASH_PRESETS.find((x) => x.id === presetId);
  if (!p || p.dashLen === null) return null;
  if (presetId === 'dash') return [p.dashLen, gap];
  if (presetId === 'dot')  return [p.dotLen ?? p.dashLen, gap];
  if (presetId === 'mix')  return [p.dashLen, Math.max(2, gap / 2), p.dotLen ?? 2, Math.max(2, gap / 2)];
  return null;
}

/** Detect the closest preset id from a raw strokeDashArray */
function detectPresetId(da: number[] | null | undefined): string {
  if (!da || da.length === 0) return 'solid';
  if (da.length === 2 && da[0] >= 8) return 'dash';
  if (da.length === 2 && da[0] <= 4) return 'dot';
  if (da.length >= 4) return 'mix';
  return 'dash';
}

/** Extract the gap value from a raw strokeDashArray */
function extractGap(da: number[] | null | undefined): number {
  if (!da || da.length < 2) return 8;
  return da[1] ?? 8;
}

export default function StrokePanel({ controller }: StrokePanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'stroke';
  const obj = controller.selectedObject;

  const [enabled, setEnabled] = useState(false);
  const [color, setColor] = useState('#000000');
  const [width, setWidth] = useState(2);
  const [dashPreset, setDashPreset] = useState('solid');
  const [gapWidth, setGapWidth] = useState(8);
  const [colorOpen, setColorOpen] = useState(false);

  const syncFromObj = useCallback(() => {
    if (!obj) return;
    const o = obj as FabricObject & Record<string, unknown>;
    const sw = typeof o.strokeWidth === 'number' ? o.strokeWidth : 0;
    setEnabled(sw > 0);
    setWidth(sw > 0 ? sw : 2);
    setColor(typeof o.stroke === 'string' && o.stroke ? o.stroke : '#000000');
    const da = (o as FabricObject & { strokeDashArray?: number[] | null }).strokeDashArray;
    setDashPreset(detectPresetId(da));
    setGapWidth(extractGap(da));
  }, [obj]);

  useEffect(() => { syncFromObj(); }, [syncFromObj]);

  const applyStroke = useCallback((en: boolean, c: string, w: number, preset: string, gap: number) => {
    if (!obj) return;
    const dashArr = en ? buildDashArray(preset, gap) : null;
    obj.set({
      stroke: en ? c : undefined,
      strokeWidth: en ? w : 0,
      strokeDashArray: dashArr,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).setDirty?.(true);
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
  }, [obj, controller]);

  const isDashed = dashPreset !== 'solid';

  /* Visual preview dash array for SVG */
  const previewDash = buildDashArray(dashPreset, gapWidth);

  if (!obj) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '80vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="stroke-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <PenLine size={15} className="text-primary" />
            Stroke
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          {/* ── Enable ── */}
          <div className="flex items-center justify-between">
            <SectionLabel>Border Stroke</SectionLabel>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => {
                setEnabled(v);
                applyStroke(v, color, width, dashPreset, gapWidth);
              }}
            />
          </div>

          {enabled && (
            <>
              {/* ── Color ── */}
              <Separator />
              <SectionLabel>Color</SectionLabel>
              <button
                className="flex items-center gap-3 w-full py-1 rounded-lg px-2 transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                onClick={() => setColorOpen((o) => !o)}
              >
                <div
                  className="w-8 h-8 rounded border border-border flex-shrink-0"
                  style={{ background: color }}
                />
                <span className="text-xs font-mono text-muted-foreground">{color.toUpperCase()}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{colorOpen ? '▲' : '▼'}</span>
              </button>
              {colorOpen && (
                <ColorPicker
                  value={color}
                  onChange={(v) => {
                    setColor(v);
                    applyStroke(true, v, width, dashPreset, gapWidth);
                  }}
                />
              )}

              {/* ── Width — micro-scale 0.05px increments ── */}
              <Separator />
              <SectionLabel>Width</SectionLabel>
              <SliderRow
                label="Stroke Width"
                value={width}
                min={0}
                max={40}
                step={0.05}
                unit="px"
                decimals={2}
                onChange={(v) => { setWidth(v); applyStroke(true, color, v, dashPreset, gapWidth); }}
              />

              {/* Fine-tune numeric input for sub-pixel precision */}
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground flex-shrink-0">Exact px</Label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  step={0.05}
                  value={width}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(40, parseFloat(e.target.value) || 0));
                    setWidth(v);
                    applyStroke(true, color, v, dashPreset, gapWidth);
                  }}
                  className="w-24 h-7 bg-transparent border border-border rounded px-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* ── Pattern ── */}
              <Separator />
              <SectionLabel>Pattern</SectionLabel>
              <div className="grid grid-cols-4 gap-1.5">
                {DASH_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setDashPreset(p.id);
                      applyStroke(true, color, width, p.id, gapWidth);
                    }}
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

              {/* Live SVG preview */}
              <svg width="100%" height="20" style={{ overflow: 'visible' }}>
                <line
                  x1="0" y1="10" x2="100%" y2="10"
                  stroke={color}
                  strokeWidth={Math.min(width, 6)}
                  strokeDasharray={previewDash ? previewDash.join(' ') : ''}
                />
              </svg>

              {/* ── Pattern Spacing — only visible for non-solid presets ── */}
              {isDashed && (
                <>
                  <Separator />
                  <SectionLabel>Pattern Spacing</SectionLabel>
                  <SliderRow
                    label="Gap Width"
                    value={gapWidth}
                    min={1}
                    max={60}
                    step={1}
                    unit="px"
                    onChange={(v) => {
                      setGapWidth(v);
                      applyStroke(true, color, width, dashPreset, v);
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Controls the space between each dash segment in real time.
                  </p>
                </>
              )}
            </>
          )}

          <div className="h-1" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
