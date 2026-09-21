import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricImage, filters } from 'fabric';
import {
  ChevronDown,
  Contrast as ContrastIcon,
  Droplets,
  Palette,
  RotateCcw,
  SlidersVertical,
  Sun,
  type LucideIcon,
} from 'lucide-react';

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
}

interface AdjustPanelProps { controller: CanvasController }

type AdjustmentKey = keyof Adjustments;

const ADJUSTMENTS: Array<{
  key: AdjustmentKey;
  label: string;
  icon: LucideIcon;
  min: number;
  max: number;
  step: number;
}> = [
  { key: 'brightness', label: 'Brightness', icon: Sun, min: -1, max: 1, step: 0.01 },
  { key: 'contrast', label: 'Contrast', icon: ContrastIcon, min: -1, max: 1, step: 0.01 },
  { key: 'saturation', label: 'Saturation', icon: Droplets, min: -1, max: 1, step: 0.01 },
  { key: 'hue', label: 'Hue Rotation', icon: Palette, min: -180, max: 180, step: 1 },
];

function formatValue(key: AdjustmentKey, value: number) {
  if (key === 'hue') return `${value > 0 ? '+' : ''}${value.toFixed(0)}°`;
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
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

  const activeAdjustment = ADJUSTMENTS.find(({ key }) => key === activeKey) ?? ADJUSTMENTS[0];
  const activeValue = adj[activeAdjustment.key];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: selectorOpen ? '62vh' : '30vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="adjust-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <SlidersVertical size={15} className="text-primary" />
            Image Adjustments
          </SheetTitle>
        </SheetHeader>

        {!isImage ? (
          <div className="px-4 pb-8 flex flex-col items-center gap-3 text-center pt-4">
            <SlidersVertical size={32} className="text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Select an image on the canvas to adjust it.</p>
          </div>
        ) : (
          <div className="px-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            {selectorOpen && (
              <div
                className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                data-testid="adjustment-selector"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Adjust parameter
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={resetAll}
                    data-testid="adjust-reset-all"
                  >
                    <RotateCcw size={12} />
                    Reset All
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {ADJUSTMENTS.map((adjustment) => {
                    const isActive = adjustment.key === activeKey;
                    return (
                      <button
                        key={adjustment.key}
                        type="button"
                        className={`flex min-h-12 items-center justify-between rounded-lg border px-3 text-left transition-colors ${
                          isActive
                            ? 'border-primary/60 bg-primary/10 text-primary'
                            : 'border-white/10 bg-black/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
                        }`}
                        onClick={() => {
                          setActiveKey(adjustment.key);
                          setSelectorOpen(false);
                        }}
                        aria-pressed={isActive}
                        data-testid={`adjustment-option-${adjustment.key}`}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <adjustment.icon size={16} aria-hidden="true" />
                          {adjustment.label}
                        </span>
                        <span className={`font-mono text-xs ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                          {formatValue(adjustment.key, adj[adjustment.key])}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 shadow-[0_0_24px_rgba(0,245,255,0.04)]"
              data-testid="adjustment-mini-bar"
            >
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="flex h-9 w-12 shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] text-primary transition-colors hover:border-primary/40 hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSelectorOpen((open) => !open)}
                  aria-expanded={selectorOpen}
                  aria-label={selectorOpen ? 'Hide adjustment options' : `Choose adjustment parameter, currently ${activeAdjustment.label}`}
                  data-testid="adjustment-selector-toggle"
                  title={activeAdjustment.label}
                >
                  <activeAdjustment.icon size={17} aria-hidden="true" />
                  <ChevronDown
                    size={11}
                    strokeWidth={2.5}
                    className={`transition-transform ${selectorOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <Slider
                    min={activeAdjustment.min}
                    max={activeAdjustment.max}
                    step={activeAdjustment.step}
                    value={[activeValue]}
                    onValueChange={([value]) => update(activeAdjustment.key, value)}
                    aria-label={`${activeAdjustment.label} value`}
                    className="w-full"
                    data-testid={`adjustment-slider-${activeAdjustment.key}`}
                  />
                </div>
                <span
                  className="min-w-[52px] shrink-0 rounded-md border border-primary/20 bg-primary/[0.08] px-2 py-1 text-right font-mono text-xs tabular-nums text-primary"
                  data-testid="adjustment-active-value"
                >
                  {formatValue(activeAdjustment.key, activeValue)}
                </span>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
