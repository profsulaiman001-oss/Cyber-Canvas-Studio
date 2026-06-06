import { useEffect, useRef, useCallback, useState } from 'react';
import {
  Canvas,
  Rect,
  Circle,
  Triangle,
  Line,
  IText,
  FabricImage,
  Path,
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

export interface ObjectMeta {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  selectable: boolean;
  fill?: string;
  imgSrc?: string;
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

export interface PenPoint { x: number; y: number }

export interface VectorAnchor {
  cmdIdx: number;
  xOff: number;
  yOff: number;
  localX: number;
  localY: number;
  screenX: number;
  screenY: number;
}

const MAX_UNDO = 50;
const EXTRA_PROPS = ['_uid', '_name', '_innerShadow', '_textureKey', '_depth3d', '_glow'];
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
  ctx.setTransform(vp[0], vp[1], vp[2], vp[3], vp[4], vp[5]);
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
  cfg: { steps: number; color: string; angle: number },
  vp: number[]
) {
  const { steps, color, angle } = cfg;
  const ar = (angle * Math.PI) / 180;
  const baseOpacity = obj.opacity ?? 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = obj as any;
  const origFill = o.fill;
  const origShadow = o.shadow;
  const origSW = o.strokeWidth;
  o.fill = color;
  o.shadow = null;
  o.strokeWidth = 0;
  for (let i = 1; i <= steps; i++) {
    const ox = Math.cos(ar) * i;
    const oy = Math.sin(ar) * i;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.globalAlpha = baseOpacity * Math.max(0.25, 1 - 0.65 * (i / steps));
    ctx.setTransform(vp[0], vp[1], vp[2], vp[3], vp[4], vp[5]);
    ctx.translate(ox, oy);
    obj.render(ctx);
    ctx.restore();
  }
  o.fill = origFill;
  o.shadow = origShadow;
  o.strokeWidth = origSW;
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
  const designWidth = useRef(options.width);
  const designHeight = useRef(options.height);
  const [objects, setObjects] = useState<ObjectMeta[]>([]);
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
  const brushActiveRef = useRef(false);
  const eyedropperActiveRef = useRef(false);
  const eyedropperCallbackRef = useRef<((color: string) => void) | null>(null);
  const brushPresetRef = useRef<BrushPreset>('standard');
  const vectorEditObjRef = useRef<FabricObject | null>(null);
  const vectorDragStartRef = useRef<{ anchorIdx: number; localX: number; localY: number } | null>(null);
  const [vectorAnchors, setVectorAnchors] = useState<VectorAnchor[]>([]);

  // Pen tool state
  const [penPoints, setPenPoints] = useState<PenPoint[]>([]);
  const penPointsRef = useRef<PenPoint[]>([]);
  const penPreviewRef = useRef<Path | null>(null);
  const penAnchorRefs = useRef<Circle[]>([]);

  const syncObjects = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objs = c.getObjects().filter((o) => !(o as any)._isPenAux && !(o as any)._isAuxLayer);
    setObjects(
      [...objs].reverse().map((obj) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const o = obj as any;
        const fill = typeof obj.fill === 'string' ? obj.fill : undefined;
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
          name: o._name || obj.type || 'Object',
          type: obj.type || 'object',
          visible: obj.visible !== false,
          selectable: obj.selectable !== false,
          fill,
          imgSrc,
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
  }, [containerEl]);

  /* ─── Pen tool helpers ─── */
  const buildPreviewPathStr = (pts: PenPoint[], closed = false): string => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    if (closed) d += ' Z';
    return d;
  };

  const updatePenPreview = useCallback((pts: PenPoint[]) => {
    const c = canvasRef.current;
    if (!c || pts.length < 2) return;
    if (penPreviewRef.current) c.remove(penPreviewRef.current);
    const p = new Path(buildPreviewPathStr(pts, false), {
      stroke: '#00F5FF', strokeWidth: 2, fill: 'transparent',
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

    const isClosed = pts.length >= 3;
    const pathStr = buildPreviewPathStr(pts, isClosed);
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
    c.selection = true;
    c.requestRenderAll();
    pushUndo();
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
    penActiveRef.current = false;
    c.selection = true;
    c.requestRenderAll();
  }

  const activatePenTool = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    penActiveRef.current = true;
    penPointsRef.current = [];
    setPenPoints([]);
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

    /* ─── After:render – inner shadow + 3D extrusion ─── */
    c.on('after:render', ({ ctx }) => {
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
        if (pts.length >= 3) {
          const first = pts[0];
          if (Math.hypot(pointer.x - first.x, pointer.y - first.y) < 20 / c.getZoom()) {
            closePenPath();
            return;
          }
        }
        const newPts = [...pts, { x: pointer.x, y: pointer.y }];
        penPointsRef.current = newPts;
        setPenPoints([...newPts]);
        const anchor = new Circle({
          left: pointer.x - 5, top: pointer.y - 5, radius: 5,
          fill: pts.length === 0 ? '#ff6b6b' : '#00F5FF',
          stroke: '#ffffff', strokeWidth: 1.5,
          selectable: false, evented: false, hasControls: false, hasBorders: false,
        });
        (anchor as unknown as Record<string, unknown>)._isPenAux = true;
        c.add(anchor);
        penAnchorRefs.current.push(anchor);
        updatePenPreview(newPts);
        return;
      }
      if ((me as MouseEvent).altKey) {
        isPanning = true;
        c.selection = false;
        lastPanX = (me as MouseEvent).clientX;
        lastPanY = (me as MouseEvent).clientY;
      }
    });

    c.on('mouse:move', (opt) => {
      if (isPanning) {
        const dx = (opt.e as MouseEvent).clientX - lastPanX;
        const dy = (opt.e as MouseEvent).clientY - lastPanY;
        c.relativePan(new Point(dx, dy));
        lastPanX = (opt.e as MouseEvent).clientX;
        lastPanY = (opt.e as MouseEvent).clientY;
      }
    });

    c.on('mouse:up', () => {
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
        const z = Math.min(Math.max(c.getZoom() * (dist / lastDist), 0.1), 10);
        // Resize canvas to exact design area at new zoom; keep coordinate origin at (0,0)
        c.setDimensions({ width: Math.round(designWidth.current * z), height: Math.round(designHeight.current * z) });
        c.setViewportTransform([z, 0, 0, z, 0, 0]);
        c.relativePan(new Point(midX - lastMidX, midY - lastMidY));
        lastDist = dist; lastMidX = midX; lastMidY = midY;
        setZoom(z);
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    /* ─── Mouse wheel zoom ─── */
    c.on('mouse:wheel', (opt) => {
      const ev = opt.e as WheelEvent;
      const z = Math.min(Math.max(c.getZoom() * (0.999 ** ev.deltaY), 0.1), 10);
      // Resize canvas to the exact design area at the new zoom; viewport origin stays at (0,0)
      c.setDimensions({ width: Math.round(designWidth.current * z), height: Math.round(designHeight.current * z) });
      c.setViewportTransform([z, 0, 0, z, 0, 0]);
      ev.preventDefault();
      ev.stopPropagation();
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
    const obj = new Rect({ left: cx - 50, top: cy - 50, width: 100, height: 100, fill: '#00F5FF', strokeWidth: 0 });
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
    const obj = new IText('Tap to edit', { left: cx - 80, top: cy - 20, fontSize: 40, fill: '#1A1A1A', fontFamily: 'Inter' });
    tagObj(obj, 'i-text'); c.add(obj); c.setActiveObject(obj); c.renderAll();
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
  const apply3DDepth = useCallback((obj: FabricObject | null, cfg: { enabled: boolean; steps: number; color: string; angle: number } | null) => {
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
    type: 'linear' | 'radial',
    stops: { offset: number; color: string }[],
    radialRadius?: number,
  ) => {
    if (!obj) return;
    const c = canvasRef.current; if (!c) return;
    const w = obj.width ?? 100;
    const h = obj.height ?? 100;
    const r2 = radialRadius ?? Math.max(w, h) / 2;
    const grad = new Gradient({
      type: type === 'radial' ? 'radial' : 'linear',
      coords: type === 'radial'
        ? { x1: 0, y1: 0, r1: 0, x2: 0, y2: 0, r2 }
        : { x1: -w / 2, y1: 0, x2: w / 2, y2: 0 },
      colorStops: stops,
      gradientUnits: 'pixels',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    obj.set('fill', grad as any);
    c.requestRenderAll();
  }, []);

  /* ─── Fill Shape with Image (CSS background-size: cover — proportional, centered) ─── */
  const fillShapeWithImage = useCallback(async (obj: FabricObject, file: File) => {
    const c = canvasRef.current; if (!c) return;
    const url = URL.createObjectURL(file);
    try {
      const fabImg = await FabricImage.fromURL(url);
      const w = obj.width ?? 100;
      const h = obj.height ?? 100;
      const imgW = fabImg.width || 1;
      const imgH = fabImg.height || 1;
      // Cover: scale uniformly so image fills every pixel of the shape
      const scale = Math.max(w / imgW, h / imgH);
      const scaledW = imgW * scale;
      const scaledH = imgH * scale;
      // Center the scaled image within the shape coordinate space
      const offsetX = -w / 2 - (scaledW - w) / 2;
      const offsetY = -h / 2 - (scaledH - h) / 2;
      const pat = new Pattern({
        source: fabImg.getElement() as HTMLImageElement,
        repeat: 'no-repeat',
        patternTransform: [scale, 0, 0, scale, offsetX, offsetY],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      obj.set('fill', pat as any);
      c.requestRenderAll();
      pushUndo();
    } finally {
      URL.revokeObjectURL(url);
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

  /* ─── Crop Image ─── */
  const cropImage = useCallback((obj: FabricObject, cropX: number, cropY: number, cropW: number, cropH: number) => {
    const c = canvasRef.current; if (!c) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).set({ cropX, cropY, width: cropW, height: cropH });
    obj.setCoords();
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
    brush.width = size;

    if (preset === 'standard') {
      brush.color = color;
      brush.shadow = null;
    } else if (preset === 'glow') {
      // Photoshop-style neon: barely-visible thin core + massive glow aura via shadow blur
      const [r, g, b] = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
      brush.color = `rgba(${r},${g},${b},0.08)`;  // near-transparent core
      brush.width = Math.max(1, size * 0.18);       // ultra-thin stroke
      brush.shadow = new Shadow({ color, blur: size * 8, offsetX: 0, offsetY: 0 });
    } else if (preset === 'airbrush') {
      const [r, g, b] = [
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
      ];
      brush.color = `rgba(${r},${g},${b},0.08)`;
      brush.width = size * 4;
      brush.shadow = null;
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
    rawPath.forEach((cmd, cmdIdx) => {
      let xOff = -1, yOff = -1, lx = 0, ly = 0;
      if (cmd[0] === 'M' || cmd[0] === 'L') { xOff = 1; yOff = 2; lx = cmd[1] as number; ly = cmd[2] as number; }
      else if (cmd[0] === 'C') { xOff = 5; yOff = 6; lx = cmd[5] as number; ly = cmd[6] as number; }
      else if (cmd[0] === 'Q') { xOff = 3; yOff = 4; lx = cmd[3] as number; ly = cmd[4] as number; }
      if (xOff < 0) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cp = util.transformPoint({ x: lx, y: ly }, matrix as any);
      anchors.push({ cmdIdx, xOff, yOff, localX: lx, localY: ly, screenX: vt[4] + cp.x * vt[0], screenY: vt[5] + cp.y * vt[3] });
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
  }, [refreshVectorAnchors]);

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
    const rawPath: [string, ...number[]][] = [...((obj as any).path ?? [])];
    const vt = c.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const canvasDx = totalClientDx / (vt[0] || 1);
    const canvasDy = totalClientDy / (vt[3] || 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inv = util.invertTransform(obj.calcTransformMatrix() as any);
    const localDx = inv[0] * canvasDx + inv[2] * canvasDy;
    const localDy = inv[1] * canvasDx + inv[3] * canvasDy;
    const newPath = rawPath.map((cmd, i) => {
      if (i !== anchor.cmdIdx) return cmd;
      const nc = [...cmd] as [string, ...number[]];
      nc[anchor.xOff] = drag.localX + localDx;
      nc[anchor.yOff] = drag.localY + localDy;
      return nc;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).set({ path: newPath });
    obj.setCoords();
    c.requestRenderAll();
    refreshVectorAnchors();
  }, [vectorAnchors, refreshVectorAnchors]);

  const vectorAnchorDragEnd = useCallback(() => {
    vectorDragStartRef.current = null;
    pushUndo();
  }, [pushUndo]);

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

  const getCanvas = () => canvasRef.current;

  return {
    getCanvas, objects, selectedObject, zoom, penPoints,
    dragInfo, isBrushActive, eyedropperActive,
    // Shapes
    addRect, addCircle, addTriangle, addLine, addText, addImageFromFile,
    addStar, addHexagon, addPentagon, addHeart, addRightTriangle, addArrow,
    // Pen tool
    activatePenTool, cancelPenTool, closePenPath,
    // Brush engine
    activateBrush, deactivateBrush,
    // Eyedropper
    activateEyedropper, deactivateEyedropper,
    // Undo/redo/export
    undo, redo, exportCanvas, getJSON, loadFromJSON,
    // Canvas ops
    setCanvasSize, setCanvasBackground, setGridOptions,
    // Object ops
    deleteSelected, duplicateSelected, bringForward, sendBackward,
    toggleVisibility, toggleLock, deleteObject, getObjectById, selectObjectById,
    moveObjectToIndex,
    // Image transforms
    flipHorizontal, flipVertical, rotate90,
    // Alignment
    alignObjects,
    // Effects
    applyInnerShadow, applyTexture, apply3DDepth, applyGlow,
    applyGradientFill, fillShapeWithImage, cropImage, applyImageFilters,
    // Vector anchor editor
    vectorAnchors, activateVectorEdit, deactivateVectorEdit,
    vectorAnchorDragStart, vectorAnchorDragMove, vectorAnchorDragEnd,
    // Util
    syncObjects, fitToContainer,
  };
}

export type CanvasController = ReturnType<typeof useFabricCanvas>;