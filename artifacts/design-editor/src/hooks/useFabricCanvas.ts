import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Canvas,
  Rect,
  Circle,
  Triangle,
  Line,
  IText,
  Textbox,
  FabricImage,
  Path,
  Group,
  Shadow,
  Point,
  FabricObject,
  ActiveSelection,
  Gradient,
  Pattern,
  PencilBrush,
  util,
  filters,
} from 'fabric';

/* ── Color utilities for decoupled fill / stroke opacity ─────────────────── */
/**
 * Parse any CSS color to its RGB triple, preserving the original RGB even
 * when the existing alpha is 0.  The canvas-based approach fails for zero-alpha
 * colors because the browser composites against the clear background and
 * getImageData returns [0,0,0,0] → RGB is lost as black.  We therefore parse
 * rgba/rgb strings directly first, and only fall back to canvas for named
 * colors and hex values where alpha is never an issue.
 */
function _cssColorToRgb(cssColor: string): [number, number, number] | null {
  if (!cssColor) return null;
  // Direct parse for rgb/rgba — avoids canvas black-on-zero-alpha bug
  const rgbaMatch = cssColor.match(
    /rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (rgbaMatch) {
    return [
      Math.round(parseFloat(rgbaMatch[1])),
      Math.round(parseFloat(rgbaMatch[2])),
      Math.round(parseFloat(rgbaMatch[3])),
    ];
  }
  // Fallback: canvas render for hex / named colors (these always have full alpha)
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  } catch { return null; }
}
/** Extract the alpha component from a CSS color string (defaults to 1). */
export function extractColorAlpha(cssColor: string): number {
  const m = cssColor?.match?.(/rgba\s*\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/i);
  return m ? Math.max(0, Math.min(1, parseFloat(m[1]))) : 1;
}
/** Rebuild a CSS color string with a new alpha channel. */
export function withAlpha(cssColor: string, alpha: number): string {
  const rgb = _cssColorToRgb(cssColor);
  if (!rgb) return cssColor;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}
