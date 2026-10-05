import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Type } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TypographyParameter, TypographyStudioProps } from './TypographyStudio';
import TypographyStudio from './TypographyStudio';

interface ParameterConfig {
  key: TypographyParameter;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (value: number) => string;
}

const PARAMETERS: ParameterConfig[] = [
  { key: 'fontSize', label: 'Font Size', min: 8, max: 300, step: 1, unit: 'px' },
  { key: 'letterSpacing', label: 'Letter Spacing', min: -50, max: 200, step: 1, unit: 'px' },
  { key: 'lineHeight', label: 'Line Height', min: 0.5, max: 4, step: 0.05, unit: '×', format: (value) => value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') },
  { key: 'wordSpacing', label: 'Word Spacing', min: -50, max: 200, step: 1, unit: 'px' },
];

export interface TypographyQuickStripProps extends TypographyStudioProps {
  defaultParameter?: TypographyParameter;
}

function formatValue(value: number, config: ParameterConfig) {
  return config.format ? config.format(value) : String(Math.round(value * 100) / 100);
}

export default function TypographyQuickStrip(props: TypographyQuickStripProps) {
  const [activeParameter, setActiveParameter] = useState<TypographyParameter>(props.defaultParameter || 'fontSize');
  const [expanded, setExpanded] = useState(false);
  const activeControl = PARAMETERS.find((parameter) => parameter.key === activeParameter) || PARAMETERS[0];
  const [valueDraft, setValueDraft] = useState(formatValue(props[activeControl.key], activeControl));
  const currentValue = props[activeControl.key];

  useEffect(() => {
    setValueDraft(formatValue(currentValue, activeControl));
  }, [activeControl, currentValue]);

  const setValue = (next: number) => {
    if (!props.hasTextSelection || !Number.isFinite(next)) return;
    switch (activeParameter) {
      case 'fontSize': props.onFontSizeChange(next); break;
      case 'letterSpacing': props.onLetterSpacingChange(next); break;
      case 'lineHeight': props.onLineHeightChange(next); break;
      case 'wordSpacing': props.onWordSpacingChange(next); break;
    }
  };

  return (
    <div className="absolute bottom-full left-1/2 z-[9999] mb-2 w-[min(720px,calc(100vw-20px))] -translate-x-1/2" data-testid="typography-quick-strip">
      <div
        className={`overflow-hidden rounded-2xl transition-all duration-300 ${expanded ? 'mb-2 max-h-[min(72vh,650px)] overflow-y-auto opacity-100' : 'pointer-events-none max-h-0 opacity-0'}`}
        aria-hidden={!expanded}
      >
        {expanded && <TypographyStudio {...props} />}
      </div>

      <div
        className="flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2.5"
        style={{
          background: '#11141A',
          borderColor: 'rgba(0,245,255,0.3)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!props.hasTextSelection}
              className="flex h-10 w-12 shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Typography parameter: ${activeControl.label}`}
              title={activeControl.label}
            >
              <Type size={15} aria-hidden="true" />
              <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-56 border-cyan-400/20 bg-[#11141A] text-foreground">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">Typography parameter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={activeParameter} onValueChange={(value) => setActiveParameter(value as TypographyParameter)}>
              {PARAMETERS.map((parameter) => (
                <DropdownMenuRadioItem key={parameter.key} value={parameter.key} className="min-h-10 text-xs data-[state=checked]:text-primary">
                  {parameter.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="min-w-0 flex-1 px-1">
          <Slider
            aria-label={activeControl.label}
            min={activeControl.min}
            max={activeControl.max}
            step={activeControl.step}
            value={[currentValue]}
            onValueChange={([value]) => setValue(value)}
            disabled={!props.hasTextSelection}
            className="w-full py-1"
          />
        </div>

        <label className="flex h-10 min-w-[76px] shrink-0 items-center justify-end gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/40">
          <span className="sr-only">{activeControl.label} value</span>
          <input
            type="number"
            value={valueDraft}
            min={activeControl.min}
            max={activeControl.max}
            step={activeControl.step}
            disabled={!props.hasTextSelection}
            aria-label={`${activeControl.label} value`}
            onChange={(event) => {
              const nextDraft = event.currentTarget.value;
              setValueDraft(nextDraft);
              if (nextDraft.trim() !== '') setValue(Number(nextDraft));
            }}
            onBlur={() => setValueDraft(formatValue(currentValue, activeControl))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="w-full min-w-0 bg-transparent text-right font-mono text-[11px] text-primary outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span className="shrink-0 font-mono text-[10px] text-primary/70" aria-hidden="true">{activeControl.unit}</span>
        </label>

        <button
          type="button"
          onClick={() => setExpanded((wasExpanded) => !wasExpanded)}
          aria-expanded={expanded}
          aria-controls="typography-studio"
          aria-label={expanded ? 'Collapse typography controls' : 'Expand typography controls'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
