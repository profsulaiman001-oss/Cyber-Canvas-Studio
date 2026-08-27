import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FlipHorizontal, FlipVertical, RotateCcw } from 'lucide-react';
import { FabricImage, FabricObject } from 'fabric';

type HandleId = 'tl' | 'tm' | 'tr' | 'ml' | 'mr' | 'bl' | 'bm' | 'br';
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
  onApplyRaster?: (canvas: HTMLCanvasElement, circular: boolean) => void;
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

  const containerRef = useRef<HTMLDivElement>(null);
  const dragHandle   = useRef<HandleId | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragFrame = useRef<number | null>(null);
  const pendingPointer = useRef<{ x: number; y: number } | null>(null);
  const dragStart    = useRef({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0 });

  /* ── Load source image into preview ───────────────────────────────────── */
  useEffect(() => {
    if (!open) { setPreviewSrc(''); return; }
    setLeft(0); setTop(0); setRight(0); setBottom(0);
    setAspectRatio(null); setCircular(false);

    if (mode === 'raster') {
      setPreviewSrc(dataUrl || '');
      setNaturalW(sourceW || 1);
      setNaturalH(sourceH || 1);
      return;
    }

    if (mode === 'image' && fabricObj) {
      const img = fabricObj as FabricImage;
      const imgEl = img.getElement?.() as HTMLImageElement | undefined;
      if (!imgEl) return;
      try {
        const nw = imgEl.naturalWidth || imgEl.width || 1;
        const nh = imgEl.naturalHeight || imgEl.height || 1;
        setNaturalW(nw); setNaturalH(nh);
        const MAX = 800;
        const s = Math.min(1, MAX / Math.max(nw, nh));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(nw * s));
        cv.height = Math.max(1, Math.round(nh * s));
        cv.getContext('2d')?.drawImage(imgEl, 0, 0, cv.width, cv.height);
        setPreviewSrc(cv.toDataURL('image/jpeg', 0.88));
        const cX = (img as FabricImage & { cropX?: number }).cropX ?? 0;
        const cY = (img as FabricImage & { cropY?: number }).cropY ?? 0;
        setLeft(Math.round((cX / nw) * 100));
        setTop(Math.round((cY / nh) * 100));
      } catch { setPreviewSrc((imgEl as HTMLImageElement).src || ''); }
      return;
    }

    if (mode === 'fill' && file) {
      let objUrl: string | null = null;
      const img = new Image();
      img.onload = () => {
        const nw = img.naturalWidth || 1;
        const nh = img.naturalHeight || 1;
        setNaturalW(nw); setNaturalH(nh);
        const MAX = 800;
        const s = Math.min(1, MAX / Math.max(nw, nh));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(nw * s));
        cv.height = Math.max(1, Math.round(nh * s));
        cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
        setPreviewSrc(cv.toDataURL('image/jpeg', 0.88));
        if (objUrl) URL.revokeObjectURL(objUrl);
      };
      img.onerror = () => { if (objUrl) URL.revokeObjectURL(objUrl); };
      objUrl = URL.createObjectURL(file);
      img.src = objUrl;
    }
  }, [open, mode, fabricObj, file, dataUrl, sourceW, sourceH]);

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

      if (aspectRatio !== null) {
        const [arW, arH] = aspectRatio;
        const targetAR = arW / arH;
        const cropWpx = ((100 - nl - nr) / 100) * (naturalW || 1);
        const newCropHpx = cropWpx / targetAR;
        const newCropHFrac = newCropHpx / (naturalH || 1);
        const totalShrinkH = Math.max(0, 1 - newCropHFrac);

        if (h === 'tm' || h === 'bm') {
          const cropHpx = ((100 - nt - nb) / 100) * (naturalH || 1);
          const newCropWFrac = (cropHpx * targetAR) / (naturalW || 1);
          const half = Math.max(0, (1 - newCropWFrac) * 50);
          nl = clamp(half, 0, 100 - MIN);
          nr = clamp(half, 0, 100 - MIN);
        } else if (h === 'ml' || h === 'mr') {
          const half = (totalShrinkH / 2) * 100;
          nt = clamp(half, 0, 100 - MIN);
          nb = clamp(half, 0, 100 - MIN);
        } else if (h === 'tl' || h === 'tr') {
          nt = clamp(totalShrinkH * 100 - nb, 0, 100 - nb - MIN);
        } else {
          nb = clamp(totalShrinkH * 100 - nt, 0, 100 - nt - MIN);
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

    if (mode === 'raster' && dataUrl) {
      const img = new Image();
      img.onload = () => {
        const cv = renderCrop(img, img.naturalWidth, img.naturalHeight);
        onApplyRaster?.(cv, circular);
        onClose();
      };
      img.src = dataUrl;
      return;
    }

    onClose();
  }, [mode, fabricObj, file, dataUrl, left, top, right, bottom, naturalW, naturalH, circular, onApplyImage, onApplyFill, onApplyRaster, onClose]);

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

          {/* ── Transform buttons (image mode only) ── */}
          {mode === 'image' && (
            <div className="flex gap-2">
              {([
                { icon: <FlipHorizontal size={15} />, label: 'Flip H', fn: onFlipH },
                { icon: <FlipVertical   size={15} />, label: 'Flip V', fn: onFlipV },
                { icon: <RotateCcw      size={15} />, label: 'Rotate', fn: onRotate90 },
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
