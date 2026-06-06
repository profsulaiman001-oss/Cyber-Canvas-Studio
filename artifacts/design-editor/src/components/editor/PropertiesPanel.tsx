import { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject, Shadow, Rect } from 'fabric';
import CropDialog from './CropDialog';
import ColorPicker from './ColorPicker';

interface PropertiesPanelProps { controller: CanvasController }

const TEXTURES = ['none', 'noise', 'lines', 'dots', 'crosshatch', 'grid'];

/* ─── Expandable color field: shows swatch + hex; tapping expands the HSB picker ─── */
function ColorField({ label, value, onChange, testId }: {
  label: string; value: string; onChange: (v: string) => void; testId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="flex items-center justify-between w-full py-0.5"
        onClick={() => setOpen((o) => !o)}
        data-testid={testId}
      >
        <Label className="text-xs text-muted-foreground cursor-pointer pointer-events-none">{label}</Label>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded border border-border flex-shrink-0"
            style={{ background: value }}
          />
          <span className="text-xs font-mono text-muted-foreground w-16 text-left">
            {value.toUpperCase()}
          </span>
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

function SliderRow({ label, value, min, max, step = 1, onChange, unit = '' }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string;
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

function NumInput({ label, value, min, max, onChange, unit = '' }: {
  label: string; value: number; min?: number; max?: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <input
          type="number" value={value} min={min} max={max}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-full h-7 bg-transparent border border-border rounded px-2 text-xs text-foreground focus:outline-none focus:border-primary"
        />
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-1">{children}</p>;
}

export default function PropertiesPanel({ controller }: PropertiesPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'properties';
  const obj = controller.selectedObject;

  const [objWidth, setObjWidth] = useState(100);
  const [objHeight, setObjHeight] = useState(100);
  const [rotation, setRotation] = useState(0);

  const [fill, setFill] = useState('#00F5FF');
  const [fillMode, setFillMode] = useState<'solid' | 'linear' | 'radial'>('solid');
  const [gradStop1, setGradStop1] = useState('#00F5FF');
  const [gradStop2, setGradStop2] = useState('#7B2FFF');

  const [stroke, setStroke] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const [rx, setRx] = useState(0);

  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowBlur, setShadowBlur] = useState(10);
  const [shadowOffsetX, setShadowOffsetX] = useState(5);
  const [shadowOffsetY, setShadowOffsetY] = useState(5);
  const [shadowOpacity, setShadowOpacity] = useState(80);

  const [innerEnabled, setInnerEnabled] = useState(false);
  const [innerColor, setInnerColor] = useState('#000000');
  const [innerBlur, setInnerBlur] = useState(15);
  const [innerOffsetX, setInnerOffsetX] = useState(0);
  const [innerOffsetY, setInnerOffsetY] = useState(0);
  const [innerOpacity, setInnerOpacity] = useState(60);

  const [depthEnabled, setDepthEnabled] = useState(false);
  const [depthAmount, setDepthAmount] = useState(8);
  const [depthColor, setDepthColor] = useState('#333333');
  const [depthAngle, setDepthAngle] = useState(225);
  const [skewX, setSkewX] = useState(0);
  const [skewY, setSkewY] = useState(0);

  const [glowEnabled, setGlowEnabled] = useState(false);
  const [glowColor, setGlowColor] = useState('#00F5FF');
  const [glowIntensity, setGlowIntensity] = useState(20);

  const [texture, setTexture] = useState('none');
  const [cropOpen, setCropOpen] = useState(false);

  const fillImageRef = useRef<HTMLInputElement>(null);

  const isText = obj?.type === 'i-text' || obj?.type === 'text';
  const isRect = obj?.type === 'rect';
  const isImage = obj?.type === 'image';
  const isShape = !isText && !isImage;

  const syncFromObject = useCallback(() => {
    if (!obj) return;
    const o = obj as FabricObject & Record<string, unknown>;

    setObjWidth(Math.round(obj.getScaledWidth()));
    setObjHeight(Math.round(obj.getScaledHeight()));
    setRotation(Math.round(Number(obj.angle) || 0));

    if (obj.fill && typeof obj.fill === 'object') {
      const gf = obj.fill as { type?: string; colorStops?: { offset: number; color: string }[] };
      if (gf.type === 'linear' || gf.type === 'radial') {
        setFillMode(gf.type);
        const stops = gf.colorStops ?? [];
        if (stops.length >= 2) { setGradStop1(stops[0].color); setGradStop2(stops[stops.length - 1].color); }
      } else { setFillMode('solid'); }
    } else {
      setFillMode('solid');
      setFill(typeof o.fill === 'string' ? o.fill : '#00F5FF');
    }

    setStroke(typeof o.stroke === 'string' && o.stroke ? o.stroke : '#000000');
    setStrokeWidth(typeof o.strokeWidth === 'number' ? o.strokeWidth : 0);
    setOpacity(typeof o.opacity === 'number' ? Math.round(o.opacity * 100) : 100);

    const shadow = o.shadow as Shadow | null;
    const glow = (o as Record<string, unknown>)._glow as { enabled?: boolean; color?: string; intensity?: number } | undefined;
    if (glow?.enabled) {
      setShadowEnabled(false);
      setGlowEnabled(true);
      setGlowColor(glow.color || '#00F5FF');
      setGlowIntensity(glow.intensity || 20);
    } else if (shadow && shadow.offsetX !== 0) {
      setShadowEnabled(true);
      setShadowColor(shadow.color || '#000000');
      setShadowBlur(shadow.blur || 10);
      setShadowOffsetX(shadow.offsetX || 5);
      setShadowOffsetY(shadow.offsetY || 5);
      setGlowEnabled(false);
    } else {
      setShadowEnabled(false);
      setGlowEnabled(false);
    }

    if (isRect) setRx(typeof o.rx === 'number' ? o.rx : 0);

    const inner = (o as Record<string, unknown>)._innerShadow as { enabled?: boolean; color?: string; blur?: number; offsetX?: number; offsetY?: number; opacity?: number } | undefined;
    if (inner) {
      setInnerEnabled(!!inner.enabled);
      setInnerColor(inner.color || '#000000');
      setInnerBlur(inner.blur ?? 15);
      setInnerOffsetX(inner.offsetX ?? 0);
      setInnerOffsetY(inner.offsetY ?? 0);
      setInnerOpacity(inner.opacity ?? 60);
    } else { setInnerEnabled(false); }

    setSkewX(typeof o.skewX === 'number' ? o.skewX : 0);
    setSkewY(typeof o.skewY === 'number' ? o.skewY : 0);

    const depth3d = (o as Record<string, unknown>)._depth3d as { enabled?: boolean; steps?: number; color?: string; angle?: number } | undefined;
    if (depth3d) {
      setDepthEnabled(!!depth3d.enabled);
      setDepthAmount(depth3d.steps ?? 8);
      setDepthColor(depth3d.color ?? '#333333');
      setDepthAngle(depth3d.angle ?? 225);
    } else { setDepthEnabled(false); }

    setTexture(((o as Record<string, unknown>)._textureKey as string) || 'none');
  }, [obj, isText, isRect]);

  useEffect(() => { syncFromObject(); }, [syncFromObject]);

  const apply = useCallback((props: Record<string, unknown>) => {
    if (!obj) return;
    obj.set(props);
    controller.getCanvas()?.renderAll();
    controller.syncObjects();
  }, [obj, controller]);

  const applyWidth = useCallback((v: number) => {
    if (!obj) return;
    const baseW = obj.width ?? 1;
    if (baseW > 0) { obj.set({ scaleX: v / baseW }); obj.setCoords(); controller.getCanvas()?.renderAll(); }
    setObjWidth(v);
  }, [obj, controller]);

  const applyHeight = useCallback((v: number) => {
    if (!obj) return;
    const baseH = obj.height ?? 1;
    if (baseH > 0) { obj.set({ scaleY: v / baseH }); obj.setCoords(); controller.getCanvas()?.renderAll(); }
    setObjHeight(v);
  }, [obj, controller]);

  const applyRotation = useCallback((v: number) => { setRotation(v); apply({ angle: v }); }, [apply]);

  const applyFill = useCallback((v: string) => { setFill(v); apply({ fill: v }); }, [apply]);

  const applyGradFill = useCallback((mode: 'linear' | 'radial', s1: string, s2: string) => {
    if (!obj) return;
    controller.applyGradientFill(obj, mode, [{ offset: 0, color: s1 }, { offset: 1, color: s2 }]);
  }, [obj, controller]);

  const applyStroke = useCallback((v: string) => { setStroke(v); apply({ stroke: v }); }, [apply]);
  const applyStrokeWidth = (v: number) => { setStrokeWidth(v); apply({ strokeWidth: v }); };
  const applyOpacity = (v: number) => { setOpacity(v); apply({ opacity: v / 100 }); };
  const applyRx = (v: number) => { setRx(v); apply({ rx: v, ry: v }); };

  const applyDropShadow = useCallback((en: boolean, color: string, blur: number, ox: number, oy: number, opa: number) => {
    if (!obj) return;
    const canvas = controller.getCanvas();
    if (en) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16); const g = parseInt(hex.slice(2, 4), 16); const b = parseInt(hex.slice(4, 6), 16);
      // For images, scale shadow depth for visibility on high-resolution layers
      const m = isImage ? 2 : 1;
      obj.set('shadow', new Shadow({ color: `rgba(${r},${g},${b},${opa / 100})`, blur: blur * m, offsetX: ox * m, offsetY: oy * m }));
    } else {
      obj.set('shadow', null);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).setDirty?.(true);
    canvas?.requestRenderAll();
  }, [obj, controller, isImage]);

  const applyInnerShadowEffect = useCallback((en: boolean, color: string, blur: number, ox: number, oy: number, opa: number) => {
    controller.applyInnerShadow(obj, en ? { enabled: true, color, blur, offsetX: ox, offsetY: oy, opacity: opa } : null);
  }, [obj, controller]);

  const applyDepth = useCallback((en: boolean, amount: number, color: string, angle: number) => {
    if (!obj) return;
    controller.apply3DDepth(obj, en ? { enabled: true, steps: amount, color, angle } : null);
  }, [obj, controller]);

  const applyGlowEffect = useCallback((en: boolean, color: string, intensity: number) => {
    controller.applyGlow(obj, en ? { enabled: true, color, intensity } : null);
  }, [obj, controller]);

  const applySkewX = (v: number) => { setSkewX(v); apply({ skewX: v }); };
  const applySkewY = (v: number) => { setSkewY(v); apply({ skewY: v }); };

  const applyTexture = (v: string) => {
    setTexture(v);
    controller.applyTexture(obj, v === 'none' ? null : v);
  };

  if (!obj) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '80vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="properties-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
          <SheetTitle className="text-sm font-semibold">Style & Effects</SheetTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => controller.duplicateSelected()} data-testid="button-duplicate">
              <Copy size={13} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => controller.deleteSelected()} data-testid="button-delete-selected">
              <Trash2 size={13} />
            </Button>
          </div>
        </SheetHeader>

        <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          {/* ── Transform ── */}
          <SectionLabel>Transform</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            <NumInput label="W (px)" value={objWidth} min={0} onChange={applyWidth} />
            <NumInput label="H (px)" value={objHeight} min={0} onChange={applyHeight} />
            <NumInput label="Angle °" value={rotation} min={-180} max={360} onChange={applyRotation} />
          </div>
          <SliderRow label="Rotation" value={rotation} min={0} max={360} onChange={applyRotation} unit="°" />

          {/* ── Fill & Stroke ── */}
          <Separator />
          <SectionLabel>Fill & Stroke</SectionLabel>

          <div className="flex gap-1">
            {(['solid', 'linear', 'radial'] as const).map((mode) => (
              <button key={mode} onClick={() => {
                setFillMode(mode);
                if (mode === 'solid') applyFill(fill);
                else applyGradFill(mode, gradStop1, gradStop2);
              }}
                className="flex-1 py-1.5 rounded-lg text-xs capitalize transition-all"
                style={{
                  background: fillMode === mode ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
                  color: fillMode === mode ? '#00F5FF' : '#9ca3af',
                  border: `1px solid ${fillMode === mode ? '#00F5FF' : 'transparent'}`,
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          {fillMode === 'solid'
            ? <ColorField label="Fill" value={fill} onChange={applyFill} testId="color-fill" />
            : (
              <div className="space-y-2 pl-2 border-l border-border">
                <ColorField label="Color 1" value={gradStop1}
                  onChange={(v) => { setGradStop1(v); applyGradFill(fillMode, v, gradStop2); }}
                  testId="color-grad1" />
                <ColorField label="Color 2" value={gradStop2}
                  onChange={(v) => { setGradStop2(v); applyGradFill(fillMode, gradStop1, v); }}
                  testId="color-grad2" />
              </div>
            )}

          <ColorField label="Stroke" value={stroke} onChange={applyStroke} testId="color-stroke" />
          <SliderRow label="Stroke Width" value={strokeWidth} min={0} max={30} onChange={applyStrokeWidth} />
          <SliderRow label="Opacity" value={opacity} min={0} max={100} onChange={applyOpacity} unit="%" />
          {isRect && <SliderRow label="Corner Radius" value={rx} min={0} max={100} onChange={applyRx} />}

          {/* ── Image actions ── */}
          {isImage && (
            <>
              <Separator />
              <SectionLabel>Image</SectionLabel>
              <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setCropOpen(true)}>
                ✂ Crop Image
              </Button>
              <CropDialog
                open={cropOpen}
                onClose={() => setCropOpen(false)}
                obj={obj}
                onApply={(cx, cy, cw, ch) => controller.cropImage(obj!, cx, cy, cw, ch)}
                onFlipH={() => controller.flipHorizontal()}
                onFlipV={() => controller.flipVertical()}
                onRotate90={() => controller.rotate90()}
              />
            </>
          )}

          {/* ── Fill shape with image ── */}
          {isShape && obj.type !== 'line' && (
            <>
              <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => fillImageRef.current?.click()}>
                🖼 Fill with Image
              </Button>
              <input
                ref={fillImageRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && obj) controller.fillShapeWithImage(obj, f);
                  e.target.value = '';
                }}
              />
            </>
          )}

          {/* ── Texture Overlay ── */}
          <Separator />
          <SectionLabel>Texture Overlay</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {TEXTURES.map((t) => (
              <button key={t} onClick={() => applyTexture(t)}
                className="py-2 px-1 rounded-lg text-xs capitalize transition-all border"
                style={{
                  background: texture === t ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
                  borderColor: texture === t ? '#00F5FF' : 'rgba(255,255,255,0.1)',
                  color: texture === t ? '#00F5FF' : '#9ca3af',
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* ── Glow / Neon ── */}
          <Separator />
          <div className="flex items-center justify-between">
            <SectionLabel>Glow / Neon</SectionLabel>
            <Switch checked={glowEnabled} onCheckedChange={(v) => {
              setGlowEnabled(v);
              applyGlowEffect(v, glowColor, glowIntensity);
              if (v) setShadowEnabled(false);
            }} />
          </div>
          {glowEnabled && (
            <div className="space-y-3 pl-2 border-l border-border">
              <ColorField label="Color" value={glowColor}
                onChange={(v) => { setGlowColor(v); applyGlowEffect(true, v, glowIntensity); }}
                testId="color-glow" />
              <SliderRow label="Intensity" value={glowIntensity} min={1} max={60}
                onChange={(v) => { setGlowIntensity(v); applyGlowEffect(true, glowColor, v); }} />
            </div>
          )}

          {/* ── Drop Shadow ── */}
          <Separator />
          <div className="flex items-center justify-between">
            <SectionLabel>Drop Shadow</SectionLabel>
            <Switch checked={shadowEnabled} onCheckedChange={(v) => {
              setShadowEnabled(v);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if (v) { setGlowEnabled(false); (obj as any)._glow = null; }
              applyDropShadow(v, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity);
            }} data-testid="switch-shadow" />
          </div>
          {shadowEnabled && (
            <div className="space-y-3 pl-2 border-l border-border">
              <ColorField label="Color" value={shadowColor}
                onChange={(v) => { setShadowColor(v); applyDropShadow(true, v, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity); }}
                testId="color-shadow" />
              <SliderRow label="Blur" value={shadowBlur} min={0} max={80}
                onChange={(v) => { setShadowBlur(v); applyDropShadow(true, shadowColor, v, shadowOffsetX, shadowOffsetY, shadowOpacity); }} />
              <SliderRow label="Offset X" value={shadowOffsetX} min={-80} max={80}
                onChange={(v) => { setShadowOffsetX(v); applyDropShadow(true, shadowColor, shadowBlur, v, shadowOffsetY, shadowOpacity); }} />
              <SliderRow label="Offset Y" value={shadowOffsetY} min={-80} max={80}
                onChange={(v) => { setShadowOffsetY(v); applyDropShadow(true, shadowColor, shadowBlur, shadowOffsetX, v, shadowOpacity); }} />
              <SliderRow label="Opacity" value={shadowOpacity} min={0} max={100}
                onChange={(v) => { setShadowOpacity(v); applyDropShadow(true, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, v); }}
                unit="%" />
            </div>
          )}

          {/* ── Inner Shadow ── */}
          <Separator />
          <div className="flex items-center justify-between">
            <SectionLabel>Inner Shadow</SectionLabel>
            <Switch checked={innerEnabled} onCheckedChange={(v) => {
              setInnerEnabled(v);
              applyInnerShadowEffect(v, innerColor, innerBlur, innerOffsetX, innerOffsetY, innerOpacity);
            }} />
          </div>
          {innerEnabled && (
            <div className="space-y-3 pl-2 border-l border-border">
              <ColorField label="Color" value={innerColor}
                onChange={(v) => { setInnerColor(v); applyInnerShadowEffect(true, v, innerBlur, innerOffsetX, innerOffsetY, innerOpacity); }}
                testId="color-inner-shadow" />
              <SliderRow label="Blur" value={innerBlur} min={0} max={60}
                onChange={(v) => { setInnerBlur(v); applyInnerShadowEffect(true, innerColor, v, innerOffsetX, innerOffsetY, innerOpacity); }} />
              <SliderRow label="Offset X" value={innerOffsetX} min={-40} max={40}
                onChange={(v) => { setInnerOffsetX(v); applyInnerShadowEffect(true, innerColor, innerBlur, v, innerOffsetY, innerOpacity); }} />
              <SliderRow label="Offset Y" value={innerOffsetY} min={-40} max={40}
                onChange={(v) => { setInnerOffsetY(v); applyInnerShadowEffect(true, innerColor, innerBlur, innerOffsetX, v, innerOpacity); }} />
              <SliderRow label="Opacity" value={innerOpacity} min={0} max={100}
                onChange={(v) => { setInnerOpacity(v); applyInnerShadowEffect(true, innerColor, innerBlur, innerOffsetX, innerOffsetY, v); }}
                unit="%" />
            </div>
          )}

          {/* ── 3D Depth Effect ── */}
          <Separator />
          <div className="flex items-center justify-between">
            <SectionLabel>3D Extrusion</SectionLabel>
            <Switch checked={depthEnabled} onCheckedChange={(v) => {
              setDepthEnabled(v);
              applyDepth(v, depthAmount, depthColor, depthAngle);
            }} />
          </div>
          {depthEnabled && (
            <div className="space-y-3 pl-2 border-l border-border">
              <ColorField label="Depth Color" value={depthColor}
                onChange={(v) => { setDepthColor(v); applyDepth(true, depthAmount, v, depthAngle); }}
                testId="color-depth" />
              <SliderRow label="Depth (steps)" value={depthAmount} min={1} max={30}
                onChange={(v) => { setDepthAmount(v); applyDepth(true, v, depthColor, depthAngle); }} />
              <SliderRow label="Angle" value={depthAngle} min={0} max={360}
                onChange={(v) => { setDepthAngle(v); applyDepth(true, depthAmount, depthColor, v); }} unit="°" />
            </div>
          )}
          <div className="space-y-3">
            <SliderRow label="Skew X" value={skewX} min={-45} max={45} onChange={applySkewX} unit="°" />
            <SliderRow label="Skew Y" value={skewY} min={-45} max={45} onChange={applySkewY} unit="°" />
          </div>

          <div className="h-2" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
