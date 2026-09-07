import { useCallback, useEffect, useMemo, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject } from 'fabric';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ColorPicker from './ColorPicker';

interface ThreeDPanelProps {
  controller: CanvasController;
}

type ThreeDParam = 'depth' | 'lightAngle' | 'lightIntensity' | 'shadow' | 'specular' | 'darken';

type Depth3dConfig = {
  enabled?: boolean;
  steps?: number;
  color?: string;
  angle?: number;
  depthAngle?: number;
  bevel?: boolean;
  bevelTaper?: number;
  darkenIntensity?: number;
  autoShade?: boolean;
  lightAngle?: number;
  lightIntensity?: number;
  shadowDepth?: number;
  shadowFalloff?: number;
  specularHardness?: number;
};

type FillLike = string | { colorStops?: Array<{ color?: string }> };

const PARAM_LABELS: Record<ThreeDParam, string> = {
  depth: '3D Depth',
  lightAngle: 'Light Angle',
  lightIntensity: 'Light Intensity',
  shadow: 'Shadow',
  specular: 'Specular Hardness',
  darken: 'Darken Intensity',
};

const PRESETS = [
  { id: 'matte', label: 'Matte', description: 'Soft, broad light', values: { lightIntensity: 58, shadowDepth: 62, shadowFalloff: 82, specularHardness: 10, darkenIntensity: 52, bevel: false, bevelTaper: 18 } },
  { id: 'studio', label: 'Studio', description: 'Balanced product light', values: { lightIntensity: 76, shadowDepth: 48, shadowFalloff: 62, specularHardness: 42, darkenIntensity: 40, bevel: true, bevelTaper: 20 } },
  { id: 'chrome', label: 'Chrome', description: 'Hard glossy edge', values: { lightIntensity: 100, shadowDepth: 38, shadowFalloff: 35, specularHardness: 92, darkenIntensity: 44, bevel: true, bevelTaper: 12 } },
] as const;

function parseColorToHex(color: string): string | null {
  if (!color) return null;
  if (color.startsWith('#')) {
    const clean = color.replace('#', '');
    if (/^[0-9a-f]{3}$/i.test(clean)) return `#${clean.split('').map((c) => c + c).join('').toLowerCase()}`;
    if (/^[0-9a-f]{6}$/i.test(clean)) return `#${clean.toLowerCase()}`;
    return null;
  }
  const match = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!match) return null;
  return `#${match.slice(1, 4).map((value) => Math.max(0, Math.min(255, Math.round(Number(value)))).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - chroma / 2;
  let r = 0; let g = 0; let b = 0;
  if (h < 60) { r = chroma; g = x; }
  else if (h < 120) { r = x; g = chroma; }
  else if (h < 180) { g = chroma; b = x; }
  else if (h < 240) { g = x; b = chroma; }
  else if (h < 300) { r = x; b = chroma; }
  else { r = chroma; b = x; }
  return `#${[r, g, b].map((value) => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function darkenColor(fill: string, intensity: number): string {
  const [r, g, b] = hexToRgb(fill);
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToHex(h, s, Math.max(0, l * (1 - intensity / 100)));
}

function getMainFillHex(obj: FabricObject): string {
  const fill = (obj as FabricObject & { fill?: FillLike }).fill;
  if (typeof fill === 'string') return parseColorToHex(fill) || '#777777';
  if (fill && typeof fill === 'object' && fill.colorStops?.length) return parseColorToHex(fill.colorStops[0]?.color || '') || '#777777';
  const stroke = (obj as FabricObject & { stroke?: string }).stroke;
  return parseColorToHex(stroke || '') || '#777777';
}

function formatValue(value: number, unit: string) {
  return `${Math.round(value * 100) / 100}${unit}`;
}

function SliderRow({
  label, value, min, max, step = 1, onChange, unit = '', disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <span className="font-mono text-[11px] text-primary">{formatValue(value, unit)}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([next]) => onChange(next)} disabled={disabled} />
    </div>
  );
}

