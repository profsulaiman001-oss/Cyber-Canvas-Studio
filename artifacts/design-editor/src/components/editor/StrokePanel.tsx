import { useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useEditor } from '@/store/editorStore';
import { CanvasController, extractColorAlpha, withAlpha, opaqueColor } from '@/hooks/useFabricCanvas';
import { FabricObject } from 'fabric';
import { ChevronDown, ChevronUp, PenLine } from 'lucide-react';
import ColorPicker from './ColorPicker';

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

export default function StrokePanel({ controller }: StrokePanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'stroke';
  const obj = controller.selectedObject;

  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // color stores only the opaque RGB — alpha is tracked separately via strokeOpacity
  const [color, setColor] = useState('#000000');
  const [strokeOpacity, setStrokeOpacity] = useState(100); // 0–100
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
    // Separate the stored stroke color into RGB part + alpha part
    const rawStroke = typeof o.stroke === 'string' && o.stroke ? o.stroke : '#000000';
    setColor(opaqueColor(rawStroke));
    setStrokeOpacity(Math.round(extractColorAlpha(rawStroke) * 100));
    const da = (o as FabricObject & { strokeDashArray?: number[] | null }).strokeDashArray;
    setDashPreset(detectPresetId(da));
    setGapWidth(extractGap(da));
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
  ) => {
    if (!obj) return;
    const dashArr = en ? buildDashArray(preset, gap) : null;
    const finalStroke = en ? buildStrokeColor(c, opacityPct) : undefined;
    obj.set({
      stroke: finalStroke,
      strokeWidth: en ? w : 0,
      strokeDashArray: dashArr,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).setDirty?.(true);
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
  }, [obj, controller]);

  const isDashed = dashPreset !== 'solid';
  const previewDash = buildDashArray(dashPreset, gapWidth);
  const widthLabel = Number.isInteger(width) ? `${width}` : width.toFixed(2);

  if (!isOpen || !obj) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 z-50" data-testid="stroke-panel">
      <div
        className="border-t"
        style={{
          background: '#11141A',
          borderTopColor: 'rgba(0,245,255,0.4)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {!expanded ? (
          /* ── Compact quick bar ── */
          <div className="flex items-center gap-2 px-4 py-3">
            <PenLine size={14} style={{ color: '#00F5FF', flexShrink: 0 }} />
            <span className="text-xs font-semibold tracking-wider shrink-0" style={{ color: '#00F5FF' }}>
              STROKE
            </span>
            <span
              className="text-[10px] font-medium tabular-nums shrink-0"
              style={{ color: '#00F5FF', minWidth: '38px', textAlign: 'right' }}
            >
              {widthLabel}px
            </span>
            <Slider
              min={0}
              max={40}
              step={0.05}
              value={[width]}
              onValueChange={([v]) => {
                setWidth(v);
                applyStroke(true, color, v, dashPreset, gapWidth, strokeOpacity);
              }}
              className="flex-1"
              aria-label="Stroke Width"
            />
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
              style={{
                color: '#00F5FF',
                background: 'rgba(0,245,255,0.12)',
                border: '1px solid rgba(0,245,255,0.35)',
              }}
              aria-label="Expand stroke settings"
              title="Advanced stroke settings"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'CLOSE_PANEL' })}
              className="text-[10px] px-2.5 py-1.5 rounded-lg shrink-0 font-medium"
              style={{
                background: 'rgba(0,245,255,0.12)',
                color: '#00F5FF',
                border: '1px solid rgba(0,245,255,0.4)',
              }}
            >
              Done
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
                      // v arrives as an opaque color from the picker
                      const rgb = opaqueColor(v);
                      setColor(rgb);
                      applyStroke(true, rgb, width, dashPreset, gapWidth, strokeOpacity);
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
