import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { FabricImage } from 'fabric';
import { FabricObject } from 'fabric';

interface CropDialogProps {
  open: boolean;
  onClose: () => void;
  obj: FabricObject | null;
  onApply: (cropX: number, cropY: number, cropW: number, cropH: number) => void;
}

export default function CropDialog({ open, onClose, obj, onApply }: CropDialogProps) {
  const img = obj as FabricImage | null;
  const srcW = img ? ((img.getElement?.() as HTMLImageElement)?.naturalWidth ?? img.width ?? 1) : 1;
  const srcH = img ? ((img.getElement?.() as HTMLImageElement)?.naturalHeight ?? img.height ?? 1) : 1;

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

  const handleApply = useCallback(() => {
    const cropX = Math.round((left / 100) * srcW);
    const cropY = Math.round((top / 100) * srcH);
    const cropW = Math.round(previewW);
    const cropH = Math.round(previewH);
    onApply(cropX, cropY, cropW, cropH);
    onClose();
  }, [left, top, srcW, srcH, previewW, previewH, onApply, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-xs mx-auto rounded-2xl"
        style={{ background: '#11141A', border: '1px solid rgba(0,245,255,0.15)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Crop Image</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Visual crop preview */}
          <div className="flex justify-center">
            <div
              className="relative rounded overflow-hidden"
              style={{ width: 160, height: 90, background: '#0B0C10', border: '1px solid rgba(0,245,255,0.2)' }}
            >
              {img && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${(img.getElement?.() as HTMLImageElement)?.src ?? ''})`,
                    backgroundSize: '100% 100%',
                    clipPath: `inset(${top}% ${right}% ${bottom}% ${left}%)`,
                  }}
                />
              )}
              <div
                className="absolute border-2 pointer-events-none"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  right: `${right}%`,
                  bottom: `${bottom}%`,
                  borderColor: '#00F5FF',
                }}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Result: {Math.round(previewW)} × {Math.round(previewH)} px
          </p>

          {[
            { label: 'Crop Left', value: left, set: setLeft, max: Math.max(0, 95 - right) },
            { label: 'Crop Right', value: right, set: setRight, max: Math.max(0, 95 - left) },
            { label: 'Crop Top', value: top, set: setTop, max: Math.max(0, 95 - bottom) },
            { label: 'Crop Bottom', value: bottom, set: setBottom, max: Math.max(0, 95 - top) },
          ].map(({ label, value, set, max }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <span className="text-xs text-muted-foreground">{value}%</span>
              </div>
              <Slider min={0} max={max} step={1} value={[value]} onValueChange={([v]) => set(v)} className="w-full" />
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleApply}>Apply Crop</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
