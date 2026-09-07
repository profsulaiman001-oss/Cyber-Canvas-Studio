import { Color, FabricObject, Gradient } from 'fabric';

export interface ColorAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
}

interface GradientConfigSnapshot {
  type?: 'linear' | 'radial' | 'angular';
  stops: Array<{ offset: number; color: string; [key: string]: unknown }>;
  radialRadius?: number | null;
  angleDeg?: number;
  origin?: { x: number; y: number };
  [key: string]: unknown;
}

type PaintSnapshot =
  | { kind: 'none' }
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; value: Record<string, unknown> }
  | { kind: 'unchanged' };

export interface ObjectColorAdjustmentBaseline {
  version: 1;
  fill: PaintSnapshot;
  stroke: PaintSnapshot;
  gradientConfig?: GradientConfigSnapshot;
}

const NO_CHANGE = Symbol('color-adjustment-no-change');

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function cloneGradientConfig(config: unknown): GradientConfigSnapshot | undefined {
  if (!config || typeof config !== 'object') return undefined;
  const source = config as Record<string, unknown>;
  if (!Array.isArray(source.stops)) return undefined;

  const stops = source.stops
    .filter((stop): stop is Record<string, unknown> => Boolean(stop && typeof stop === 'object'))
    .map((stop) => ({
      ...stop,
      offset: Number(stop.offset) || 0,
      color: typeof stop.color === 'string' ? stop.color : '#000000',
    }));

  if (stops.length === 0) return undefined;

  return {
    ...source,
    type: source.type === 'angular' || source.type === 'radial' ? source.type : 'linear',
    stops,
    origin: source.origin && typeof source.origin === 'object'
      ? { ...(source.origin as { x?: number; y?: number }), x: Number((source.origin as { x?: number }).x) || 0.5, y: Number((source.origin as { y?: number }).y) || 0.5 }
      : undefined,
  };
}

function capturePaint(paint: unknown): PaintSnapshot {
  if (paint == null) return { kind: 'none' };
  if (typeof paint === 'string') return { kind: 'solid', color: paint };

  if (
    typeof paint === 'object'
    && Array.isArray((paint as { colorStops?: unknown }).colorStops)
  ) {
    const gradient = paint as {
      colorStops: Array<{ offset?: number; color?: string; [key: string]: unknown }>;
      toObject?: () => Record<string, unknown>;
    };
    const serialized = gradient.toObject ? gradient.toObject() : { ...gradient };
    return {
      kind: 'gradient',
      value: {
        ...serialized,
        colorStops: gradient.colorStops.map((stop) => ({
          ...stop,
          offset: Number(stop.offset) || 0,
          color: typeof stop.color === 'string' ? stop.color : '#000000',
        })),
      },
    };
  }

  // Patterns and custom paint objects are intentionally left untouched. They
  // are not safely reconstructible from a serializable color snapshot.
  return { kind: 'unchanged' };
}

function paintFromSnapshot(snapshot: PaintSnapshot): unknown | typeof NO_CHANGE {
  if (snapshot.kind === 'none') return null;
  if (snapshot.kind === 'solid') return snapshot.color;
  if (snapshot.kind === 'gradient') return new Gradient(snapshot.value as any);
  return NO_CHANGE;
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / delta) % 6; break;
      case g: h = (b - r) / delta + 2; break;
      default: h = (r - g) / delta + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation);
  const l = clamp(lightness);
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const [r1, g1, b1] = segment < 1
    ? [chroma, x, 0]
    : segment < 2
      ? [x, chroma, 0]
      : segment < 3
        ? [0, chroma, x]
        : segment < 4
          ? [0, x, chroma]
          : segment < 5
            ? [x, 0, chroma]
            : [chroma, 0, x];
  const match = l - (chroma / 2);
  return [
    Math.round((r1 + match) * 255),
    Math.round((g1 + match) * 255),
    Math.round((b1 + match) * 255),
  ] as const;
}

