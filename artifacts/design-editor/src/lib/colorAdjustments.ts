import { Color, FabricImage, FabricObject, Gradient, filters } from 'fabric';

export interface ColorAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  warmth: number;
  tint: number;
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

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  warmth: 0,
  tint: 0,
};

function isColorAdjustments(value: unknown): value is ColorAdjustments {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ColorAdjustments>;
  return ['brightness', 'contrast', 'saturation', 'hue', 'warmth', 'tint']
    .every((key) => Number.isFinite(candidate[key as keyof ColorAdjustments]));
}

function getSavedAdjustments(object: FabricObject): ColorAdjustments | undefined {
  const saved = (object as FabricObject & { _adjustments?: unknown })._adjustments;
  return isColorAdjustments(saved) ? { ...saved } : undefined;
}

function getImageAdjustmentValues(image: FabricImage): ColorAdjustments {
  const result = { ...DEFAULT_COLOR_ADJUSTMENTS };
  for (const filter of image.filters || []) {
    const item = filter as unknown as Record<string, unknown>;
    const type = String(item.type || filter.constructor?.name || '');
    if (type === 'Brightness') result.brightness = Number(item.brightness) || 0;
    else if (type === 'Contrast') result.contrast = Number(item.contrast) || 0;
    else if (type === 'Saturation') result.saturation = Number(item.saturation) || 0;
    else if (type === 'HueRotation') result.hue = Math.round((Number(item.rotation) || 0) * 180 / Math.PI);
  }
  return result;
}

function warmthTintMatrix(adjustments: ColorAdjustments) {
  const warmth = adjustments.warmth * 28;
  const tint = adjustments.tint * 24;
  return [
    1, 0, 0, 0, (warmth + tint) / 255,
    0, 1, 0, 0, ((warmth * 0.08) - tint) / 255,
    0, 0, 1, 0, (-warmth + tint) / 255,
    0, 0, 0, 1, 0,
  ];
}

function approximatelyEqual(first: unknown, second: number) {
  return typeof first === 'number' && Math.abs(first - second) < 0.00001;
}

function isPreviousAdjustmentFilter(
  filter: FabricImage['filters'][number],
  previous: ColorAdjustments,
): boolean {
  const item = filter as unknown as Record<string, unknown>;
  const type = String(item.type || filter.constructor?.name || '');
  if (type === 'Brightness') return approximatelyEqual(item.brightness, previous.brightness);
  if (type === 'Contrast') return approximatelyEqual(item.contrast, previous.contrast);
  if (type === 'Saturation') return approximatelyEqual(item.saturation, previous.saturation);
  if (type === 'HueRotation') return approximatelyEqual(item.rotation, (previous.hue / 180) * Math.PI);
  if (type === 'ColorMatrix' && (previous.warmth !== 0 || previous.tint !== 0)) {
    const actual = item.matrix;
    const expected = warmthTintMatrix(previous);
    return Array.isArray(actual)
      && actual.length === expected.length
      && actual.every((value, index) => approximatelyEqual(value, expected[index]));
  }
  return false;
}

function applyImageColorAdjustment(image: FabricImage, adjustments: ColorAdjustments) {
  const extended = image as FabricImage & { _adjustments?: ColorAdjustments; setDirty?: (dirty?: boolean) => void };
  const previous = getSavedAdjustments(image) ?? getImageAdjustmentValues(image);
  const preservedFilters = (image.filters || []).filter((filter) => !isPreviousAdjustmentFilter(filter, previous));
  const adjustmentFilters = [];

  if (adjustments.brightness !== 0) adjustmentFilters.push(new filters.Brightness({ brightness: adjustments.brightness }));
  if (adjustments.contrast !== 0) adjustmentFilters.push(new filters.Contrast({ contrast: adjustments.contrast }));
  if (adjustments.saturation !== 0) adjustmentFilters.push(new filters.Saturation({ saturation: adjustments.saturation }));
  if (adjustments.hue !== 0) adjustmentFilters.push(new filters.HueRotation({ rotation: (adjustments.hue / 180) * Math.PI }));
  if (adjustments.warmth !== 0 || adjustments.tint !== 0) {
    adjustmentFilters.push(new filters.ColorMatrix({ matrix: warmthTintMatrix(adjustments) as any, colorsOnly: true }));
  }

  image.filters = [...preservedFilters, ...adjustmentFilters];
  image.applyFilters();
  extended._adjustments = { ...adjustments };
  extended.dirty = true;
  extended.setDirty?.(true);
}

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
    const warmth = adjustments.warmth * 28;
    const tint = adjustments.tint * 24;
    const adjustedRed = clamp(nextRed + warmth + tint, 0, 255);
    const adjustedGreen = clamp(nextGreen + (warmth * 0.08) - tint, 0, 255);
    const adjustedBlue = clamp(nextBlue - warmth + tint, 0, 255);

    return `rgba(${Math.round(adjustedRed)},${Math.round(adjustedGreen)},${Math.round(adjustedBlue)},${clamp(alpha).toFixed(3)})`;
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

/**
 * Apply adjustments to an object and all nested members. ActiveSelection is a
 * temporary Fabric wrapper, so only its members receive persistent metadata.
 */
export function applyColorAdjustmentTree(root: FabricObject, adjustments: ColorAdjustments) {
  const visit = (object: FabricObject) => {
    if (object.type !== 'activeSelection') {
      applyObjectColorAdjustment(object, adjustments);
      if (object.type === 'image') applyImageColorAdjustment(object as FabricImage, adjustments);
      else (object as FabricObject & { _adjustments?: ColorAdjustments })._adjustments = { ...adjustments };
      (object as FabricObject & { dirty?: boolean; setDirty?: (dirty?: boolean) => void }).dirty = true;
      (object as FabricObject & { setDirty?: (dirty?: boolean) => void }).setDirty?.(true);
    }

    const getObjects = (object as FabricObject & { getObjects?: () => FabricObject[] }).getObjects;
    getObjects?.call(object).forEach(visit);
  };

  visit(root);
}

export function readColorAdjustments(root: FabricObject | null): ColorAdjustments {
  if (!root) return { ...DEFAULT_COLOR_ADJUSTMENTS };
  let found: ColorAdjustments | undefined;
  const visit = (object: FabricObject) => {
    if (found) return;
    found = getSavedAdjustments(object);
    if (!found && object.type === 'image') found = getImageAdjustmentValues(object as FabricImage);
    const getObjects = (object as FabricObject & { getObjects?: () => FabricObject[] }).getObjects;
    getObjects?.call(object).forEach(visit);
  };
  visit(root);
  return found ? { ...found } : { ...DEFAULT_COLOR_ADJUSTMENTS };
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