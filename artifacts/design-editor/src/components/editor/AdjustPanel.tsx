import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricImage, filters } from 'fabric';
import { Check, ChevronDown, SlidersVertical } from 'lucide-react';

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
}

interface AdjustPanelProps { controller: CanvasController }

type AdjustmentKey = keyof Adjustments;

const ADJUSTMENT_OPTIONS: Array<{
  key: AdjustmentKey;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: 'brightness', label: 'Brightness', min: -1, max: 1, step: 0.01 },
  { key: 'contrast', label: 'Contrast', min: -1, max: 1, step: 0.01 },
  { key: 'saturation', label: 'Saturation', min: -1, max: 1, step: 0.01 },
  { key: 'hue', label: 'Hue Rotation', min: -180, max: 180, step: 1 },
];

function formatAdjustmentValue(key: AdjustmentKey, value: number) {
  if (key === 'hue') return `${value > 0 ? '+' : ''}${Math.round(value)}°`;
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function ActiveAdjustmentSlider({ label, value, min, max, step, onChange, displayValue }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  displayValue: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-xs font-mono tabular-nums text-primary">{displayValue}</span>
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
  const [activeKey, setActiveKey] = useState<AdjustmentKey>('brightness');
  const [selectorOpen, setSelectorOpen] = useState(false);

  const syncFromImage = useCallback(() => {
    if (!imgObj) { setAdj({ brightness: 0, contrast: 0, saturation: 0, hue: 0 }); return; }
    setAdj(readFiltersFromImage(imgObj));
  }, [imgObj]);

  useEffect(() => { syncFromImage(); }, [syncFromImage]);
  useEffect(() => {
    if (!isOpen) setSelectorOpen(false);
  }, [isOpen]);

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

  const activeOption = ADJUSTMENT_OPTIONS.find((option) => option.key === activeKey) ?? ADJUSTMENT_OPTIONS[0];
  const activeValue = adj[activeOption.key];

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
          <div className="px-4 space-y-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            {selectorOpen && (
              <div id="adjustment-selector" className="space-y-2" data-testid="adjustment-selector">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Select adjustment</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={resetAll}
                    data-testid="button-reset-adjustments"
                  >
                    Reset All
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {ADJUSTMENT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setActiveKey(option.key);
                        setSelectorOpen(false);
                      }}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors"
                      style={{
                        borderColor: activeKey === option.key ? 'rgba(0,245,255,0.55)' : 'rgba(255,255,255,0.1)',
                        background: activeKey === option.key ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.03)',
                        color: activeKey === option.key ? '#00F5FF' : undefined,
                      }}
                      data-testid={`adjustment-option-${option.key}`}
                    >
                      <span>{option.label}</span>
                      {activeKey === option.key && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 space-y-2.5" data-testid="adjustment-mini-bar">
              <button
                type="button"
                onClick={() => setSelectorOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={selectorOpen}
                aria-controls="adjustment-selector"
                data-testid="button-toggle-adjustment-selector"
              >
                <span className="text-xs font-semibold text-foreground">{activeOption.label}</span>
                <span className="ml-auto text-xs font-mono tabular-nums text-primary">
                  {formatAdjustmentValue(activeKey, activeValue)}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform ${selectorOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <ActiveAdjustmentSlider
                label={activeOption.label}
                value={activeValue}
                min={activeOption.min}
                max={activeOption.max}
                step={activeOption.step}
                onChange={(value) => update(activeKey, value)}
                displayValue={formatAdjustmentValue(activeKey, activeValue)}
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