/** Strip alpha from a color, returning an opaque `rgb(...)` string. */
export function opaqueColor(cssColor: string): string {
  const rgb = _cssColorToRgb(cssColor);
  if (!rgb) return cssColor;
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

export type GradientFillType = 'linear' | 'radial' | 'angular';

interface GradientOrigin {
  x: number;
  y: number;
}

interface ParsedGradientStop {
  offset: number;
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

function cssColorToRgba(cssColor: string): [number, number, number, number] {
  const trimmed = cssColor.trim();
  const hex = trimmed.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    const value = hex[1];
    const expanded = value.length === 3 || value.length === 4
      ? value.split('').map((part) => part + part).join('')
      : value;
    if (expanded.length === 6 || expanded.length === 8) {
      return [
        parseInt(expanded.slice(0, 2), 16),
        parseInt(expanded.slice(2, 4), 16),
        parseInt(expanded.slice(4, 6), 16),
        expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      ];
    }
  }
  const rgbMatch = trimmed.match(
    /rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i,
  );
  if (rgbMatch) {
    return [
      Math.max(0, Math.min(255, Math.round(parseFloat(rgbMatch[1])))),
      Math.max(0, Math.min(255, Math.round(parseFloat(rgbMatch[2])))),
      Math.max(0, Math.min(255, Math.round(parseFloat(rgbMatch[3])))),
      rgbMatch[4] === undefined ? 1 : Math.max(0, Math.min(1, parseFloat(rgbMatch[4]))),
    ];
  }
  const rgb = _cssColorToRgb(trimmed) ?? [0, 0, 0];
  return [rgb[0], rgb[1], rgb[2], extractColorAlpha(trimmed)];
}

function prepareGradientStops(stops: { offset: number; color: string }[]): ParsedGradientStop[] {
  return stops
    .map((stop) => {
      const [red, green, blue, alpha] = cssColorToRgba(stop.color);
      return {
        offset: Math.max(0, Math.min(1, stop.offset)),
        red,
        green,
        blue,
        alpha,
      };
    })
    .sort((a, b) => a.offset - b.offset);
}

function colorAtGradientPosition(
  stops: ParsedGradientStop[],
  position: number,
): [number, number, number, number] {
  if (!stops.length) return [0, 0, 0, 1];
  if (position <= stops[0].offset) {
    const first = stops[0];
    return [first.red, first.green, first.blue, first.alpha];
  }
  if (position >= stops[stops.length - 1].offset) {
    const last = stops[stops.length - 1];
    return [last.red, last.green, last.blue, last.alpha];
  }

  for (let index = 0; index < stops.length - 1; index += 1) {
    const first = stops[index];
    const second = stops[index + 1];
    if (position >= first.offset && position <= second.offset) {
      const span = second.offset - first.offset;
      const ratio = span === 0 ? 0 : (position - first.offset) / span;
      return [
        Math.round(first.red + (second.red - first.red) * ratio),
        Math.round(first.green + (second.green - first.green) * ratio),
        Math.round(first.blue + (second.blue - first.blue) * ratio),
        first.alpha + (second.alpha - first.alpha) * ratio,
      ];
    }
  }
  const last = stops[stops.length - 1];
  return [last.red, last.green, last.blue, last.alpha];
}

/**
 * Fabric has native linear and radial gradients, but no conical gradient.
 * Render the sweep into a small reusable canvas and scale it to the object.
 * This keeps Angular gradients editable without replacing Fabric's object model.
 */
function createAngularGradientCanvas(
  width: number,
  height: number,
  stops: { offset: number; color: string }[],
  angleDeg: number,
  origin: GradientOrigin,
): HTMLCanvasElement {
  const maxDimension = 384;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const renderWidth = Math.max(2, Math.round(width * scale));
  const renderHeight = Math.max(2, Math.round(height * scale));
  const gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = renderWidth;
  gradientCanvas.height = renderHeight;
  const context = gradientCanvas.getContext('2d');
  if (!context) return gradientCanvas;

  const image = context.createImageData(renderWidth, renderHeight);
  const originX = Math.max(0, Math.min(1, origin.x)) * renderWidth;
  const originY = Math.max(0, Math.min(1, origin.y)) * renderHeight;
  const normalizedAngle = ((angleDeg % 360) + 360) % 360;
  const parsedStops = prepareGradientStops(stops);

  for (let y = 0; y < renderHeight; y += 1) {
    for (let x = 0; x < renderWidth; x += 1) {
      const theta = (Math.atan2(y - originY, x - originX) * 180) / Math.PI;
      const position = (((theta - normalizedAngle) % 360) + 360) % 360 / 360;
      const [red, green, blue, alpha] = colorAtGradientPosition(parsedStops, position);
      const pixel = (y * renderWidth + x) * 4;
      image.data[pixel] = red;
      image.data[pixel + 1] = green;
      image.data[pixel + 2] = blue;
      image.data[pixel + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(image, 0, 0);
  return gradientCanvas;
}

export interface ObjectMeta {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  selectable: boolean;
  fill?: string;
  stroke?: string;
  opacity: number;
  imgSrc?: string;
  thumbnailSrc?: string;
}

export interface CanvasBgConfig {
  type: 'solid' | 'transparent' | 'gradient';
  color: string;
  gradientType: 'linear' | 'radial';
  gradientStops: { offset: number; color: string }[];
}

export type AlignType = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV';
export type BrushPreset = 'standard' | 'glow' | 'airbrush';

export interface DragInfo {
  w: number; h: number; angle: number; clientX: number; clientY: number;
}

interface UseFabricCanvasOptions {
  width: number;
  height: number;
  onSelectionChange: (ids: string[]) => void;
  onCanvasChanged: () => void;
  onUndoRedoChange: (canUndo: boolean, canRedo: boolean) => void;
}

export interface PenPoint {
  x: number;
  y: number;
  /** Outgoing bezier control handle (absolute design coords). Null = corner/straight. */
  cpOut?: { x: number; y: number };
  /** Incoming bezier control handle (mirrored from drag, absolute design coords). */
  cpIn?: { x: number; y: number };
}

export interface VectorAnchor {
  cmdIdx: number;
  xOff: number;
  yOff: number;
  localX: number;
  localY: number;
  screenX: number;
  screenY: number;
  kind: 'anchor' | 'handle';
  pairScreenX: number | null;
  pairScreenY: number | null;
  /** Local coords of the anchor this handle belongs to (for mirror math) */
  anchorLocalX?: number;
  anchorLocalY?: number;
  /** Sibling handle location in path for Photoshop-style symmetric mirroring */
  mirrorCmdIdx?: number;
  mirrorXOff?: number;
  mirrorYOff?: number;
}

const MAX_UNDO = 50;
const EXTRA_PROPS = ['_uid', '_name', '_innerShadow', '_textureKey', '_depth3d', '_glow', '_gradientConfig'];
let objectSeq: Record<string, number> = {};

function nextName(type: string): string {
  objectSeq[type] = (objectSeq[type] || 0) + 1;
  const labels: Record<string, string> = {
    rect: 'Rectangle', circle: 'Circle', triangle: 'Triangle',
    line: 'Line', path: 'Path', 'i-text': 'Text', image: 'Image',
    star: 'Star', hexagon: 'Hexagon', pentagon: 'Pentagon',
    heart: 'Heart', arrow: 'Arrow', brush: 'Brush Stroke',
  };
  return `${labels[type] || type} ${objectSeq[type]}`;
}

function objId(obj: FabricObject): string {
  if (!obj.get('_uid')) {
    (obj as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
  return (obj as FabricObject & { _uid: string })._uid;
}

/* Render the actual Fabric object into a transparent preview. Unlike a CSS
 * swatch, this preserves gradients, patterns, strokes, opacity, filters, and
 * image textures. Keep the background transparent: the panel supplies its own
 * dark preview surface instead of baking a grey checkerboard into the image. */
function renderLayerThumbnail(obj: FabricObject): string | undefined {
  try {
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const scaledW = Math.max(1, obj.getScaledWidth());
    const scaledH = Math.max(1, obj.getScaledHeight());
    const fit = Math.min((size - 14) / scaledW, (size - 14) / scaledH);
    const scaleX = fit * Math.max(0.001, Math.abs(obj.scaleX ?? 1)) * (obj.flipX ? -1 : 1);
    const scaleY = fit * Math.max(0.001, Math.abs(obj.scaleY ?? 1)) * (obj.flipY ? -1 : 1);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(((obj.angle ?? 0) * Math.PI) / 180);
    ctx.scale(scaleX, scaleY);
    ctx.globalAlpha = Math.max(0, Math.min(1, obj.opacity ?? 1));

    const render = (obj as FabricObject & {
      _render?: (renderCtx: CanvasRenderingContext2D) => void;
    })._render;
    if (!render) {
      ctx.restore();
      return undefined;
    }
    render.call(obj, ctx);
    ctx.restore();
    return canvas.toDataURL('image/png');
  } catch {
    return undefined;
  }
}

function visualSignature(obj: FabricObject): string {
  const o = obj as FabricObject & Record<string, unknown>;
  let fill = String(o.fill ?? '');
  try { fill = JSON.stringify(o.fill); } catch { /* use String fallback */ }
  let imageSource = '';
  if (obj.type === 'image') {
    try {
      const getElement = o.getElement as (() => HTMLImageElement) | undefined;
      const element = getElement?.();
      imageSource = element?.currentSrc || element?.src || '';
    } catch { /* image may not be decoded yet */ }
  }
  return [
    objId(obj),
    obj.type,
    fill,
    String(o.stroke ?? ''),
    String(o.strokeWidth ?? ''),
    String(o.opacity ?? 1),
    String(o.text ?? ''),
    String(o._textureKey ?? ''),
    imageSource,
    String(o.width ?? ''),
    String(o.height ?? ''),
    String(o.scaleX ?? ''),
    String(o.scaleY ?? ''),
    String(o.angle ?? ''),
    String(o.flipX ?? ''),
    String(o.flipY ?? ''),
  ].join('|');
}

function tagObj(obj: FabricObject, nameKey: string) {
  (obj as FabricObject & { _name: string })._name = nextName(nameKey);
  (obj as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/* ─── SVG path helpers ─── */
function starPath(r = 60, r2 = 24, n = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r2;
    pts.push(`${rad * Math.cos(a)},${rad * Math.sin(a)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

function polygonPath(n: number, r = 60, startAngle = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n + startAngle;
    pts.push(`${r * Math.cos(a)},${r * Math.sin(a)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

const HEART_PATH =
  'M 0,-35 C 5,-50 25,-50 25,-32 C 25,-15 0,10 0,30 C 0,10 -25,-15 -25,-32 C -25,-50 -5,-50 0,-35 Z';
const RIGHT_TRI_PATH = 'M -50,50 L -50,-50 L 50,50 Z';
const ARROW_PATH = 'M -55,-18 L 10,-18 L 10,-45 L 55,0 L 10,45 L 10,18 L -55,18 Z';

/* ─── Inner shadow canvas renderer ─── */
function drawInnerShadow(
  ctx: CanvasRenderingContext2D,
  obj: FabricObject,
  cfg: { color: string; blur: number; offsetX: number; offsetY: number; opacity: number },
  vp: number[]
) {
  ctx.save();
  ctx.transform(vp[0], vp[1], vp[2], vp[3], vp[4], vp[5]);
  const m = obj.calcTransformMatrix();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);

  const w = (obj.width ?? 100);
  const h = (obj.height ?? 100);
  const pad = Math.max(cfg.blur * 3, 50);

  ctx.beginPath();
  if (obj.type === 'circle') {
    const r = (obj as Circle).radius ?? w / 2;
    ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
    ctx.clip();
  } else if (obj.type === 'path' || obj.type === 'triangle') {
    // Clip to the actual path geometry so the shadow never bleeds outside
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmds = (obj as Path & { path?: [string, ...number[]][] }).path;
    let clipped = false;
    if (cmds && cmds.length > 0) {
      try {
        const dStr = cmds.map((cmd) => cmd.join(' ')).join(' ');
        ctx.clip(new Path2D(dStr));
        clipped = true;
      } catch { /* fall through to rect clip */ }
    }
    if (!clipped) {
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.clip();
    }
  } else {
    const rx = (obj as Rect).rx ?? 0;
    if (rx > 0) {
      const x = -w / 2, y = -h / 2;
      ctx.moveTo(x + rx, y); ctx.lineTo(x + w - rx, y);
      ctx.arcTo(x + w, y, x + w, y + rx, rx); ctx.lineTo(x + w, y + h - rx);
      ctx.arcTo(x + w, y + h, x + w - rx, y + h, rx); ctx.lineTo(x + rx, y + h);
      ctx.arcTo(x, y + h, x, y + h - rx, rx); ctx.lineTo(x, y + rx);
      ctx.arcTo(x, y, x + rx, y, rx); ctx.closePath();
    } else {
      ctx.rect(-w / 2, -h / 2, w, h);
    }
    ctx.clip();
  }

  ctx.shadowColor = cfg.color;
  ctx.shadowBlur = cfg.blur;
  ctx.shadowOffsetX = cfg.offsetX;
  ctx.shadowOffsetY = cfg.offsetY;
  ctx.globalAlpha = cfg.opacity / 100;
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.rect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
  ctx.rect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
  ctx.fill('evenodd');
  ctx.restore();
}

/* ─── True 3D extrusion renderer ─── */
function draw3DLayer(
  ctx: CanvasRenderingContext2D,
  obj: FabricObject,
  cfg: { steps: number; color: string; angle: number; bevel?: boolean; bevelTaper?: number },
  vp: number[]
) {
  const { steps, color, angle, bevel = false, bevelTaper = 20 } = cfg;
  const ar = (angle * Math.PI) / 180;
  const baseOpacity = obj.opacity ?? 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = obj as any;
  const origFill = o.fill;
  const origShadow = o.shadow;
  const origSW = o.strokeWidth;
  const origStroke = o.stroke;
  // Disable Fabric's object cache so our fill mutation is actually used during render
  const origCaching = o.objectCaching;
  const origDirty = o.dirty;

  o.fill = color;
  o.stroke = color;
  o.shadow = null;
  o.strokeWidth = 0;
  o.objectCaching = false;
  o.dirty = true;

  // Each step = 2px offset so depth is visible on large shapes; paint farthest first
  const PX_PER_STEP = 2;
  // Bevel: object center in design-space coordinates for scale pivot
  const center = bevel ? obj.getCenterPoint() : null;
  // bevelTaper is 0–50 (percentage); farthest layer shrinks by that fraction
  const taperFraction = bevelTaper / 100;

  for (let i = steps; i >= 1; i--) {
    const t = i / steps; // 1 = farthest, near 0 = closest
    const ox = Math.cos(ar) * i * PX_PER_STEP;
    const oy = Math.sin(ar) * i * PX_PER_STEP;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    // Fade far slabs to 40%, near slabs to 85% — creates visible depth gradient
    ctx.globalAlpha = baseOpacity * (0.4 + 0.45 * (1 - t));
    ctx.transform(vp[0], vp[1], vp[2], vp[3], vp[4], vp[5]);
    ctx.translate(ox, oy);
    if (bevel && center) {
      // Scale inward around the object's design-space center: farthest layer = (1 - taperFraction)
      const s = 1 - t * taperFraction;
      ctx.translate(center.x, center.y);
      ctx.scale(s, s);
      ctx.translate(-center.x, -center.y);
    }
    obj.render(ctx);
    ctx.restore();
  }

  // Restore original properties then re-render the main object on top of depth slabs
  o.fill = origFill;
  o.stroke = origStroke;
  o.shadow = origShadow;
  o.strokeWidth = origSW;
  o.objectCaching = origCaching;
  o.dirty = origDirty;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = baseOpacity;
  ctx.transform(vp[0], vp[1], vp[2], vp[3], vp[4], vp[5]);
  obj.render(ctx);
  ctx.restore();
}

export function useFabricCanvas(
  canvasEl: React.RefObject<HTMLCanvasElement | null>,
  containerEl: React.RefObject<HTMLDivElement | null>,
  options: UseFabricCanvasOptions
) {
  const canvasRef = useRef<Canvas | null>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isUndoRedoRef = useRef<boolean>(false);
  const undoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designWidth = useRef(options.width);
  const designHeight = useRef(options.height);
  const [objects, setObjects] = useState<ObjectMeta[]>([]);
  const lastVisualSignatureRef = useRef('');
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [isBrushActive, setIsBrushActive] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);

  // Mutable refs for event handlers
  const gridEnabledRef = useRef(false);
  const snapToGridRef = useRef(false);
  const gridSizeRef = useRef(20);
  const penActiveRef = useRef(false);
  const penModeRef = useRef<'pen' | 'bezier' | 'spline'>('pen');
  // Callback fired after a pen path is committed — wired to activateVectorEdit (defined later)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postPenCloseRef = useRef<((path: any) => void) | null>(null);
  const brushActiveRef = useRef(false);
  const eyedropperActiveRef = useRef(false);
  const eyedropperCallbackRef = useRef<((color: string) => void) | null>(null);
  const brushPresetRef = useRef<BrushPreset>('standard');
  const panModeRef = useRef(false);
  const vectorEditObjRef = useRef<FabricObject | null>(null);
  const vectorDragStartRef = useRef<{ anchorIdx: number; localX: number; localY: number } | null>(null);
  const [vectorAnchors, setVectorAnchors] = useState<VectorAnchor[]>([]);
  const [isVectorEditActive, setIsVectorEditActive] = useState(false);

  // Pan offset tracking (used during pinch-to-zoom to accumulate pan delta)
  const panOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pen tool state
  const [penPoints, setPenPoints] = useState<PenPoint[]>([]);
  const penPointsRef = useRef<PenPoint[]>([]);
  const penPreviewRef = useRef<Path | null>(null);
  const penAnchorRefs = useRef<Circle[]>([]);
  // Bezier pen drag tracking — records the mouse-down position until mouseup commits the node
  const penMouseDownRef = useRef(false);
  const penDownPointerRef = useRef<{ x: number; y: number } | null>(null);
  const penLiveHandleRef = useRef<{
    cpOut: { x: number; y: number };
    cpIn: { x: number; y: number };
  } | null>(null);
  const [penLiveHandle, setPenLiveHandle] = useState<{
    x: number; y: number; cpOut: { x: number; y: number };
  } | null>(null);

  // Vector node editor state
  const [selectedVectorAnchorIdx, setSelectedVectorAnchorIdx] = useState<number | null>(null);

  const syncObjects = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objs = c.getObjects().filter((o) => !(o as any)._isPenAux && !(o as any)._isAuxLayer);
    lastVisualSignatureRef.current = objs.map(visualSignature).join('||');
    setObjects(
      [...objs].reverse().map((obj) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const o = obj as any;
        const fill = typeof obj.fill === 'string' ? obj.fill : undefined;
        const stroke = typeof obj.stroke === 'string' ? obj.stroke : undefined;
        const labelByType: Record<string, string> = {
          rect: 'Rectangle',
          circle: 'Circle',
          triangle: 'Triangle',
          line: 'Line',
          path: 'Path',
          image: 'Image',
          group: 'Group',
          'i-text': 'Text',
          text: 'Text',
          textbox: 'Text',
        };
        const isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox';
        const textLabel = typeof o.text === 'string' && o.text.length > 0 ? o.text : 'Text';
        const typeLabel = labelByType[obj.type] || String(o._name || obj.type || 'Object').replace(/\s+\d+$/, '');
        // Generate a stable base64 thumbnail so it never shows a broken-image icon
        let imgSrc: string | undefined;
        if (obj.type === 'image') {
          try {
            const imgEl = o.getElement?.() as HTMLImageElement | undefined;
            if (imgEl && imgEl.complete) {
              const nw = imgEl.naturalWidth || imgEl.width || 0;
              const nh = imgEl.naturalHeight || imgEl.height || 0;
              if (nw > 0 && nh > 0) {
                const maxSz = 50;
                const scale = Math.min(1, maxSz / Math.max(nw, nh));
                const tw = Math.max(1, Math.round(nw * scale));
                const th = Math.max(1, Math.round(nh * scale));
                const tmpCv = document.createElement('canvas');
                tmpCv.width = tw; tmpCv.height = th;
                const tCtx = tmpCv.getContext('2d');
                if (tCtx) {
                  tCtx.drawImage(imgEl, 0, 0, tw, th);
                  imgSrc = tmpCv.toDataURL('image/jpeg', 0.55);
                }
              }
            }
          } catch { /* tainted canvas or other error — leave imgSrc undefined */ }
        }
        return {
          id: objId(obj),
          name: isText ? textLabel : typeLabel,
          type: obj.type || 'object',
          visible: obj.visible !== false,
          selectable: obj.selectable !== false,
          fill,
          stroke,
          opacity: obj.opacity ?? 1,
          imgSrc,
          thumbnailSrc: renderLayerThumbnail(obj),
        };
      })
    );
  }, []);

  const pushUndo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || isUndoRedoRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = JSON.stringify((c as any).toJSON(EXTRA_PROPS));
    undoStack.current.push(json);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    options.onUndoRedoChange(undoStack.current.length > 0, false);
    options.onCanvasChanged();
    syncObjects();
  }, [options, syncObjects]);

  const fitToContainer = useCallback(() => {
    const c = canvasRef.current;
    const container = containerEl.current;
    if (!c || !container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const newZoom = Math.min(w / designWidth.current, h / designHeight.current) * 0.9;
    // Size the Fabric canvas exactly to the visible design area.
    // Design (0,0) aligns with canvas (0,0) — no viewport translation offset needed.
    // This ensures click coords, drag coords, and export coords all share one origin.
    const cw = Math.round(designWidth.current * newZoom);
    const ch = Math.round(designHeight.current * newZoom);
    c.setDimensions({ width: cw, height: ch });
    c.setViewportTransform([newZoom, 0, 0, newZoom, 0, 0]);
    setZoom(newZoom);
    // Scroll the container so the canvas is centered inside the PAN_MARGIN scroll area.
    // PAN_MARGIN (600px) of extra space is added on each side in Canvas.tsx.
    const PAN_MARGIN = 600;
    const ct = containerEl.current;
    if (ct) {
      requestAnimationFrame(() => {
        ct.scrollLeft = PAN_MARGIN - (ct.clientWidth - cw) / 2;
        ct.scrollTop = PAN_MARGIN - (ct.clientHeight - ch) / 2;
      });
    }
  }, [containerEl]);

  /* ─── Pen tool helpers ─── */

  /** Build an SVG path string supporting straight lines and cubic bezier segments */
  const buildBezierPathStr = (pts: PenPoint[], closed = false): string => {
    if (pts.length < 1) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cp1 = prev.cpOut ?? { x: prev.x, y: prev.y };
      const cp2 = curr.cpIn ?? { x: curr.x, y: curr.y };
      if (cp1.x === prev.x && cp1.y === prev.y && cp2.x === curr.x && cp2.y === curr.y) {
        d += ` L ${curr.x} ${curr.y}`;
      } else {
        d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${curr.x} ${curr.y}`;
      }
    }
    if (closed) d += ' Z';
    return d;
  };

  /** Build a smooth cubic Bezier path using Catmull-Rom interpolation.
   *  Each clicked point becomes an anchor; control handles are auto-computed.
   *  tension=0.375 gives natural-looking curves (Catmull-Rom α=0.5 centripetal). */
  const buildCatmullRomPath = (pts: PenPoint[], closed = false, tension = 0.375): string => {
    if (pts.length < 2) return pts.length === 1 ? `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}` : '';
    const n = pts.length;
    // Return a "ghost" point reflected across endpoint, for natural boundary behaviour
    const getP = (i: number): { x: number; y: number } => {
      if (i < 0) return closed ? pts[n + i] : { x: 2 * pts[0].x - pts[1].x, y: 2 * pts[0].y - pts[1].y };
      if (i >= n) return closed ? pts[i % n] : { x: 2 * pts[n - 1].x - pts[n - 2].x, y: 2 * pts[n - 1].y - pts[n - 2].y };
      return pts[i];
    };
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    const count = closed ? n : n - 1;
    for (let i = 0; i < count; i++) {
      const p0 = getP(i - 1), p1 = getP(i), p2 = getP(i + 1), p3 = getP(i + 2);
      // Catmull-Rom → cubic Bezier control point formula
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    if (closed) d += ' Z';
    return d;
  };

  /** Choose path builder based on current pen mode */
  const buildModePath = (pts: PenPoint[], closed = false): string => {
    const mode = penModeRef.current;
    if (mode === 'bezier' || mode === 'spline') return buildCatmullRomPath(pts, closed);
    return buildBezierPathStr(pts, closed);
  };

  const updatePenPreview = useCallback((
    pts: PenPoint[],
    liveNode?: { x: number; y: number; cpIn?: { x: number; y: number } } | null,
  ) => {
    const c = canvasRef.current;
    if (!c || pts.length < 1) return;
    if (penPreviewRef.current) c.remove(penPreviewRef.current);

    // Build path including live preview segment to the in-progress drag node
    const allPts: PenPoint[] = [...pts];
    if (liveNode && pts.length >= 1) {
      allPts.push({ x: liveNode.x, y: liveNode.y, cpIn: liveNode.cpIn });
    }
    if (allPts.length < 2) return;

    // Use Catmull-Rom for bezier/spline modes, standard bezier for pen mode
    const pathStr = (penModeRef.current === 'bezier' || penModeRef.current === 'spline')
      ? buildCatmullRomPath(allPts, false)
      : buildBezierPathStr(allPts, false);

    const p = new Path(pathStr, {
      stroke: '#00F5FF', strokeWidth: 1.5, fill: 'transparent',
      selectable: false, evented: false, hasControls: false, hasBorders: false,
      strokeDashArray: [6, 3],
    });
    (p as unknown as Record<string, unknown>)._isPenAux = true;
    c.add(p);
    penPreviewRef.current = p;
    c.renderAll();
  }, []);

  const closePenPath = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const pts = penPointsRef.current;
    if (pts.length < 2) { cancelPenTool(); return; }
    if (penPreviewRef.current) { c.remove(penPreviewRef.current); penPreviewRef.current = null; }
    penAnchorRefs.current.forEach((ci) => c.remove(ci));
    penAnchorRefs.current = [];
    penMouseDownRef.current = false;
    penDownPointerRef.current = null;
    penLiveHandleRef.current = null;
    setPenLiveHandle(null);

    const isClosed = pts.length >= 3;
    // Use Catmull-Rom for bezier/spline so the final committed path also curves correctly
    const pathStr = (penModeRef.current === 'bezier' || penModeRef.current === 'spline')
      ? buildCatmullRomPath(pts, isClosed)
      : buildBezierPathStr(pts, isClosed);

    const finalPath = new Path(pathStr, {
      stroke: '#00F5FF', strokeWidth: 3,
      fill: isClosed ? 'rgba(0,245,255,0.25)' : 'transparent',
    });
    tagObj(finalPath, 'path');
    c.add(finalPath);
    c.setActiveObject(finalPath);
    penPointsRef.current = [];
    setPenPoints([]);
    penActiveRef.current = false;
    penModeRef.current = 'pen'; // reset mode after path is committed
    c.selection = true;
    c.requestRenderAll();
    pushUndo();
    // Enter vector edit on the new curve path immediately so handles are editable
    // Use setTimeout to avoid calling activateVectorEdit before it is initialized
    // (it is defined later in this file, after closePenPath)
    setTimeout(() => { postPenCloseRef.current?.(finalPath); }, 0);
  }, [pushUndo]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function cancelPenTool() {
    const c = canvasRef.current;
    if (!c) return;
    if (penPreviewRef.current) { c.remove(penPreviewRef.current); penPreviewRef.current = null; }
    penAnchorRefs.current.forEach((ci) => c.remove(ci));
    penAnchorRefs.current = [];
    penPointsRef.current = [];
    setPenPoints([]);
    penMouseDownRef.current = false;
    penDownPointerRef.current = null;
    penLiveHandleRef.current = null;
    setPenLiveHandle(null);
    penActiveRef.current = false;
    c.selection = true;
    c.requestRenderAll();
  }

  const activatePenTool = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    penModeRef.current = 'pen'; // ensure straight-line mode unless overridden
    penActiveRef.current = true;
    penPointsRef.current = [];
    setPenPoints([]);
    penMouseDownRef.current = false;
    penDownPointerRef.current = null;
    penLiveHandleRef.current = null;
    setPenLiveHandle(null);
    c.selection = false;
    c.discardActiveObject();
    c.requestRenderAll();
  }, []);

  /** Activate pen tool in Bézier curve mode — clicks produce smooth Catmull-Rom curves */
  const activateBezierPen = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    penModeRef.current = 'bezier';
    penActiveRef.current = true;
    penPointsRef.current = [];
    setPenPoints([]);
    penMouseDownRef.current = false;
    penDownPointerRef.current = null;
    penLiveHandleRef.current = null;
    setPenLiveHandle(null);
    c.selection = false;
    c.discardActiveObject();
    c.requestRenderAll();
  }, []);

  /** Activate pen tool in Spline mode — Catmull-Rom interpolation through all clicked points */
  const activateSplinePen = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    penModeRef.current = 'spline';
    penActiveRef.current = true;
    penPointsRef.current = [];
    setPenPoints([]);
    penMouseDownRef.current = false;
    penDownPointerRef.current = null;
    penLiveHandleRef.current = null;
    setPenLiveHandle(null);
    c.selection = false;
    c.discardActiveObject();
    c.requestRenderAll();
  }, []);

  useEffect(() => {
    if (!canvasEl.current) return;
    const c = new Canvas(canvasEl.current, {
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
      // Allow objects to scale to their absolute minimum — no artificial lower bound
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(({ minScaleLimit: 0 }) as any),
    });
    canvasRef.current = c;
    designWidth.current = options.width;
    designHeight.current = options.height;
    fitToContainer();

    /* ─── Selection events ─── */
    const handleSelect = () => {
      const active = c.getActiveObject();
      if (active) {
        setSelectedObject(active);
        options.onSelectionChange(c.getActiveObjects().map(objId));
      }
    };
    const handleDeselect = () => { setSelectedObject(null); options.onSelectionChange([]); };
    const handleChange = () => { if (!isUndoRedoRef.current) pushUndo(); syncObjects(); };

    c.on('selection:created', handleSelect);
    c.on('selection:updated', handleSelect);
    c.on('selection:cleared', handleDeselect);
    c.on('object:added', handleChange);
    c.on('object:modified', handleChange);
    c.on('object:removed', handleChange);

    /* ─── Snap to grid + drag telemetry ─── */
    c.on('object:moving', (e) => {
      if (snapToGridRef.current && gridEnabledRef.current) {
        const obj = e.target;
        const g = gridSizeRef.current;
        obj.set({
          left: Math.round((obj.left ?? 0) / g) * g,
          top: Math.round((obj.top ?? 0) / g) * g,
        });
      }
      const t = e.target;
      if (t) setDragInfo({ w: Math.round(t.getScaledWidth()), h: Math.round(t.getScaledHeight()), angle: Math.round(t.angle ?? 0), clientX: (e.e as MouseEvent).clientX ?? 0, clientY: (e.e as MouseEvent).clientY ?? 0 });
    });
    c.on('object:scaling', (e) => {
      const t = e.target;
      if (t) setDragInfo({ w: Math.round(t.getScaledWidth()), h: Math.round(t.getScaledHeight()), angle: Math.round(t.angle ?? 0), clientX: (e.e as MouseEvent).clientX ?? 0, clientY: (e.e as MouseEvent).clientY ?? 0 });
    });
    c.on('object:rotating', (e) => {
      const t = e.target;
      if (t) setDragInfo({ w: Math.round(t.getScaledWidth()), h: Math.round(t.getScaledHeight()), angle: Math.round(t.angle ?? 0), clientX: (e.e as MouseEvent).clientX ?? 0, clientY: (e.e as MouseEvent).clientY ?? 0 });
    });

    /* ─── After:render – thumbnail refresh + inner shadow + 3D extrusion ─── */
    c.on('after:render', ({ ctx }) => {
      const visualSignatureNow = c.getObjects()
        .filter((obj) => !(obj as any)._isPenAux && !(obj as any)._isAuxLayer)
        .map(visualSignature)
        .join('||');
      // Some panels mutate Fabric properties directly. The render is the
      // common signal for those changes; refresh only when visual state really
      // changed so pointer renders do not rebuild every thumbnail.
      if (visualSignatureNow !== lastVisualSignatureRef.current) syncObjects();

      const vp = c.viewportTransform;
      if (!vp) return;
      c.getObjects().forEach((obj) => {
        // Inner shadow
        const cfg = (obj as FabricObject & { _innerShadow?: { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number; opacity: number } })._innerShadow;
        if (cfg?.enabled) drawInnerShadow(ctx, obj, cfg, vp);
        // True 3D extrusion
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const depth3d = (obj as any)._depth3d as { enabled: boolean; steps: number; color: string; angle: number } | undefined;
        if (depth3d?.enabled) draw3DLayer(ctx, obj, depth3d, vp);
      });
    });

    /* ─── Brush stroke complete ─── */
    c.on('path:created', (e: { path: Path }) => {
      if (brushActiveRef.current) {
        tagObj(e.path, 'brush');
        pushUndo();
      }
    });

    /* ─── Mouse:down – eyedropper, pen tool, pan ─── */
    let isPanning = false;
    let lastPanX = 0, lastPanY = 0;

    c.on('mouse:down', (opt) => {
      // Eyedropper intercept
      if (eyedropperActiveRef.current && eyedropperCallbackRef.current) {
        const lc = c.getElement() as HTMLCanvasElement;
        const lCtx = lc.getContext('2d');
        if (lCtx) {
          const me = opt.e as MouseEvent;
          const rect = lc.getBoundingClientRect();
          const sx = Math.max(0, Math.round(me.clientX - rect.left));
          const sy = Math.max(0, Math.round(me.clientY - rect.top));
          const px = lCtx.getImageData(sx, sy, 1, 1).data;
          const hex = `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
          eyedropperCallbackRef.current(hex);
        }
        eyedropperActiveRef.current = false;
        eyedropperCallbackRef.current = null;
        setEyedropperActive(false);
        return;
      }

      const me = opt.e as MouseEvent | TouchEvent;
      if (penActiveRef.current) {
        const pointer = c.getScenePoint(opt.e as MouseEvent);
        const pts = penPointsRef.current;
        // Close path when user clicks back on the first anchor (≥3 nodes already placed)
        if (pts.length >= 3) {
          const first = pts[0];
          if (Math.hypot(pointer.x - first.x, pointer.y - first.y) < 20 / c.getZoom()) {
            closePenPath();
            return;
          }
        }
        // Record the mouse-down position. The node is committed on mouse:up,
        // allowing a drag to pull out bezier control handles before releasing.
        penMouseDownRef.current = true;
        penDownPointerRef.current = { x: pointer.x, y: pointer.y };
        penLiveHandleRef.current = null;
        return;
      }
      // Touch-based pan is handled exclusively by the container touch handlers in
      // Canvas.tsx. If we let touch events reach this mouse:down pan path, Fabric
      // synthesizes them from TouchEvents where .clientX is undefined, producing NaN
      // deltas that corrupt ct.scrollLeft → black-screen viewport crash.
      const isTouch = 'touches' in me;
      if (!isTouch && (panModeRef.current || (me as MouseEvent).altKey)) {
        isPanning = true;
        c.selection = false;
        lastPanX = (me as MouseEvent).clientX;
        lastPanY = (me as MouseEvent).clientY;
        c.setCursor('grabbing');
      }
    });

    c.on('mouse:move', (opt) => {
      // Bezier pen: while mouse button is held, compute live bezier handle from drag
      if (penActiveRef.current && penMouseDownRef.current && penDownPointerRef.current) {
        const pointer = c.getScenePoint(opt.e as MouseEvent);
        const dx = pointer.x - penDownPointerRef.current.x;
        const dy = pointer.y - penDownPointerRef.current.y;
        const dragDist = Math.hypot(dx, dy);
        if (dragDist > 3 / c.getZoom()) {
          const anchor = penDownPointerRef.current;
          const cpOut = { x: anchor.x + dx, y: anchor.y + dy };
          const cpIn  = { x: anchor.x - dx, y: anchor.y - dy };
          penLiveHandleRef.current = { cpOut, cpIn };
          setPenLiveHandle({ x: anchor.x, y: anchor.y, cpOut });
          // Live preview shows path from committed nodes to current drag position
          updatePenPreview(penPointsRef.current, { x: anchor.x, y: anchor.y, cpIn });
        }
      }

      // Skip pan delta math for touch events — same NaN-safety guard as mouse:down.
      if (isPanning && !('touches' in opt.e)) {
        const dx = (opt.e as MouseEvent).clientX - lastPanX;
        const dy = (opt.e as MouseEvent).clientY - lastPanY;
        lastPanX = (opt.e as MouseEvent).clientX;
        lastPanY = (opt.e as MouseEvent).clientY;
        // Pan by scrolling the container — the canvas itself stays at a fixed zoom/vpt.
        // This prevents objects from going out of the canvas element bounds.
        const ct = containerEl.current;
        if (ct) { ct.scrollLeft -= dx; ct.scrollTop -= dy; }
      }
    });

    c.on('mouse:up', () => {
      // Bezier pen: commit the node (with handles if drag occurred) on mouse release
      if (penActiveRef.current && penMouseDownRef.current && penDownPointerRef.current) {
        const anchor = penDownPointerRef.current;
        const liveHandle = penLiveHandleRef.current;
        const newNode: PenPoint = {
          x: anchor.x,
          y: anchor.y,
          ...(liveHandle ? { cpOut: liveHandle.cpOut, cpIn: liveHandle.cpIn } : {}),
        };
        const newPts = [...penPointsRef.current, newNode];
        penPointsRef.current = newPts;
        setPenPoints([...newPts]);
        // Remove old Fabric circle anchors — the SVG overlay in Canvas.tsx handles visuals
        penAnchorRefs.current.forEach((ci) => { try { c.remove(ci); } catch { /* ok */ } });
        penAnchorRefs.current = [];
        setPenLiveHandle(null);
        penLiveHandleRef.current = null;
        penDownPointerRef.current = null;
        penMouseDownRef.current = false;
        updatePenPreview(newPts, null);
      } else {
        penMouseDownRef.current = false;
      }
      isPanning = false;
      if (!penActiveRef.current && !brushActiveRef.current) c.selection = true;
      setDragInfo(null);
    });

    /* ─── Pinch to zoom ─── */
    let lastDist = 0, lastMidX = 0, lastMidY = 0;
    const el = canvasEl.current!;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const [t0, t1] = [e.touches[0], e.touches[1]];
        lastDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        lastMidX = (t0.clientX + t1.clientX) / 2;
        lastMidY = (t0.clientY + t1.clientY) / 2;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t0, t1] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        if (lastDist === 0) { lastDist = dist; lastMidX = midX; lastMidY = midY; return; }
        const ratio = dist / lastDist;
        if (!Number.isFinite(ratio) || ratio <= 0) return;
        const rawZ = c.getZoom() * ratio;
        if (!Number.isFinite(rawZ) || rawZ <= 0) return;
        const z = Math.min(Math.max(rawZ, 0.1), 1.0);
        c.setDimensions({ width: Math.round(designWidth.current * z), height: Math.round(designHeight.current * z) });
        c.setViewportTransform([z, 0, 0, z, 0, 0]);
        const panDx = midX - lastMidX;
        const panDy = midY - lastMidY;
        panOffsetRef.current = { x: panOffsetRef.current.x + panDx, y: panOffsetRef.current.y + panDy };
        setPanOffset({ ...panOffsetRef.current });
        lastDist = dist; lastMidX = midX; lastMidY = midY;
        setZoom(z);
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    /* ─── Mouse wheel zoom ─── */
    c.on('mouse:wheel', (opt) => {
      const ev = opt.e as WheelEvent;
      const rawZ = c.getZoom() * (0.999 ** ev.deltaY);
      ev.preventDefault();
      ev.stopPropagation();
      if (!Number.isFinite(rawZ) || rawZ <= 0) return;
      const z = Math.min(Math.max(rawZ, 0.1), 1.0);
      c.setDimensions({ width: Math.round(designWidth.current * z), height: Math.round(designHeight.current * z) });
      c.setViewportTransform([z, 0, 0, z, 0, 0]);
      setZoom(z);
    });

    /* ─── Neon / glow path: screen blending for real light-emission look ─── */
    c.on('path:created', (e: Record<string, unknown>) => {
      const path = e.path as FabricObject | undefined;
      if (!path) return;
      if (brushPresetRef.current === 'glow') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (path as any).globalCompositeOperation = 'screen';
        c.requestRenderAll();
      }
    });

    const ro = new ResizeObserver(() => fitToContainer());
    if (containerEl.current) ro.observe(containerEl.current);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      ro.disconnect();
      c.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEl]);

  /* ─── Grid / snap setters ─── */
  const setGridOptions = useCallback((enabled: boolean, snap: boolean, size: number) => {
    gridEnabledRef.current = enabled;
    snapToGridRef.current = snap;
    gridSizeRef.current = size;
  }, []);

  /* ─── Canvas background ─── */
  const setCanvasBackground = useCallback((cfg: CanvasBgConfig) => {
    const c = canvasRef.current;
    if (!c) return;
    if (cfg.type === 'transparent') {
      (c as Canvas & { backgroundColor: string }).backgroundColor = '';
    } else if (cfg.type === 'solid') {
      (c as Canvas & { backgroundColor: string }).backgroundColor = cfg.color;
    } else {
      const w = designWidth.current;
      const h = designHeight.current;
      const stops = cfg.gradientStops.map((s) => ({ offset: s.offset, color: s.color }));
      const grad = new Gradient({
        type: cfg.gradientType === 'radial' ? 'radial' : 'linear',
        coords: cfg.gradientType === 'radial'
          ? { r1: 0, r2: Math.max(w, h) / 2, x1: w / 2, y1: h / 2, x2: w / 2, y2: h / 2 }
          : { x1: 0, y1: 0, x2: w, y2: 0 },
        colorStops: stops,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c as any).backgroundColor = grad;
    }
    c.requestRenderAll();
  }, []);

  /* ─── Shape center helper ─── */
  const getCenter = useCallback(() => {
    const c = canvasRef.current!;
    const vt = c.viewportTransform;
    return {
      cx: (c.width / 2 - (vt ? vt[4] : 0)) / c.getZoom(),
      cy: (c.height / 2 - (vt ? vt[5] : 0)) / c.getZoom(),
    };
  }, []);

  /* ─── Shape adders ─── */
  const addRect = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Rect({ left: cx - 50, top: cy - 50, width: 100, height: 100, fill: '#00F5FF', strokeWidth: 0, strokeUniform: true });
    tagObj(obj, 'rect'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addCircle = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Circle({ left: cx - 50, top: cy - 50, radius: 50, fill: '#00F5FF', strokeWidth: 0 });
    tagObj(obj, 'circle'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addTriangle = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Triangle({ left: cx - 50, top: cy - 55, width: 100, height: 100, fill: '#00F5FF', strokeWidth: 0 });
    tagObj(obj, 'triangle'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addStar = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Path(starPath(60, 26, 5), { left: cx - 60, top: cy - 60, fill: '#FFD700', strokeWidth: 0 });
    tagObj(obj, 'star'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addHexagon = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Path(polygonPath(6, 60, Math.PI / 6), { left: cx - 60, top: cy - 60, fill: '#7B2FFF', strokeWidth: 0 });
    tagObj(obj, 'hexagon'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addPentagon = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Path(polygonPath(5, 60, -Math.PI / 2), { left: cx - 60, top: cy - 60, fill: '#FF6B6B', strokeWidth: 0 });
    tagObj(obj, 'pentagon'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addHeart = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Path(HEART_PATH, { left: cx - 30, top: cy - 30, fill: '#FF2D55', strokeWidth: 0 });
    tagObj(obj, 'heart'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addRightTriangle = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Path(RIGHT_TRI_PATH, { left: cx - 50, top: cy - 50, fill: '#34D399', strokeWidth: 0 });
    tagObj(obj, 'triangle'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addArrow = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Path(ARROW_PATH, { left: cx - 55, top: cy - 45, fill: '#F59E0B', strokeWidth: 0 });
    tagObj(obj, 'arrow'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addLine = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Line([cx - 80, cy, cx + 80, cy], { stroke: '#00F5FF', strokeWidth: 3, fill: 'transparent' });
    tagObj(obj, 'line'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addText = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const obj = new Textbox('Tap to edit', { left: cx - 125, top: cy - 20, width: 250, fontSize: 40, fill: '#1A1A1A', fontFamily: 'Inter' });
    tagObj(obj, 'textbox'); c.add(obj); c.setActiveObject(obj); c.renderAll();
  }, [getCenter]);

  const addImageFromFile = useCallback(async (file: File) => {
    const c = canvasRef.current; if (!c) return;
    const url = URL.createObjectURL(file);
    try {
      const img = await FabricImage.fromURL(url);
      const maxDim = Math.min(designWidth.current, designHeight.current) * 0.5;
      const scale = Math.min(maxDim / (img.width || 1), maxDim / (img.height || 1));
      img.scale(scale);
      const { cx, cy } = getCenter();
      img.set({ left: cx - (img.width || 0) * scale / 2, top: cy - (img.height || 0) * scale / 2 });
      tagObj(img, 'image'); c.add(img); c.setActiveObject(img); c.renderAll();
    } finally { URL.revokeObjectURL(url); }
  }, [getCenter]);

  const alignObjects = useCallback((type: AlignType) => {
    const c = canvasRef.current;
    if (!c) return;

    const activeSelection = c.getActiveObject();
    if (!activeSelection) return;

    // Gather active objects and immediately dissolve the selection to unlock raw absolute coordinates
    const objs = c.getActiveObjects();
    if (objs.length === 0) return;

    const cw = designWidth.current;
    const ch = designHeight.current;

    if (objs.length === 1) {
      const obj = objs[0];
      const rect = obj.getBoundingRect();
      const deltaLeft = (obj.left ?? 0) - rect.left;
      const deltaTop = (obj.top ?? 0) - rect.top;

      switch (type) {
        case 'left': obj.set({ left: deltaLeft }); break;
        case 'right': obj.set({ left: cw - rect.width + deltaLeft }); break;
        case 'top': obj.set({ top: deltaTop }); break;
        case 'bottom': obj.set({ top: ch - rect.height + deltaTop }); break;
        case 'centerH': obj.set({ left: (cw - rect.width) / 2 + deltaLeft }); break;
        case 'centerV': obj.set({ top: (ch - rect.height) / 2 + deltaTop }); break;
      }
      obj.setCoords();
    } else {
      // Multi-object alignment: destroy selection context to process raw coordinates safely
      c.discardActiveObject();

      const objectsMetadata = objs.map((obj) => {
        const rect = obj.getBoundingRect();
        return {
          obj,
          rect,
          deltaLeft: (obj.left ?? 0) - rect.left,
          deltaTop: (obj.top ?? 0) - rect.top,
        };
      });

      const bounds = {
        left: Math.min(...objectsMetadata.map((o) => o.rect.left)),
        right: Math.max(...objectsMetadata.map((o) => o.rect.left + o.rect.width)),
        top: Math.min(...objectsMetadata.map((o) => o.rect.top)),
        bottom: Math.max(...objectsMetadata.map((o) => o.rect.top + o.rect.height)),
      };
      const groupW = bounds.right - bounds.left;
      const groupH = bounds.bottom - bounds.top;

      objectsMetadata.forEach(({ obj, rect, deltaLeft, deltaTop }) => {
        switch (type) {
          case 'left': obj.set({ left: bounds.left + deltaLeft }); break;
          case 'right': obj.set({ left: bounds.right - rect.width + deltaLeft }); break;
          case 'top': obj.set({ top: bounds.top + deltaTop }); break;
          case 'bottom': obj.set({ top: bounds.bottom - rect.height + deltaLeft }); break;
          case 'centerH': obj.set({ left: bounds.left + (groupW - rect.width) / 2 + deltaLeft }); break;
          case 'centerV': obj.set({ top: bounds.top + (groupH - rect.height) / 2 + deltaTop }); break;
        }
        obj.setCoords();
      });

      // Cleanly reconstruct the selection container over the newly aligned positions
      const newSelection = new ActiveSelection(objs, { canvas: c });
      c.setActiveObject(newSelection);
    }

    c.requestRenderAll();
    pushUndo();
  }, [pushUndo]);

  /* ─── Texture overlay ─── */
  const TEXTURES: Record<string, string> = {
    noise: `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#n)' opacity='0.4'/></svg>`,
    lines: `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><line x1='0' y1='5' x2='10' y2='5' stroke='rgba(0,0,0,0.25)' stroke-width='1'/></svg>`,
    dots: `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><circle cx='5' cy='5' r='1.5' fill='rgba(0,0,0,0.3)'/></svg>`,
    crosshatch: `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><line x1='0' y1='0' x2='10' y2='10' stroke='rgba(0,0,0,0.2)' stroke-width='1'/><line x1='10' y1='0' x2='0' y2='10' stroke='rgba(0,0,0,0.2)' stroke-width='1'/></svg>`,
    grid: `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><rect width='20' height='20' fill='none' stroke='rgba(0,0,0,0.2)' stroke-width='0.5'/></svg>`,
  };

  const applyTexture = useCallback((obj: FabricObject | null, textureKey: string | null) => {
    const c = canvasRef.current; if (!c || !obj) return;
    if (!textureKey) {
      obj.set('fill', (obj as FabricObject & { _origFill?: string })._origFill || '#00F5FF');
      (obj as FabricObject & { _textureKey?: string })._textureKey = undefined;
      c.requestRenderAll(); return;
    }
    if (!(obj as FabricObject & { _origFill?: string })._origFill && typeof obj.fill === 'string') {
      (obj as FabricObject & { _origFill?: string })._origFill = obj.fill;
    }
    (obj as FabricObject & { _textureKey?: string })._textureKey = textureKey;
    const svgStr = TEXTURES[textureKey];
    if (!svgStr) return;
    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const pat = new Pattern({ source: img, repeat: 'repeat' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.set('fill', pat as any);
      c.requestRenderAll();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  /* ─── Apply inner shadow ─── */
  const applyInnerShadow = useCallback(
    (obj: FabricObject | null, cfg: { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number; opacity: number } | null) => {
      const c = canvasRef.current; if (!c || !obj) return;
      (obj as FabricObject & { _innerShadow?: unknown })._innerShadow = cfg;
      c.requestRenderAll();
    },
    []
  );

  /* ─── True 3D Extrusion ─── */
  const apply3DDepth = useCallback((obj: FabricObject | null, cfg: { enabled: boolean; steps: number; color: string; angle: number; bevel?: boolean; bevelTaper?: number } | null) => {
    if (!obj) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any)._depth3d = cfg;
    canvasRef.current?.requestRenderAll();
  }, []);

  /* ─── Glow / Neon ─── */
  const applyGlow = useCallback((obj: FabricObject | null, cfg: { enabled: boolean; color: string; intensity: number } | null) => {
    if (!obj) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any)._glow = cfg;
    if (cfg?.enabled) {
      obj.set('shadow', new Shadow({ color: cfg.color, blur: cfg.intensity * 2.5, offsetX: 0, offsetY: 0 }));
    } else {
      obj.set('shadow', null);
    }
    canvasRef.current?.requestRenderAll();
  }, []);

  /* ─── Gradient Fill (radialRadius is optional pixels; defaults to Math.max(w,h)/2) ─── */
  const applyGradientFill = useCallback((
    obj: FabricObject | null,
    type: GradientFillType,
    stops: { offset: number; color: string }[],
    radialRadius?: number,
    angleDeg?: number,
    origin: GradientOrigin = { x: 0.5, y: 0.5 },
  ) => {
    if (!obj) return;
    const c = canvasRef.current; if (!c) return;
    const w = Math.max(1, obj.width ?? 100);
    const h = Math.max(1, obj.height ?? 100);
    const safeStops = stops.map((stop) => ({
      offset: Math.max(0, Math.min(1, stop.offset)),
      color: stop.color,
    })).filter((stop) => Number.isFinite(stop.offset) && typeof stop.color === 'string' && stop.color.length > 0);
    if (safeStops.length < 2) return;
    const safeOrigin = {
      x: Math.max(0, Math.min(1, origin.x)),
      y: Math.max(0, Math.min(1, origin.y)),
    };
    const safeAngle = ((angleDeg ?? 0) % 360 + 360) % 360;

    // ─── Coordinate system note ────────────────────────────────────────────────
    // Fabric's _applyPatternGradientTransform always applies:
    //   ctx.transform(1, 0, 0, 1, -width/2, -height/2)   (for 'pixels' units)
    // before calling ctx.fill(), shifting the origin to the TOP-LEFT corner of
    // the object.  So gradient pixel coords must use top-left (0,0) → (w,h).
    // ──────────────────────────────────────────────────────────────────────────

    try {
      if (type === 'angular') {
        const angularCanvas = createAngularGradientCanvas(w, h, safeStops, safeAngle, safeOrigin);
        const renderScale = angularCanvas.width > 0 ? w / angularCanvas.width : 1;
        const renderScaleY = angularCanvas.height > 0 ? h / angularCanvas.height : 1;
        const pat = new Pattern({
          source: angularCanvas,
          repeat: 'no-repeat',
          patternTransform: [renderScale, 0, 0, renderScaleY, 0, 0],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obj.set('fill', pat as any);
      } else {
        let coords: Record<string, number>;
        if (type === 'radial') {
          // Center at (w/2, h/2), inner radius 0, outer radius fills the shape
          const r2 = Math.max(1, radialRadius ?? Math.max(w, h) / 2);
          const cx = safeOrigin.x * w;
          const cy = safeOrigin.y * h;
          coords = { x1: cx, y1: cy, r1: 0, x2: cx, y2: cy, r2 };
        } else {
          // Linear: vector from one edge to the opposite, through the center
          // Default 0° = left→right; positive angle rotates clockwise
          const rad = (safeAngle * Math.PI) / 180;
          const cx = w / 2;
          const cy = h / 2;
          // Half-length: reach to the bounding box edge along the gradient direction
          const halfLen = Math.abs(cx * Math.cos(rad)) + Math.abs(cy * Math.sin(rad));
          coords = {
            x1: cx - halfLen * Math.cos(rad),
            y1: cy - halfLen * Math.sin(rad),
            x2: cx + halfLen * Math.cos(rad),
            y2: cy + halfLen * Math.sin(rad),
          };
        }

        const grad = new Gradient({
          type: type === 'radial' ? 'radial' : 'linear',
          coords,
          colorStops: safeStops.map((stop) => ({ ...stop })),
          gradientUnits: 'pixels',
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obj.set('fill', grad as any);
      }

      // Keep the editable source configuration alongside the Fabric fill. This is
      // also used to restore the Angular controls when the panel is reopened.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (obj as any)._gradientConfig = {
        type,
        stops: safeStops.map((stop) => ({ ...stop })),
        radialRadius: radialRadius ?? null,
        angleDeg: safeAngle,
        origin: { ...safeOrigin },
      };
      c.requestRenderAll();
    } catch {
      // A malformed stop or unsupported Fabric fill must not take down the
      // editor. Leave the previous fill intact and keep the canvas responsive.
      return;
    }
  }, []);

  /* ─── Decoupled Fill Opacity (encodes alpha into fill color, never touches obj.opacity) ─── */
  const applyFillOpacity = useCallback((obj: FabricObject | null, fraction: number) => {
    if (!obj) return;
    const c = canvasRef.current; if (!c) return;
    const fill = obj.fill;
    if (typeof fill === 'string') {
      obj.set('fill', withAlpha(fill, fraction));
    } else if (fill && typeof fill === 'object' && 'colorStops' in (fill as object)) {
      // Gradient: rebuild with opacity baked into each stop's alpha
      const gf = fill as { type?: string; colorStops?: { offset: number; color: string }[]; coords?: Record<string, number>; gradientUnits?: string };
      if (gf.colorStops && gf.type) {
        const newStops = gf.colorStops.map((s) => ({ offset: s.offset, color: withAlpha(s.color, fraction) }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        obj.set('fill', new Gradient({ type: gf.type as 'linear' | 'radial', coords: gf.coords ?? {}, colorStops: newStops, gradientUnits: (gf.gradientUnits ?? 'pixels') as 'pixels' | 'percentage' }) as any);
      }
    }
    // Keep obj.opacity = 1 so stroke is never dimmed by this fill-opacity change
    obj.set('opacity', 1);
    c.requestRenderAll();
  }, []);

  const getFillOpacity = useCallback((obj: FabricObject | null): number => {
    if (!obj) return 1;
    const fill = obj.fill;
    if (typeof fill === 'string') return extractColorAlpha(fill);
    if (fill && typeof fill === 'object' && 'colorStops' in (fill as object)) {
      const gf = fill as { colorStops?: { offset: number; color: string }[] };
      if (gf.colorStops?.length) return extractColorAlpha(gf.colorStops[0].color);
    }
    return 1;
  }, []);

  /* ─── Decoupled Stroke Opacity (encodes alpha into stroke color string) ─── */
  const applyStrokeOpacity = useCallback((obj: FabricObject | null, fraction: number) => {
    if (!obj) return;
    const c = canvasRef.current; if (!c) return;
    const stroke = typeof obj.stroke === 'string' && obj.stroke ? obj.stroke : '#000000';
    obj.set('stroke', withAlpha(stroke, fraction));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).setDirty?.(true);
    c.requestRenderAll();
  }, []);

  const getStrokeOpacity = useCallback((obj: FabricObject | null): number => {
    if (!obj) return 1;
    return extractColorAlpha(typeof obj.stroke === 'string' ? obj.stroke : '');
  }, []);

  /* ─── Fill Shape with Image (CSS background-size: cover — proportional, centered) ─── */
  // Accepts either a raw File or a pre-cropped HTMLCanvasElement (from FillCropModal)
  const fillShapeWithImage = useCallback(async (obj: FabricObject, source: File | HTMLCanvasElement) => {
    const c = canvasRef.current; if (!c) return;
    // Object local (pre-scale) dimensions
    const w = Math.max(1, obj.width ?? 100);
    const h = Math.max(1, obj.height ?? 100);

    let patternSource: HTMLImageElement | HTMLCanvasElement;
    let imgW: number, imgH: number;
    let objUrl: string | null = null;

    try {
      if (source instanceof HTMLCanvasElement) {
        // Already a cropped canvas at native resolution — use it directly.
        patternSource = source;
        imgW = source.width || 1;
        imgH = source.height || 1;
      } else {
        // Load at full native resolution — no intermediate canvas so no quality loss.
        objUrl = URL.createObjectURL(source);
        const fabImg = await FabricImage.fromURL(objUrl);
        patternSource = fabImg.getElement() as HTMLImageElement;
        imgW = (patternSource as HTMLImageElement).naturalWidth || patternSource.width || 1;
        imgH = (patternSource as HTMLImageElement).naturalHeight || patternSource.height || 1;
      }

      // ── Correct patternTransform for Fabric v7 ────────────────────────────────
      // Fabric's _applyPatternGradientTransform already does:
      //   ctx.translate(-objWidth/2, -objHeight/2)   ← shifts origin to top-left
      // and then multiplies by patternTransform. So patternTransform must only
      // encode the cover-fit scale + centering — NO additional -w/2,-h/2 shift.
      //
      // Cover-fit scale: make the image fill the entire object in local space.
      const scale = Math.max(w / imgW, h / imgH);
      // Center the (possibly oversized) scaled image within the object bounds.
      const tx = -(imgW * scale - w) / 2;
      const ty = -(imgH * scale - h) / 2;

      const pat = new Pattern({
        source: patternSource,
        repeat: 'no-repeat',
        // [a, b, c, d, e, f] = [scaleX, 0, 0, scaleY, translateX, translateY]
        patternTransform: [scale, 0, 0, scale, tx, ty],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.set('fill', pat as any);
      c.requestRenderAll();
      pushUndo();
    } finally {
      // Safe to revoke — HTMLImageElement keeps its decoded data after load.
      if (objUrl) URL.revokeObjectURL(objUrl);
    }
  }, [pushUndo]);

  /* ─── Image transform helpers ─── */
  const flipHorizontal = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const obj = c.getActiveObject(); if (!obj) return;
    obj.set({ flipX: !obj.flipX });
    obj.setCoords(); c.requestRenderAll(); pushUndo();
  }, [pushUndo]);

  const flipVertical = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const obj = c.getActiveObject(); if (!obj) return;
    obj.set({ flipY: !obj.flipY });
    obj.setCoords(); c.requestRenderAll(); pushUndo();
  }, [pushUndo]);

  const rotate90 = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const obj = c.getActiveObject(); if (!obj) return;
    obj.set({ angle: ((obj.angle ?? 0) + 90) % 360 });
    obj.setCoords(); c.requestRenderAll(); pushUndo();
  }, [pushUndo]);

  /* ─── Move object to specific canvas stack index (for drag-and-drop layer reorder) ─── */
  const moveObjectToIndex = useCallback((obj: FabricObject, targetIndex: number) => {
    const c = canvasRef.current; if (!c) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c as any).moveObjectTo(obj, Math.max(0, targetIndex));
    c.renderAll(); syncObjects();
  }, [syncObjects]);

  /* ─── Crop Image (Fabric native cropX/cropY) ─── */
  const cropImage = useCallback((obj: FabricObject, cropX: number, cropY: number, cropW: number, cropH: number) => {
    const c = canvasRef.current; if (!c) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).set({ cropX, cropY, width: cropW, height: cropH });
    obj.setCoords();
    c.requestRenderAll();
    pushUndo();
  }, [pushUndo]);

  /* ─── Apply circular clip-path to a FabricImage ─── */
  const applyCircularCrop = useCallback((obj: FabricObject) => {
    const c = canvasRef.current; if (!c) return;
    const w = obj.width ?? 100;
    const h = obj.height ?? 100;
    const r = Math.min(w, h) / 2;
    const clip = new Circle({
      radius: r,
      originX: 'center',
      originY: 'center',
    });
    obj.set('clipPath', clip);
    obj.setCoords();
    c.requestRenderAll();
    pushUndo();
  }, [pushUndo]);

  /* ─── Add a raster HTMLCanvasElement as a new FabricImage at design position ─── */
  const addRasterLayer = useCallback(async (
    canvas: HTMLCanvasElement,
    designLeft: number,
    designTop: number,
    mult: number,
  ) => {
    const c = canvasRef.current; if (!c) return;
    const dataUrl = canvas.toDataURL('image/png');
    const fabImg = await FabricImage.fromURL(dataUrl);
    fabImg.set({
      left: designLeft,
      top: designTop,
      // mult is the pixel multiplier used when rasterising, so 1/mult maps
      // back from raster pixels → design units with no quality loss.
      scaleX: 1 / mult,
      scaleY: 1 / mult,
    });
    c.add(fabImg);
    c.setActiveObject(fabImg);
    c.requestRenderAll();
    pushUndo();
  }, [pushUndo]);

  /* ─── Image Adjustment Filters ─── */
  const applyImageFilters = useCallback((
    obj: FabricObject,
    adjustments: { brightness: number; contrast: number; saturation: number; hue: number }
  ) => {
    const c = canvasRef.current;
    if (!c || obj.type !== 'image') return;
    const img = obj as FabricImage;
    const { brightness, contrast, saturation, hue } = adjustments;
    const filterList: object[] = [];
    if (brightness !== 0) filterList.push(new filters.Brightness({ brightness }));
    if (contrast !== 0) filterList.push(new filters.Contrast({ contrast }));
    if (saturation !== 0) filterList.push(new filters.Saturation({ saturation }));
    if (hue !== 0) filterList.push(new filters.HueRotation({ rotation: (hue / 180) * Math.PI }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    img.filters = filterList as any;
    img.applyFilters();
    c.requestRenderAll();
  }, []);

  /* ─── Brush Engine ─── */
  const activateBrush = useCallback((preset: BrushPreset, color: string, size: number) => {
    const c = canvasRef.current; if (!c) return;
    brushActiveRef.current = true;
    setIsBrushActive(true);
    c.isDrawingMode = true;
    c.selection = false;
    c.discardActiveObject();

    brushPresetRef.current = preset;
    const brush = new PencilBrush(c);

    if (preset === 'standard') {
      // Photoshop-grade paintbrush: full-opacity, rich round stroke
      brush.color = color;
      brush.width = size;
      brush.shadow = new Shadow({ color: 'rgba(0,0,0,0.18)', blur: size * 0.4, offsetX: 0, offsetY: 1 });
    } else if (preset === 'glow') {
      // Neon/glow: strong opaque core so the stroke is visible while drawing;
      // screen composite + massive shadow bloom applied on path:created for light-emission effect.
      const [r, g, b] = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
      brush.color = `rgba(${r},${g},${b},0.90)`;
      brush.width = Math.max(2, size * 0.5);
      brush.shadow = new Shadow({ color, blur: Math.max(25, size * 8), offsetX: 0, offsetY: 0 });
    } else if (preset === 'airbrush') {
      // Airbrush: soft feathered spray — very wide, low-alpha core with blurry halo
      const [r, g, b] = [
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
      ];
      brush.color = `rgba(${r},${g},${b},0.03)`;
      brush.width = size * 5;
      brush.shadow = new Shadow({ color: `rgba(${r},${g},${b},0.35)`, blur: size * 4, offsetX: 0, offsetY: 0 });
    }

    brush.strokeLineCap = 'round';
    brush.strokeLineJoin = 'round';
    c.freeDrawingBrush = brush;
    c.requestRenderAll();
  }, []);

  const deactivateBrush = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    brushActiveRef.current = false;
    setIsBrushActive(false);
    c.isDrawingMode = false;
    c.selection = true;
    c.requestRenderAll();
  }, []);

  /* ─── Eyedropper ─── */
  const activateEyedropper = useCallback((callback: (color: string) => void) => {
    eyedropperActiveRef.current = true;
    eyedropperCallbackRef.current = callback;
    setEyedropperActive(true);
    const c = canvasRef.current; if (!c) return;
    c.discardActiveObject();
    c.selection = false;
    c.requestRenderAll();
  }, []);

  const deactivateEyedropper = useCallback(() => {
    eyedropperActiveRef.current = false;
    eyedropperCallbackRef.current = null;
    setEyedropperActive(false);
    const c = canvasRef.current; if (!c) return;
    c.selection = true;
  }, []);

  /* ─── Vector / path anchor editor ─── */
  const refreshVectorAnchors = useCallback(() => {
    const obj = vectorEditObjRef.current;
    const c = canvasRef.current;
    if (!obj || !c) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPath: [string, ...number[]][] = (obj as any).path ?? [];
    const matrix = obj.calcTransformMatrix();
    const vt = c.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const anchors: VectorAnchor[] = [];

    const toScreen = (lx: number, ly: number): { screenX: number; screenY: number } => {
      // Fabric renders path via: ctx.transform(calcTransformMatrix()); ctx.translate(-pathOffset.x, -pathOffset.y); draw(path)
      // So a path coordinate (lx, ly) maps to design space as: matrix * (lx - pathOffset.x, ly - pathOffset.y)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const po = (obj as any).pathOffset ?? { x: 0, y: 0 };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cp = util.transformPoint({ x: lx - po.x, y: ly - po.y }, matrix as any);
      return { screenX: vt[4] + cp.x * vt[0], screenY: vt[5] + cp.y * vt[3] };
    };

    let prevAnchorScreen: { screenX: number; screenY: number } | null = null;

    let prevAnchorLocal: { x: number; y: number } | null = null;

    rawPath.forEach((cmd, cmdIdx) => {
      if (cmd[0] === 'M' || cmd[0] === 'L') {
        const lx = cmd[1] as number, ly = cmd[2] as number;
        const screen = toScreen(lx, ly);
        anchors.push({ cmdIdx, xOff: 1, yOff: 2, localX: lx, localY: ly, ...screen, kind: 'anchor', pairScreenX: null, pairScreenY: null });
        prevAnchorScreen = screen;
        prevAnchorLocal = { x: lx, y: ly };
      } else if (cmd[0] === 'C') {
        const cx1 = cmd[1] as number, cy1 = cmd[2] as number;
        const cx2 = cmd[3] as number, cy2 = cmd[4] as number;
        const ex  = cmd[5] as number, ey  = cmd[6] as number;
        const ep  = toScreen(ex, ey);
        const h1  = toScreen(cx1, cy1);
        const h2  = toScreen(cx2, cy2);
        // cp1 = out-handle of prevAnchor. Mirror = cp2 of previous C cmd (cmdIdx-1, xOff=3,4)
        anchors.push({
          cmdIdx, xOff: 1, yOff: 2, localX: cx1, localY: cy1, ...h1,
          kind: 'handle', pairScreenX: prevAnchorScreen?.screenX ?? null, pairScreenY: prevAnchorScreen?.screenY ?? null,
          anchorLocalX: prevAnchorLocal?.x, anchorLocalY: prevAnchorLocal?.y,
          mirrorCmdIdx: cmdIdx - 1, mirrorXOff: 3, mirrorYOff: 4,
        });
        // cp2 = in-handle of endpoint. Mirror = cp1 of next C cmd (cmdIdx+1, xOff=1,2)
        anchors.push({
          cmdIdx, xOff: 3, yOff: 4, localX: cx2, localY: cy2, ...h2,
          kind: 'handle', pairScreenX: ep.screenX, pairScreenY: ep.screenY,
          anchorLocalX: ex, anchorLocalY: ey,
          mirrorCmdIdx: cmdIdx + 1, mirrorXOff: 1, mirrorYOff: 2,
        });
        anchors.push({ cmdIdx, xOff: 5, yOff: 6, localX: ex, localY: ey, ...ep, kind: 'anchor', pairScreenX: null, pairScreenY: null });
        prevAnchorScreen = ep;
        prevAnchorLocal = { x: ex, y: ey };
      } else if (cmd[0] === 'Q') {
        const cx = cmd[1] as number, cy = cmd[2] as number;
        const ex = cmd[3] as number, ey = cmd[4] as number;
        const ep = toScreen(ex, ey);
        const h  = toScreen(cx, cy);
        anchors.push({
          cmdIdx, xOff: 1, yOff: 2, localX: cx, localY: cy, ...h,
          kind: 'handle', pairScreenX: prevAnchorScreen?.screenX ?? null, pairScreenY: prevAnchorScreen?.screenY ?? null,
        });
        anchors.push({ cmdIdx, xOff: 3, yOff: 4, localX: ex, localY: ey, ...ep, kind: 'anchor', pairScreenX: null, pairScreenY: null });
        prevAnchorScreen = ep;
        prevAnchorLocal = { x: ex, y: ey };
      }
    });

    setVectorAnchors(anchors);
  }, []);

  const activateVectorEdit = useCallback((obj: FabricObject) => {
    const c = canvasRef.current; if (!c) return;
    vectorEditObjRef.current = obj;
    c.discardActiveObject();
    obj.set({ hasControls: false, hasBorders: false });
    c.requestRenderAll();
    refreshVectorAnchors();
    setIsVectorEditActive(true);
  }, [refreshVectorAnchors]);

  // Wire postPenCloseRef so closePenPath (defined earlier) can call activateVectorEdit
  postPenCloseRef.current = activateVectorEdit;

  const deactivateVectorEdit = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const obj = vectorEditObjRef.current;
    if (obj) {
      obj.set({ hasControls: true, hasBorders: true });
      c.setActiveObject(obj);
      c.requestRenderAll();
    }
    vectorEditObjRef.current = null;
    vectorDragStartRef.current = null;
    setVectorAnchors([]);
    setIsVectorEditActive(false);
  }, []);

  const vectorAnchorDragStart = useCallback((anchorIdx: number) => {
    const anchor = vectorAnchors[anchorIdx];
    if (!anchor) return;
    vectorDragStartRef.current = { anchorIdx, localX: anchor.localX, localY: anchor.localY };
  }, [vectorAnchors]);

  const vectorAnchorDragMove = useCallback((totalClientDx: number, totalClientDy: number) => {
    const c = canvasRef.current; if (!c) return;
    const obj = vectorEditObjRef.current; if (!obj) return;
    const drag = vectorDragStartRef.current; if (!drag) return;
    const anchor = vectorAnchors[drag.anchorIdx]; if (!anchor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawPath: [string, ...number[]][] = [...((obj as any).path ?? [])];
    const vt = c.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const canvasDx = totalClientDx / (vt[0] || 1);
    const canvasDy = totalClientDy / (vt[3] || 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = util.invertTransform(obj.calcTransformMatrix() as any);
    const localDx = inv[0] * canvasDx + inv[2] * canvasDy;
    const localDy = inv[1] * canvasDx + inv[3] * canvasDy;

    const newHandleX = drag.localX + localDx;
    const newHandleY = drag.localY + localDy;

    // Update the dragged handle
    let newPath = rawPath.map((cmd, i) => {
      if (i !== anchor.cmdIdx) return cmd;
      const nc = [...cmd] as [string, ...number[]];
      nc[anchor.xOff] = newHandleX;
      nc[anchor.yOff] = newHandleY;
      return nc;
    });

    // Photoshop-style symmetric mirroring: when dragging a handle, update its
    // sibling handle to maintain C1 continuity (smooth node behaviour).
    if (
      anchor.kind === 'handle' &&
      anchor.anchorLocalX !== undefined &&
      anchor.anchorLocalY !== undefined &&
      anchor.mirrorCmdIdx !== undefined &&
      anchor.mirrorCmdIdx >= 0 && anchor.mirrorCmdIdx < rawPath.length
    ) {
      const mirrorCmd = rawPath[anchor.mirrorCmdIdx];
      if (mirrorCmd && mirrorCmd[0] === 'C') {
        const aX = anchor.anchorLocalX;
        const aY = anchor.anchorLocalY;
        // Mirror = anchor + (anchor - newHandle)
        const mirX = 2 * aX - newHandleX;
        const mirY = 2 * aY - newHandleY;
        newPath = newPath.map((cmd, i) => {
          if (i !== anchor.mirrorCmdIdx) return cmd;
          const nc = [...cmd] as [string, ...number[]];
          nc[anchor.mirrorXOff!] = mirX;
          nc[anchor.mirrorYOff!] = mirY;
          return nc;
        });
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).set({ path: newPath });

    // Recompute bounding box from the new path data so selection handles track changes.
    // Path coords are in raw local space; pathOffset is the bbox center in that space.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    newPath.forEach(cmd => {
      for (let k = 1; k + 1 < cmd.length; k += 2) {
        const px = cmd[k] as number, py = cmd[k + 1] as number;
        if (Number.isFinite(px) && Number.isFinite(py)) {
          minX = Math.min(minX, px); minY = Math.min(minY, py);
          maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
        }
      }
    });
    if (Number.isFinite(minX)) {
      const newPo = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldPo = (obj as any).pathOffset ?? { x: 0, y: 0 };
      // Shift left/top to compensate for the moved bbox center so other points stay put
      const dX = newPo.x - oldPo.x;
      const dY = newPo.y - oldPo.y;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (obj as any).set({
        pathOffset: newPo,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        left: (obj.left ?? 0) + dX * (obj.scaleX ?? 1),
        top: (obj.top ?? 0) + dY * (obj.scaleY ?? 1),
      });
    }

    obj.dirty = true;
    obj.setCoords();
    c.requestRenderAll();
    refreshVectorAnchors();
  }, [vectorAnchors, refreshVectorAnchors]);

  const vectorAnchorDragEnd = useCallback(() => {
    vectorDragStartRef.current = null;
    pushUndo();
  }, [pushUndo]);

  /* ─── Vector node add / delete / nudge ─── */

  /** Nudge the currently selected anchor by (dx, dy) in design units */
  const nudgeSelectedVectorNode = useCallback((dx: number, dy: number) => {
    const c = canvasRef.current; if (!c) return;
    const obj = vectorEditObjRef.current; if (!obj) return;
    if (selectedVectorAnchorIdx === null) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPath: [string, ...number[]][] = (obj as any).path ?? [];
    const anchorsOnly = vectorAnchors.filter(a => a.kind === 'anchor');
    const target = anchorsOnly[selectedVectorAnchorIdx];
    if (!target) return;

    // Convert design-unit nudge to local path space via inverse transform
    const vt = c.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const z = vt[0] || 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = util.invertTransform(obj.calcTransformMatrix() as any);
    const localDx = inv[0] * dx * z + inv[2] * dy * z;
    const localDy = inv[1] * dx * z + inv[3] * dy * z;

    const newPath = rawPath.map((cmd, i) => {
      if (i !== target.cmdIdx) return cmd;
      const nc = [...cmd] as [string, ...number[]];
      nc[target.xOff] = target.localX + localDx;
      nc[target.yOff] = target.localY + localDy;
      return nc;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).set({ path: newPath });
    obj.dirty = true;
    obj.setCoords();
    c.requestRenderAll();
    refreshVectorAnchors();
  }, [selectedVectorAnchorIdx, vectorAnchors, refreshVectorAnchors]);

  /** Delete the currently selected anchor node */
  const deleteSelectedVectorNode = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const obj = vectorEditObjRef.current; if (!obj) return;
    if (selectedVectorAnchorIdx === null) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPath: [string, ...number[]][] = (obj as any).path ?? [];
    const anchorsOnly = vectorAnchors.filter(a => a.kind === 'anchor');
    const target = anchorsOnly[selectedVectorAnchorIdx];
    if (!target) return;

    // Remove the command at cmdIdx (and any adjacent handle commands for C segments)
    const newPath = rawPath.filter((_, i) => i !== target.cmdIdx);
    if (newPath.length < 1) return; // Must keep at least M

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).set({ path: newPath });
    // Update bbox
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    newPath.forEach(cmd => {
      for (let k = 1; k + 1 < cmd.length; k += 2) {
        const px = cmd[k] as number, py = cmd[k + 1] as number;
        if (Number.isFinite(px) && Number.isFinite(py)) {
          minX = Math.min(minX, px); minY = Math.min(minY, py);
          maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
        }
      }
    });
    if (Number.isFinite(minX)) {
      const newPo = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldPo = (obj as any).pathOffset ?? { x: 0, y: 0 };
      const dX = newPo.x - oldPo.x, dY = newPo.y - oldPo.y;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (obj as any).set({
        pathOffset: newPo, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY),
        left: (obj.left ?? 0) + dX * (obj.scaleX ?? 1),
        top: (obj.top ?? 0) + dY * (obj.scaleY ?? 1),
      });
    }
    obj.dirty = true;
    obj.setCoords();
    c.requestRenderAll();
    setSelectedVectorAnchorIdx(prev => prev === null ? null : Math.max(0, prev - 1));
    refreshVectorAnchors();
    pushUndo();
  }, [selectedVectorAnchorIdx, vectorAnchors, refreshVectorAnchors, pushUndo]);

  /** Insert a new anchor at the midpoint after the selected anchor */
  const addVectorNodeAfter = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const obj = vectorEditObjRef.current; if (!obj) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPath: [string, ...number[]][] = (obj as any).path ?? [];
    const anchorsOnly = vectorAnchors.filter(a => a.kind === 'anchor');
    const targetIdx = selectedVectorAnchorIdx ?? (anchorsOnly.length > 0 ? 0 : null);
    if (targetIdx === null) return;
    const target = anchorsOnly[targetIdx];
    const next = anchorsOnly[targetIdx + 1];
    if (!target) return;

    // Midpoint between target and next anchor (or +30px right if last node)
    const mx = next ? (target.localX + next.localX) / 2 : target.localX + 30;
    const my = next ? (target.localY + next.localY) / 2 : target.localY;

    const insertAfterCmdIdx = target.cmdIdx;
    const newCmd: [string, ...number[]] = ['L', mx, my];
    const newPath = [
      ...rawPath.slice(0, insertAfterCmdIdx + 1),
      newCmd,
      ...rawPath.slice(insertAfterCmdIdx + 1),
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).set({ path: newPath });
    obj.dirty = true;
    obj.setCoords();
    c.requestRenderAll();
    setSelectedVectorAnchorIdx(targetIdx + 1);
    refreshVectorAnchors();
    pushUndo();
  }, [selectedVectorAnchorIdx, vectorAnchors, refreshVectorAnchors, pushUndo]);

  /* ─── Pan Mode ─── */
  const setPanMode = useCallback((active: boolean) => {
    panModeRef.current = active;
    const c = canvasRef.current; if (!c) return;
    if (active) {
      c.selection = false;
      c.discardActiveObject();
      c.defaultCursor = 'grab';
      c.hoverCursor = 'grab';
      c.moveCursor = 'grabbing';
    } else {
      c.selection = true;
      c.defaultCursor = 'default';
      c.hoverCursor = 'move';
      c.moveCursor = 'move';
    }
    c.requestRenderAll();
  }, []);

  /* ─── Zoom Level ─── */
  const applyZoom = useCallback((rawZ: number) => {
    const c = canvasRef.current; if (!c) return;
    if (!Number.isFinite(rawZ) || rawZ <= 0) return;
    const z = Math.min(Math.max(rawZ, 0.1), 1.0);
    c.setDimensions({ width: Math.round(designWidth.current * z), height: Math.round(designHeight.current * z) });
    c.setViewportTransform([z, 0, 0, z, 0, 0]);
    setZoom(z);
  }, []);

  const setZoomLevel = useCallback((percent: number) => {
    applyZoom(percent / 100);
  }, [applyZoom]);

  const zoomIn = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    applyZoom(c.getZoom() * 1.25);
  }, [applyZoom]);

  const zoomOut = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    applyZoom(c.getZoom() * 0.8);
  }, [applyZoom]);

  const resetZoom = useCallback(() => { fitToContainer(); }, [fitToContainer]);

  /* ─── Bezier Curve ─── */
  const addBezierCurve = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const pathStr = `M ${cx - 90},${cy} C ${cx - 45},${cy - 90} ${cx + 45},${cy - 90} ${cx + 90},${cy}`;
    const obj = new Path(pathStr, { stroke: '#00F5FF', strokeWidth: 3, fill: 'transparent', strokeLineCap: 'round' });
    tagObj(obj, 'path');
    c.add(obj); c.setActiveObject(obj); c.renderAll();
    activateVectorEdit(obj);
  }, [getCenter, activateVectorEdit]);

  /* ─── Spline Path ─── */
  const addSplinePath = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const { cx, cy } = getCenter();
    const pathStr = [
      `M ${cx - 100},${cy}`,
      `Q ${cx - 50},${cy - 80} ${cx},${cy}`,
      `Q ${cx + 50},${cy + 80} ${cx + 100},${cy}`,
    ].join(' ');
    const obj = new Path(pathStr, { stroke: '#00F5FF', strokeWidth: 3, fill: 'transparent', strokeLineCap: 'round' });
    tagObj(obj, 'path');
    c.add(obj); c.setActiveObject(obj); c.renderAll();
    activateVectorEdit(obj);
  }, [getCenter, activateVectorEdit]);

  /* ─── Universal Mask (clipPath) ─── */
  const applyMaskFromSelection = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const active = c.getActiveObjects();
    if (active.length < 2) return;

    const allObjs = c.getObjects();
    // Sort by z-order: topmost (highest index) becomes the clip shape
    const sorted = [...active].sort((a, b) => allObjs.indexOf(a) - allObjs.indexOf(b));
    const target = sorted[0];       // bottom-most object = content
    const maskShape = sorted[sorted.length - 1]; // topmost = clip shape

    maskShape.clone().then((clonedMask: FabricObject) => {
      // absolutePositioned:true → Fabric uses canvas-absolute coordinates directly,
      // so no manual coordinate offset math is needed. The clone sits exactly where
      // the original mask shape was on the canvas, clipping the target object.
      clonedMask.set({ absolutePositioned: true });
      clonedMask.setCoords();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (target as any).clipPath = clonedMask;
      c.remove(maskShape);
      c.discardActiveObject();
      c.setActiveObject(target);
      target.setCoords();
      c.requestRenderAll();
      pushUndo();
    });
  }, [pushUndo]);

  const releaseMask = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const obj = c.getActiveObject(); if (!obj) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).clipPath = undefined;
    obj.setCoords();
    c.requestRenderAll();
    pushUndo();
  }, [pushUndo]);

  /* ─── Expose push helpers for external callers (panels, nudge, etc.) ─── */
  const pushUndoNow = useCallback(() => {
    if (undoDebounceRef.current) { clearTimeout(undoDebounceRef.current); undoDebounceRef.current = null; }
    pushUndo();
  }, [pushUndo]);

  const commitChange = useCallback(() => {
    syncObjects();
    if (undoDebounceRef.current) clearTimeout(undoDebounceRef.current);
    undoDebounceRef.current = setTimeout(() => { pushUndo(); undoDebounceRef.current = null; }, 400);
  }, [syncObjects, pushUndo]);

  /* ─── Undo / Redo ─── */
  const undo = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || undoStack.current.length === 0) return;
    isUndoRedoRef.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redoStack.current.push(JSON.stringify((c as any).toJSON(EXTRA_PROPS)));
    const prev = undoStack.current.pop()!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).loadFromJSON(JSON.parse(prev));
    c.renderAll();
    isUndoRedoRef.current = false;
    options.onUndoRedoChange(undoStack.current.length > 0, redoStack.current.length > 0);
    syncObjects(); setSelectedObject(null); options.onSelectionChange([]);
  }, [options, syncObjects]);

  const redo = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || redoStack.current.length === 0) return;
    isUndoRedoRef.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    undoStack.current.push(JSON.stringify((c as any).toJSON(EXTRA_PROPS)));
    const next = redoStack.current.pop()!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).loadFromJSON(JSON.parse(next));
    c.renderAll();
    isUndoRedoRef.current = false;
    options.onUndoRedoChange(undoStack.current.length > 0, redoStack.current.length > 0);
    syncObjects(); setSelectedObject(null); options.onSelectionChange([]);
  }, [options, syncObjects]);

  /* ─── Export (Fixed: Enforces Explicit Snapshot Clipping Parameters) ─── */
  const exportCanvas = useCallback((format: 'png' | 'jpeg', quality: number, multiplier: number): string => {
    const c = canvasRef.current; if (!c) return '';

    const activeObj = c.getActiveObject();
    const savedVpTransform = c.viewportTransform;

    // Clear selection UI artifacts from export raster render
    c.discardActiveObject();

    // Lock workspace viewport rendering origin directly to physical vector artboard boundaries
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.setDimensions({ width: designWidth.current, height: designHeight.current });

    const dataUrl = c.toDataURL({ 
      format, 
      quality, 
      multiplier,
      left: 0,
      top: 0,
      width: designWidth.current,
      height: designHeight.current
    });

    // Seamlessly restore view matrix to UI working states
    if (savedVpTransform) c.setViewportTransform(savedVpTransform);
    if (activeObj) c.setActiveObject(activeObj);

    fitToContainer();
    return dataUrl;
  }, [fitToContainer]);

  /* ─── Project persistence ─── */
  const getJSON = useCallback((): object => {
    const c = canvasRef.current; if (!c) return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (c as any).toJSON(EXTRA_PROPS);
  }, []);

  const loadFromJSON = useCallback(async (json: object) => {
    const c = canvasRef.current; if (!c) return;
    // Guard against object:added/modified handlers pushing spurious undo entries
    // while we restore state, and clear existing objects first to prevent smear.
    isUndoRedoRef.current = true;
    c.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).loadFromJSON(json);
    isUndoRedoRef.current = false;
    c.renderAll(); syncObjects();
    options.onUndoRedoChange(false, false);
    undoStack.current = []; redoStack.current = [];
  }, [options, syncObjects]);

  /* ─── Canvas / layer ops ─── */
  const setCanvasSize = useCallback((width: number, height: number) => {
    designWidth.current = width; designHeight.current = height; fitToContainer();
  }, [fitToContainer]);

  const deleteSelected = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    c.getActiveObjects().forEach((o) => c.remove(o));
    c.discardActiveObject(); c.renderAll();
  }, []);

  const duplicateSelected = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const active = c.getActiveObject(); if (!active) return;
    active.clone().then((cloned: FabricObject) => {
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      (cloned as FabricObject & { _name: string })._name = `${(active as FabricObject & { _name?: string })._name || 'Object'} copy`;
      (cloned as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      c.add(cloned); c.setActiveObject(cloned); c.renderAll();
    });
  }, []);

  /* ─── Copy / Paste (internal canvas clipboard) ─── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clipboardRef = useRef<any>(null);

  const copySelected = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const active = c.getActiveObject(); if (!active) return;
    active.clone().then((cloned: FabricObject) => {
      clipboardRef.current = cloned;
    });
  }, []);

  const pasteSelected = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const src = clipboardRef.current; if (!src) return;
    src.clone().then((cloned: FabricObject) => {
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cloned as any)._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cloned as any)._name = `${(src as any)._name || 'Object'} copy`;
      c.add(cloned); c.setActiveObject(cloned); c.renderAll();
      pushUndo(); syncObjects();
    });
  }, [pushUndo, syncObjects]);

  const bringForward = useCallback((obj: FabricObject) => {
    const c = canvasRef.current; if (!c) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c as any).bringObjectForward(obj); c.renderAll(); syncObjects();
  }, [syncObjects]);

  const sendBackward = useCallback((obj: FabricObject) => {
    const c = canvasRef.current; if (!c) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c as any).sendObjectBackwards(obj); c.renderAll(); syncObjects();
  }, [syncObjects]);

  const toggleVisibility = useCallback((obj: FabricObject) => {
    obj.set('visible', !obj.visible); canvasRef.current?.renderAll(); syncObjects();
  }, [syncObjects]);

  const toggleLock = useCallback((obj: FabricObject) => {
    const locked = !obj.selectable;
    obj.set({ selectable: locked, evented: locked });
    if (!locked) canvasRef.current?.discardActiveObject();
    canvasRef.current?.renderAll(); syncObjects();
  }, [syncObjects]);

  const deleteObject = useCallback((obj: FabricObject) => {
    const c = canvasRef.current; if (!c) return;
    if (c.getActiveObject() === obj || c.getActiveObjects().includes(obj)) {
      c.discardActiveObject();
      setSelectedObject(null);
      options.onSelectionChange([]);
    }
    c.remove(obj); c.renderAll(); syncObjects();
  }, [options, syncObjects]);

  const getObjectById = useCallback((id: string): FabricObject | null => {
    const c = canvasRef.current; if (!c) return null;
    return c.getObjects().find((o) => objId(o) === id) || null;
  }, []);

  const selectObjectById = useCallback((id: string) => {
    const c = canvasRef.current; if (!c) return;
    const obj = c.getObjects().find((o) => objId(o) === id);
    if (obj) { c.setActiveObject(obj); c.renderAll(); }
  }, []);

  const selectObjectsByIds = useCallback((ids: string[]) => {
    const c = canvasRef.current; if (!c) return;
    const selected = ids
      .map((id) => c.getObjects().find((obj) => objId(obj) === id))
      .filter((obj): obj is FabricObject => Boolean(obj));
    c.discardActiveObject();
    if (selected.length === 1) {
      c.setActiveObject(selected[0]);
    } else if (selected.length > 1) {
      c.setActiveObject(new ActiveSelection(selected, { canvas: c }));
    }
    c.requestRenderAll();
  }, []);

  const groupSelected = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const selected = c.getActiveObjects();
    if (selected.length < 2) return;

    // Fabric 7 no longer exposes ActiveSelection.toGroup(). Constructing a
    // Group explicitly also keeps the conversion compatible with loaded
    // projects and preserves the children as real editable objects.
    c.discardActiveObject();
    const group = new Group(selected);
    c.remove(...selected);
    c.add(group);
    tagObj(group, 'group');
    c.setActiveObject(group);
    c.requestRenderAll();
    options.onSelectionChange([objId(group)]);
    setSelectedObject(group);
    pushUndo();
    syncObjects();
  }, [options, pushUndo, syncObjects]);

  const ungroupSelected = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const active = c.getActiveObject();
    if (!active || active.type !== 'group') return;

    // Fabric 7 removed Group.toActiveSelection(). Remove the children from
    // the group first so their canvas-space transforms are restored, then
    // reinsert them and recreate the visible multi-selection.
    const group = active as unknown as Group;
    const children = group.getObjects().slice();
    if (children.length === 0) return;
    group.remove(...children);
    c.remove(active);
    c.add(...children);
    const selection = new ActiveSelection(children, { canvas: c });
    c.setActiveObject(selection);
    c.requestRenderAll();
    const ids = selection.getObjects().map(objId);
    options.onSelectionChange(ids);
    setSelectedObject(selection);
    pushUndo();
    syncObjects();
  }, [options, pushUndo, syncObjects]);

  const getCanvas = () => canvasRef.current;

  return {
    getCanvas, objects, selectedObject, zoom, penPoints,
    dragInfo, isBrushActive, eyedropperActive,
    // Shapes
    addRect, addCircle, addTriangle, addLine, addText, addImageFromFile,
    addStar, addHexagon, addPentagon, addHeart, addRightTriangle, addArrow,
    // Vector paths
    addBezierCurve, addSplinePath,
    // Pen tool
    activatePenTool, activateBezierPen, activateSplinePen, cancelPenTool, closePenPath,
    // Brush engine
    activateBrush, deactivateBrush,
    // Eyedropper
    activateEyedropper, deactivateEyedropper,
    // Undo/redo/export
    pushUndoNow, commitChange,
    undo, redo, exportCanvas, getJSON, loadFromJSON,
    // Canvas ops
    setCanvasSize, setCanvasBackground, setGridOptions,
    // Pan + Zoom
    setPanMode, setZoomLevel, zoomIn, zoomOut, resetZoom,
    // Mask (clipPath)
    applyMaskFromSelection, releaseMask,
    // Object ops
    deleteSelected, duplicateSelected, copySelected, pasteSelected, bringForward, sendBackward,
    toggleVisibility, toggleLock, deleteObject, getObjectById, selectObjectById, selectObjectsByIds,
    groupSelected, ungroupSelected,
    moveObjectToIndex,
    // Image transforms
    flipHorizontal, flipVertical, rotate90,
    // Alignment
    alignObjects,
    // Effects
    applyInnerShadow, applyTexture, apply3DDepth, applyGlow,
    applyGradientFill, fillShapeWithImage, cropImage, applyCircularCrop, addRasterLayer, applyImageFilters,
    // Decoupled fill / stroke opacity
    applyFillOpacity, getFillOpacity, applyStrokeOpacity, getStrokeOpacity,
    // Pen bezier live handle (for SVG overlay in Canvas.tsx)
    penLiveHandle,
    // Vector anchor editor
    vectorAnchors, isVectorEditActive,
    activateVectorEdit, deactivateVectorEdit,
    vectorAnchorDragStart, vectorAnchorDragMove, vectorAnchorDragEnd,
    // Vector node editor panel
    selectedVectorAnchorIdx, setSelectedVectorAnchorIdx,
    addVectorNodeAfter, deleteSelectedVectorNode, nudgeSelectedVectorNode,
    // Util
    syncObjects, fitToContainer,
  };
}

export type CanvasController = ReturnType<typeof useFabricCanvas>;