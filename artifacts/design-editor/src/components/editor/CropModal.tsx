import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FlipHorizontal, FlipVertical, RotateCcw } from 'lucide-react';
import { FabricImage, FabricObject } from 'fabric';

type HandleId = 'tl' | 'tm' | 'tr' | 'ml' | 'mr' | 'bl' | 'bm' | 'br' | 'move';
type CropMode = 'image' | 'fill' | 'raster';
type ARPreset = { label: string; value: [number, number] | null };

const AR_PRESETS: ARPreset[] = [
  { label: 'Free', value: null },
  { label: '1:1', value: [1, 1] },
  { label: '3:4', value: [3, 4] },
  { label: '4:5', value: [4, 5] },
  { label: '16:9', value: [16, 9] },
  { label: '9:16', value: [9, 16] },
];

export interface CropModalProps {
  open: boolean;
  onClose: () => void;
  mode: CropMode;
  fabricObj?: FabricObject | null;
  file?: File | null;
  dataUrl?: string;
  sourceW?: number;
  sourceH?: number;
  onApplyImage?: (cropX: number, cropY: number, cropW: number, cropH: number, circular: boolean) => void;
  onApplyFill?: (canvas: HTMLCanvasElement, circular: boolean) => void;
  onApplyRaster?: (
    canvas: HTMLCanvasElement,
    circular: boolean,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number,
  ) => void;
  onFlipH?: () => void;
  onFlipV?: () => void;
  onRotate90?: () => void;
}

