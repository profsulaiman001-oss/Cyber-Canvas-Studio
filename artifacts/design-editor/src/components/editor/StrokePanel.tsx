import { useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useEditor } from '@/store/editorStore';
import { CanvasController, extractColorAlpha, withAlpha } from '@/hooks/useFabricCanvas';
import { FabricObject } from 'fabric';
import { ChevronDown, ChevronUp, PenLine } from 'lucide-react';
import ColorPicker from './ColorPicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StrokePanelProps { controller: CanvasController }

function SliderRow({ label, value, min, max, step = 1, onChange, unit = '', decimals = 0, disabled = false }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string; decimals?: number; disabled?: boolean;
}) {
  const display = decimals > 0 ? value.toFixed(decimals) : Math.round(value);
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs text-muted-foreground">{display}{unit}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
        disabled={disabled}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider pt-1" style={{ color: '#00F5FF' }}>{children}</p>;
}

const DASH_PRESETS: { id: string; label: string; dashLen: number | null; dotLen: number | null }[] = [
  { id: 'solid',   label: 'Solid',  dashLen: null, dotLen: null },
  { id: 'dash',    label: 'Dash',   dashLen: 12,   dotLen: null },
  { id: 'dot',     label: 'Dot',    dashLen: 2,    dotLen: null },
  { id: 'mix',     label: 'Mix',    dashLen: 12,   dotLen: 2   },
];

type StrokeParameter = 'width' | 'dash' | 'capJoin';
const STROKE_PARAMETER_LABELS: Record<StrokeParameter, string> = {
  width: 'Stroke Width',
  dash: 'Dash Array',
  capJoin: 'Cap / Join Style',
};

function buildDashArray(presetId: string, gap: number): number[] | null {
  const p = DASH_PRESETS.find((x) => x.id === presetId);
  if (!p || p.dashLen === null) return null;
  if (presetId === 'dash') return [p.dashLen, gap];
  if (presetId === 'dot')  return [p.dotLen ?? p.dashLen, gap];
  if (presetId === 'mix')  return [p.dashLen, Math.max(2, gap / 2), p.dotLen ?? 2, Math.max(2, gap / 2)];
  return null;
}

function detectPresetId(da: number[] | null | undefined): string {
  if (!da || da.length === 0) return 'solid';
  if (da.length === 2 && da[0] >= 8) return 'dash';
  if (da.length === 2 && da[0] <= 4) return 'dot';
  if (da.length >= 4) return 'mix';
  return 'dash';
}

function extractGap(da: number[] | null | undefined): number {
  if (!da || da.length < 2) return 8;
  return da[1] ?? 8;
}

function colorToHex(cssColor: string): string {
  const value = cssColor.trim();
  const hexMatch = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    const rgbPart = raw.length === 4 || raw.length === 8 ? raw.slice(0, raw.length === 4 ? 3 : 6) : raw;
    const expanded = rgbPart.length === 3
      ? rgbPart.split('').map((channel) => channel + channel).join('')
      : rgbPart;
    return `#${expanded.slice(0, 6).toLowerCase()}`;
  }

  const rgbMatch = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgbMatch) {
    const channels = rgbMatch.slice(1, 4).map((channel) => (
      Math.max(0, Math.min(255, Math.round(Number(channel))))
    ));
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }

  return '#000000';
}