export function transformColor(color: string, adjustments: ColorAdjustments) {
  try {
    const source = new Color(color).getSource();
    if (!source || source.length < 3) return color;

    const [red, green, blue, alpha = 1] = source;
    const hsl = rgbToHsl(red, green, blue);
    const brightnessAdjustedLightness = clamp(hsl.l + (adjustments.brightness * 0.5));
    const contrastAdjustedLightness = clamp(
      ((brightnessAdjustedLightness - 0.5) * (1 + adjustments.contrast)) + 0.5,
    );
    const saturation = clamp(hsl.s * (1 + adjustments.saturation));
    const hue = hsl.h + adjustments.hue;
    const [nextRed, nextGreen, nextBlue] = hslToRgb(hue, saturation, contrastAdjustedLightness);

    return `rgba(${nextRed},${nextGreen},${nextBlue},${clamp(alpha).toFixed(3)})`;
  } catch {
    return color;
  }
}

function transformPaint(snapshot: PaintSnapshot, adjustments: ColorAdjustments): unknown | typeof NO_CHANGE {
  if (snapshot.kind === 'solid') return transformColor(snapshot.color, adjustments);
  if (snapshot.kind === 'gradient') {
    const value = snapshot.value;
    const colorStops = Array.isArray(value.colorStops)
      ? value.colorStops.map((stop) => {
        const item = stop as { color?: string; [key: string]: unknown };
        return {
          ...item,
          color: typeof item.color === 'string' ? transformColor(item.color, adjustments) : '#000000',
        };
      })
      : [];
    return new Gradient({ ...value, colorStops } as any);
  }
  return paintFromSnapshot(snapshot);
}

export function walkObjectTree(root: FabricObject, visit: (object: FabricObject) => void) {
  visit(root);
  const getObjects = (root as FabricObject & { getObjects?: () => FabricObject[] }).getObjects;
  if (!getObjects) return;
  for (const child of getObjects.call(root)) walkObjectTree(child, visit);
}

export function ensureObjectColorBaseline(object: FabricObject): ObjectColorAdjustmentBaseline {
  const extended = object as FabricObject & {
    _adjustmentBase?: ObjectColorAdjustmentBaseline;
    _gradientConfig?: unknown;
  };
  if (extended._adjustmentBase?.version === 1) return extended._adjustmentBase;

  const baseline: ObjectColorAdjustmentBaseline = {
    version: 1,
    fill: capturePaint(object.fill),
    stroke: capturePaint(object.stroke),
    gradientConfig: cloneGradientConfig(extended._gradientConfig),
  };
  extended._adjustmentBase = baseline;
  return baseline;
}

export function applyObjectColorAdjustment(object: FabricObject, adjustments: ColorAdjustments) {
  const baseline = ensureObjectColorBaseline(object);
  const fill = transformPaint(baseline.fill, adjustments);
  const stroke = transformPaint(baseline.stroke, adjustments);
  if (fill !== NO_CHANGE) object.set('fill', fill as any);
  if (stroke !== NO_CHANGE) object.set('stroke', stroke as any);
  object.setCoords();
  return baseline;
}

export function getAdjustedGradientConfig(object: FabricObject, adjustments: ColorAdjustments) {
  const baseline = ensureObjectColorBaseline(object);
  if (!baseline.gradientConfig) return undefined;
  return {
    ...baseline.gradientConfig,
    stops: baseline.gradientConfig.stops.map((stop) => ({
      ...stop,
      color: transformColor(stop.color, adjustments),
    })),
  };
}

export function restoreObjectColorBaseline(object: FabricObject) {
  const baseline = ensureObjectColorBaseline(object);
  const fill = paintFromSnapshot(baseline.fill);
  const stroke = paintFromSnapshot(baseline.stroke);
  if (fill !== NO_CHANGE) object.set('fill', fill as any);
  if (stroke !== NO_CHANGE) object.set('stroke', stroke as any);
  object.setCoords();
  return baseline;
}

export function getBaselineGradientConfig(object: FabricObject) {
  return ensureObjectColorBaseline(object).gradientConfig;
}