function ColorField({
  value, autoShade, onChange, onReset, disabled,
}: {
  value: string;
  autoShade: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5" onClick={() => setOpen((current) => !current)} disabled={disabled}>
          <Label className="pointer-events-none text-[11px] text-muted-foreground">Depth Color</Label>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md border border-white/20" style={{ background: value }} />
            <span className="font-mono text-[10px] text-muted-foreground">{value.toUpperCase()}</span>
          </div>
        </button>
        {!autoShade && (
          <button onClick={onReset} disabled={disabled} className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-primary hover:bg-primary/10">
            <RotateCcw size={11} /> Auto
          </button>
        )}
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${open && !disabled ? 'mt-2 max-h-72 opacity-100' : 'max-h-0 opacity-0'}`}>
        <ColorPicker value={value} onChange={onChange} />
      </div>
    </div>
  );
}

export default function ThreeDPanel({ controller }: ThreeDPanelProps) {
  const { state } = useEditor();
  const obj = controller.selectedObject;
  const [expanded, setExpanded] = useState(false);
  const [activeParam, setActiveParam] = useState<ThreeDParam>('depth');
  const [enabled, setEnabled] = useState(false);
  const [steps, setSteps] = useState(8);
  const [depthColor, setDepthColor] = useState('#777777');
  const [depthAngle, setDepthAngle] = useState(225);
  const [lightAngle, setLightAngle] = useState(45);
  const [lightIntensity, setLightIntensity] = useState(76);
  const [shadowDepth, setShadowDepth] = useState(48);
  const [shadowFalloff, setShadowFalloff] = useState(62);
  const [specularHardness, setSpecularHardness] = useState(42);
  const [bevel, setBevel] = useState(true);
  const [bevelTaper, setBevelTaper] = useState(20);
  const [darkenIntensity, setDarkenIntensity] = useState(40);
  const [autoShade, setAutoShade] = useState(true);

  const getAutoColor = useCallback((intensity: number) => obj ? darkenColor(getMainFillHex(obj), intensity) : '#777777', [obj]);

  const syncFromObj = useCallback(() => {
    if (!obj) {
      setEnabled(false); setSteps(8); setDepthColor('#777777'); setDepthAngle(225);
      setLightAngle(45); setLightIntensity(76); setShadowDepth(48); setShadowFalloff(62);
      setSpecularHardness(42); setBevel(true); setBevelTaper(20); setDarkenIntensity(40); setAutoShade(true);
      return;
    }
    const depth = (obj as FabricObject & Record<string, unknown>)._depth3d as Depth3dConfig | undefined;
    const nextDarken = depth?.darkenIntensity ?? 40;
    const nextDepthAngle = depth?.depthAngle ?? depth?.angle ?? 225;
    const nextAutoShade = depth?.autoShade !== false;
    setEnabled(!!depth?.enabled);
    setSteps(depth?.steps ?? 8);
    setDepthAngle(nextDepthAngle);
    setLightAngle(depth?.lightAngle ?? 45);
    setLightIntensity(depth?.lightIntensity ?? 76);
    setShadowDepth(depth?.shadowDepth ?? 48);
    setShadowFalloff(depth?.shadowFalloff ?? 62);
    setSpecularHardness(depth?.specularHardness ?? 42);
    setDarkenIntensity(nextDarken);
    setAutoShade(nextAutoShade);
    setDepthColor(depth?.color || (nextAutoShade ? getAutoColor(nextDarken) : '#777777'));
    setBevel(depth?.bevel ?? true);
    setBevelTaper(depth?.bevelTaper ?? 20);
  }, [obj, getAutoColor]);

  useEffect(() => {
    syncFromObj();
    setExpanded(false);
    setActiveParam('depth');
  }, [syncFromObj]);

  const applyDepth = useCallback((next: {
    enabled: boolean;
    steps: number;
    color: string;
    depthAngle: number;
    lightAngle: number;
    lightIntensity: number;
    shadowDepth: number;
    shadowFalloff: number;
    specularHardness: number;
    darkenIntensity: number;
    bevel: boolean;
    bevelTaper: number;
    autoShade: boolean;
  }) => {
    if (!obj) return;
    controller.apply3DDepth(obj, next.enabled ? {
      enabled: true,
      steps: next.steps,
      color: next.color,
      angle: next.depthAngle,
      depthAngle: next.depthAngle,
      lightAngle: next.lightAngle,
      lightIntensity: next.lightIntensity,
      shadowDepth: next.shadowDepth,
      shadowFalloff: next.shadowFalloff,
      specularHardness: next.specularHardness,
      darkenIntensity: next.darkenIntensity,
      bevel: next.bevel,
      bevelTaper: next.bevelTaper,
      autoShade: next.autoShade,
    } : null);
    controller.commitChange();
  }, [obj, controller]);

  const updateDepth = useCallback((changes: Partial<{
    enabled: boolean;
    steps: number;
    color: string;
    depthAngle: number;
    lightAngle: number;
    lightIntensity: number;
    shadowDepth: number;
    shadowFalloff: number;
    specularHardness: number;
    darkenIntensity: number;
    bevel: boolean;
    bevelTaper: number;
    autoShade: boolean;
  }>) => {
    const next = {
      enabled,
      steps,
      color: depthColor,
      depthAngle,
      lightAngle,
      lightIntensity,
      shadowDepth,
      shadowFalloff,
      specularHardness,
      darkenIntensity,
      bevel,
      bevelTaper,
      autoShade,
      ...changes,
    };
    applyDepth(next);
  }, [enabled, steps, depthColor, depthAngle, lightAngle, lightIntensity, shadowDepth, shadowFalloff, specularHardness, darkenIntensity, bevel, bevelTaper, autoShade, applyDepth]);

  const handleEnabledChange = (nextEnabled: boolean) => {
    setEnabled(nextEnabled);
    if (nextEnabled && autoShade) {
      const nextColor = getAutoColor(darkenIntensity);
      setDepthColor(nextColor);
      updateDepth({ enabled: true, color: nextColor });
    } else {
      updateDepth({ enabled: nextEnabled });
    }
  };

  const handleDarkenChange = (value: number) => {
    setDarkenIntensity(value);
    const nextColor = autoShade ? getAutoColor(value) : depthColor;
    if (autoShade) setDepthColor(nextColor);
    updateDepth({ darkenIntensity: value, color: nextColor });
  };

  const handleColorChange = (value: string) => {
    const nextColor = parseColorToHex(value) || depthColor;
    setDepthColor(nextColor);
    setAutoShade(false);
    updateDepth({ color: nextColor, autoShade: false });
  };

  const handlePreset = (preset: typeof PRESETS[number]) => {
    const next = preset.values;
    setLightIntensity(next.lightIntensity);
    setShadowDepth(next.shadowDepth);
    setShadowFalloff(next.shadowFalloff);
    setSpecularHardness(next.specularHardness);
    setDarkenIntensity(next.darkenIntensity);
    setBevel(next.bevel);
    setBevelTaper(next.bevelTaper);
    const nextColor = autoShade ? getAutoColor(next.darkenIntensity) : depthColor;
    if (autoShade) setDepthColor(nextColor);
    updateDepth({
      ...next,
      color: nextColor,
      autoShade,
    });
  };

  const controls = useMemo(() => ({
    depth: { label: PARAM_LABELS.depth, value: steps, min: 1, max: 80, step: 1, unit: 'px', onChange: (value: number) => { setSteps(value); updateDepth({ steps: value }); } },
    lightAngle: { label: PARAM_LABELS.lightAngle, value: lightAngle, min: 0, max: 360, step: 1, unit: '°', onChange: (value: number) => { setLightAngle(value); updateDepth({ lightAngle: value }); } },
    lightIntensity: { label: PARAM_LABELS.lightIntensity, value: lightIntensity, min: 0, max: 100, step: 1, unit: '%', onChange: (value: number) => { setLightIntensity(value); updateDepth({ lightIntensity: value }); } },
    shadow: { label: PARAM_LABELS.shadow, value: shadowDepth, min: 0, max: 100, step: 1, unit: '%', onChange: (value: number) => { setShadowDepth(value); updateDepth({ shadowDepth: value }); } },
    specular: { label: PARAM_LABELS.specular, value: specularHardness, min: 0, max: 100, step: 1, unit: '%', onChange: (value: number) => { setSpecularHardness(value); updateDepth({ specularHardness: value }); } },
    darken: { label: PARAM_LABELS.darken, value: darkenIntensity, min: 0, max: 100, step: 1, unit: '%', onChange: handleDarkenChange },
  }), [steps, lightAngle, lightIntensity, shadowDepth, specularHardness, darkenIntensity, updateDepth]);
  const activeControl = controls[activeParam];

  if (state.activePanel !== 'threeD') return null;

  return (
    <div className="absolute bottom-full left-1/2 z-[9999] mb-2 w-[min(720px,calc(100vw-20px))] -translate-x-1/2" data-testid="threed-panel">
      <div
        className={`overflow-hidden rounded-2xl transition-all duration-300 ${expanded ? 'mb-2 max-h-[min(72vh,650px)] overflow-y-auto opacity-100' : 'pointer-events-none max-h-0 opacity-0'}`}
        style={{ background: '#11141A', border: expanded ? '1px solid rgba(0,245,255,0.25)' : '1px solid transparent', boxShadow: expanded ? '0 -8px 30px rgba(0,0,0,0.45)' : 'none' }}
      >
        <div className="space-y-4 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Box size={14} className="text-primary" /><span className="text-xs font-semibold text-primary">3D Extrusion Studio</span></div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Live lighting controls</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3">
              <ColorField value={depthColor} autoShade={autoShade} onChange={handleColorChange} onReset={() => { const nextColor = getAutoColor(darkenIntensity); setDepthColor(nextColor); setAutoShade(true); updateDepth({ color: nextColor, autoShade: true }); }} disabled={!obj} />
              <SliderRow label="3D Depth" value={steps} min={1} max={80} unit="px" onChange={(value) => { setSteps(value); updateDepth({ steps: value }); }} disabled={!obj || !enabled} />
              <SliderRow label="Extrusion Direction" value={depthAngle} min={0} max={360} unit="°" onChange={(value) => { setDepthAngle(value); updateDepth({ depthAngle: value }); }} disabled={!obj} />
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">Depth vector</span>
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-white/[0.03]">
                  <div className="absolute h-[2px] w-5 origin-left bg-primary" style={{ transform: `rotate(${depthAngle - 90}deg) translateX(2px)` }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                <span className="font-mono text-[10px] text-primary">{Math.round(depthAngle)}°</span>
              </div>
            </div>

            <div className="space-y-3">
              <SliderRow label="Light Angle / Direction" value={lightAngle} min={0} max={360} unit="°" onChange={(value) => { setLightAngle(value); updateDepth({ lightAngle: value }); }} disabled={!obj} />
              <SliderRow label="Light Intensity" value={lightIntensity} min={0} max={100} unit="%" onChange={(value) => { setLightIntensity(value); updateDepth({ lightIntensity: value }); }} disabled={!obj} />
              <SliderRow label="Shadow Depth" value={shadowDepth} min={0} max={100} unit="%" onChange={(value) => { setShadowDepth(value); updateDepth({ shadowDepth: value }); }} disabled={!obj} />
              <SliderRow label="Shadow Falloff" value={shadowFalloff} min={0} max={100} unit="%" onChange={(value) => { setShadowFalloff(value); updateDepth({ shadowFalloff: value }); }} disabled={!obj} />
              <SliderRow label="Specular Hardness" value={specularHardness} min={0} max={100} unit="%" onChange={(value) => { setSpecularHardness(value); updateDepth({ specularHardness: value }); }} disabled={!obj} />
              <SliderRow label="Darken Intensity / Depth Shade" value={darkenIntensity} min={0} max={100} unit="%" onChange={handleDarkenChange} disabled={!obj || !autoShade} />
            </div>
          </div>

          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <div><Label className="text-[11px] text-muted-foreground">Bevel Mode</Label><p className="text-[10px] text-muted-foreground/70">Taper far layers into the face</p></div>
              <Switch checked={bevel} onCheckedChange={(value) => { setBevel(value); updateDepth({ bevel: value }); }} disabled={!obj} />
            </div>
            <SliderRow label="Bevel Taper" value={bevelTaper} min={1} max={50} unit="%" onChange={(value) => { setBevelTaper(value); updateDepth({ bevelTaper: value }); }} disabled={!obj || !bevel} />
          </div>

          <div className="border-t border-border pt-3">
            <div className="mb-2 flex items-center gap-2"><Sparkles size={13} className="text-primary" /><Label className="text-[11px] text-muted-foreground">Lighting Presets</Label></div>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((preset) => (
                <button key={preset.id} onClick={() => handlePreset(preset)} disabled={!obj} className="rounded-lg border border-white/10 bg-white/[0.035] px-2 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40">
                  <span className="block text-[10px] font-semibold text-foreground">{preset.label}</span>
                  <span className="mt-0.5 block text-[9px] text-muted-foreground">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border px-2.5 py-2.5" style={{ background: '#11141A', borderColor: 'rgba(0,245,255,0.3)', boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)' }}>
        <Box size={14} className="shrink-0 text-primary" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex min-w-[106px] shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-left text-[10px] font-semibold text-primary hover:bg-primary/10">
              <span className="truncate">{activeControl.label}</span><ChevronDown size={12} className="ml-auto shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-52 border-cyan-400/20 bg-[#11141A] text-foreground">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">3D parameter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={activeParam} onValueChange={(value) => setActiveParam(value as ThreeDParam)}>
              {(Object.keys(PARAM_LABELS) as ThreeDParam[]).map((param) => (
                <DropdownMenuRadioItem key={param} value={param} className="text-xs">{PARAM_LABELS[param]}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Slider min={activeControl.min} max={activeControl.max} step={activeControl.step} value={[activeControl.value]} onValueChange={([value]) => activeControl.onChange(value)} disabled={!obj || !enabled} className="min-w-0 flex-1" />
        <span className="min-w-[42px] shrink-0 text-right font-mono text-[10px] text-primary">{formatValue(activeControl.value, activeControl.unit)}</span>
        <Switch checked={enabled} onCheckedChange={handleEnabledChange} disabled={!obj} aria-label="Toggle 3D extrusion effect" />
        <button onClick={() => setExpanded((open) => !open)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10" aria-label={expanded ? 'Collapse 3D extrusion controls' : 'Expand 3D extrusion controls'}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
      {!obj && <div className="mt-1 text-center text-[10px] text-muted-foreground">Select an object to edit 3D lighting</div>}
      {obj && <div className="sr-only"><Lightbulb /> {enabled ? '3D lighting enabled' : '3D lighting disabled'}</div>}
    </div>
  );
}