import { useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <span className="font-mono text-[11px] text-primary">{display}{unit}</span>
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

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{title}</p>
      <p className="text-right text-[10px] text-muted-foreground">{description}</p>
    </div>
  );
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

  const renderCompactControls = () => (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-12 max-w-[48px] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-primary hover:bg-primary/10"
            aria-label={`Choose stroke parameter, currently ${STROKE_PARAMETER_LABELS[activeParameter]}`}
            title={STROKE_PARAMETER_LABELS[activeParameter]}
          >
            <PenLine size={14} aria-hidden="true" />
            <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="w-52 border-cyan-400/20 bg-[#11141A] text-foreground">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">
            Stroke parameter
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={activeParameter}
            onValueChange={(value) => setActiveParameter(value as StrokeParameter)}
          >
            {(Object.keys(STROKE_PARAMETER_LABELS) as StrokeParameter[]).map((parameter) => (
              <DropdownMenuRadioItem key={parameter} value={parameter} className="gap-2 text-xs data-[state=checked]:text-primary">
                {STROKE_PARAMETER_LABELS[parameter]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {activeParameter === 'capJoin' ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <select
            value={lineCap}
            onChange={(event) => {
              const value = event.target.value as typeof lineCap;
              setLineCap(value);
              applyStroke(enabled, color, width, dashPreset, gapWidth, strokeOpacity, value, lineJoin);
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
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
            className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
            aria-label="Stroke join"
          >
            <option value="miter">Miter join</option>
            <option value="round">Round join</option>
            <option value="bevel">Bevel join</option>
          </select>
        </div>
      ) : (
        <>
          <div className="min-w-0 w-full flex-1">
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
              className="w-full"
              aria-label={STROKE_PARAMETER_LABELS[activeParameter]}
              disabled={!enabled}
            />
          </div>
          <span className="min-w-[42px] shrink-0 text-right font-mono text-[10px] text-primary">
            {activeParameter === 'width' ? `${widthLabel}px` : `${Math.round(gapWidth)}px`}
          </span>
        </>
      )}

      <Switch
        checked={enabled}
        onCheckedChange={(value) => {
          setEnabled(value);
          applyStroke(value, color, width, dashPreset, gapWidth, strokeOpacity);
        }}
        aria-label="Toggle stroke"
      />
      <button
        type="button"
        onClick={() => {
          const nextExpanded = !expanded;
          setExpanded(nextExpanded);
          if (!nextExpanded) setColorOpen(false);
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
        aria-label={expanded ? 'Collapse stroke settings' : 'Expand stroke settings'}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
    </div>
  );

  if (!isOpen || !obj) return null;

  return (
    <div
      className="absolute bottom-full left-1/2 z-[9999] mb-2 flex w-[min(720px,calc(100vw-20px))] -translate-x-1/2 flex-col"
      data-testid="stroke-panel"
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
          boxShadow: expanded
            ? '0 -8px 30px rgba(0,0,0,0.45)'
            : 'none',
        }}
        aria-hidden={!expanded}
        data-testid="stroke-settings-drawer"
      >
        <div
          className="space-y-4 px-4 pb-4 pt-3"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PenLine size={14} className="text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  STROKE SETTINGS
                </span>
              </div>
              <span className="mr-auto pl-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Fine-tune the selected outline
              </span>
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  setColorOpen(false);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
                aria-label="Collapse stroke settings"
                title="Collapse stroke settings"
              >
                <ChevronUp size={15} />
              </button>
            </div>

            <div className="space-y-4">
              {/* ── Enable ── */}
              <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <SectionHeader title="Border Stroke" description="Show or hide the outline" />
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => {
                    setEnabled(v);
                    applyStroke(v, color, width, dashPreset, gapWidth, strokeOpacity);
                  }}
                />
              </div>

              {/* ── Color ── */}
              <div className="space-y-3 border-t border-border pt-3">
                <SectionHeader title="Color" description="Choose the outline color" />
                <button
                  type="button"
                  disabled={!enabled}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setColorOpen((open) => !open)}
                  aria-expanded={colorOpen}
                >
                  <span className="text-[11px] text-muted-foreground">Stroke color</span>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-5 w-5 rounded-md border border-white/20"
                      style={{ background: buildStrokeColor(color, strokeOpacity) }}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">{color.toUpperCase()}</span>
                    {colorOpen ? <ChevronUp size={13} className="text-primary" /> : <ChevronDown size={13} className="text-primary" />}
                  </span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${colorOpen && enabled ? 'mt-2 max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <ColorPicker
                    value={color}
                    onChange={(value) => {
                      const hex = colorToHex(value);
                      setColor(hex);
                      applyStroke(true, hex, width, dashPreset, gapWidth, strokeOpacity);
                    }}
                  />
                </div>
              </div>

              {/* ── Stroke Opacity (independent of fill opacity) ── */}
              <div className="space-y-3 border-t border-border pt-3">
                <SectionHeader title="Stroke Opacity" description="Set stroke transparency" />
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
              <div className="space-y-3 border-t border-border pt-3">
                <SectionHeader title="Width" description="Adjust line thickness" />
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
                  <Label className="shrink-0 text-[10px] text-muted-foreground">Exact px</Label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={0.05}
                    value={width}
                    disabled={!enabled}
                    onChange={(event) => {
                      const value = Math.max(0, Math.min(40, parseFloat(event.target.value) || 0));
                      setWidth(value);
                      applyStroke(true, color, value, dashPreset, gapWidth, strokeOpacity);
                    }}
                    className="h-8 w-24 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-right font-mono text-xs text-primary focus:outline-none focus:ring-1 focus:ring-primary/60 disabled:opacity-45"
                    aria-label="Exact stroke width in pixels"
                  />
                </div>
              </div>

              {/* ── Pattern ── */}
              <div className="space-y-3 border-t border-border pt-3">
                <SectionHeader title="Pattern" description="Choose a line treatment" />
                <div className="grid grid-cols-4 gap-2">
                  {DASH_PRESETS.map((preset) => {
                    const active = dashPreset === preset.id;
                    return (
                      <button
                        type="button"
                        key={preset.id}
                        disabled={!enabled}
                        onClick={() => {
                          setDashPreset(preset.id);
                          applyStroke(true, color, width, preset.id, gapWidth, strokeOpacity);
                        }}
                        className={`rounded-lg border px-2 py-2 text-center text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          active
                            ? 'border-primary/50 bg-primary/10 text-primary'
                            : 'border-white/10 bg-white/[0.035] text-muted-foreground hover:border-primary/40 hover:bg-primary/10'
                        }`}
                        aria-pressed={active}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Live SVG preview */}
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3">
                  <svg width="100%" height="20" style={{ overflow: 'visible', opacity: enabled ? 1 : 0.45 }}>
                    <line
                      x1="0" y1="10" x2="100%" y2="10"
                      stroke={buildStrokeColor(color, strokeOpacity)}
                      strokeWidth={Math.min(width, 6)}
                      strokeDasharray={previewDash ? previewDash.join(' ') : ''}
                    />
                  </svg>
                </div>

                {isDashed && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <SectionHeader title="Pattern Spacing" description="Set the gap between marks" />
                    <div className={!enabled ? 'opacity-45' : undefined}>
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
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      <div
        className="flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2.5"
        style={{
          background: '#11141A',
          borderColor: 'rgba(0,245,255,0.3)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
        }}
        data-testid="stroke-compact-pill"
      >
        {renderCompactControls()}
      </div>
    </div>
  );
}
