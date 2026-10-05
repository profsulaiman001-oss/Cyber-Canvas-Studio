import { useId } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Type } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useEditor } from '@/store/editorStore';
import FontPicker from './FontPicker';
import FontUploader from './FontUploader';

export type TypographyParameter = 'fontSize' | 'letterSpacing' | 'lineHeight' | 'wordSpacing';
export type TypographyAlignment = 'left' | 'center' | 'right' | 'justify';
export type TypographyTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export interface TypographyValues {
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  wordSpacing: number;
}

export interface TypographyStudioProps extends TypographyValues {
  hasTextSelection: boolean;
  fontFamily: string;
  alignment: TypographyAlignment;
  textTransform: TypographyTransform;
  glowEnabled: boolean;
  neonEnabled: boolean;
  onFontSizeChange: (value: number) => void;
  onLetterSpacingChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
  onWordSpacingChange: (value: number) => void;
  onFontFamilyChange: (font: string) => void;
  onAlignmentChange: (alignment: TypographyAlignment) => void;
  onTextTransformChange: (transform: TypographyTransform) => void;
  onGlowChange: (enabled: boolean) => void;
  onNeonChange: (enabled: boolean) => void;
  className?: string;
}

const SYSTEM_FONTS = ['Inter', 'Georgia', 'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Impact'];

const PARAMS: Array<{
  key: TypographyParameter;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (value: number) => string;
}> = [
  { key: 'fontSize', label: 'Font Size', min: 8, max: 300, step: 1, unit: 'px' },
  { key: 'letterSpacing', label: 'Letter Spacing', min: -50, max: 200, step: 1, unit: 'px' },
  { key: 'lineHeight', label: 'Line Height', min: 0.5, max: 4, step: 0.05, unit: '×', format: (value) => value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') },
  { key: 'wordSpacing', label: 'Word Spacing', min: -50, max: 200, step: 1, unit: 'px' },
];

function displayValue(value: number, format?: (value: number) => string) {
  return format ? format(value) : String(Math.round(value * 100) / 100);
}

export default function TypographyStudio(props: TypographyStudioProps) {
  const { state } = useEditor();
  const titleId = useId();
  const disabled = !props.hasTextSelection;

  const updateParameter = (key: TypographyParameter, value: number) => {
    if (disabled) return;
    switch (key) {
      case 'fontSize': props.onFontSizeChange(value); break;
      case 'letterSpacing': props.onLetterSpacingChange(value); break;
      case 'lineHeight': props.onLineHeightChange(value); break;
      case 'wordSpacing': props.onWordSpacingChange(value); break;
    }
  };

  return (
    <section
      id="typography-studio"
      aria-labelledby={titleId}
      className={`overflow-hidden rounded-2xl ${props.className || ''}`}
      style={{
        background: '#11141A',
        border: '1px solid rgba(0,245,255,0.25)',
        boxShadow: '0 -8px 30px rgba(0,0,0,0.45)',
      }}
      data-testid="typography-studio"
    >
      <div className="space-y-4 px-4 pb-4 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type size={14} className="text-primary" aria-hidden="true" />
            <h2 id={titleId} className="text-xs font-semibold text-primary">Typography Studio</h2>
          </div>
          {!props.hasTextSelection && <span className="text-[10px] text-muted-foreground">Select a text object to edit</span>}
        </div>

        <fieldset disabled={disabled} className="min-w-0 space-y-4 disabled:opacity-45">
          <legend className="sr-only">Text formatting controls</legend>
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {PARAMS.map((param) => {
              const id = `typography-${param.key}`;
              const value = props[param.key];
              return (
                <div key={param.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={id} className="text-[11px] text-muted-foreground">{param.label}</Label>
                    <span className="font-mono text-[11px] text-primary">
                      {displayValue(value, param.format)}{param.unit}
                    </span>
                  </div>
                  <Slider
                    id={id}
                    aria-label={param.label}
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={[value]}
                    onValueChange={([next]) => updateParameter(param.key, next)}
                    disabled={disabled}
                    className="py-1"
                  />
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground" id="typography-font-label">Font Family</Label>
              {props.hasTextSelection ? (
                <div aria-labelledby="typography-font-label">
                  <FontPicker
                    value={props.fontFamily}
                    onChange={props.onFontFamilyChange}
                    systemFonts={SYSTEM_FONTS}
                    customFonts={state.customFonts}
                    data-testid="typography-font-picker"
                  />
                </div>
              ) : (
                <button type="button" disabled className="flex h-10 w-full items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-left text-xs text-muted-foreground">
                  Select a text object
                </button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">Import Font</Label>
              {props.hasTextSelection
                ? <FontUploader />
                : (
                  <button type="button" disabled className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-left text-xs text-muted-foreground">
                    Import unavailable
                  </button>
                )}
            </div>
          </div>

          <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">Alignment</Label>
              <ToggleGroup
                type="single"
                value={props.alignment}
                onValueChange={(value) => value && props.onAlignmentChange(value as TypographyAlignment)}
                aria-label="Text alignment"
                className="grid grid-cols-4 gap-1"
              >
                <ToggleGroupItem value="left" aria-label="Align left" className="h-10 min-w-0 border border-white/10 bg-white/[0.03] data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                  <AlignLeft size={15} aria-hidden="true" />
                </ToggleGroupItem>
                <ToggleGroupItem value="center" aria-label="Align center" className="h-10 min-w-0 border border-white/10 bg-white/[0.03] data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                  <AlignCenter size={15} aria-hidden="true" />
                </ToggleGroupItem>
                <ToggleGroupItem value="right" aria-label="Align right" className="h-10 min-w-0 border border-white/10 bg-white/[0.03] data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                  <AlignRight size={15} aria-hidden="true" />
                </ToggleGroupItem>
                <ToggleGroupItem value="justify" aria-label="Justify text" className="h-10 min-w-0 border border-white/10 bg-white/[0.03] data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                  <AlignJustify size={15} aria-hidden="true" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">Text Transform</Label>
              <ToggleGroup
                type="single"
                value={props.textTransform}
                onValueChange={(value) => value && props.onTextTransformChange(value as TypographyTransform)}
                aria-label="Text transform"
                className="grid grid-cols-4 gap-1"
              >
                <ToggleGroupItem value="none" className="h-10 border border-white/10 bg-white/[0.03] px-1.5 text-[10px] data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">As typed</ToggleGroupItem>
                <ToggleGroupItem value="uppercase" className="h-10 border border-white/10 bg-white/[0.03] px-2 text-[10px] data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">UPPER</ToggleGroupItem>
                <ToggleGroupItem value="lowercase" className="h-10 border border-white/10 bg-white/[0.03] px-2 text-[10px] data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">lower</ToggleGroupItem>
                <ToggleGroupItem value="capitalize" className="h-10 border border-white/10 bg-white/[0.03] px-2 text-[10px] data-[state=on]:border-primary/60 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">Title</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2">
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <Label htmlFor="typography-glow-toggle" className="cursor-pointer text-xs text-muted-foreground">Glow</Label>
              <Switch id="typography-glow-toggle" checked={props.glowEnabled} onCheckedChange={props.onGlowChange} disabled={disabled} aria-label="Toggle text glow" />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <Label htmlFor="typography-neon-toggle" className="cursor-pointer text-xs text-muted-foreground">Neon</Label>
              <Switch id="typography-neon-toggle" checked={props.neonEnabled} onCheckedChange={props.onNeonChange} disabled={disabled} aria-label="Toggle neon text" />
            </div>
          </div>
        </fieldset>
      </div>
    </section>
  );
}
