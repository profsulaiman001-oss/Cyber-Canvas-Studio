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
} from 'fabric';

export interface ObjectMeta {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  selectable: boolean;
}

export interface CanvasBgConfig {
  type: 'solid' | 'transparent' | 'gradient';
  color: string;
  gradientType: 'linear' | 'radial';
  gradientStops: { offset: number; color: string }[];
}

export type AlignType = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV';

interface UseFabricCanvasOptions {
  width: number;
  height: number;
  onSelectionChange: (ids: string[]) => void;
  onCanvasChanged: () => void;
  onUndoRedoChange: (canUndo: boolean, canRedo: boolean) => void;
}

export interface PenPoint { x: number; y: number }

const MAX_UNDO = 50;
let objectSeq: Record<string, number> = {};

function nextName(type: string): string {
  objectSeq[type] = (objectSeq[type] || 0) + 1;
  const labels: Record<string, string> = {
    rect: 'Rectangle', circle: 'Circle', triangle: 'Triangle',
    line: 'Line', path: 'Path', 'i-text': 'Text', image: 'Image',
    star: 'Star', hexagon: 'Hexagon', pentagon: 'Pentagon',
    heart: 'Heart', arrow: 'Arrow',
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

/* ─── Inner shadow canvas renderer (called in after:render) ─── */
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

  // Clip to object shape
  ctx.beginPath();
  if (obj.type === 'circle') {
    const r = (obj as Circle).radius ?? w / 2;
    ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
  } else {
    const rx = (obj as Rect).rx ?? 0;
    if (rx > 0) {
      const x = -w / 2, y = -h / 2;
      ctx.moveTo(x + rx, y);
      ctx.lineTo(x + w - rx, y);
      ctx.arcTo(x + w, y, x + w, y + rx, rx);
      ctx.lineTo(x + w, y + h - rx);
      ctx.arcTo(x + w, y + h, x + w - rx, y + h, rx);
      ctx.lineTo(x + rx, y + h);
      ctx.arcTo(x, y + h, x, y + h - rx, rx);
      ctx.lineTo(x, y + rx);
      ctx.arcTo(x, y, x + rx, y, rx);
      ctx.closePath();
    } else {
      ctx.rect(-w / 2, -h / 2, w, h);
    }
  }
  ctx.clip();

  // Draw large ring outside + shadow bleeds inward through the clip
  ctx.shadowColor = cfg.color;
  ctx.shadowBlur = cfg.blur;
  ctx.shadowOffsetX = cfg.offsetX;
  ctx.shadowOffsetY = cfg.offsetY;
  ctx.globalAlpha = cfg.opacity / 100;
  ctx.fillStyle = cfg.color;

  ctx.beginPath();
  ctx.rect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2); // outer
  ctx.rect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);             // inner hole (even-odd)
  ctx.fill('evenodd');

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
  const isUndoRedo = useRef(false);
  const designWidth = useRef(options.width);
  const designHeight = useRef(options.height);
  const [objects, setObjects] = useState<ObjectMeta[]>([]);
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(null);
  const [zoom, setZoom] = useState(1);

  // Grid / snap refs (mutable, read inside Fabric event handlers)
  const gridEnabledRef = useRef(false);
  const snapToGridRef = useRef(false);
  const gridSizeRef = useRef(20);

  // Pen tool state
  const penActiveRef = useRef(false);
  const [penPoints, setPenPoints] = useState<PenPoint[]>([]);
  const penPointsRef = useRef<PenPoint[]>([]);
  const penPreviewRef = useRef<Path | null>(null);
  const penAnchorRefs = useRef<Circle[]>([]);

  const syncObjects = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const objs = c.getObjects().filter((o) => !(o as FabricObject & { _isPenAux?: boolean })._isPenAux);
    setObjects(
      [...objs].reverse().map((obj) => ({
        id: objId(obj),
        name: (obj as FabricObject & { _name?: string })._name || obj.type || 'Object',
        type: obj.type || 'object',
        visible: obj.visible !== false,
        selectable: obj.selectable !== false,
      }))
    );
  }, []);

  const pushUndo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || isUndoRedo.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = JSON.stringify((c as any).toJSON(['_uid', '_name', '_innerShadow', '_textureKey']));
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
    c.setZoom(newZoom);
    c.setDimensions({ width: w, height: h });
    const vpX = (w - designWidth.current * newZoom) / 2;
    const vpY = (h - designHeight.current * newZoom) / 2;
    c.setViewportTransform([newZoom, 0, 0, newZoom, vpX, vpY]);
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
      stroke: '#00F5FF',
      strokeWidth: 2,
      fill: 'transparent',
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
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
    if (pts.length < 2) {
      cancelPenTool();
      return;
    }
    // Remove aux objects
    if (penPreviewRef.current) { c.remove(penPreviewRef.current); penPreviewRef.current = null; }
    penAnchorRefs.current.forEach((ci) => c.remove(ci));
    penAnchorRefs.current = [];

    const isClosed = pts.length >= 3;
    const pathStr = buildPreviewPathStr(pts, isClosed);
    const finalPath = new Path(pathStr, {
      stroke: '#00F5FF',
      strokeWidth: 3,
      fill: isClosed ? 'rgba(0,245,255,0.25)' : 'transparent',
    });
    tagObj(finalPath, 'path');
    c.add(finalPath);
    c.setActiveObject(finalPath);

    // Reset pen state
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
    const handleChange = () => { if (!isUndoRedo.current) pushUndo(); syncObjects(); };

    c.on('selection:created', handleSelect);
    c.on('selection:updated', handleSelect);
    c.on('selection:cleared', handleDeselect);
    c.on('object:added', handleChange);
    c.on('object:modified', handleChange);
    c.on('object:removed', handleChange);

    /* ─── Snap to grid ─── */
    c.on('object:moving', (e) => {
      if (!snapToGridRef.current || !gridEnabledRef.current) return;
      const obj = e.target;
      const g = gridSizeRef.current;
      obj.set({
        left: Math.round((obj.left ?? 0) / g) * g,
        top: Math.round((obj.top ?? 0) / g) * g,
      });
    });

    /* ─── Inner shadow afterRender ─── */
    c.on('after:render', ({ ctx }) => {
      const vp = c.viewportTransform;
      if (!vp) return;
      c.getObjects().forEach((obj) => {
        const cfg = (obj as FabricObject & { _innerShadow?: { enabled: boolean; color: string; blur: number; offsetX: number; offsetY: number; opacity: number } })._innerShadow;
        if (!cfg?.enabled) return;
        drawInnerShadow(ctx, obj, cfg, vp);
      });
    });

    /* ─── Mouse:down – pen tool & pan ─── */
    let isPanning = false;
    let lastPanX = 0, lastPanY = 0;

    c.on('mouse:down', (opt) => {
      const me = opt.e as MouseEvent | TouchEvent;
      if (penActiveRef.current) {
        const pointer = c.getScenePoint(opt.e as MouseEvent);
        const pts = penPointsRef.current;
        // Close if clicking near first point
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

        // Add anchor circle
        const anchor = new Circle({
          left: pointer.x - 5,
          top: pointer.y - 5,
          radius: 5,
          fill: pts.length === 0 ? '#ff6b6b' : '#00F5FF',
          stroke: '#ffffff',
          strokeWidth: 1.5,
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
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
    c.on('mouse:up', () => { isPanning = false; if (!penActiveRef.current) c.selection = true; });

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
        const rect = el.getBoundingClientRect();
        const point = new Point(midX - rect.left, midY - rect.top);
        c.zoomToPoint(point, Math.min(Math.max(c.getZoom() * (dist / lastDist), 0.1), 10));
        c.relativePan(new Point(midX - lastMidX, midY - lastMidY));
        lastDist = dist; lastMidX = midX; lastMidY = midY;
        setZoom(c.getZoom());
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    /* ─── Mouse wheel zoom ─── */
    c.on('mouse:wheel', (opt) => {
      let z = Math.min(Math.max(c.getZoom() * 0.999 ** (opt.e as WheelEvent).deltaY, 0.1), 10);
      c.zoomToPoint(new Point((opt.e as WheelEvent).offsetX, (opt.e as WheelEvent).offsetY), z);
      opt.e.preventDefault();
      opt.e.stopPropagation();
      setZoom(z);
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
        coords:
          cfg.gradientType === 'radial'
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
    const obj = new IText('Tap to edit', { left: cx - 80, top: cy - 20, fontSize: 40, fill: '#ffffff', fontFamily: 'Inter' });
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

  /* ─── Alignment ─── */
  const alignObjects = useCallback((type: AlignType) => {
    const c = canvasRef.current; if (!c) return;
    const objs = c.getActiveObjects();
    if (!objs.length) return;

    const cw = designWidth.current;
    const ch = designHeight.current;
    const zoom = c.getZoom();
    const vp = c.viewportTransform || [1, 0, 0, 1, 0, 0];

    const toDesign = (br: { left: number; top: number; width: number; height: number }) => ({
      left: (br.left - vp[4]) / zoom,
      top: (br.top - vp[5]) / zoom,
      width: br.width / zoom,
      height: br.height / zoom,
    });

    if (objs.length === 1) {
      const obj = objs[0];
      const dr = toDesign(obj.getBoundingRect());
      const dLeft = (obj.left ?? 0) - dr.left;
      const dTop = (obj.top ?? 0) - dr.top;
      switch (type) {
        case 'left': obj.set({ left: dLeft }); break;
        case 'right': obj.set({ left: cw - dr.width + dLeft }); break;
        case 'top': obj.set({ top: dTop }); break;
        case 'bottom': obj.set({ top: ch - dr.height + dTop }); break;
        case 'centerH': obj.set({ left: (cw - dr.width) / 2 + dLeft }); break;
        case 'centerV': obj.set({ top: (ch - dr.height) / 2 + dTop }); break;
      }
      obj.setCoords();
    } else {
      c.discardActiveObject();
      const infos = objs.map((obj) => {
        const dr = toDesign(obj.getBoundingRect());
        return { obj, dr, dLeft: (obj.left ?? 0) - dr.left, dTop: (obj.top ?? 0) - dr.top };
      });
      const minLeft = Math.min(...infos.map((i) => i.dr.left));
      const maxRight = Math.max(...infos.map((i) => i.dr.left + i.dr.width));
      const minTop = Math.min(...infos.map((i) => i.dr.top));
      const maxBottom = Math.max(...infos.map((i) => i.dr.top + i.dr.height));
      const totalW = maxRight - minLeft;
      const totalH = maxBottom - minTop;
      infos.forEach(({ obj, dr, dLeft, dTop }) => {
        switch (type) {
          case 'left': obj.set({ left: minLeft + dLeft }); break;
          case 'right': obj.set({ left: maxRight - dr.width + dLeft }); break;
          case 'top': obj.set({ top: minTop + dTop }); break;
          case 'bottom': obj.set({ top: maxBottom - dr.height + dTop }); break;
          case 'centerH': obj.set({ left: minLeft + (totalW - dr.width) / 2 + dLeft }); break;
          case 'centerV': obj.set({ top: minTop + (totalH - dr.height) / 2 + dTop }); break;
        }
        obj.setCoords();
      });
      const sel = new ActiveSelection(objs, { canvas: c });
      c.setActiveObject(sel);
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
      c.requestRenderAll();
      return;
    }
    // Store original fill
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

  /* ─── Undo / Redo ─── */
  const undo = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || undoStack.current.length === 0) return;
    isUndoRedo.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redoStack.current.push(JSON.stringify((c as any).toJSON(['_uid', '_name', '_innerShadow', '_textureKey'])));
    const prev = undoStack.current.pop()!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).loadFromJSON(JSON.parse(prev));
    c.renderAll();
    isUndoRedo.current = false;
    options.onUndoRedoChange(undoStack.current.length > 0, redoStack.current.length > 0);
    syncObjects(); setSelectedObject(null); options.onSelectionChange([]);
  }, [options, syncObjects]);

  const redo = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || redoStack.current.length === 0) return;
    isUndoRedo.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    undoStack.current.push(JSON.stringify((c as any).toJSON(['_uid', '_name', '_innerShadow', '_textureKey'])));
    const next = redoStack.current.pop()!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).loadFromJSON(JSON.parse(next));
    c.renderAll();
    isUndoRedo.current = false;
    options.onUndoRedoChange(undoStack.current.length > 0, redoStack.current.length > 0);
    syncObjects(); setSelectedObject(null); options.onSelectionChange([]);
  }, [options, syncObjects]);

  /* ─── Export ─── */
  const exportCanvas = useCallback((format: 'png' | 'jpeg', quality: number, multiplier: number): string => {
    const c = canvasRef.current; if (!c) return '';
    const vt = c.viewportTransform;
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.setDimensions({ width: designWidth.current, height: designHeight.current });
    const dataUrl = c.toDataURL({ format, quality, multiplier });
    c.setViewportTransform(vt || [1, 0, 0, 1, 0, 0]);
    fitToContainer();
    return dataUrl;
  }, [fitToContainer]);

  /* ─── Project persistence ─── */
  const getJSON = useCallback((): object => {
    const c = canvasRef.current; if (!c) return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (c as any).toJSON(['_uid', '_name', '_innerShadow', '_textureKey']);
  }, []);

  const loadFromJSON = useCallback(async (json: object) => {
    const c = canvasRef.current; if (!c) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (c as any).loadFromJSON(json);
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
    c.remove(obj); c.renderAll();
  }, []);

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
    // Shapes
    addRect, addCircle, addTriangle, addLine, addText, addImageFromFile,
    addStar, addHexagon, addPentagon, addHeart, addRightTriangle, addArrow,
    // Pen tool
    activatePenTool, cancelPenTool, closePenPath,
    // Undo/redo/export
    undo, redo, exportCanvas, getJSON, loadFromJSON,
    // Canvas ops
    setCanvasSize, setCanvasBackground, setGridOptions,
    // Object ops
    deleteSelected, duplicateSelected, bringForward, sendBackward,
    toggleVisibility, toggleLock, deleteObject, getObjectById, selectObjectById,
    // Alignment
    alignObjects,
    // Effects
    applyInnerShadow, applyTexture,
    // Util
    syncObjects, fitToContainer,
  };
}

export type CanvasController = ReturnType<typeof useFabricCanvas>;
