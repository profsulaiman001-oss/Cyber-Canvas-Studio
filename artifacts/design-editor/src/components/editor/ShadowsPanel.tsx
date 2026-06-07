import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject, Shadow } from 'fabric';
import { Layers3 } from 'lucide-react';
import ColorPicker from './ColorPicker';

interface ShadowsPanelProps { controller: CanvasController }

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const expanded = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.slice(0, 6).padEnd(6, '0');
  const r = parseInt(expanded.slice(0, 2), 16) || 0;
  const g = parseInt(expanded.slice(2, 4), 16) || 0;
  const b = parseInt(expanded.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha / 100)).toFixed(3)})`;
}

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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="flex items-center justify-between w-full py-0.5" onClick={() => setOpen((o) => !o)}>
        <Label className="text-xs text-muted-foreground cursor-pointer pointer-events-none">{label}</Label>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border border-border flex-shrink-0" style={{ background: value }} />
          <span className="text-xs font-mono text-muted-foreground w-16 text-left">{value.toUpperCase()}</span>
        </div>
      </button>
      {open && <div className="mt-2 mb-1"><ColorPicker value={value} onChange={onChange} /></div>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-1">{children}</p>;
}

export default function ShadowsPanel({ controller }: ShadowsPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'shadows';
  const obj = controller.selectedObject;
  const isImage = obj?.type === 'image';

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
      setDropColor(shadow.color || '#000000');
      setDropBlur(shadow.blur || 10);
      setDropOffX(shadow.offsetX || 5);
      setDropOffY(shadow.offsetY || 5);
    } else {
      setDropEnabled(false);
    }

    const inner = (o as Record<string, unknown>)._innerShadow as
      { enabled?: boolean; color?: string; blur?: number; offsetX?: number; offsetY?: number; opacity?: number } | undefined;
    if (inner) {
      setInnerEnabled(!!inner.enabled);
      setInnerColor(inner.color || '#000000');
      setInnerBlur(inner.blur ?? 15);
      setInnerOffX(inner.offsetX ?? 0);
      setInnerOffY(inner.offsetY ?? 0);
      setInnerOpacity(inner.opacity ?? 60);
    } else {
      setInnerEnabled(false);
    }
  }, [obj]);

  useEffect(() => { syncFromObj(); }, [syncFromObj]);

  const applyDropShadow = useCallback((
    en: boolean, color: string, blur: number, ox: number, oy: number, opa: number
  ) => {
    if (!obj) return;
    const canvas = controller.getCanvas();
    if (en) {
      const m = isImage ? 2 : 1;
      obj.set('shadow', new Shadow({
        color: hexToRgba(color, opa),
        blur: blur * m,
        offsetX: ox * m,
        offsetY: oy * m,
      }));
    } else {
      obj.set('shadow', null);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).setDirty?.(true);
    canvas?.requestRenderAll();
    controller.commitChange();
  }, [obj, controller, isImage]);

  const applyInnerShadow = useCallback((
    en: boolean, color: string, blur: number, ox: number, oy: number, opa: number
  ) => {
    controller.applyInnerShadow(obj,
      en ? { enabled: true, color, blur, offsetX: ox, offsetY: oy, opacity: opa } : null
    );
    controller.commitChange();
  }, [obj, controller]);

  if (!obj) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '78vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="shadows-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers3 size={15} className="text-primary" />
            Shadows
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          {/* ── Drop Shadow ── */}
          <div className="flex items-center justify-between">
            <SectionLabel>Drop Shadow</SectionLabel>
            <Switch
              checked={dropEnabled}
              onCheckedChange={(v) => {
                setDropEnabled(v);
                applyDropShadow(v, dropColor, dropBlur, dropOffX, dropOffY, dropOpacity);
              }}
            />
          </div>
          {dropEnabled && (
            <div className="space-y-3 pl-2 border-l border-border">
              <ColorField
                label="Color"
                value={dropColor}
                onChange={(v) => { setDropColor(v); applyDropShadow(true, v, dropBlur, dropOffX, dropOffY, dropOpacity); }}
              />
              <SliderRow label="Blur" value={dropBlur} min={0} max={80}
                onChange={(v) => { setDropBlur(v); applyDropShadow(true, dropColor, v, dropOffX, dropOffY, dropOpacity); }} />
              <SliderRow label="Offset X" value={dropOffX} min={-80} max={80}
                onChange={(v) => { setDropOffX(v); applyDropShadow(true, dropColor, dropBlur, v, dropOffY, dropOpacity); }} />
              <SliderRow label="Offset Y" value={dropOffY} min={-80} max={80}
                onChange={(v) => { setDropOffY(v); applyDropShadow(true, dropColor, dropBlur, dropOffX, v, dropOpacity); }} />
              <SliderRow label="Opacity" value={dropOpacity} min={0} max={100} unit="%"
                onChange={(v) => { setDropOpacity(v); applyDropShadow(true, dropColor, dropBlur, dropOffX, dropOffY, v); }} />
            </div>
          )}

          {/* ── Inner Shadow ── */}
          <Separator />
          <div className="flex items-center justify-between">
            <SectionLabel>Inner Shadow</SectionLabel>
            <Switch
              checked={innerEnabled}
              onCheckedChange={(v) => {
                setInnerEnabled(v);
                applyInnerShadow(v, innerColor, innerBlur, innerOffX, innerOffY, innerOpacity);
              }}
            />
          </div>
          {innerEnabled && (
            <div className="space-y-3 pl-2 border-l border-border">
              <ColorField
                label="Color"
                value={innerColor}
                onChange={(v) => { setInnerColor(v); applyInnerShadow(true, v, innerBlur, innerOffX, innerOffY, innerOpacity); }}
              />
              <SliderRow label="Blur" value={innerBlur} min={0} max={60}
                onChange={(v) => { setInnerBlur(v); applyInnerShadow(true, innerColor, v, innerOffX, innerOffY, innerOpacity); }} />
              <SliderRow label="Offset X" value={innerOffX} min={-40} max={40}
                onChange={(v) => { setInnerOffX(v); applyInnerShadow(true, innerColor, innerBlur, v, innerOffY, innerOpacity); }} />
              <SliderRow label="Offset Y" value={innerOffY} min={-40} max={40}
                onChange={(v) => { setInnerOffY(v); applyInnerShadow(true, innerColor, innerBlur, innerOffX, v, innerOpacity); }} />
              <SliderRow label="Opacity" value={innerOpacity} min={0} max={100} unit="%"
                onChange={(v) => { setInnerOpacity(v); applyInnerShadow(true, innerColor, innerBlur, innerOffX, innerOffY, v); }} />
            </div>
          )}

          <div className="h-2" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
