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
import { FabricObject } from 'fabric';
import CropDialog from './CropDialog';
import ColorPicker from './ColorPicker';

interface PropertiesPanelProps { controller: CanvasController }

const TEXTURES = ['none', 'noise', 'lines', 'dots', 'crosshatch', 'grid'];

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
          <div className="w-6 h-6 rounded border border-border flex-shrink-0" style={{ background: value }} />
          <span className="text-xs font-mono text-muted-foreground w-16 text-left">{value.toUpperCase()}</span>
        </div>
      </button>
      {open && <div className="mt-2 mb-1"><ColorPicker value={value} onChange={onChange} /></div>}
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

  const [opacity, setOpacity] = useState(100);
  /* rx stores the *visual* corner radius (in canvas pixels after scale) */
  const [rx, setRx] = useState(0);
  const [skewX, setSkewX] = useState(0);
  const [skewY, setSkewY] = useState(0);

  const [glowEnabled, setGlowEnabled] = useState(false);
  const [glowColor, setGlowColor] = useState('#00F5FF');
  const [glowIntensity, setGlowIntensity] = useState(20);

  const [texture, setTexture] = useState('none');
  const [cropOpen, setCropOpen] = useState(false);

  const fillImageRef = useRef<HTMLInputElement>(null);

  const isText = obj?.type === 'i-text' || obj?.type === 'text' || obj?.type === 'textbox';
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

    setOpacity(typeof o.opacity === 'number' ? Math.round(o.opacity * 100) : 100);

    const glow = (o as Record<string, unknown>)._glow as { enabled?: boolean; color?: string; intensity?: number } | undefined;
    if (glow?.enabled) {
      setGlowEnabled(true);
      setGlowColor(glow.color || '#00F5FF');
      setGlowIntensity(glow.intensity || 20);
    } else {
      setGlowEnabled(false);
    }

    if (isRect) {
      // Convert stored rx (in unscaled object space) → visual radius (after scaleX applied)
      const rawRx = typeof o.rx === 'number' ? o.rx : 0;
      const scaleX = typeof o.scaleX === 'number' ? o.scaleX : 1;
      setRx(Math.round(rawRx * scaleX));
    }

    setSkewX(typeof o.skewX === 'number' ? o.skewX : 0);
    setSkewY(typeof o.skewY === 'number' ? o.skewY : 0);
    setTexture(((o as Record<string, unknown>)._textureKey as string) || 'none');
  }, [obj, isRect]);

  useEffect(() => { syncFromObject(); }, [syncFromObject]);

  const apply = useCallback((props: Record<string, unknown>) => {
    if (!obj) return;
    obj.set(props);
    controller.getCanvas()?.renderAll();
    controller.commitChange();
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

  const applyOpacity = (v: number) => { setOpacity(v); apply({ opacity: v / 100 }); };

  /**
   * Corner radius normalization:
   * The slider value `v` represents the desired *visual* radius in canvas pixels.
   * Fabric.js applies rx/ry to the unscaled object dimensions, so we must
   * compensate: rx_stored = v / scaleX, ry_stored = v / scaleY.
   * This guarantees perfectly concentric, uniform corners on any aspect ratio.
   */
  const applyRx = useCallback((v: number) => {
    if (!obj) return;
    setRx(v);
    const scaleX = (obj.scaleX ?? 1) || 1;
    const scaleY = (obj.scaleY ?? 1) || 1;
    const rxVal = v / scaleX;
    const ryVal = v / scaleY;
    apply({ rx: rxVal, ry: ryVal });
  }, [obj, apply]);

  const applyGlowEffect = useCallback((en: boolean, color: string, intensity: number) => {
    controller.applyGlow(obj, en ? { enabled: true, color, intensity } : null);
    controller.commitChange();
  }, [obj, controller]);

  const applySkewX = (v: number) => { setSkewX(v); apply({ skewX: v }); };
  const applySkewY = (v: number) => { setSkewY(v); apply({ skewY: v }); };

  const applyTexture = (v: string) => {
    setTexture(v);
    controller.applyTexture(obj, v === 'none' ? null : v);
  };

  if (!obj) return null;

  /* Dynamic corner radius max = half of the smaller visual dimension */
  const rxMax = Math.max(4, Math.min(Math.round(objWidth / 2), Math.round(objHeight / 2)));

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '80vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="properties-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between" style={{ paddingRight: '2.75rem' }}>
            <SheetTitle className="text-sm font-semibold">Style &amp; Fill</SheetTitle>
            <div className="flex gap-1.5 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => controller.duplicateSelected()} data-testid="button-duplicate">
                <Copy size={13} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => controller.deleteSelected()} data-testid="button-delete-selected">
                <Trash2 size={13} />
              </Button>
            </div>
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

          {/* ── Fill ── */}
          <Separator />
          <SectionLabel>Fill</SectionLabel>
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

          <SliderRow label="Opacity" value={opacity} min={0} max={100} onChange={applyOpacity} unit="%" />

          {/* Corner radius — normalized for any aspect ratio */}
          {isRect && (
            <SliderRow
              label="Corner Radius"
              value={rx}
              min={0}
              max={rxMax}
              onChange={applyRx}
              unit="px"
            />
          )}

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

          {/* ── Skew ── */}
          <Separator />
          <SectionLabel>Skew</SectionLabel>
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
