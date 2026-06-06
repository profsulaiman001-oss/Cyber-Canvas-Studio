import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricImage, filters } from 'fabric';
import { SlidersVertical } from 'lucide-react';

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
}

interface AdjustPanelProps { controller: CanvasController }

function SliderRow({ label, value, min, max, step = 0.01, onChange, displayValue }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  displayValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground w-12 text-right">
          {displayValue ?? (Math.round(value * 100) / 100)}
        </span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-1">{children}</p>;
}

function readFiltersFromImage(img: FabricImage): Adjustments {
  const result: Adjustments = { brightness: 0, contrast: 0, saturation: 0, hue: 0 };
  if (!img.filters) return result;
  for (const f of img.filters) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fo = f as any;
    const t = fo.type || fo.constructor?.name || '';
    if (t === 'Brightness') result.brightness = fo.brightness ?? 0;
    else if (t === 'Contrast') result.contrast = fo.contrast ?? 0;
    else if (t === 'Saturation') result.saturation = fo.saturation ?? 0;
    else if (t === 'HueRotation') result.hue = Math.round((fo.rotation ?? 0) * 180 / Math.PI);
  }
  return result;
}

function buildFilters(adj: Adjustments) {
  const list: object[] = [];
  if (adj.brightness !== 0) list.push(new filters.Brightness({ brightness: adj.brightness }));
  if (adj.contrast !== 0) list.push(new filters.Contrast({ contrast: adj.contrast }));
  if (adj.saturation !== 0) list.push(new filters.Saturation({ saturation: adj.saturation }));
  if (adj.hue !== 0) list.push(new filters.HueRotation({ rotation: (adj.hue / 180) * Math.PI }));
  return list;
}

export default function AdjustPanel({ controller }: AdjustPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'adjust';
  const obj = controller.selectedObject;
  const isImage = obj?.type === 'image';
  const imgObj = isImage ? (obj as FabricImage) : null;

  const [adj, setAdj] = useState<Adjustments>({ brightness: 0, contrast: 0, saturation: 0, hue: 0 });

  const syncFromImage = useCallback(() => {
    if (!imgObj) { setAdj({ brightness: 0, contrast: 0, saturation: 0, hue: 0 }); return; }
    setAdj(readFiltersFromImage(imgObj));
  }, [imgObj]);

  useEffect(() => { syncFromImage(); }, [syncFromImage]);

  const applyFilters = useCallback((next: Adjustments) => {
    if (!imgObj) return;
    const c = controller.getCanvas();
    if (!c) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    imgObj.filters = buildFilters(next) as any;
    imgObj.applyFilters();
    c.requestRenderAll();
  }, [imgObj, controller]);

  const update = (key: keyof Adjustments, value: number) => {
    const next = { ...adj, [key]: value };
    setAdj(next);
    applyFilters(next);
  };

  const resetAll = () => {
    const zero: Adjustments = { brightness: 0, contrast: 0, saturation: 0, hue: 0 };
    setAdj(zero);
    applyFilters(zero);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '70vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="adjust-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <SlidersVertical size={15} className="text-primary" />
            Image Adjustments
          </SheetTitle>
          {isImage && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={resetAll}
            >
              Reset All
            </Button>
          )}
        </SheetHeader>

        {!isImage ? (
          <div className="px-4 pb-8 flex flex-col items-center gap-3 text-center pt-4">
            <SlidersVertical size={32} className="text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Select an image on the canvas to adjust it.</p>
          </div>
        ) : (
          <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

            <SectionLabel>Tone</SectionLabel>

            <SliderRow
              label="Brightness"
              value={adj.brightness}
              min={-1} max={1} step={0.01}
              onChange={(v) => update('brightness', v)}
              displayValue={adj.brightness > 0 ? `+${adj.brightness.toFixed(2)}` : adj.brightness.toFixed(2)}
            />

            <SliderRow
              label="Contrast"
              value={adj.contrast}
              min={-1} max={1} step={0.01}
              onChange={(v) => update('contrast', v)}
              displayValue={adj.contrast > 0 ? `+${adj.contrast.toFixed(2)}` : adj.contrast.toFixed(2)}
            />

            <Separator />
            <SectionLabel>Color</SectionLabel>

            <SliderRow
              label="Saturation"
              value={adj.saturation}
              min={-1} max={1} step={0.01}
              onChange={(v) => update('saturation', v)}
              displayValue={adj.saturation > 0 ? `+${adj.saturation.toFixed(2)}` : adj.saturation.toFixed(2)}
            />

            <SliderRow
              label="Hue Rotation"
              value={adj.hue}
              min={-180} max={180} step={1}
              onChange={(v) => update('hue', v)}
              displayValue={`${adj.hue > 0 ? '+' : ''}${adj.hue}°`}
            />

            <div className="h-1" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
