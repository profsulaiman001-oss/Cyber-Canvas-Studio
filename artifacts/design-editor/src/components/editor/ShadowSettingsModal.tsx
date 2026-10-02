import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Layers2, Layers3 } from 'lucide-react';
import ColorPicker from './ColorPicker';

export type ShadowMode = 'drop' | 'inner';

interface ShadowSettingsModalProps {
  expanded: boolean;
  mode: ShadowMode;
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
  onModeChange: (mode: ShadowMode) => void;
  onEnabledChange: (enabled: boolean) => void;
  onColorChange: (color: string) => void;
  onBlurChange: (value: number) => void;
  onOffsetXChange: (value: number) => void;
  onOffsetYChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
}

function StudioSlider({
  label,
  value,
  min,
  max,
  unit = '',
  onChange,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
  testId: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{label}</Label>
        <span className="min-w-[42px] shrink-0 text-right font-mono text-[11px] tabular-nums text-primary">
          {Math.round(value * 100) / 100}{unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
        className="w-full"
        aria-label={`${label} shadow`}
        data-testid={testId}
      />
    </div>
  );
}

export default function ShadowSettingsModal({
  expanded,
  mode,
  enabled,
  color,
  blur,
  offsetX,
  offsetY,
  opacity,
  onModeChange,
  onEnabledChange,
  onColorChange,
  onBlurChange,
  onOffsetXChange,
  onOffsetYChange,
  onOpacityChange,
}: ShadowSettingsModalProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const isDrop = mode === 'drop';
  const ModeIcon = isDrop ? Layers3 : Layers2;

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
      data-testid="shadow-settings-modal"
    >
      <div className="space-y-4 px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ModeIcon size={14} className="text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Shadow Studio</span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="shadow-studio-enabled" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Enabled
            </Label>
            <Switch
              id="shadow-studio-enabled"
              checked={enabled}
              onCheckedChange={onEnabledChange}
              aria-label={`Toggle ${isDrop ? 'drop' : 'inner'} shadow`}
              data-testid="shadow-studio-enabled"
            />
          </div>
        </div>

        <section className="space-y-2.5 border-t border-cyan-400/10 pt-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Shadow Type</h3>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'drop' as const, label: 'Drop Shadow', icon: Layers3 },
              { key: 'inner' as const, label: 'Inner Shadow', icon: Layers2 },
            ]).map(({ key, label, icon: Icon }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onModeChange(key)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-semibold transition-colors ${
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-white/10 bg-white/[0.035] text-muted-foreground hover:border-primary/25 hover:bg-primary/[0.06]'
                  }`}
                  aria-pressed={active}
                  data-testid={`shadow-studio-type-${key}`}
                >
                  <Icon size={14} className="shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                  <span className="ml-auto flex h-2 w-2 items-center justify-center" aria-hidden="true">
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_7px_rgba(0,245,255,0.95)]" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2.5 border-t border-cyan-400/10 pt-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <StudioSlider label="Blur" value={blur} min={0} max={100} onChange={onBlurChange} testId="shadow-studio-blur" />
            <StudioSlider label="Offset X" value={offsetX} min={-100} max={100} onChange={onOffsetXChange} testId="shadow-studio-offset-x" />
            <StudioSlider label="Offset Y" value={offsetY} min={-100} max={100} onChange={onOffsetYChange} testId="shadow-studio-offset-y" />
            <StudioSlider label="Opacity" value={opacity} min={0} max={100} unit="%" onChange={onOpacityChange} testId="shadow-studio-opacity" />

            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:col-span-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">Color</h3>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
                onClick={() => setColorPickerOpen((open) => !open)}
                aria-expanded={colorPickerOpen}
                aria-label="Choose shadow color"
                data-testid="shadow-color-picker-toggle"
              >
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Color value</span>
                <span className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-md border border-white/20" style={{ background: color }} aria-hidden="true" />
                  <span className="font-mono text-[10px] text-primary">{color.toUpperCase()}</span>
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${colorPickerOpen ? 'mt-2 max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
                <ColorPicker value={color} onChange={onColorChange} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}