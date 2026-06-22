import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FillCropModalProps {
  open: boolean;
  file: File | null;
  onClose: () => void;
  onApply: (canvas: HTMLCanvasElement) => void;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

export default function FillCropModal({ open, file, onClose, onApply }: FillCropModalProps) {
  const [dataSrc, setDataSrc] = useState('');
  const [naturalW, setNaturalW] = useState(1);
  const [naturalH, setNaturalH] = useState(1);
  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);
  const [right, setRight] = useState(0);
  const [bottom, setBottom] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragHandle = useRef<Corner | null>(null);
  const dragStart = useRef({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0 });

  useEffect(() => {
    if (!open || !file) { setDataSrc(''); return; }
    let objUrl: string | null = null;
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth || 1;
      const nh = img.naturalHeight || 1;
      setNaturalW(nw); setNaturalH(nh);
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(nw, nh));
      const tw = Math.max(1, Math.round(nw * scale));
      const th = Math.max(1, Math.round(nh * scale));
      const cv = document.createElement('canvas');
      cv.width = tw; cv.height = th;
      cv.getContext('2d')?.drawImage(img, 0, 0, tw, th);
      setDataSrc(cv.toDataURL('image/jpeg', 0.88));
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
    img.onerror = () => { if (objUrl) setDataSrc(objUrl); };
    objUrl = URL.createObjectURL(file);
    img.src = objUrl;
    setLeft(0); setTop(0); setRight(0); setBottom(0);
  }, [open, file]);

  const getContainerSize = useCallback((): { w: number; h: number } => {
    if (!containerRef.current) return { w: 280, h: 200 };
    return { w: containerRef.current.clientWidth, h: containerRef.current.clientHeight };
  }, []);

  const startDrag = useCallback((corner: Corner, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragHandle.current = corner;
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: cx, y: cy, left, top, right, bottom };
  }, [left, top, right, bottom]);

  useEffect(() => {
    if (!open) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragHandle.current) return;
      const cx = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const cy = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const { w, h } = getContainerSize();
      const px = ((cx - dragStart.current.x) / w) * 100;
      const py = ((cy - dragStart.current.y) / h) * 100;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const c = dragHandle.current;
      if (c === 'tl') {
        setLeft(clamp(dragStart.current.left + px, 0, 90 - dragStart.current.right));
        setTop(clamp(dragStart.current.top + py, 0, 90 - dragStart.current.bottom));
      } else if (c === 'tr') {
        setRight(clamp(dragStart.current.right - px, 0, 90 - dragStart.current.left));
        setTop(clamp(dragStart.current.top + py, 0, 90 - dragStart.current.bottom));
      } else if (c === 'bl') {
        setLeft(clamp(dragStart.current.left + px, 0, 90 - dragStart.current.right));
        setBottom(clamp(dragStart.current.bottom - py, 0, 90 - dragStart.current.top));
      } else {
        setRight(clamp(dragStart.current.right - px, 0, 90 - dragStart.current.left));
        setBottom(clamp(dragStart.current.bottom - py, 0, 90 - dragStart.current.top));
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
  }, [open, getContainerSize]);

  const handleApply = useCallback(() => {
    if (!file) { onClose(); return; }
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const cropX = Math.round((left / 100) * srcW);
      const cropY = Math.round((top / 100) * srcH);
      const cropW = Math.max(1, Math.round((1 - (left + right) / 100) * srcW));
      const cropH = Math.max(1, Math.round((1 - (top + bottom) / 100) * srcH));
      const cv = document.createElement('canvas');
      cv.width = cropW; cv.height = cropH;
      cv.getContext('2d')?.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      URL.revokeObjectURL(objUrl);
      onApply(cv);
      onClose();
    };
    img.onerror = () => URL.revokeObjectURL(objUrl);
    img.src = objUrl;
  }, [file, left, top, right, bottom, onApply, onClose]);

  const hasSrc = Boolean(dataSrc);
  const previewW = Math.round(naturalW * (1 - (left + right) / 100));
  const previewH = Math.round(naturalH * (1 - (top + bottom) / 100));

  const handleStyle: React.CSSProperties = {
    position: 'absolute', width: 16, height: 16, borderRadius: 3,
    background: '#00F5FF', border: '2.5px solid white',
    cursor: 'nwse-resize', touchAction: 'none', zIndex: 10,
  };

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
          <DialogTitle className="text-sm font-semibold">Crop Before Fill</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-xs text-muted-foreground">
            Drag the corner handles to select which region fills the shape. Press <strong>Skip</strong> to fill with the full image.
          </p>

          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg select-none w-full"
            style={{
              maxHeight: 360,
              aspectRatio: `${naturalW} / ${naturalH}`,
              background: '#0B0C10',
              border: '1px solid rgba(0,245,255,0.2)',
            }}
          >
            {hasSrc && (
              <img
                src={dataSrc}
                draggable={false}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'contain',
                  opacity: 0.35,
                  pointerEvents: 'none', userSelect: 'none',
                }}
              />
            )}

            {hasSrc && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.55)',
                clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${left}% ${top}%,${left}% ${100 - bottom}%,${100 - right}% ${100 - bottom}%,${100 - right}% ${top}%,${left}% ${top}%)`,
                pointerEvents: 'none',
              }} />
            )}

            {hasSrc && (
              <div style={{
                position: 'absolute',
                left: `${left}%`, top: `${top}%`, right: `${right}%`, bottom: `${bottom}%`,
                overflow: 'hidden', pointerEvents: 'none',
              }}>
                <img
                  src={dataSrc}
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: `${-left / Math.max(0.01, 1 - (left + right) / 100)}%`,
                    top: `${-top / Math.max(0.01, 1 - (top + bottom) / 100)}%`,
                    width: `${100 / Math.max(0.01, 1 - (left + right) / 100)}%`,
                    height: `${100 / Math.max(0.01, 1 - (top + bottom) / 100)}%`,
                    objectFit: 'contain', userSelect: 'none',
                  }}
                />
              </div>
            )}

            <div style={{
              position: 'absolute',
              left: `${left}%`, top: `${top}%`, right: `${right}%`, bottom: `${bottom}%`,
              border: '2px solid #00F5FF', pointerEvents: 'none',
            }}>
              {[1, 2].map((i) => (
                <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / 3) * 100}%`, width: 1, background: 'rgba(0,245,255,0.35)' }} />
              ))}
              {[1, 2].map((i) => (
                <div key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${(i / 3) * 100}%`, height: 1, background: 'rgba(0,245,255,0.35)' }} />
              ))}
            </div>

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

            {!hasSrc && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                Loading…
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Crop region: {previewW} × {previewH} px
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => {
            if (file) {
              const objUrl = URL.createObjectURL(file);
              const img = new Image();
              img.onload = () => {
                const cv = document.createElement('canvas');
                cv.width = img.naturalWidth; cv.height = img.naturalHeight;
                cv.getContext('2d')?.drawImage(img, 0, 0);
                URL.revokeObjectURL(objUrl);
                onApply(cv);
                onClose();
              };
              img.onerror = () => URL.revokeObjectURL(objUrl);
              img.src = objUrl;
            } else { onClose(); }
          }}>Skip Crop</Button>
          <Button size="sm" onClick={handleApply} disabled={!hasSrc}>Apply & Fill</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