export default function CropModal({
  open, onClose, mode,
  fabricObj, file, dataUrl, sourceW = 1, sourceH = 1,
  onApplyImage, onApplyFill, onApplyRaster,
  onFlipH, onFlipV, onRotate90,
}: CropModalProps) {

  const [previewSrc, setPreviewSrc] = useState('');
  const [naturalW, setNaturalW] = useState(1);
  const [naturalH, setNaturalH] = useState(1);

  const [left, setLeft]     = useState(0);
  const [top, setTop]       = useState(0);
  const [right, setRight]   = useState(0);
  const [bottom, setBottom] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<[number, number] | null>(null);
  const [circular, setCircular] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [rotation, setRotation] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragHandle   = useRef<HandleId | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragFrame = useRef<number | null>(null);
  const pendingPointer = useRef<{ x: number; y: number } | null>(null);
  const dragStart    = useRef({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0 });
  const basePreviewSrc = useRef('');
  const baseNaturalSize = useRef({ width: 1, height: 1 });
  const transformRequestRef = useRef(0);

  const renderTransformedPreview = useCallback((
    nextFlipX: boolean,
    nextFlipY: boolean,
    nextRotation: number,
  ) => {
    const source = basePreviewSrc.current;
    if (!source) return;
    const { width, height } = baseNaturalSize.current;
    const radians = (nextRotation * Math.PI) / 180;
    const rotated = nextRotation % 180 !== 0;
    const outputW = rotated ? height : width;
    const outputH = rotated ? width : height;
    const img = new Image();
    const requestId = ++transformRequestRef.current;
    img.onload = () => {
      if (requestId !== transformRequestRef.current) return;
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(outputW));
      cv.height = Math.max(1, Math.round(outputH));
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.translate(cv.width / 2, cv.height / 2);
      ctx.rotate(radians);
      ctx.scale(nextFlipX ? -1 : 1, nextFlipY ? -1 : 1);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      setPreviewSrc(cv.toDataURL('image/jpeg', 0.88));
      setNaturalW(outputW);
      setNaturalH(outputH);
    };
    img.src = source;
  }, []);

  const rotateCropClockwise = useCallback((
    oldW: number,
    oldH: number,
    oldLeft: number,
    oldTop: number,
    oldRight: number,
    oldBottom: number,
  ) => {
    const x1 = (oldLeft / 100) * oldW;
    const y1 = (oldTop / 100) * oldH;
    const x2 = ((100 - oldRight) / 100) * oldW;
    const y2 = ((100 - oldBottom) / 100) * oldH;
    // A clockwise quarter-turn maps (x, y) to (oldH - y, x).
    const newX1 = oldH - y2;
    const newY1 = x1;
    const newX2 = oldH - y1;
    const newY2 = x2;
    setLeft(Math.max(0, Math.min(100, (newX1 / oldH) * 100)));
    setTop(Math.max(0, Math.min(100, (newY1 / oldW) * 100)));
    setRight(Math.max(0, Math.min(100, 100 - (newX2 / oldH) * 100)));
    setBottom(Math.max(0, Math.min(100, 100 - (newY2 / oldW) * 100)));
  }, []);

  /* ── Load source image into preview ───────────────────────────────────── */
  useEffect(() => {
    if (!open) { setPreviewSrc(''); return; }
    setLeft(0); setTop(0); setRight(0); setBottom(0);
    setAspectRatio(null); setCircular(false);
    setFlipX(false); setFlipY(false); setRotation(0);
    transformRequestRef.current += 1;

    if (mode === 'raster') {
      basePreviewSrc.current = dataUrl || '';
      baseNaturalSize.current = { width: sourceW || 1, height: sourceH || 1 };
      setPreviewSrc(dataUrl || '');
      setNaturalW(sourceW || 1);
      setNaturalH(sourceH || 1);
      return;
    }

    if (mode === 'image' && fabricObj) {
      const img = fabricObj as FabricImage;
      const imgEl = img.getElement?.() as HTMLImageElement | undefined;
      if (!imgEl) return;
      const nw = imgEl.naturalWidth || imgEl.width || 1;
      const nh = imgEl.naturalHeight || imgEl.height || 1;
      try {
        setNaturalW(nw); setNaturalH(nh);
        const cv = document.createElement('canvas');
        // Keep the source at native resolution. The preview is constrained by
        // CSS, while transformed/cropped output must not be based on a small
        // thumbnail.
        cv.width = Math.max(1, Math.round(nw));
        cv.height = Math.max(1, Math.round(nh));
        cv.getContext('2d')?.drawImage(imgEl, 0, 0, cv.width, cv.height);
        const source = cv.toDataURL('image/png');
        basePreviewSrc.current = source;
        baseNaturalSize.current = { width: nw, height: nh };
        setPreviewSrc(source);
        const cX = (img as FabricImage & { cropX?: number }).cropX ?? 0;
        const cY = (img as FabricImage & { cropY?: number }).cropY ?? 0;
        setLeft(Math.round((cX / nw) * 100));
        setTop(Math.round((cY / nh) * 100));
      } catch {
        const source = (imgEl as HTMLImageElement).src || '';
        basePreviewSrc.current = source;
        baseNaturalSize.current = { width: nw, height: nh };
        setPreviewSrc(source);
      }
      return;
    }

    if (mode === 'fill' && file) {
      let objUrl: string | null = null;
      const img = new Image();
      img.onload = () => {
        const nw = img.naturalWidth || 1;
        const nh = img.naturalHeight || 1;
        setNaturalW(nw); setNaturalH(nh);
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(nw));
        cv.height = Math.max(1, Math.round(nh));
        cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
        const source = cv.toDataURL('image/png');
        basePreviewSrc.current = source;
        baseNaturalSize.current = { width: nw, height: nh };
        setPreviewSrc(source);
        if (objUrl) URL.revokeObjectURL(objUrl);
      };
      img.onerror = () => { if (objUrl) URL.revokeObjectURL(objUrl); };
      objUrl = URL.createObjectURL(file);
      img.src = objUrl;
    }
  }, [open, mode, fabricObj, file, dataUrl, sourceW, sourceH]);

  const handleTransform = useCallback((kind: 'flipX' | 'flipY' | 'rotate') => {
    const nextFlipX = kind === 'flipX' ? !flipX : flipX;
    const nextFlipY = kind === 'flipY' ? !flipY : flipY;
    const nextRotation = kind === 'rotate' ? (rotation + 90) % 360 : rotation;

    // Keep the selected content under the same visual focus when the source
    // is mirrored. A quarter-turn also swaps the source dimensions and maps
    // the crop rectangle into the new coordinate system.
    if (kind === 'flipX') {
      setLeft(right);
      setRight(left);
    } else if (kind === 'flipY') {
      setTop(bottom);
      setBottom(top);
    } else {
      rotateCropClockwise(naturalW, naturalH, left, top, right, bottom);
    }

    setFlipX(nextFlipX);
    setFlipY(nextFlipY);
    setRotation(nextRotation);
    renderTransformedPreview(nextFlipX, nextFlipY, nextRotation);
  }, [
    flipX, flipY, rotation, left, top, right, bottom, naturalW, naturalH,
    rotateCropClockwise, renderTransformedPreview,
  ]);

  /* Keep the preview sized to the space left by the modal chrome on mobile. */
  useEffect(() => {
    if (!open) return;
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [open]);

  /* ── Center-crop to an aspect ratio ──────────────────────────────────── */
  const snapToAR = useCallback((ar: [number, number] | null) => {
    setAspectRatio(ar);
    if (!ar) return;
    const [arW, arH] = ar;
    const targetAR = arW / arH;
    const imgAR = naturalW / naturalH;
    if (targetAR > imgAR) {
      const visH = naturalW / targetAR / naturalH;
      const crop = ((1 - visH) / 2) * 100;
      setLeft(0); setRight(0);
      setTop(Math.max(0, crop)); setBottom(Math.max(0, crop));
    } else {
      const visW = naturalH * targetAR / naturalW;
      const crop = ((1 - visW) / 2) * 100;
      setTop(0); setBottom(0);
      setLeft(Math.max(0, crop)); setRight(Math.max(0, crop));
    }
  }, [naturalW, naturalH]);

  const toggleCircular = useCallback(() => {
    const next = !circular;
    setCircular(next);
    if (next) snapToAR([1, 1]);
  }, [circular, snapToAR]);

  /* ── Drag handles ────────────────────────────────────────────────────── */
  const startDrag = useCallback((h: HandleId, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    dragHandle.current = h;
    dragPointerId.current = e.pointerId;
    dragStart.current = { x: e.clientX, y: e.clientY, left, top, right, bottom };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [left, top, right, bottom]);

  useEffect(() => {
    if (!open) return;
    const applyDrag = (cx: number, cy: number) => {
      if (!dragHandle.current || !containerRef.current) return;
      const cw = containerRef.current.clientWidth  || 1;
      const ch = containerRef.current.clientHeight || 1;
      const px = ((cx - dragStart.current.x) / cw) * 100;
      const py = ((cy - dragStart.current.y) / ch) * 100;
      const ds = dragStart.current;
      const MIN = 5;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const h = dragHandle.current;

      let nl = ds.left, nt = ds.top, nr = ds.right, nb = ds.bottom;

      if      (h === 'tl') { nl = clamp(ds.left + px, 0, 100 - ds.right - MIN); nt = clamp(ds.top + py, 0, 100 - ds.bottom - MIN); }
      else if (h === 'tm') { nt = clamp(ds.top + py, 0, 100 - ds.bottom - MIN); }
      else if (h === 'tr') { nr = clamp(ds.right - px, 0, 100 - ds.left - MIN); nt = clamp(ds.top + py, 0, 100 - ds.bottom - MIN); }
      else if (h === 'ml') { nl = clamp(ds.left + px, 0, 100 - ds.right - MIN); }
      else if (h === 'mr') { nr = clamp(ds.right - px, 0, 100 - ds.left - MIN); }
      else if (h === 'bl') { nl = clamp(ds.left + px, 0, 100 - ds.right - MIN); nb = clamp(ds.bottom - py, 0, 100 - ds.top - MIN); }
      else if (h === 'bm') { nb = clamp(ds.bottom - py, 0, 100 - ds.top - MIN); }
      else if (h === 'br') { nr = clamp(ds.right - px, 0, 100 - ds.left - MIN); nb = clamp(ds.bottom - py, 0, 100 - ds.top - MIN); }

       if (h === 'move') {
         const cropW = 100 - ds.left - ds.right;
         const cropH = 100 - ds.top - ds.bottom;
         nl = clamp(ds.left + px, 0, 100 - cropW);
         nt = clamp(ds.top + py, 0, 100 - cropH);
         nr = 100 - cropW - nl;
         nb = 100 - cropH - nt;
       } else if (aspectRatio !== null) {
         // Work in percentage coordinates, but account for the source aspect
         // ratio so the resulting rectangle remains the selected pixel ratio.
         const [arW, arH] = aspectRatio;
         const ratio = (arW / arH) * (naturalH || 1) / (naturalW || 1);
         const startW = 100 - ds.left - ds.right;
         const startH = 100 - ds.top - ds.bottom;
         const minW = Math.max(1, Math.min(5, 100 * ratio));
         const minH = Math.max(1, Math.min(5, 100 / ratio));
         const fit = (requestedW: number, maxW: number) => {
           const maxByHeight = maxW;
           return clamp(Math.max(minW, requestedW), minW, Math.max(minW, maxByHeight));
         };

         if (h === 'tl' || h === 'tr' || h === 'bl' || h === 'br') {
           const anchorX = h.includes('l') ? ds.left + startW : ds.left;
           const anchorY = h.includes('t') ? ds.top + startH : ds.top;
           const pointerX = h.includes('l') ? anchorX - px : anchorX + px;
           const pointerY = h.includes('t') ? anchorY - py : anchorY + py;
           const candidateW = Math.max(0, Math.abs(pointerX - anchorX));
           const candidateH = Math.max(0, Math.abs(pointerY - anchorY));
           let maxW = h.includes('l') ? anchorX : 100 - anchorX;
           const maxH = h.includes('t') ? anchorY : 100 - anchorY;
           maxW = Math.min(maxW, maxH * ratio);
           const width = fit(Math.max(candidateW, candidateH * ratio), maxW);
           const height = width / ratio;
           nl = h.includes('l') ? anchorX - width : anchorX;
           nt = h.includes('t') ? anchorY - height : anchorY;
           nr = 100 - nl - width;
           nb = 100 - nt - height;
         } else if (h === 'tm' || h === 'bm') {
           const fixedBottom = h === 'tm';
           const anchorY = fixedBottom ? ds.top + startH : ds.top;
           const pointerY = fixedBottom ? anchorY - py : anchorY + py;
           const maxH = fixedBottom ? anchorY : 100 - anchorY;
           const height = clamp(Math.max(minH, Math.abs(pointerY - anchorY)), minH, maxH);
           const width = Math.min(100, height * ratio);
           const center = ds.left + startW / 2;
           nl = clamp(center - width / 2, 0, 100 - width);
           nr = 100 - nl - width;
           nt = fixedBottom ? anchorY - height : anchorY;
           nb = 100 - nt - height;
         } else if (h === 'ml' || h === 'mr') {
           const fixedRight = h === 'ml';
           const anchorX = fixedRight ? ds.left + startW : ds.left;
           const pointerX = fixedRight ? anchorX - px : anchorX + px;
           const maxW = fixedRight ? anchorX : 100 - anchorX;
           const width = fit(Math.abs(pointerX - anchorX), maxW);
           const height = Math.min(100, width / ratio);
           const center = ds.top + startH / 2;
           nt = clamp(center - height / 2, 0, 100 - height);
           nb = 100 - nt - height;
           nl = fixedRight ? anchorX - width : anchorX;
           nr = 100 - nl - width;
         }
       }

      setLeft(nl); setTop(nt); setRight(nr); setBottom(nb);
    };
    const flushDrag = () => {
      dragFrame.current = null;
      const point = pendingPointer.current;
      pendingPointer.current = null;
      if (point) applyDrag(point.x, point.y);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragHandle.current || e.pointerId !== dragPointerId.current) return;
      e.preventDefault();
      pendingPointer.current = { x: e.clientX, y: e.clientY };
      if (dragFrame.current === null) {
        dragFrame.current = window.requestAnimationFrame(flushDrag);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId.current) return;
      if (dragFrame.current !== null) {
        window.cancelAnimationFrame(dragFrame.current);
        flushDrag();
      } else {
        applyDrag(e.clientX, e.clientY);
      }
      dragHandle.current = null;
      dragPointerId.current = null;
      pendingPointer.current = null;
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      if (dragFrame.current !== null) window.cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [open, naturalW, naturalH, aspectRatio]);

  /* ── Apply ───────────────────────────────────────────────────────────── */
  const handleApply = useCallback(() => {
    const renderCrop = (img: HTMLImageElement, sw: number, sh: number): HTMLCanvasElement => {
      const cx = Math.round(left / 100 * sw);
      const cy = Math.round(top  / 100 * sh);
      const cw = Math.max(1, Math.round((100 - left - right)  / 100 * sw));
      const ch = Math.max(1, Math.round((100 - top  - bottom) / 100 * sh));
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const ctx2d = cv.getContext('2d')!;
      if (circular) {
        ctx2d.beginPath();
        ctx2d.ellipse(cw / 2, ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
        ctx2d.clip();
      }
      ctx2d.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
      return cv;
    };

    if (mode === 'image' && fabricObj && (flipX || flipY || rotation !== 0)) {
      // Native Fabric cropX/cropY cannot express a crop made in the rotated
      // coordinate system. Return the transformed pixels instead so the
      // preview and the committed result are identical.
      const img = new Image();
      img.onload = () => {
        const cv = renderCrop(img, naturalW, naturalH);
        onApplyRaster?.(
          cv, circular,
          Math.round(left / 100 * naturalW),
          Math.round(top / 100 * naturalH),
          Math.max(1, Math.round((100 - left - right) / 100 * naturalW)),
          Math.max(1, Math.round((100 - top - bottom) / 100 * naturalH)),
        );
        onClose();
      };
      img.src = previewSrc;
      return;
    }

    if (mode === 'image' && fabricObj) {
      const cropX = Math.round(left  / 100 * naturalW);
      const cropY = Math.round(top   / 100 * naturalH);
      const cropW = Math.max(1, Math.round((100 - left - right)  / 100 * naturalW));
      const cropH = Math.max(1, Math.round((100 - top  - bottom) / 100 * naturalH));
      onApplyImage?.(cropX, cropY, cropW, cropH, circular);
      onClose();
      return;
    }

    if (mode === 'fill' && file) {
      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const cv = renderCrop(img, img.naturalWidth, img.naturalHeight);
        URL.revokeObjectURL(objUrl);
        onApplyFill?.(cv, circular);
        onClose();
      };
      img.onerror = () => URL.revokeObjectURL(objUrl);
      img.src = objUrl;
      return;
    }

    if (mode === 'raster' && previewSrc) {
      const img = new Image();
      img.onload = () => {
        const cv = renderCrop(img, naturalW, naturalH);
        onApplyRaster?.(
          cv, circular,
          Math.round(left / 100 * naturalW),
          Math.round(top / 100 * naturalH),
          Math.max(1, Math.round((100 - left - right) / 100 * naturalW)),
          Math.max(1, Math.round((100 - top - bottom) / 100 * naturalH)),
        );
        onClose();
      };
      img.src = previewSrc;
      return;
    }

    onClose();
  }, [
    mode, fabricObj, file, dataUrl, previewSrc, left, top, right, bottom,
    naturalW, naturalH, circular, flipX, flipY, rotation,
    onApplyImage, onApplyFill, onApplyRaster, onClose,
  ]);

  const handleSkip = useCallback(() => {
    if (mode === 'fill' && file) {
      const objUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        cv.getContext('2d')?.drawImage(img, 0, 0);
        URL.revokeObjectURL(objUrl);
        onApplyFill?.(cv, false);
        onClose();
      };
      img.onerror = () => URL.revokeObjectURL(objUrl);
      img.src = objUrl;
    } else {
      onClose();
    }
  }, [mode, file, onApplyFill, onClose]);

  /* ── Derived ─────────────────────────────────────────────────────────── */
  const hasSrc = Boolean(previewSrc);
  const outW   = Math.max(1, Math.round((100 - left - right)  / 100 * naturalW));
  const outH   = Math.max(1, Math.round((100 - top  - bottom) / 100 * naturalH));
  const vMid   = top + (100 - top - bottom) / 2;
  const hMid   = left + (100 - left - right) / 2;
  const viewportW = viewport.width || (typeof window !== 'undefined' ? window.innerWidth : 480);
  const viewportH = viewport.height || (typeof window !== 'undefined' ? window.innerHeight : 800);
  const previewMaxW = Math.max(240, Math.min(480, viewportW - 48));
  const previewMaxH = Math.max(160, Math.min(380, Math.floor(viewportH * 0.42)));
  const previewScale = Math.min(
    1,
    previewMaxW / Math.max(1, naturalW),
    previewMaxH / Math.max(1, naturalH),
  );
  const previewDisplayW = Math.max(1, Math.round(naturalW * previewScale));
  const previewDisplayH = Math.max(1, Math.round(naturalH * previewScale));

  /* clip-path for the bright crop overlay — uses CSS inset() for clean rectangle crop
     or ellipse() for circle crop. Both run on a single full-size img tag so there is
     NO double-image ghost artifact. */
  const brightClip = circular
    ? `ellipse(${(100 - left - right) / 2}% ${(100 - top - bottom) / 2}% at ${(left + (100 - left - right) / 2)}% ${(top + (100 - top - bottom) / 2)}%)`
    : `inset(${top}% ${right}% ${bottom}% ${left}%)`;

  const HANDLE_BASE: React.CSSProperties = {
    position: 'absolute', width: 44, height: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 0, padding: 0, borderRadius: 8, background: 'transparent',
    touchAction: 'none', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
    zIndex: 10,
  };

  const handles: { id: HandleId; style: React.CSSProperties }[] = [
    { id: 'tl', style: { left: `${left}%`,  top: `${top}%`,    transform: 'translate(-50%,-50%)', cursor: 'nwse-resize' } },
    { id: 'tm', style: { left: `${hMid}%`,  top: `${top}%`,    transform: 'translate(-50%,-50%)', cursor: 'ns-resize' } },
    { id: 'tr', style: { right: `${right}%`, top: `${top}%`,   transform: 'translate(50%,-50%)',  cursor: 'nesw-resize' } },
    { id: 'bl', style: { left: `${left}%`,  bottom: `${bottom}%`, transform: 'translate(-50%,50%)', cursor: 'nesw-resize' } },
    { id: 'bm', style: { left: `${hMid}%`,  bottom: `${bottom}%`, transform: 'translate(-50%,50%)', cursor: 'ns-resize' } },
    { id: 'br', style: { right: `${right}%`, bottom: `${bottom}%`, transform: 'translate(50%,50%)',  cursor: 'nwse-resize' } },
    { id: 'ml', style: { left: `${left}%`,  top: `${vMid}%`,   transform: 'translate(-50%,-50%)', cursor: 'ew-resize' } },
    { id: 'mr', style: { right: `${right}%`, top: `${vMid}%`,  transform: 'translate(50%,-50%)',  cursor: 'ew-resize' } },
  ];

  const title = mode === 'image' ? 'Crop Image' : mode === 'fill' ? 'Crop Before Fill' : 'Crop Selection';
  const applyLabel = mode === 'fill' ? 'Apply & Fill' : 'Apply Crop';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="mx-auto max-h-[90dvh] overflow-y-auto rounded-2xl p-4 sm:p-6"
        style={{
          background: '#11141A',
          border: '1px solid rgba(0,245,255,0.15)',
          maxWidth: 'min(92vw,520px)',
          width: 'calc(100vw - 24px)',
          maxHeight: '90dvh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">

          {/* ── Transform buttons ── */}
          {mode !== 'fill' && (
            <div className="flex gap-2">
              {([
                { icon: <FlipHorizontal size={15} />, label: 'Flip H', fn: () => { handleTransform('flipX'); onFlipH?.(); } },
                { icon: <FlipVertical   size={15} />, label: 'Flip V', fn: () => { handleTransform('flipY'); onFlipV?.(); } },
                { icon: <RotateCcw      size={15} />, label: 'Rotate', fn: () => { handleTransform('rotate'); onRotate90?.(); } },
              ] as const).map(({ icon, label, fn }) => (
                <button
                  key={label}
                   onClick={fn}
                  className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border border-border hover:border-primary/50 transition-colors"
                  style={{ background: 'rgba(0,245,255,0.03)' }}
                >
                  <span className="text-primary">{icon}</span>
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Aspect ratio presets ── */}
          <div className="flex gap-1 flex-wrap">
            {AR_PRESETS.map((p) => {
              const active = JSON.stringify(aspectRatio) === JSON.stringify(p.value) && !circular;
              return (
                <button
                  key={p.label}
                  onClick={() => { setCircular(false); snapToAR(p.value); }}
                  className="text-[11px] px-2.5 py-1 rounded-lg border transition-colors"
                  style={{
                    background: active ? 'rgba(0,245,255,0.15)' : 'rgba(0,245,255,0.04)',
                    borderColor: active ? '#00F5FF' : 'rgba(0,245,255,0.2)',
                    color: active ? '#00F5FF' : '#888',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
            <button
              onClick={toggleCircular}
              className="text-[11px] px-2.5 py-1 rounded-lg border transition-colors"
              style={{
                background: circular ? 'rgba(0,245,255,0.15)' : 'rgba(0,245,255,0.04)',
                borderColor: circular ? '#00F5FF' : 'rgba(0,245,255,0.2)',
                color: circular ? '#00F5FF' : '#888',
              }}
            >
              ◯ Circle
            </button>
          </div>

          {/* ── Crop canvas ── */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg select-none w-full"
            style={{
              width: hasSrc ? previewDisplayW : '100%',
              height: hasSrc ? previewDisplayH : previewMaxH,
              maxWidth: '100%',
              margin: '0 auto',
              background: '#0B0C10',
              border: '1px solid rgba(0,245,255,0.2)',
            }}
          >
            {hasSrc && (
              <>
                {/* Dimmed base — objectFit:fill is correct since container already has image AR */}
                <img
                  src={previewSrc}
                  draggable={false}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', opacity: 0.3, pointerEvents: 'none', userSelect: 'none' }}
                />

                {/* Full-brightness image clipped to crop zone — single img, no ghost */}
                <img
                  src={previewSrc}
                  draggable={false}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', clipPath: brightClip, pointerEvents: 'none', userSelect: 'none' }}
                />

                {/* Crop frame border */}
                <div style={{
                  position: 'absolute',
                  left: `${left}%`, top: `${top}%`, right: `${right}%`, bottom: `${bottom}%`,
                  border: `2px solid ${circular ? 'transparent' : '#00F5FF'}`,
                  ...(circular ? { borderRadius: '50%', boxShadow: 'inset 0 0 0 2px #00F5FF' } : {}),
                  pointerEvents: 'none',
                }}>
                  {!circular && [1, 2].map((i) => (
                    <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / 3) * 100}%`, width: 1, background: 'rgba(0,245,255,0.3)' }} />
                  ))}
                  {!circular && [1, 2].map((i) => (
                    <div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${(i / 3) * 100}%`, height: 1, background: 'rgba(0,245,255,0.3)' }} />
                  ))}
                </div>

                {/* The crop frame itself is a move target. Handles remain above
                    it, while this transparent surface accepts drag/touch from
                    anywhere inside the selected rectangle. */}
                <div
                  onPointerDown={(e) => startDrag('move', e)}
                  style={{
                    position: 'absolute',
                    left: `${left}%`, top: `${top}%`,
                    width: `${100 - left - right}%`,
                    height: `${100 - top - bottom}%`,
                    cursor: 'move',
                    touchAction: 'none',
                    userSelect: 'none',
                    zIndex: 5,
                  }}
                  aria-label="Move crop selection"
                  role="button"
                  tabIndex={-1}
                />

                {/* 8 drag handles; the 44px transparent hit areas are intentionally larger than the visible knobs for touch. */}
                {handles.map(({ id, style }) => (
                  <div
                    key={id}
                    style={{ ...HANDLE_BASE, ...style }}
                    onPointerDown={(e) => startDrag(id, e)}
                    aria-label={`Move ${id} crop handle`}
                    role="slider"
                    tabIndex={-1}
                  >
                    <span style={{
                      width: id === 'ml' || id === 'mr' ? 12 : id === 'tm' || id === 'bm' ? 24 : 18,
                      height: id === 'ml' || id === 'mr' ? 24 : id === 'tm' || id === 'bm' ? 12 : 18,
                      borderRadius: 3,
                      background: '#00F5FF',
                      border: '2.5px solid white',
                      boxShadow: '0 0 8px rgba(0,245,255,0.45)',
                      pointerEvents: 'none',
                    }} />
                  </div>
                ))}
              </>
            )}

            {!hasSrc && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Loading…</div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Output: {outW} × {outH} px{circular ? ' · circular' : ''}
          </p>
        </div>

        <DialogFooter className="gap-2">
          {mode === 'fill' && (
            <Button variant="ghost" size="sm" onClick={handleSkip}>Skip Crop</Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleApply} disabled={!hasSrc}>{applyLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
