import { useState, useEffect, useCallback, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricImage, FabricObject, filters } from 'fabric';
import { Check, ChevronDown, ChevronUp, RotateCcw, SlidersVertical } from 'lucide-react';
import {
  applyObjectColorAdjustment,
  ensureObjectColorBaseline,
  getAdjustedGradientConfig,
  getBaselineGradientConfig,
  restoreObjectColorBaseline,
  type ColorAdjustments,
  walkObjectTree,
} from '@/lib/colorAdjustments';

interface AdjustPanelProps { controller: CanvasController }

type AdjustmentKey = keyof ColorAdjustments;

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

function AdjustmentControl({
  option,
  value,
  enabled,
  onToggle,
  onChange,
}: {
  option: typeof ADJUSTMENT_OPTIONS[number];
  value: number;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-[11px] text-muted-foreground">{option.label}</Label>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono tabular-nums text-primary">
            {formatAdjustmentValue(option.key, value)}
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            aria-label={`Toggle ${option.label}`}
          />
        </div>
      </div>
      <Slider
        min={option.min}
        max={option.max}
        step={option.step}
        value={[value]}
        onValueChange={([nextValue]) => onChange(nextValue)}
        disabled={!enabled}
        className="w-full"
      />
    </div>
  );
}

function readFiltersFromImage(img: FabricImage): ColorAdjustments {
  const result: ColorAdjustments = { brightness: 0, contrast: 0, saturation: 0, hue: 0 };
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

function buildFilters(adj: ColorAdjustments) {
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

  const [adj, setAdj] = useState<ColorAdjustments>({ brightness: 0, contrast: 0, saturation: 0, hue: 0 });
  const [activeKey, setActiveKey] = useState<AdjustmentKey>('brightness');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lastNonZeroValuesRef = useRef<Partial<ColorAdjustments>>({});

  const syncFromObject = useCallback(() => {
    if (!obj) {
      setAdj({ brightness: 0, contrast: 0, saturation: 0, hue: 0 });
      lastNonZeroValuesRef.current = {};
      return;
    }
    if (obj.type === 'image') {
      const next = readFiltersFromImage(obj as FabricImage);
      setAdj(next);
      lastNonZeroValuesRef.current = Object.fromEntries(
        ADJUSTMENT_OPTIONS
          .filter((option) => next[option.key] !== 0)
          .map((option) => [option.key, next[option.key]]),
      );
      return;
    }
    walkObjectTree(obj, (child) => { ensureObjectColorBaseline(child); });
    const stored = (obj as FabricObject & { _adjustments?: ColorAdjustments })._adjustments;
    const next = stored ? { ...stored } : { brightness: 0, contrast: 0, saturation: 0, hue: 0 };
    setAdj(next);
    lastNonZeroValuesRef.current = Object.fromEntries(
      ADJUSTMENT_OPTIONS
        .filter((option) => next[option.key] !== 0)
        .map((option) => [option.key, next[option.key]]),
    );
  }, [obj]);

  useEffect(() => { syncFromObject(); }, [syncFromObject]);
  useEffect(() => {
    if (!isOpen) {
      setSelectorOpen(false);
      setExpanded(false);
    }
  }, [isOpen]);

  const applyFilters = useCallback((next: ColorAdjustments) => {
    if (!obj) return;
    const c = controller.getCanvas();
    if (!c) return;

    walkObjectTree(obj, (child) => {
      if (child.type === 'image') {
        const img = child as FabricImage;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        img.filters = buildFilters(next) as any;
        img.applyFilters();
      } else {
        applyObjectColorAdjustment(child, next);
        const gradientConfig = getAdjustedGradientConfig(child, next);
        if (gradientConfig) {
          if (gradientConfig.type === 'angular') {
            controller.applyGradientFill(
              child,
              'angular',
              gradientConfig.stops,
              gradientConfig.radialRadius ?? undefined,
              gradientConfig.angleDeg ?? 0,
              gradientConfig.origin ?? { x: 0.5, y: 0.5 },
              false,
            );
          } else {
            (child as FabricObject & { _gradientConfig?: unknown })._gradientConfig = gradientConfig;
          }
        }
      }

      (child as FabricObject & { _adjustments?: ColorAdjustments })._adjustments = { ...next };
    });

    (obj as FabricObject & { _adjustments?: ColorAdjustments })._adjustments = { ...next };
    c.requestRenderAll();
  }, [obj, controller]);

  const update = (key: keyof ColorAdjustments, value: number) => {
    const next = { ...adj, [key]: value };
    if (value !== 0) lastNonZeroValuesRef.current[key] = value;
    setAdj(next);
    applyFilters(next);
  };

  const toggleActiveAdjustment = (key: AdjustmentKey, enabled: boolean) => {
    if (enabled) {
      const fallback = key === 'hue' ? 45 : 0.25;
      update(key, lastNonZeroValuesRef.current[key] ?? fallback);
    } else {
      update(key, 0);
    }
  };

  const resetAll = () => {
    if (!obj) return;
    const zero: ColorAdjustments = { brightness: 0, contrast: 0, saturation: 0, hue: 0 };
    const c = controller.getCanvas();
    walkObjectTree(obj, (child) => {
      if (child.type === 'image') {
        const img = child as FabricImage;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        img.filters = [] as any;
        img.applyFilters();
        return;
      }

      restoreObjectColorBaseline(child);
      const gradientConfig = getBaselineGradientConfig(child);
      if (!gradientConfig) return;
      if (gradientConfig.type === 'angular') {
        controller.applyGradientFill(
          child,
          'angular',
          gradientConfig.stops,
          gradientConfig.radialRadius ?? undefined,
          gradientConfig.angleDeg ?? 0,
          gradientConfig.origin ?? { x: 0.5, y: 0.5 },
          false,
        );
      } else {
        (child as FabricObject & { _gradientConfig?: unknown })._gradientConfig = gradientConfig;
      }
    });
    walkObjectTree(obj, (child) => {
      delete (child as FabricObject & { _adjustments?: ColorAdjustments })._adjustments;
    });
    setAdj(zero);
    lastNonZeroValuesRef.current = {};
    c?.requestRenderAll();
  };

  const activeOption = ADJUSTMENT_OPTIONS.find((option) => option.key === activeKey) ?? ADJUSTMENT_OPTIONS[0];
  const activeValue = adj[activeOption.key];
  const activeEnabled = activeValue !== 0;

  if (!isOpen || !obj) return null;

  return (
    <div
      className="absolute bottom-full left-1/2 z-[9999] mb-2 w-[min(620px,calc(100vw-24px))] -translate-x-1/2"
      data-testid="adjust-panel"
    >
      <div
        className={`overflow-hidden rounded-2xl transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-[620px] opacity-100 mb-2' : 'pointer-events-none max-h-0 opacity-0'
        }`}
        style={{
          background: '#11141A',
          border: expanded ? '1px solid rgba(0,245,255,0.25)' : '1px solid transparent',
          boxShadow: expanded ? '0 -8px 30px rgba(0,0,0,0.45)' : 'none',
        }}
      >
        <div className="space-y-3 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersVertical size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Color Adjustments</span>
            </div>
            <button
              type="button"
              onClick={resetAll}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-primary transition-colors hover:bg-primary/10"
              data-testid="button-reset-adjustments"
            >
              <RotateCcw size={11} />
              Reset All
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {ADJUSTMENT_OPTIONS.map((option) => (
              <AdjustmentControl
                key={option.key}
                option={option}
                value={adj[option.key]}
                enabled={adj[option.key] !== 0}
                onToggle={(enabled) => toggleActiveAdjustment(option.key, enabled)}
                onChange={(value) => update(option.key, value)}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 rounded-2xl px-3 py-2.5 transition-all duration-300 ease-in-out"
        style={{
          background: '#11141A',
          border: '1px solid rgba(0,245,255,0.3)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
        }}
        data-testid="adjustment-mini-bar"
      >
        <div className="relative min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => setSelectorOpen((open) => !open)}
            className="flex max-w-[145px] items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-xs font-semibold transition-colors hover:bg-white/10"
            style={{ color: '#00F5FF', background: selectorOpen ? 'rgba(0,245,255,0.14)' : 'rgba(255,255,255,0.05)' }}
            aria-expanded={selectorOpen}
            aria-haspopup="listbox"
            aria-controls="adjustment-selector"
            data-testid="button-toggle-adjustment-selector"
          >
            <SlidersVertical size={13} />
            <span className="truncate">{activeOption.label}</span>
            <ChevronDown size={13} className={`shrink-0 transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
          </button>
          {selectorOpen && (
            <div
              id="adjustment-selector"
              role="listbox"
              className="absolute bottom-full left-0 z-10 mb-2 w-48 rounded-xl border border-white/10 p-1.5 shadow-2xl"
              style={{ background: '#11141A' }}
              data-testid="adjustment-selector"
            >
              {ADJUSTMENT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="option"
                  aria-selected={activeKey === option.key}
                  onClick={() => {
                    setActiveKey(option.key);
                    setSelectorOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/10"
                  style={{
                    color: activeKey === option.key ? '#00F5FF' : 'rgba(255,255,255,0.7)',
                    background: activeKey === option.key ? 'rgba(0,245,255,0.1)' : 'transparent',
                  }}
                  data-testid={`adjustment-option-${option.key}`}
                >
                  <span>{option.label}</span>
                  {activeKey === option.key && <Check size={13} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <Switch
          checked={activeEnabled}
          onCheckedChange={(enabled) => toggleActiveAdjustment(activeKey, enabled)}
          aria-label={`Toggle ${activeOption.label}`}
        />

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Slider
            min={activeOption.min}
            max={activeOption.max}
            step={activeOption.step}
            value={[activeValue]}
            onValueChange={([value]) => update(activeKey, value)}
            disabled={!activeEnabled}
            className="min-w-0 flex-1"
          />
          <span className="w-12 shrink-0 text-right text-[10px] font-mono tabular-nums text-primary">
            {formatAdjustmentValue(activeKey, activeValue)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
          style={{ color: '#00F5FF', background: expanded ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.05)' }}
          aria-label={expanded ? 'Collapse adjustment controls' : 'Expand adjustment controls'}
          data-testid="button-toggle-adjustment-expanded"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
    </div>
  );
}