export default function StrokePanel({ controller }: StrokePanelProps) {
  const { state } = useEditor();
  const isOpen = state.activePanel === 'stroke';
  const obj = controller.selectedObject;

  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeParameter, setActiveParameter] = useState<StrokeParameter>('width');
  // color stores only the opaque RGB — alpha is tracked separately via strokeOpacity
  const [color, setColor] = useState('#000000');
  const [strokeOpacity, setStrokeOpacity] = useState(100); // 0–100
  const [width, setWidth] = useState(2);
  const [dashPreset, setDashPreset] = useState('solid');
  const [gapWidth, setGapWidth] = useState(8);
  const [lineCap, setLineCap] = useState<'butt' | 'round' | 'square'>('round');
  const [lineJoin, setLineJoin] = useState<'miter' | 'round' | 'bevel'>('round');
  const [colorOpen, setColorOpen] = useState(false);

  const syncFromObj = useCallback(() => {
    if (!obj) return;
    const o = obj as FabricObject & Record<string, unknown>;
    const sw = typeof o.strokeWidth === 'number' ? o.strokeWidth : 0;
    setEnabled(sw > 0);
    setWidth(sw > 0 ? sw : 2);
    // Separate the stored stroke color into RGB part + alpha part
    const rawStroke = typeof o.stroke === 'string' && o.stroke ? o.stroke : '#000000';
    // ColorPicker consumes hex values; passing `rgb(...)` here makes its
    // hex parser fall back to its red default on the next pointer event.
    setColor(colorToHex(rawStroke));
    setStrokeOpacity(Math.round(extractColorAlpha(rawStroke) * 100));
    const da = (o as FabricObject & { strokeDashArray?: number[] | null }).strokeDashArray;
    setDashPreset(detectPresetId(da));
    setGapWidth(extractGap(da));
    setLineCap(((o as FabricObject & { strokeLineCap?: 'butt' | 'round' | 'square' }).strokeLineCap) || 'round');
    setLineJoin(((o as FabricObject & { strokeLineJoin?: 'miter' | 'round' | 'bevel' }).strokeLineJoin) || 'round');
  }, [obj]);

  useEffect(() => {
    if (!isOpen) {
      setExpanded(false);
      setColorOpen(false);
      return;
    }
    syncFromObj();
  }, [isOpen, syncFromObj]);

  /**
   * Build the final stroke color string by merging the RGB color with the opacity.
   * This keeps fill opacity and stroke opacity completely independent — the stroke
   * never inherits from obj.opacity.
   */
  const buildStrokeColor = (rgb: string, opacityPct: number): string =>
    withAlpha(rgb, opacityPct / 100);

  const applyStroke = useCallback((
    en: boolean, c: string, w: number, preset: string, gap: number, opacityPct: number,
    cap = lineCap, join = lineJoin,
  ) => {
    if (!obj) return;
    const dashArr = en ? buildDashArray(preset, gap) : null;
    const finalStroke = en ? buildStrokeColor(c, opacityPct) : undefined;
    obj.set({
      stroke: finalStroke,
      strokeWidth: en ? w : 0,
      strokeDashArray: dashArr,
      strokeLineCap: cap,
      strokeLineJoin: join,
    });
    obj.setCoords();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).setDirty?.(true);
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
  }, [obj, controller, lineCap, lineJoin]);

  const isDashed = dashPreset !== 'solid';
  const previewDash = buildDashArray(dashPreset, gapWidth);
  const widthLabel = Number.isInteger(width) ? `${width}` : width.toFixed(2);

  if (!isOpen || !obj) return null;

  return (
    <div
      className="absolute bottom-full left-1/2 z-50 mb-3 w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2"
      data-testid="stroke-panel"
    >
      <div className="overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#12161A] shadow-[0_-8px_28px_rgba(0,0,0,0.45)]">
        {!expanded ? (
          /* ── Compact quick bar ── */
          <div className="flex min-w-0 items-center gap-2 p-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-12 shrink-0 items-center justify-center gap-0.5 rounded-lg border border-cyan-500/30 bg-cyan-400/10 text-cyan-300 transition-colors hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  aria-label={`Choose stroke parameter, currently ${STROKE_PARAMETER_LABELS[activeParameter]}`}
                  title={STROKE_PARAMETER_LABELS[activeParameter]}
                >
                  <PenLine size={17} aria-hidden="true" />
                  <ChevronDown size={11} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="min-w-44 border-cyan-500/20 bg-[#12161A]">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Stroke control
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuRadioGroup
                  value={activeParameter}
                  onValueChange={(value) => setActiveParameter(value as StrokeParameter)}
                >
                  {(Object.keys(STROKE_PARAMETER_LABELS) as StrokeParameter[]).map((parameter) => (
                    <DropdownMenuRadioItem key={parameter} value={parameter} className="text-xs">
                      {STROKE_PARAMETER_LABELS[parameter]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Switch
              checked={enabled}
              onCheckedChange={(value) => {
                setEnabled(value);
                applyStroke(value, color, width, dashPreset, gapWidth, strokeOpacity);
              }}
              aria-label="Toggle stroke"
              className="shrink-0 data-[state=checked]:bg-cyan-400"
            />

            {activeParameter === 'capJoin' ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <select
                  value={lineCap}
                  onChange={(event) => {
                    const value = event.target.value as typeof lineCap;
                    setLineCap(value);
                    applyStroke(enabled, color, width, dashPreset, gapWidth, strokeOpacity, value, lineJoin);
                  }}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/60"
                  aria-label="Stroke cap"
                >
                  <option value="butt">Butt cap</option>
                  <option value="round">Round cap</option>
                  <option value="square">Square cap</option>
                </select>
                <select
                  value={lineJoin}
                  onChange={(event) => {
                    const value = event.target.value as typeof lineJoin;
                    setLineJoin(value);
                    applyStroke(enabled, color, width, dashPreset, gapWidth, strokeOpacity, lineCap, value);
                  }}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-300/60"
                  aria-label="Stroke join"
                >
                  <option value="miter">Miter join</option>
                  <option value="round">Round join</option>
                  <option value="bevel">Bevel join</option>
                </select>
              </div>
            ) : (
              <>
                <span className="min-w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-cyan-300">
                  {activeParameter === 'width' ? `${widthLabel}px` : `${Math.round(gapWidth)}px`}
                </span>
                <Slider
                  min={activeParameter === 'width' ? 0 : 1}
                  max={activeParameter === 'width' ? 40 : 60}
                  step={activeParameter === 'width' ? 0.05 : 1}
                  value={[activeParameter === 'width' ? width : gapWidth]}
                  onValueChange={([value]) => {
                    if (activeParameter === 'width') {
                      setWidth(value);
                      applyStroke(enabled, color, value, dashPreset, gapWidth, strokeOpacity);
                    } else {
                      setGapWidth(value);
                      applyStroke(enabled, color, width, dashPreset, value, strokeOpacity);
                    }
                  }}
                  className="w-full flex-1"
                  aria-label={STROKE_PARAMETER_LABELS[activeParameter]}
                  disabled={!enabled}
                />
              </>
            )}

            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-400/10 text-cyan-300 transition-colors hover:bg-cyan-400/15"
              aria-label="Expand stroke settings"
              title="Advanced stroke settings"
            >
              <ChevronUp size={16} />
            </button>
          </div>
        ) : (
          /* ── Expanded advanced drawer ── */
          <div
            className="max-h-[min(72vh,560px)] overflow-y-auto px-4 pt-3"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <PenLine size={15} style={{ color: '#00F5FF' }} />
                <span className="text-xs font-semibold tracking-wider" style={{ color: '#00F5FF' }}>
                  STROKE SETTINGS
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  setColorOpen(false);
                }}
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{
                  color: '#00F5FF',
                  background: 'rgba(0,245,255,0.1)',
                  border: '1px solid rgba(0,245,255,0.3)',
                }}
                aria-label="Collapse stroke settings"
                title="Collapse stroke settings"
              >
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* ── Enable ── */}
              <div className="flex items-center justify-between">
                <SectionLabel>Border Stroke</SectionLabel>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => {
                    setEnabled(v);
                    applyStroke(v, color, width, dashPreset, gapWidth, strokeOpacity);
                  }}
                />
              </div>

              {/* ── Color ── */}
              <div className="space-y-1.5">
                <Separator />
                <SectionLabel>Color</SectionLabel>
                <button
                  type="button"
                  disabled={!enabled}
                  className="flex items-center gap-3 w-full py-1 rounded-lg px-2 transition-all disabled:opacity-45"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  onClick={() => setColorOpen((o) => !o)}
                >
                  <div
                    className="w-8 h-8 rounded border border-border flex-shrink-0"
                    style={{ background: buildStrokeColor(color, strokeOpacity) }}
                  />
                  <span className="text-xs font-mono text-muted-foreground">{color.toUpperCase()}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{colorOpen ? '▲' : '▼'}</span>
                </button>
                {colorOpen && enabled && (
                  <ColorPicker
                    value={color}
                    onChange={(v) => {
                      const hex = colorToHex(v);
                      setColor(hex);
                      applyStroke(true, hex, width, dashPreset, gapWidth, strokeOpacity);
                    }}
                  />
                )}
              </div>

              {/* ── Stroke Opacity (independent of fill opacity) ── */}
              <div className="space-y-1.5">
                <Separator />
                <SectionLabel>Stroke Opacity</SectionLabel>
                <div className={!enabled ? 'opacity-45' : undefined}>
                  <SliderRow
                    label="Opacity"
                    value={strokeOpacity}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    disabled={!enabled}
                    onChange={(v) => {
                      setStrokeOpacity(v);
                      applyStroke(true, color, width, dashPreset, gapWidth, v);
                    }}
                  />
                </div>
              </div>

              {/* ── Width and exact value ── */}
              <div className="space-y-2">
                <Separator />
                <SectionLabel>Width</SectionLabel>
                <div className={!enabled ? 'opacity-45' : undefined}>
                  <SliderRow
                    label="Stroke Width"
                    value={width}
                    min={0}
                    max={40}
                    step={0.05}
                    unit="px"
                    decimals={2}
                    disabled={!enabled}
                    onChange={(v) => {
                      setWidth(v);
                      applyStroke(true, color, v, dashPreset, gapWidth, strokeOpacity);
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground flex-shrink-0">Exact px</Label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={0.05}
                    value={width}
                    disabled={!enabled}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(40, parseFloat(e.target.value) || 0));
                      setWidth(v);
                      applyStroke(true, color, v, dashPreset, gapWidth, strokeOpacity);
                    }}
                    className="w-24 h-8 bg-transparent border border-border rounded px-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-45"
                    aria-label="Exact stroke width in pixels"
                  />
                </div>
              </div>

              {/* ── Pattern ── */}
              <div className="space-y-2">
                <Separator />
                <SectionLabel>Pattern</SectionLabel>
                <div className={`grid grid-cols-4 gap-1.5 ${!enabled ? 'opacity-45' : ''}`}>
                  {DASH_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      disabled={!enabled}
                      onClick={() => {
                        setDashPreset(p.id);
                        applyStroke(true, color, width, p.id, gapWidth, strokeOpacity);
                      }}
                      className="py-2 rounded-lg text-xs transition-all border disabled:cursor-not-allowed"
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
                <svg width="100%" height="20" style={{ overflow: 'visible', opacity: enabled ? 1 : 0.45 }}>
                  <line
                    x1="0" y1="10" x2="100%" y2="10"
                    stroke={buildStrokeColor(color, strokeOpacity)}
                    strokeWidth={Math.min(width, 6)}
                    strokeDasharray={previewDash ? previewDash.join(' ') : ''}
                  />
                </svg>

                {isDashed && (
                  <div className={!enabled ? 'opacity-45' : undefined}>
                    <SectionLabel>Pattern Spacing</SectionLabel>
                    <SliderRow
                      label="Gap Width"
                      value={gapWidth}
                      min={1}
                      max={60}
                      step={1}
                      unit="px"
                      disabled={!enabled}
                      onChange={(v) => {
                        setGapWidth(v);
                        applyStroke(true, color, width, dashPreset, v, strokeOpacity);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
