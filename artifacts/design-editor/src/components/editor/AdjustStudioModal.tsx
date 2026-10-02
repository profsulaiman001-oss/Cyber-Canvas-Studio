import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { ColorAdjustments } from '@/lib/colorAdjustments';
import { Contrast, Droplets, Palette, Paintbrush, RotateCcw, Sun, Thermometer, type LucideIcon } from 'lucide-react';

export type AdjustmentKey = keyof ColorAdjustments;

export interface AdjustmentControl {
  key: AdjustmentKey;
  label: string;
  icon: LucideIcon;
  min: number;
  max: number;
  step: number;
}

export const ADJUSTMENT_CONTROLS: AdjustmentControl[] = [
  { key: 'brightness', label: 'Brightness', icon: Sun, min: -1, max: 1, step: 0.01 },
  { key: 'contrast', label: 'Contrast', icon: Contrast, min: -1, max: 1, step: 0.01 },
  { key: 'saturation', label: 'Saturation', icon: Droplets, min: -1, max: 1, step: 0.01 },
  { key: 'hue', label: 'Hue Rotation', icon: Palette, min: -180, max: 180, step: 1 },
  { key: 'warmth', label: 'Warmth', icon: Thermometer, min: -1, max: 1, step: 0.01 },
  { key: 'tint', label: 'Tint', icon: Paintbrush, min: -1, max: 1, step: 0.01 },
];

export function formatAdjustmentValue(key: AdjustmentKey, value: number) {
  return key === 'hue' ? `${Math.round(value)}°` : value.toFixed(2);
}

interface AdjustStudioModalProps {
  expanded: boolean;
  hasSelection: boolean;
  adjustments: ColorAdjustments;
  onChange: (key: AdjustmentKey, value: number) => void;
  onCommit: () => void;
  onResetAll: () => void;
}

export default function AdjustStudioModal({
  expanded,
  hasSelection,
  adjustments,
  onChange,
  onCommit,
  onResetAll,
}: AdjustStudioModalProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl transition-all duration-300 ${
        expanded
          ? 'mb-2 max-h-[min(72vh,650px)] overflow-y-auto opacity-100'
          : 'pointer-events-none max-h-0 opacity-0'
      }`}
      style={{
        background: 'rgba(17,20,26,0.97)',
        backdropFilter: 'blur(18px)',
        border: expanded ? '1px solid rgba(0,245,255,0.25)' : '1px solid transparent',
        boxShadow: expanded ? '0 -8px 30px rgba(0,0,0,0.45)' : 'none',
      }}
      aria-hidden={!expanded}
      data-testid="adjust-studio"
    >
      <div className="space-y-4 px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sun size={14} className="text-primary" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              Adjustments Studio
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-lg border border-primary/20 px-2 text-[10px] font-semibold uppercase tracking-wider text-primary hover:bg-primary/10 hover:text-primary"
            onClick={onResetAll}
            disabled={!hasSelection || !expanded}
            data-testid="adjust-reset-all"
          >
            <RotateCcw size={12} />
            Reset All
          </Button>
        </div>

        <section className="space-y-2.5 border-t border-cyan-400/10 pt-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Color &amp; Tone</h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {ADJUSTMENT_CONTROLS.map(({ key, label, icon: Icon, min, max, step }) => (
              <div
                key={key}
                className="space-y-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
                data-testid={`adjustment-card-${key}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                    <Icon size={13} className="shrink-0 text-primary" aria-hidden="true" />
                    {label}
                  </span>
                  <span className="min-w-[48px] shrink-0 text-right font-mono text-[11px] tabular-nums text-primary">
                    {formatAdjustmentValue(key, adjustments[key])}
                  </span>
                </div>
                <Slider
                  min={min}
                  max={max}
                  step={step}
                  value={[adjustments[key]]}
                  onValueChange={([value]) => onChange(key, value)}
                  onValueCommit={onCommit}
                  disabled={!hasSelection || !expanded}
                  className="w-full"
                  aria-label={`${label} adjustment`}
                  data-testid={`adjustment-studio-slider-${key}`}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}