import { useCallback, useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject, Shadow } from 'fabric';
import {
  ChevronDown,
  ChevronUp,
  Droplets,
  Eye,
  Layers2,
  Layers3,
  MoveHorizontal,
  MoveVertical,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ShadowSettingsModal, { type ShadowMode } from './ShadowSettingsModal';

interface ShadowsPanelProps {
  controller: CanvasController;
}

type ShadowParameter = 'blur' | 'offsetX' | 'offsetY' | 'opacity';

const SHADOW_PARAMETERS: Array<{
  key: ShadowParameter;
  label: string;
  icon: LucideIcon;
  min: number;
  max: number;
  unit: string;
}> = [
  { key: 'blur', label: 'Blur', icon: Droplets, min: 0, max: 100, unit: '' },
  { key: 'offsetX', label: 'Offset X', icon: MoveHorizontal, min: -100, max: 100, unit: '' },
  { key: 'offsetY', label: 'Offset Y', icon: MoveVertical, min: -100, max: 100, unit: '' },
  { key: 'opacity', label: 'Opacity', icon: Eye, min: 0, max: 100, unit: '%' },
];

function parseColorToHex(color: string): string {
  if (!color) return '#000000';
  if (color.startsWith('#')) {
    const value = color.replace('#', '');
    const expanded = value.length === 3
      ? value.split('').map((character) => character + character).join('')
      : value.slice(0, 6);
    return `#${expanded.toLowerCase().padEnd(6, '0')}`;
  }
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (match) {
    return `#${[match[1], match[2], match[3]]
      .map((value) => Math.max(0, Math.min(255, parseInt(value, 10))).toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return '#000000';
}

function parseAlphaPercent(color: string): number {
  if (!color || !color.startsWith('rgba')) return 80;
  const match = color.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/i);
  return match ? Math.round(Math.max(0, Math.min(1, parseFloat(match[1]))) * 100) : 80;
}

function hexToRgba(hex: string, opacityPercent: number): string {
  const value = hex.replace('#', '');
  const expanded = value.length === 3
    ? value.split('').map((character) => character + character).join('')
    : value.slice(0, 6).padEnd(6, '0');
  const red = parseInt(expanded.slice(0, 2), 16) || 0;
  const green = parseInt(expanded.slice(2, 4), 16) || 0;
  const blue = parseInt(expanded.slice(4, 6), 16) || 0;
  const alpha = Math.max(0, Math.min(1, opacityPercent / 100)).toFixed(3);
  return `rgba(${red},${green},${blue},${alpha})`;
}

export default function ShadowsPanel({ controller }: ShadowsPanelProps) {
  const { state } = useEditor();
  const obj = controller.selectedObject;
  const isImage = obj?.type === 'image';
  const [activeShadowMode, setActiveShadowMode] = useState<ShadowMode>('drop');
  const [activeParameter, setActiveParameter] = useState<ShadowParameter>('blur');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [parameterMenuOpen, setParameterMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [dropEnabled, setDropEnabled] = useState(false);
  const [dropColor, setDropColor] = useState('#000000');
  const [dropBlur, setDropBlur] = useState(10);
  const [dropOffX, setDropOffX] = useState(5);
  const [dropOffY, setDropOffY] = useState(5);
  const [dropOpacity, setDropOpacity] = useState(80);

  const [innerEnabled, setInnerEnabled] = useState(false);
  const [innerColor, setInnerColor] = useState('#000000');
  const [innerBlur, setInnerBlur] = useState(15);
  const [innerOffX, setInnerOffX] = useState(0);
  const [innerOffY, setInnerOffY] = useState(0);
  const [innerOpacity, setInnerOpacity] = useState(60);

  const syncFromObj = useCallback(() => {
    if (!obj) return;
    const object = obj as FabricObject & Record<string, unknown>;
    const shadow = object.shadow as Shadow | null;
    const glow = object._glow as { enabled?: boolean } | undefined;

    if (shadow && !glow?.enabled && (shadow.offsetX !== 0 || shadow.offsetY !== 0 || shadow.blur !== 0)) {
      setDropEnabled(true);
      setDropColor(parseColorToHex(shadow.color || '#000000'));
      setDropOpacity(parseAlphaPercent(shadow.color || 'rgba(0,0,0,0.8)'));
      setDropBlur(shadow.blur || 10);
      setDropOffX(shadow.offsetX || 5);
      setDropOffY(shadow.offsetY || 5);
    } else {
      setDropEnabled(false);
    }

    const inner = object._innerShadow as {
      enabled?: boolean;
      color?: string;
      blur?: number;
      offsetX?: number;
      offsetY?: number;
      opacity?: number;
    } | undefined;
    if (inner) {
      setInnerEnabled(!!inner.enabled);
      setInnerColor(parseColorToHex(inner.color || '#000000'));
      setInnerBlur(inner.blur ?? 15);
      setInnerOffX(inner.offsetX ?? 0);
      setInnerOffY(inner.offsetY ?? 0);
      setInnerOpacity(inner.opacity ?? 60);
    } else {
      setInnerEnabled(false);
    }
  }, [obj]);

  useEffect(() => {
    syncFromObj();
    setExpanded(false);
    setModeMenuOpen(false);
    setParameterMenuOpen(false);
  }, [syncFromObj]);

  const applyDropShadow = useCallback((
    enabled: boolean,
    color: string,
    blur: number,
    offsetX: number,
    offsetY: number,
    opacity: number,
  ) => {
    if (!obj) return;
    const multiplier = isImage ? 2 : 1;
    obj.set('shadow', enabled ? new Shadow({
      color: hexToRgba(color, opacity),
      blur: blur * multiplier,
      offsetX: offsetX * multiplier,
      offsetY: offsetY * multiplier,
    }) : null);
    // Fabric can cache shadowed objects; invalidate before the immediate render.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).setDirty?.(true);
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
  }, [obj, controller, isImage]);

  const applyInnerShadow = useCallback((
    enabled: boolean,
    color: string,
    blur: number,
    offsetX: number,
    offsetY: number,
    opacity: number,
  ) => {
    controller.applyInnerShadow(obj, enabled ? { enabled: true, color, blur, offsetX, offsetY, opacity } : null);
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
  }, [obj, controller]);

  if (!obj || state.activePanel !== 'shadows') return null;

  const isDrop = activeShadowMode === 'drop';
  const activeEnabled = isDrop ? dropEnabled : innerEnabled;
  const activeLabel = isDrop ? 'Drop Shadow' : 'Inner Shadow';
  const ActiveShadowIcon = isDrop ? Layers3 : Layers2;
  const activeParameterOption = SHADOW_PARAMETERS.find(({ key }) => key === activeParameter) ?? SHADOW_PARAMETERS[0];
  const activeParameterValue = isDrop
    ? { blur: dropBlur, offsetX: dropOffX, offsetY: dropOffY, opacity: dropOpacity }[activeParameter]
    : { blur: innerBlur, offsetX: innerOffX, offsetY: innerOffY, opacity: innerOpacity }[activeParameter];

  const setActiveEnabled = (enabled: boolean) => {
    if (isDrop) {
      setDropEnabled(enabled);
      applyDropShadow(enabled, dropColor, dropBlur, dropOffX, dropOffY, dropOpacity);
    } else {
      setInnerEnabled(enabled);
      applyInnerShadow(enabled, innerColor, innerBlur, innerOffX, innerOffY, innerOpacity);
    }
  };

  const setShadowParameterValue = (mode: ShadowMode, parameter: ShadowParameter, value: number) => {
    if (mode === 'drop') {
      if (parameter === 'blur') {
        setDropBlur(value);
        applyDropShadow(true, dropColor, value, dropOffX, dropOffY, dropOpacity);
      } else if (parameter === 'offsetX') {
        setDropOffX(value);
        applyDropShadow(true, dropColor, dropBlur, value, dropOffY, dropOpacity);
      } else if (parameter === 'offsetY') {
        setDropOffY(value);
        applyDropShadow(true, dropColor, dropBlur, dropOffX, value, dropOpacity);
      } else {
        setDropOpacity(value);
        applyDropShadow(true, dropColor, dropBlur, dropOffX, dropOffY, value);
      }
    } else if (parameter === 'blur') {
      setInnerBlur(value);
      applyInnerShadow(true, innerColor, value, innerOffX, innerOffY, innerOpacity);
    } else if (parameter === 'offsetX') {
      setInnerOffX(value);
      applyInnerShadow(true, innerColor, innerBlur, value, innerOffY, innerOpacity);
    } else if (parameter === 'offsetY') {
      setInnerOffY(value);
      applyInnerShadow(true, innerColor, innerBlur, innerOffX, value, innerOpacity);
    } else {
      setInnerOpacity(value);
      applyInnerShadow(true, innerColor, innerBlur, innerOffX, innerOffY, value);
    }
  };

  const setActiveColor = (value: string) => {
    const color = parseColorToHex(value);
    if (isDrop) {
      setDropColor(color);
      applyDropShadow(true, color, dropBlur, dropOffX, dropOffY, dropOpacity);
    } else {
      setInnerColor(color);
      applyInnerShadow(true, color, innerBlur, innerOffX, innerOffY, innerOpacity);
    }
  };

  return (
    <div
      className="absolute bottom-full left-1/2 z-[9999] mb-2 w-[min(720px,calc(100vw-20px))] -translate-x-1/2"
      data-testid="shadows-panel"
    >
      <ShadowSettingsModal
        expanded={expanded}
        mode={activeShadowMode}
        enabled={activeEnabled}
        color={isDrop ? dropColor : innerColor}
        blur={isDrop ? dropBlur : innerBlur}
        offsetX={isDrop ? dropOffX : innerOffX}
        offsetY={isDrop ? dropOffY : innerOffY}
        opacity={isDrop ? dropOpacity : innerOpacity}
        onModeChange={setActiveShadowMode}
        onEnabledChange={setActiveEnabled}
        onColorChange={setActiveColor}
        onBlurChange={(value) => setShadowParameterValue(activeShadowMode, 'blur', value)}
        onOffsetXChange={(value) => setShadowParameterValue(activeShadowMode, 'offsetX', value)}
        onOffsetYChange={(value) => setShadowParameterValue(activeShadowMode, 'offsetY', value)}
        onOpacityChange={(value) => setShadowParameterValue(activeShadowMode, 'opacity', value)}
      />

      <div
        className="flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2.5"
        style={{
          background: '#11141A',
          backdropFilter: 'blur(18px)',
          borderColor: 'rgba(0,245,255,0.3)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
        }}
        data-testid="shadow-mini-bar"
      >
        <DropdownMenu
          open={modeMenuOpen}
          onOpenChange={(open) => {
            setModeMenuOpen(open);
            if (open) setParameterMenuOpen(false);
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-12 max-w-[48px] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Shadow type: ${activeLabel}`}
              title={activeLabel}
              data-testid="shadow-mode-trigger"
            >
              <ActiveShadowIcon size={14} aria-hidden="true" />
              <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-52 border-cyan-400/20 bg-[#11141A] text-foreground"
            data-testid="shadow-mode-menu"
          >
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">Shadow Type</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            {([
              { key: 'drop' as const, label: 'Drop Shadow', icon: Layers3 },
              { key: 'inner' as const, label: 'Inner Shadow', icon: Layers2 },
            ]).map(({ key, label, icon: Icon }) => {
              const selected = activeShadowMode === key;
              return (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => setActiveShadowMode(key)}
                  className={`gap-2 text-xs focus:bg-primary/10 focus:text-foreground ${selected ? 'text-primary' : 'text-foreground'}`}
                  aria-current={selected ? 'true' : undefined}
                  data-testid={`shadow-mode-option-${key}`}
                >
                  <Icon size={14} className="shrink-0 text-primary" aria-hidden="true" />
                  <span>{label}</span>
                  <span className="ml-auto flex h-2 w-2 items-center justify-center" aria-hidden="true">
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_7px_rgba(0,245,255,0.95)]" />}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Switch
          checked={activeEnabled}
          onCheckedChange={setActiveEnabled}
          aria-label={`Toggle ${activeLabel}`}
          data-testid="shadow-enabled-toggle"
        />

        <DropdownMenu
          open={parameterMenuOpen}
          onOpenChange={(open) => {
            setParameterMenuOpen(open);
            if (open) setModeMenuOpen(false);
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-12 max-w-[48px] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Shadow parameter: ${activeParameterOption.label}`}
              title={activeParameterOption.label}
              data-testid="shadow-parameter-trigger"
            >
              <activeParameterOption.icon size={14} aria-hidden="true" />
              <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-52 border-cyan-400/20 bg-[#11141A] text-foreground"
            data-testid="shadow-parameter-menu"
          >
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">Shadow Parameter</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            {SHADOW_PARAMETERS.map((parameter) => {
              const selected = activeParameter === parameter.key;
              const value = isDrop
                ? { blur: dropBlur, offsetX: dropOffX, offsetY: dropOffY, opacity: dropOpacity }[parameter.key]
                : { blur: innerBlur, offsetX: innerOffX, offsetY: innerOffY, opacity: innerOpacity }[parameter.key];
              const Icon = parameter.icon;
              return (
                <DropdownMenuItem
                  key={parameter.key}
                  onSelect={() => setActiveParameter(parameter.key)}
                  className={`gap-2 text-xs focus:bg-primary/10 focus:text-foreground ${selected ? 'text-primary' : 'text-foreground'}`}
                  aria-current={selected ? 'true' : undefined}
                  data-testid={`shadow-parameter-option-${parameter.key}`}
                >
                  <Icon size={14} className="shrink-0 text-primary" aria-hidden="true" />
                  <span>{parameter.label}</span>
                  <span className="ml-auto font-mono text-[10px] tabular-nums">{value}{parameter.unit}</span>
                  <span className="flex h-2 w-2 items-center justify-center" aria-hidden="true">
                    {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_7px_rgba(0,245,255,0.95)]" />}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="min-w-0 flex-1">
          <Slider
            min={activeParameterOption.min}
            max={activeParameterOption.max}
            step={1}
            value={[activeParameterValue]}
            onValueChange={([value]) => setShadowParameterValue(activeShadowMode, activeParameter, value)}
            disabled={!activeEnabled}
            className="w-full"
            aria-label={`${activeLabel} ${activeParameterOption.label}`}
            data-testid={`shadow-slider-${activeParameter}`}
          />
        </div>
        <span
          className="min-w-[42px] shrink-0 text-right font-mono text-[10px] tabular-nums text-primary"
          data-testid="shadow-active-value"
        >
          {activeParameterValue}{activeParameterOption.unit}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={expanded ? 'Collapse shadow controls' : 'Expand shadow controls'}
          aria-expanded={expanded}
          data-testid="shadow-studio-toggle"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
    </div>
  );
}