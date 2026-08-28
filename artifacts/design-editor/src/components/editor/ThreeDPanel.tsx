import { useState, useEffect, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject } from 'fabric';
import { Box, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import ColorPicker from './ColorPicker';

interface ThreeDPanelProps { controller: CanvasController }

type Depth3dConfig = {
  enabled?: boolean;
  steps?: number;
  color?: string;
  angle?: number;
  bevel?: boolean;
  bevelTaper?: number;
  darkenIntensity?: number;
  autoShade?: boolean;
};

type FillLike = string | {
  colorStops?: Array<{ color?: string }>;
};

function parseColorToHex(color: string): string | null {
  if (!color) return null;
  if (color.startsWith('#')) {
    const clean = color.replace('#', '');
    if (/^[0-9a-f]{3}$/i.test(clean)) {
      return `#${clean.split('').map((c) => c + c).join('').toLowerCase()}`;
    }
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
  // 40% is the default, matching the requested 35–40% HSL lightness reduction.
  return hslToHex(h, s, Math.max(0, l * (1 - intensity / 100)));
}

function getMainFillHex(obj: FabricObject): string {
  const fill = (obj as FabricObject & { fill?: FillLike }).fill;
  if (typeof fill === 'string') {
    const parsed = parseColorToHex(fill);
    if (parsed) return parsed;
  }
  if (fill && typeof fill === 'object' && fill.colorStops?.length) {
    const parsed = parseColorToHex(fill.colorStops[0]?.color || '');
    if (parsed) return parsed;
  }
  const stroke = (obj as FabricObject & { stroke?: string }).stroke;
  return parseColorToHex(stroke || '') || '#777777';
}

function SliderRow({
  label, value, min, max, step = 1, onChange, unit = '', disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <span className="text-[11px] font-mono text-primary">{Math.round(value * 100) / 100}{unit}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
      />
    </div>
  );
}

function ColorField({
  value, autoShade, onChange, onReset, disabled = false,
}: {
  value: string;
  autoShade: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-2 py-1.5 transition-all duration-300 ease-in-out hover:bg-white/5"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
        >
          <Label className="text-[11px] text-muted-foreground pointer-events-none">Depth Color</Label>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md border border-white/20" style={{ background: value }} />
            <span className="text-[10px] font-mono text-muted-foreground">{value.toUpperCase()}</span>
          </div>
        </button>
        {!autoShade && (
          <button
            onClick={onReset}
            disabled={disabled}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-primary transition-all duration-300 ease-in-out hover:bg-primary/10"
            title="Use an automatically derived shade"
          >
            <RotateCcw size={11} />
            Auto
          </button>
        )}
      </div>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open && !disabled ? 'max-h-72 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
        <ColorPicker value={value} onChange={onChange} />
      </div>
    </div>
  );
}

export default function ThreeDPanel({ controller }: ThreeDPanelProps) {
  const { state } = useEditor();
  const obj = controller.selectedObject;
  const [expanded, setExpanded] = useState(false);

  console.debug('[ThreeDPanel] Rendering 3D Panel', {
    activeTool: state.activeTool,
    activePanel: state.activePanel,
    selectedObject: obj?.type ?? null,
  });

  const [enabled, setEnabled] = useState(false);
  const [steps, setSteps] = useState(8);
  const [depthColor, setDepthColor] = useState('#777777');
  const [angle, setAngle] = useState(225);
  const [bevel, setBevel] = useState(false);
  const [bevelTaper, setBevelTaper] = useState(20);
  const [darkenIntensity, setDarkenIntensity] = useState(40);
  const [autoShade, setAutoShade] = useState(true);

  const getAutoColor = useCallback((intensity: number) => (
    obj ? darkenColor(getMainFillHex(obj), intensity) : '#777777'
  ), [obj]);

  const syncFromObj = useCallback(() => {
    if (!obj) {
      setEnabled(false);
      setSteps(8);
      setDarkenIntensity(40);
      setAutoShade(true);
      setDepthColor('#777777');
      setAngle(225);
      setBevel(false);
      setBevelTaper(20);
      return;
    }
    const depth = (obj as FabricObject & Record<string, unknown>)._depth3d as Depth3dConfig | undefined;
    if (depth) {
      const nextIntensity = depth.darkenIntensity ?? 40;
      const nextAutoShade = depth.autoShade !== false;
      setEnabled(!!depth.enabled);
      setSteps(depth.steps ?? 8);
      setDarkenIntensity(nextIntensity);
      setAutoShade(nextAutoShade);
      setDepthColor(depth.color || (nextAutoShade ? getAutoColor(nextIntensity) : '#777777'));
      setAngle(depth.angle ?? 225);
      setBevel(!!depth.bevel);
      setBevelTaper(depth.bevelTaper ?? 20);
    } else {
      setEnabled(false);
      setSteps(8);
      setDarkenIntensity(40);
      setAutoShade(true);
      setDepthColor(getAutoColor(40));
      setAngle(225);
      setBevel(false);
      setBevelTaper(20);
    }
  }, [obj, getAutoColor]);

  useEffect(() => {
    syncFromObj();
    setExpanded(false);
  }, [syncFromObj]);

  const applyDepth = useCallback((
    nextEnabled: boolean,
    nextSteps: number,
    nextColor: string,
    nextAngle: number,
    nextBevel: boolean,
    nextTaper: number,
    nextIntensity: number,
    nextAutoShade: boolean,
  ) => {
    if (!obj) return;
    controller.apply3DDepth(obj, nextEnabled ? {
      enabled: true,
      steps: nextSteps,
      color: nextColor,
      angle: nextAngle,
      bevel: nextBevel,
      bevelTaper: nextTaper,
      darkenIntensity: nextIntensity,
      autoShade: nextAutoShade,
    } : null);
    controller.commitChange();
  }, [obj, controller]);

  if (state.activePanel !== 'threeD') return null;

  const updateDepth = (changes: Partial<{
    enabled: boolean;
    steps: number;
    color: string;
    angle: number;
    bevel: boolean;
    bevelTaper: number;
    darkenIntensity: number;
    autoShade: boolean;
  }>) => {
    const next = {
      enabled,
      steps,
      color: depthColor,
      angle,
      bevel,
      bevelTaper,
      darkenIntensity,
      autoShade,
      ...changes,
    };
    applyDepth(
      next.enabled,
      next.steps,
      next.color,
      next.angle,
      next.bevel,
      next.bevelTaper,
      next.darkenIntensity,
      next.autoShade,
    );
  };

  const handleEnabledChange = (nextEnabled: boolean) => {
    setEnabled(nextEnabled);
    if (nextEnabled && autoShade) {
      const nextColor = getAutoColor(darkenIntensity);
      setDepthColor(nextColor);
      updateDepth({ enabled: true, color: nextColor, autoShade: true });
    } else {
      updateDepth({ enabled: nextEnabled });
    }
  };

  const handleStepsChange = (value: number) => {
    setSteps(value);
    updateDepth({ steps: value });
  };

  const handleIntensityChange = (value: number) => {
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

  const resetAutoShade = () => {
    const nextColor = getAutoColor(darkenIntensity);
    setDepthColor(nextColor);
    setAutoShade(true);
    updateDepth({ color: nextColor, autoShade: true });
  };

  return (
    <div
      className="absolute bottom-full left-1/2 z-[9999] mb-2 w-[min(620px,calc(100vw-24px))] -translate-x-1/2"
      data-testid="threed-panel"
    >
      <div
        className={`overflow-hidden rounded-2xl transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-[640px] opacity-100 mb-2' : 'pointer-events-none max-h-0 opacity-0'
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
              <Box size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">3D Extrusion</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Detailed controls</span>
          </div>

          <ColorField
            value={depthColor}
            autoShade={autoShade}
            onChange={handleColorChange}
            onReset={resetAutoShade}
            disabled={!obj}
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{obj ? (autoShade ? 'Auto shade from main fill' : 'Manual depth color override') : 'Select an object to edit 3D depth'}</span>
            <span className="font-mono text-primary">{darkenIntensity}% darker</span>
          </div>
          <SliderRow
            label="Darken Intensity"
            value={darkenIntensity}
            min={0}
            max={100}
            unit="%"
            onChange={handleIntensityChange}
            disabled={!obj || !autoShade}
          />

          <SliderRow
            label="Angle / Direction"
            value={angle}
            min={0}
            max={360}
            unit="°"
            onChange={(value) => { setAngle(value); updateDepth({ angle: value }); }}
            disabled={!obj}
          />
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">Direction</span>
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-white/[0.03]">
              <div
                className="absolute h-[2px] w-5 origin-left bg-primary"
                style={{ transform: `rotate(${angle - 90}deg) translateX(2px)` }}
              />
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            </div>
            <span className="text-[10px] font-mono text-primary">{Math.round(angle)}°</span>
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Bevel Mode</Label>
              <Switch
                checked={bevel}
                onCheckedChange={(value) => { setBevel(value); updateDepth({ bevel: value }); }}
                disabled={!obj}
                data-testid="switch-bevel"
              />
            </div>
            <SliderRow
              label="Bevel Taper"
              value={bevelTaper}
              min={1}
              max={50}
              unit="%"
              onChange={(value) => { setBevelTaper(value); updateDepth({ bevelTaper: value }); }}
              disabled={!obj || !bevel}
            />
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-all duration-300 ease-in-out"
        style={{
          background: '#11141A',
          border: '1px solid rgba(0,245,255,0.3)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
        }}
      >
        <Box size={14} className="shrink-0 text-primary" />
        <span className="shrink-0 text-[10px] font-semibold tracking-wide text-primary">3D DEPTH</span>
        <Switch
          checked={enabled}
          onCheckedChange={handleEnabledChange}
          disabled={!obj}
          aria-label="Toggle 3D Depth Effect"
        />
        <span className="shrink-0 text-[10px] text-muted-foreground">Steps</span>
        <Slider
          min={1}
          max={80}
          step={1}
          value={[steps]}
          onValueChange={([value]) => handleStepsChange(value)}
          disabled={!obj || !enabled}
          className="min-w-0 flex-1"
        />
        <span className="w-6 shrink-0 text-right text-[10px] font-mono text-primary">{steps}</span>
        <button
          onClick={() => setExpanded((open) => !open)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ease-in-out hover:bg-white/10"
          style={{ color: '#00F5FF', background: expanded ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.05)' }}
          aria-label={expanded ? 'Collapse 3D extrusion controls' : 'Expand 3D extrusion controls'}
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
    </div>
  );
}