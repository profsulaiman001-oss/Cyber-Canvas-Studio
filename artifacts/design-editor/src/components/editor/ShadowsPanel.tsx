import { useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject, Shadow } from 'fabric';
import { ChevronDown, ChevronUp, Layers3 } from 'lucide-react';
import ColorPicker from './ColorPicker';

interface ShadowsPanelProps { controller: CanvasController }
type ShadowMode = 'drop' | 'inner';

/* ── Color parsing utilities ── */
function parseColorToHex(color: string): string {
  if (!color) return '#000000';
  if (color.startsWith('#')) {
    const c = color.replace('#', '');
    const clean = c.length === 3 ? c[0] + c[0] + c[1] + c[1] + c[2] + c[2] : c.slice(0, 6);
    return `#${clean.toLowerCase().padEnd(6, '0')}`;
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    return `#${[m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, parseInt(v, 10))).toString(16).padStart(2, '0')).join('')}`;
  }
  return '#000000';
}

function parseAlphaPercent(color: string): number {
  if (!color || !color.startsWith('rgba')) return 80;
  const m = color.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/i);
  return m ? Math.round(Math.max(0, Math.min(1, parseFloat(m[1]))) * 100) : 80;
}

function hexToRgba(hex: string, opacityPercent: number): string {
  const clean = hex.replace('#', '');
  const expanded = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.slice(0, 6).padEnd(6, '0');
  const r = parseInt(expanded.slice(0, 2), 16) || 0;
  const g = parseInt(expanded.slice(2, 4), 16) || 0;
  const b = parseInt(expanded.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, opacityPercent / 100)).toFixed(3)})`;
}

function SliderRow({
  label, value, min, max, onChange, unit = '',
}: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <span className="text-[11px] font-mono text-primary">{Math.round(value * 100) / 100}{unit}</span>
      </div>
      <Slider min={min} max={max} step={1} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="flex items-center justify-between w-full rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
        onClick={() => setOpen((o) => !o)}
      >
        <Label className="text-[11px] text-muted-foreground pointer-events-none">Color</Label>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md border border-white/20" style={{ background: value }} />
          <span className="text-[10px] font-mono text-muted-foreground">{value.toUpperCase()}</span>
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-72 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
        <ColorPicker value={value} onChange={onChange} />
      </div>
    </div>
  );
}

export default function ShadowsPanel({ controller }: ShadowsPanelProps) {
  const { state, dispatch } = useEditor();
  const obj = controller.selectedObject;
  const isImage = obj?.type === 'image';
  const [activeMode, setActiveMode] = useState<ShadowMode>('drop');
  const [expanded, setExpanded] = useState(false);

  const [dropEnabled, setDropEnabled] = useState(false);
  const [dropColor, setDropColor] = useState('#000000');
  const [dropBlur, setDropBlur] = useState(10);
  const [dropOffX, setDropOffX] = useState(5);
  const [dropOffY, setDropOffY] = useState(5);
  const [dropOpacity, setDropOpacity] = useState(80);

  const [innerEnabled, setInnerEnabled] = useState(false);
  const [innerColor, setInnerColor] = useState('#000000');
  const [innerBlur, setInnerBlur] = useState(15);
  const [innerOffX, setInnerOffX] = useState(0);
  const [innerOffY, setInnerOffY] = useState(0);
  const [innerOpacity, setInnerOpacity] = useState(60);

  const syncFromObj = useCallback(() => {
    if (!obj) return;
    const o = obj as FabricObject & Record<string, unknown>;
    const shadow = o.shadow as Shadow | null;
    const glow = (o as Record<string, unknown>)._glow as { enabled?: boolean } | undefined;

    if (shadow && !glow?.enabled && (shadow.offsetX !== 0 || shadow.offsetY !== 0 || shadow.blur !== 0)) {
      setDropEnabled(true);
      setDropColor(parseColorToHex(shadow.color || '#000000'));
      setDropOpacity(parseAlphaPercent(shadow.color || 'rgba(0,0,0,0.8)'));
      setDropBlur(shadow.blur || 10);
      setDropOffX(shadow.offsetX || 5);
      setDropOffY(shadow.offsetY || 5);
    } else {
      setDropEnabled(false);
    }

    const inner = (o as Record<string, unknown>)._innerShadow as {
      enabled?: boolean; color?: string; blur?: number; offsetX?: number; offsetY?: number; opacity?: number;
    } | undefined;
    if (inner) {
      setInnerEnabled(!!inner.enabled);
      setInnerColor(parseColorToHex(inner.color || '#000000'));
      setInnerBlur(inner.blur ?? 15);
      setInnerOffX(inner.offsetX ?? 0);
      setInnerOffY(inner.offsetY ?? 0);
      setInnerOpacity(inner.opacity ?? 60);
    } else {
      setInnerEnabled(false);
    }
  }, [obj]);

  useEffect(() => {
    syncFromObj();
    setExpanded(false);
  }, [syncFromObj]);

  const applyDropShadow = useCallback((
    enabled: boolean, color: string, blur: number, offsetX: number, offsetY: number, opacity: number,
  ) => {
    if (!obj) return;
    const multiplier = isImage ? 2 : 1;
    obj.set('shadow', enabled ? new Shadow({
      color: hexToRgba(color, opacity),
      blur: blur * multiplier,
      offsetX: offsetX * multiplier,
      offsetY: offsetY * multiplier,
    }) : null);
    // Fabric can cache shadowed objects; invalidate before the immediate render.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).setDirty?.(true);
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
  }, [obj, controller, isImage]);

  const applyInnerShadow = useCallback((
    enabled: boolean, color: string, blur: number, offsetX: number, offsetY: number, opacity: number,
  ) => {
    controller.applyInnerShadow(obj, enabled ? { enabled: true, color, blur, offsetX, offsetY, opacity } : null);
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
  }, [obj, controller]);

  if (!obj || state.activePanel !== 'shadows') return null;

  const isDrop = activeMode === 'drop';
  const activeEnabled = isDrop ? dropEnabled : innerEnabled;
  const activeBlur = isDrop ? dropBlur : innerBlur;
  const blurMax = isDrop ? 80 : 60;
  const activeLabel = isDrop ? 'Drop Shadow' : 'Inner Shadow';

  const setMode = (mode: ShadowMode) => setActiveMode(mode);
  const setActiveEnabled = (enabled: boolean) => {
    if (isDrop) {
      setDropEnabled(enabled);
      applyDropShadow(enabled, dropColor, dropBlur, dropOffX, dropOffY, dropOpacity);
    } else {
      setInnerEnabled(enabled);
      applyInnerShadow(enabled, innerColor, innerBlur, innerOffX, innerOffY, innerOpacity);
    }
  };

  const setActiveBlur = (blur: number) => {
    if (isDrop) {
      setDropBlur(blur);
      applyDropShadow(true, dropColor, blur, dropOffX, dropOffY, dropOpacity);
    } else {
      setInnerBlur(blur);
      applyInnerShadow(true, innerColor, blur, innerOffX, innerOffY, innerOpacity);
    }
  };

  return (
    <div
      className="absolute bottom-full left-1/2 z-50 w-[min(560px,calc(100vw-24px))] -translate-x-1/2 mb-2"
      data-testid="shadows-panel"
    >
      {/* Expanded controls sheet. It stays mounted so switching modes is seamless. */}
      <div
        className={`overflow-hidden rounded-2xl transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-[520px] opacity-100 mb-2' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
        style={{
          background: '#11141A',
          border: expanded ? '1px solid rgba(0,245,255,0.25)' : '1px solid transparent',
          boxShadow: expanded ? '0 -8px 30px rgba(0,0,0,0.45)' : 'none',
        }}
      >
        <div className="px-4 pt-3 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers3 size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">{activeLabel}</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Detailed controls</span>
          </div>

          <ColorField
            value={isDrop ? dropColor : innerColor}
            onChange={(value) => {
              const hex = parseColorToHex(value);
              if (isDrop) {
                setDropColor(hex);
                applyDropShadow(true, hex, dropBlur, dropOffX, dropOffY, dropOpacity);
              } else {
                setInnerColor(hex);
                applyInnerShadow(true, hex, innerBlur, innerOffX, innerOffY, innerOpacity);
              }
            }}
          />
          <SliderRow
            label="Blur"
            value={activeBlur}
            min={0}
            max={blurMax}
            onChange={setActiveBlur}
          />
          <div className="grid grid-cols-2 gap-4">
            <SliderRow
              label="Offset X"
              value={isDrop ? dropOffX : innerOffX}
              min={-80}
              max={80}
              onChange={(value) => {
                if (isDrop) {
                  setDropOffX(value);
                  applyDropShadow(true, dropColor, dropBlur, value, dropOffY, dropOpacity);
                } else {
                  setInnerOffX(value);
                  applyInnerShadow(true, innerColor, innerBlur, value, innerOffY, innerOpacity);
                }
              }}
            />
            <SliderRow
              label="Offset Y"
              value={isDrop ? dropOffY : innerOffY}
              min={-80}
              max={80}
              onChange={(value) => {
                if (isDrop) {
                  setDropOffY(value);
                  applyDropShadow(true, dropColor, dropBlur, dropOffX, value, dropOpacity);
                } else {
                  setInnerOffY(value);
                  applyInnerShadow(true, innerColor, innerBlur, innerOffX, value, innerOpacity);
                }
              }}
            />
          </div>
          <SliderRow
            label="Opacity"
            value={isDrop ? dropOpacity : innerOpacity}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => {
              if (isDrop) {
                setDropOpacity(value);
                applyDropShadow(true, dropColor, dropBlur, dropOffX, dropOffY, value);
              } else {
                setInnerOpacity(value);
                applyInnerShadow(true, innerColor, innerBlur, innerOffX, innerOffY, value);
              }
            }}
          />
        </div>
      </div>

      {/* Compact floating bar */}
      <div
        className="flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-all duration-300 ease-in-out"
        style={{
          background: '#11141A',
          border: '1px solid rgba(0,245,255,0.3)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
        }}
      >
        <div className="flex items-center gap-1 rounded-xl p-0.5 shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {(['drop', 'inner'] as ShadowMode[]).map((mode) => {
            const selected = activeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setMode(mode)}
                className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all duration-300 ease-in-out"
                style={{
                  color: selected ? '#00F5FF' : 'rgba(255,255,255,0.45)',
                  background: selected ? 'rgba(0,245,255,0.14)' : 'transparent',
                  boxShadow: selected ? '0 0 8px rgba(0,245,255,0.12)' : 'none',
                }}
              >
                {mode === 'drop' ? 'Drop Shadow' : 'Inner Shadow'}
              </button>
            );
          })}
        </div>

        <Switch checked={activeEnabled} onCheckedChange={setActiveEnabled} aria-label={`Toggle ${activeLabel}`} />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[10px] text-muted-foreground shrink-0">Blur</span>
          <Slider
            min={0}
            max={blurMax}
            step={1}
            value={[activeBlur]}
            onValueChange={([value]) => setActiveBlur(value)}
            disabled={!activeEnabled}
            className="min-w-0 flex-1"
          />
          <span className="text-[10px] font-mono text-primary w-5 text-right">{activeBlur}</span>
        </div>

        <button
          onClick={() => setExpanded((open) => !open)}
          className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all duration-300 ease-in-out hover:bg-white/10"
          style={{ color: '#00F5FF', background: expanded ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.05)' }}
          aria-label={expanded ? 'Collapse shadow controls' : 'Expand shadow controls'}
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
    </div>
  );
}