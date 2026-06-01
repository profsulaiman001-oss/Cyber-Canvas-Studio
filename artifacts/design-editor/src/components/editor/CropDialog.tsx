import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FabricImage, FabricObject } from 'fabric';
import { FlipHorizontal, FlipVertical, RotateCcw } from 'lucide-react';

interface CropDialogProps {
  open: boolean;
  onClose: () => void;
  obj: FabricObject | null;
  onApply: (cropX: number, cropY: number, cropW: number, cropH: number) => void;
  onFlipH?: () => void;
  onFlipV?: () => void;
  onRotate90?: () => void;
}

interface Handle { corner: 'tl' | 'tr' | 'bl' | 'br' }

export default function CropDialog({ open, onClose, obj, onApply, onFlipH, onFlipV, onRotate90 }: CropDialogProps) {
  const img = obj as FabricImage | null;
  const imgEl = img ? (img.getElement?.() as HTMLImageElement | undefined) : undefined;
  const srcW = imgEl?.naturalWidth || imgEl?.width || img?.width || 1;
  const srcH = imgEl?.naturalHeight || imgEl?.height || img?.height || 1;

  /* ─── Generate a stable data-URL thumbnail so the preview never shows a broken image ─── */
  const [dataSrc, setDataSrc] = useState('');
  useEffect(() => {
    if (!open || !imgEl) { setDataSrc(''); return; }
    try {
      const nw = imgEl.naturalWidth || imgEl.width || 1;
      const nh = imgEl.naturalHeight || imgEl.height || 1;
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(nw, nh));
      const tw = Math.max(1, Math.round(nw * scale));
      const th = Math.max(1, Math.round(nh * scale));
      const cv = document.createElement('canvas');
      cv.width = tw; cv.height = th;
      cv.getContext('2d')?.drawImage(imgEl, 0, 0, tw, th);
      setDataSrc(cv.toDataURL('image/jpeg', 0.88));
    } catch {
      setDataSrc(imgEl.src || '');
    }
  }, [open, imgEl]);

  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);
  const [right, setRight] = useState(0);
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    if (open && img) {
      const cX = (img as FabricImage & { cropX?: number }).cropX ?? 0;
      const cY = (img as FabricImage & { cropY?: number }).cropY ?? 0;
      setLeft(Math.round((cX / srcW) * 100));
      setTop(Math.round((cY / srcH) * 100));
      setRight(0);
      setBottom(0);
    }
  }, [open, img, srcW, srcH]);

  const previewW = Math.max(1, srcW * (1 - (left + right) / 100));
  const previewH = Math.max(1, srcH * (1 - (top + bottom) / 100));

  /* ─── Draggable crop frame ─── */
  const frameRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragHandle = useRef<Handle['corner'] | null>(null);
  const dragStart = useRef({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0 });

  /* Container dimensions are dynamic — read from the DOM ref */
  const getContainerSize = useCallback((): { w: number; h: number } => {
    if (!containerRef.current) return { w: 280, h: 200 };
    return { w: containerRef.current.clientWidth, h: containerRef.current.clientHeight };
  }, []);

  const pxToPercent = useCallback((dx: number, dy: number) => {
    const { w, h } = getContainerSize();
    return { px: (dx / w) * 100, py: (dy / h) * 100 };
  }, [getContainerSize]);

  const startDrag = useCallback((corner: Handle['corner'], e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragHandle.current = corner;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX, y: clientY, left, top, right, bottom };
  }, [left, top, right, bottom]);

  useEffect(() => {
    if (!open) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragHandle.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const dx = clientX - dragStart.current.x;
      const dy = clientY - dragStart.current.y;
      const { px, py } = pxToPercent(dx, dy);
      const corner = dragHandle.current;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      if (corner === 'tl') {
        setLeft(clamp(dragStart.current.left + px, 0, 95 - dragStart.current.right));
        setTop(clamp(dragStart.current.top + py, 0, 95 - dragStart.current.bottom));
      } else if (corner === 'tr') {
        setRight(clamp(dragStart.current.right - px, 0, 95 - dragStart.current.left));
        setTop(clamp(dragStart.current.top + py, 0, 95 - dragStart.current.bottom));
      } else if (corner === 'bl') {
        setLeft(clamp(dragStart.current.left + px, 0, 95 - dragStart.current.right));
        setBottom(clamp(dragStart.current.bottom - py, 0, 95 - dragStart.current.top));
      } else if (corner === 'br') {
        setRight(clamp(dragStart.current.right - px, 0, 95 - dragStart.current.left));
        setBottom(clamp(dragStart.current.bottom - py, 0, 95 - dragStart.current.top));
      }
    };
    const onUp = () => { dragHandle.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [open, pxToPercent]);

  const handleApply = useCallback(() => {
    const cropX = Math.round((left / 100) * srcW);
    const cropY = Math.round((top / 100) * srcH);
    const cropW = Math.round(previewW);
    const cropH = Math.round(previewH);
    onApply(cropX, cropY, cropW, cropH);
    onClose();
  }, [left, top, srcW, srcH, previewW, previewH, onApply, onClose]);

  const handleStyle: React.CSSProperties = {
    position: 'absolute', width: 16, height: 16, borderRadius: 3,
    background: '#00F5FF', border: '2.5px solid white',
    cursor: 'nwse-resize', touchAction: 'none', zIndex: 10,
  };

  const hasSrc = Boolean(dataSrc);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="mx-auto rounded-2xl"
        style={{
          background: '#11141A',
          border: '1px solid rgba(0,245,255,0.15)',
          maxWidth: 'min(92vw, 480px)',
          width: '100%',
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Crop Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Transform quick actions */}
          <div className="flex gap-2">
            <button
              onClick={onFlipH}
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border border-border hover:border-primary/50 transition-colors"
              style={{ background: 'rgba(0,245,255,0.03)' }}
            >
              <FlipHorizontal size={16} className="text-primary" />
              <span className="text-[10px] text-muted-foreground">Flip H</span>
            </button>
            <button
              onClick={onFlipV}
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border border-border hover:border-primary/50 transition-colors"
              style={{ background: 'rgba(0,245,255,0.03)' }}
            >
              <FlipVertical size={16} className="text-primary" />
              <span className="text-[10px] text-muted-foreground">Flip V</span>
            </button>
            <button
              onClick={onRotate90}
              className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border border-border hover:border-primary/50 transition-colors"
              style={{ background: 'rgba(0,245,255,0.03)' }}
            >
              <RotateCcw size={16} className="text-primary" />
              <span className="text-[10px] text-muted-foreground">Rotate 90°</span>
            </button>
          </div>

          {/* Visual crop preview — responsive, max-height 400px, object-fit: contain */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg select-none w-full"
            style={{
              maxWidth: '100%',
              maxHeight: 400,
              aspectRatio: `${srcW} / ${srcH}`,
              background: '#0B0C10',
              border: '1px solid rgba(0,245,255,0.2)',
            }}
          >
            {/* Base image — dimmed for the cropped-out region */}
            {hasSrc && (
              <img
                src={dataSrc}
                draggable={false}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'contain',
                  opacity: 0.38,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Dark overlay outside crop zone — clip-path cuts out the bright crop area */}
            {hasSrc && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.52)',
                clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${left}% ${top}%, ${left}% ${100 - bottom}%, ${100 - right}% ${100 - bottom}%, ${100 - right}% ${top}%, ${left}% ${top}%)`,
                pointerEvents: 'none',
              }} />
            )}

            {/* Crop zone — full-brightness image clipped to selected area */}
            {hasSrc && (
              <div style={{
                position: 'absolute',
                left: `${left}%`, top: `${top}%`,
                right: `${right}%`, bottom: `${bottom}%`,
                overflow: 'hidden',
                pointerEvents: 'none',
              }}>
                {/* Inner img must be positioned/sized to match the outer container */}
                <img
                  src={dataSrc}
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: `${-left / (1 - (left + right) / 100)}%`,
                    top: `${-top / (1 - (top + bottom) / 100)}%`,
                    width: `${100 / (1 - (left + right) / 100)}%`,
                    height: `${100 / (1 - (top + bottom) / 100)}%`,
                    objectFit: 'contain',
                    userSelect: 'none',
                  }}
                />
              </div>
            )}

            {/* Crop frame border */}
            <div
              ref={frameRef}
              style={{
                position: 'absolute',
                left: `${left}%`, top: `${top}%`,
                right: `${right}%`, bottom: `${bottom}%`,
                border: '2px solid #00F5FF',
                pointerEvents: 'none',
              }}
            >
              {/* Rule-of-thirds grid */}
              {[1, 2].map((i) => (
                <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / 3) * 100}%`, width: 1, background: 'rgba(0,245,255,0.3)' }} />
              ))}
              {[1, 2].map((i) => (
                <div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${(i / 3) * 100}%`, height: 1, background: 'rgba(0,245,255,0.3)' }} />
              ))}
            </div>

            {/* Draggable corner handles */}
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <div
                key={corner}
                style={{
                  ...handleStyle,
                  ...(corner === 'tl' ? { left: `${left}%`, top: `${top}%`, transform: 'translate(-50%,-50%)', cursor: 'nwse-resize' } : {}),
                  ...(corner === 'tr' ? { right: `${right}%`, top: `${top}%`, transform: 'translate(50%,-50%)', cursor: 'nesw-resize' } : {}),
                  ...(corner === 'bl' ? { left: `${left}%`, bottom: `${bottom}%`, transform: 'translate(-50%,50%)', cursor: 'nesw-resize' } : {}),
                  ...(corner === 'br' ? { right: `${right}%`, bottom: `${bottom}%`, transform: 'translate(50%,50%)', cursor: 'nwse-resize' } : {}),
                }}
                onMouseDown={(e) => startDrag(corner, e)}
                onTouchStart={(e) => startDrag(corner, e)}
              />
            ))}

            {/* No-image fallback */}
            {!hasSrc && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                Loading preview…
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Output: {Math.round(previewW)} × {Math.round(previewH)} px
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleApply}>Apply Crop</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
