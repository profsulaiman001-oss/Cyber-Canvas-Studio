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
} from 'fabric';

export interface ObjectMeta {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  selectable: boolean;
}

interface UseFabricCanvasOptions {
  width: number;
  height: number;
  onSelectionChange: (ids: string[]) => void;
  onCanvasChanged: () => void;
  onUndoRedoChange: (canUndo: boolean, canRedo: boolean) => void;
}

const MAX_UNDO = 50;
let objectSeq: Record<string, number> = {};

function nextName(type: string): string {
  objectSeq[type] = (objectSeq[type] || 0) + 1;
  const labels: Record<string, string> = {
    rect: 'Rectangle',
    circle: 'Circle',
    triangle: 'Triangle',
    line: 'Line',
    path: 'Curve',
    'i-text': 'Text',
    image: 'Image',
  };
  return `${labels[type] || type} ${objectSeq[type]}`;
}

function objId(obj: FabricObject): string {
  if (!obj.get('_uid')) {
    (obj as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
  return (obj as FabricObject & { _uid: string })._uid;
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

  const syncObjects = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const objs = c.getObjects().map((obj) => ({
      id: objId(obj),
      name: (obj as FabricObject & { _name?: string })._name || obj.type || 'Object',
      type: obj.type || 'object',
      visible: obj.visible !== false,
      selectable: obj.selectable !== false,
    }));
    setObjects([...objs].reverse());
  }, []);

  const pushUndo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || isUndoRedo.current) return;
    const json = JSON.stringify(c.toJSON(['_uid', '_name']));
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

  useEffect(() => {
    if (!canvasEl.current) return;
    const c = new Canvas(canvasEl.current, {
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    });
    canvasRef.current = c;

    const init = () => {
      designWidth.current = options.width;
      designHeight.current = options.height;
      fitToContainer();
    };
    init();

    const handleSelect = () => {
      const active = c.getActiveObject();
      if (active) {
        const ids = c.getActiveObjects().map(objId);
        setSelectedObject(active);
        options.onSelectionChange(ids);
      }
    };
    const handleDeselect = () => {
      setSelectedObject(null);
      options.onSelectionChange([]);
    };
    const handleChange = () => {
      if (!isUndoRedo.current) pushUndo();
      syncObjects();
    };

    c.on('selection:created', handleSelect);
    c.on('selection:updated', handleSelect);
    c.on('selection:cleared', handleDeselect);
    c.on('object:added', handleChange);
    c.on('object:modified', handleChange);
    c.on('object:removed', handleChange);

    // Pinch to zoom
    let lastDist = 0;
    let lastMidX = 0;
    let lastMidY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        lastDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        lastMidX = (t0.clientX + t1.clientX) / 2;
        lastMidY = (t0.clientY + t1.clientY) / 2;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        const ratio = dist / lastDist;
        const rect = canvasEl.current!.getBoundingClientRect();
        const point = new Point(midX - rect.left, midY - rect.top);
        const newZoom = Math.min(Math.max(c.getZoom() * ratio, 0.1), 10);
        c.zoomToPoint(point, newZoom);
        c.relativePan(new Point(midX - lastMidX, midY - lastMidY));
        lastDist = dist;
        lastMidX = midX;
        lastMidY = midY;
        setZoom(newZoom);
      }
    };
    const el = canvasEl.current;
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    // Mouse wheel zoom
    c.on('mouse:wheel', (opt) => {
      const delta = (opt.e as WheelEvent).deltaY;
      let z = c.getZoom();
      z *= 0.999 ** delta;
      z = Math.min(Math.max(z, 0.1), 10);
      c.zoomToPoint(new Point((opt.e as WheelEvent).offsetX, (opt.e as WheelEvent).offsetY), z);
      opt.e.preventDefault();
      opt.e.stopPropagation();
      setZoom(z);
    });

    // Alt/space + drag to pan
    let isPanning = false;
    let lastPanX = 0;
    let lastPanY = 0;
    c.on('mouse:down', (opt) => {
      if ((opt.e as MouseEvent).altKey) {
        isPanning = true;
        c.selection = false;
        lastPanX = (opt.e as MouseEvent).clientX;
        lastPanY = (opt.e as MouseEvent).clientY;
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
      c.selection = true;
    });

    const ro = new ResizeObserver(() => fitToContainer());
    if (containerEl.current) ro.observe(containerEl.current);

    return () => {
      c.off('selection:created', handleSelect);
      c.off('selection:updated', handleSelect);
      c.off('selection:cleared', handleDeselect);
      c.off('object:added', handleChange);
      c.off('object:modified', handleChange);
      c.off('object:removed', handleChange);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      ro.disconnect();
      c.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEl]);

  const getCanvas = () => canvasRef.current;

  const addRect = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const vt = c.viewportTransform;
    const cx = (c.width / 2 - (vt ? vt[4] : 0)) / c.getZoom();
    const cy = (c.height / 2 - (vt ? vt[5] : 0)) / c.getZoom();
    const obj = new Rect({
      left: cx - 50,
      top: cy - 50,
      width: 100,
      height: 100,
      fill: '#00F5FF',
      stroke: 'transparent',
      strokeWidth: 0,
    });
    (obj as FabricObject & { _name: string })._name = nextName('rect');
    (obj as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    c.add(obj);
    c.setActiveObject(obj);
    c.renderAll();
  }, []);

  const addCircle = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const vt = c.viewportTransform;
    const cx = (c.width / 2 - (vt ? vt[4] : 0)) / c.getZoom();
    const cy = (c.height / 2 - (vt ? vt[5] : 0)) / c.getZoom();
    const obj = new Circle({
      left: cx - 50,
      top: cy - 50,
      radius: 50,
      fill: '#00F5FF',
      stroke: 'transparent',
      strokeWidth: 0,
    });
    (obj as FabricObject & { _name: string })._name = nextName('circle');
    (obj as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    c.add(obj);
    c.setActiveObject(obj);
    c.renderAll();
  }, []);

  const addTriangle = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const vt = c.viewportTransform;
    const cx = (c.width / 2 - (vt ? vt[4] : 0)) / c.getZoom();
    const cy = (c.height / 2 - (vt ? vt[5] : 0)) / c.getZoom();
    const obj = new Triangle({
      left: cx - 50,
      top: cy - 60,
      width: 100,
      height: 100,
      fill: '#00F5FF',
      stroke: 'transparent',
      strokeWidth: 0,
    });
    (obj as FabricObject & { _name: string })._name = nextName('triangle');
    (obj as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    c.add(obj);
    c.setActiveObject(obj);
    c.renderAll();
  }, []);

  const addLine = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const vt = c.viewportTransform;
    const cx = (c.width / 2 - (vt ? vt[4] : 0)) / c.getZoom();
    const cy = (c.height / 2 - (vt ? vt[5] : 0)) / c.getZoom();
    const obj = new Line([cx - 80, cy, cx + 80, cy], {
      stroke: '#00F5FF',
      strokeWidth: 3,
      fill: 'transparent',
    });
    (obj as FabricObject & { _name: string })._name = nextName('line');
    (obj as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    c.add(obj);
    c.setActiveObject(obj);
    c.renderAll();
  }, []);

  const addBezierPath = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const vt = c.viewportTransform;
    const cx = (c.width / 2 - (vt ? vt[4] : 0)) / c.getZoom();
    const cy = (c.height / 2 - (vt ? vt[5] : 0)) / c.getZoom();
    const obj = new Path(
      `M ${cx - 80} ${cy} C ${cx - 40} ${cy - 80}, ${cx + 40} ${cy + 80}, ${cx + 80} ${cy}`,
      {
        stroke: '#00F5FF',
        strokeWidth: 3,
        fill: 'transparent',
      }
    );
    (obj as FabricObject & { _name: string })._name = nextName('path');
    (obj as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    c.add(obj);
    c.setActiveObject(obj);
    c.renderAll();
  }, []);

  const addText = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const vt = c.viewportTransform;
    const cx = (c.width / 2 - (vt ? vt[4] : 0)) / c.getZoom();
    const cy = (c.height / 2 - (vt ? vt[5] : 0)) / c.getZoom();
    const obj = new IText('Tap to edit', {
      left: cx - 80,
      top: cy - 20,
      fontSize: 40,
      fill: '#ffffff',
      fontFamily: 'Inter',
    });
    (obj as FabricObject & { _name: string })._name = nextName('i-text');
    (obj as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    c.add(obj);
    c.setActiveObject(obj);
    c.renderAll();
  }, []);

  const addImageFromFile = useCallback(async (file: File) => {
    const c = canvasRef.current;
    if (!c) return;
    const url = URL.createObjectURL(file);
    try {
      const img = await FabricImage.fromURL(url);
      const maxDim = Math.min(designWidth.current, designHeight.current) * 0.5;
      const scale = Math.min(maxDim / (img.width || 1), maxDim / (img.height || 1));
      img.scale(scale);
      const vt = c.viewportTransform;
      const cx = (c.width / 2 - (vt ? vt[4] : 0)) / c.getZoom();
      const cy = (c.height / 2 - (vt ? vt[5] : 0)) / c.getZoom();
      img.set({ left: cx - (img.width || 0) * scale / 2, top: cy - (img.height || 0) * scale / 2 });
      (img as FabricObject & { _name: string })._name = nextName('image');
      (img as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      c.add(img);
      c.setActiveObject(img);
      c.renderAll();
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const undo = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || undoStack.current.length === 0) return;
    isUndoRedo.current = true;
    const current = JSON.stringify(c.toJSON(['_uid', '_name']));
    redoStack.current.push(current);
    const prev = undoStack.current.pop()!;
    await c.loadFromJSON(JSON.parse(prev));
    c.renderAll();
    isUndoRedo.current = false;
    options.onUndoRedoChange(undoStack.current.length > 0, redoStack.current.length > 0);
    syncObjects();
    setSelectedObject(null);
    options.onSelectionChange([]);
  }, [options, syncObjects]);

  const redo = useCallback(async () => {
    const c = canvasRef.current;
    if (!c || redoStack.current.length === 0) return;
    isUndoRedo.current = true;
    const current = JSON.stringify(c.toJSON(['_uid', '_name']));
    undoStack.current.push(current);
    const next = redoStack.current.pop()!;
    await c.loadFromJSON(JSON.parse(next));
    c.renderAll();
    isUndoRedo.current = false;
    options.onUndoRedoChange(undoStack.current.length > 0, redoStack.current.length > 0);
    syncObjects();
    setSelectedObject(null);
    options.onSelectionChange([]);
  }, [options, syncObjects]);

  const exportCanvas = useCallback(
    (format: 'png' | 'jpeg', quality: number, multiplier: number): string => {
      const c = canvasRef.current;
      if (!c) return '';
      const vt = c.viewportTransform;
      c.setViewportTransform([1, 0, 0, 1, 0, 0]);
      c.setDimensions({ width: designWidth.current, height: designHeight.current });
      const dataUrl = c.toDataURL({ format, quality, multiplier });
      c.setViewportTransform(vt || [1, 0, 0, 1, 0, 0]);
      fitToContainer();
      return dataUrl;
    },
    [fitToContainer]
  );

  const getJSON = useCallback((): object => {
    const c = canvasRef.current;
    if (!c) return {};
    return c.toJSON(['_uid', '_name']);
  }, []);

  const loadFromJSON = useCallback(
    async (json: object) => {
      const c = canvasRef.current;
      if (!c) return;
      await c.loadFromJSON(json);
      c.renderAll();
      syncObjects();
      options.onUndoRedoChange(false, false);
      undoStack.current = [];
      redoStack.current = [];
    },
    [options, syncObjects]
  );

  const setCanvasSize = useCallback(
    (width: number, height: number) => {
      designWidth.current = width;
      designHeight.current = height;
      fitToContainer();
    },
    [fitToContainer]
  );

  const deleteSelected = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const actives = c.getActiveObjects();
    actives.forEach((obj) => c.remove(obj));
    c.discardActiveObject();
    c.renderAll();
  }, []);

  const duplicateSelected = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const active = c.getActiveObject();
    if (!active) return;
    active.clone().then((cloned: FabricObject) => {
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      const origName = (active as FabricObject & { _name?: string })._name || 'Object';
      (cloned as FabricObject & { _name: string })._name = `${origName} copy`;
      (cloned as FabricObject & { _uid: string })._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      c.add(cloned);
      c.setActiveObject(cloned);
      c.renderAll();
    });
  }, []);

  const bringForward = useCallback((obj: FabricObject) => {
    const c = canvasRef.current;
    if (!c) return;
    c.bringObjectForward(obj);
    c.renderAll();
    syncObjects();
  }, [syncObjects]);

  const sendBackward = useCallback((obj: FabricObject) => {
    const c = canvasRef.current;
    if (!c) return;
    c.sendObjectBackwards(obj);
    c.renderAll();
    syncObjects();
  }, [syncObjects]);

  const toggleVisibility = useCallback((obj: FabricObject) => {
    obj.set('visible', !obj.visible);
    canvasRef.current?.renderAll();
    syncObjects();
  }, [syncObjects]);

  const toggleLock = useCallback((obj: FabricObject) => {
    const locked = !obj.selectable;
    obj.set({ selectable: locked, evented: locked });
    if (!locked) {
      canvasRef.current?.discardActiveObject();
    }
    canvasRef.current?.renderAll();
    syncObjects();
  }, [syncObjects]);

  const deleteObject = useCallback((obj: FabricObject) => {
    const c = canvasRef.current;
    if (!c) return;
    c.remove(obj);
    c.renderAll();
  }, []);

  const getObjectById = useCallback((id: string): FabricObject | null => {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getObjects().find((obj) => objId(obj) === id) || null;
  }, []);

  const selectObjectById = useCallback((id: string) => {
    const c = canvasRef.current;
    if (!c) return;
    const obj = c.getObjects().find((o) => objId(o) === id);
    if (obj) {
      c.setActiveObject(obj);
      c.renderAll();
    }
  }, []);

  return {
    getCanvas,
    objects,
    selectedObject,
    zoom,
    addRect,
    addCircle,
    addTriangle,
    addLine,
    addBezierPath,
    addText,
    addImageFromFile,
    undo,
    redo,
    exportCanvas,
    getJSON,
    loadFromJSON,
    setCanvasSize,
    deleteSelected,
    duplicateSelected,
    bringForward,
    sendBackward,
    toggleVisibility,
    toggleLock,
    deleteObject,
    getObjectById,
    selectObjectById,
    syncObjects,
    fitToContainer,
  };
}

export type CanvasController = ReturnType<typeof useFabricCanvas>;
