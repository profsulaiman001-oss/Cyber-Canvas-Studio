import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';

interface CanvasSizeDialogProps {
  controller: CanvasController;
}

const PRESETS = [
  { label: 'Instagram Post', w: 1080, h: 1080 },
  { label: 'Instagram Story', w: 1080, h: 1920 },
  { label: 'Twitter/X Banner', w: 1500, h: 500 },
  { label: 'Facebook Cover', w: 820, h: 312 },
  { label: 'YouTube Thumbnail', w: 1280, h: 720 },
  { label: 'A4 Portrait', w: 2480, h: 3508 },
  { label: 'A4 Landscape', w: 3508, h: 2480 },
  { label: 'Custom', w: 0, h: 0 },
];

export default function CanvasSizeDialog({ controller }: CanvasSizeDialogProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'canvasSize';

  const [width, setWidth] = useState(String(state.canvasSize.width));
  const [height, setHeight] = useState(String(state.canvasSize.height));
  const [selectedPreset, setSelectedPreset] = useState('Custom');

  const applyPreset = (preset: typeof PRESETS[0]) => {
    if (preset.w > 0) {
      setWidth(String(preset.w));
      setHeight(String(preset.h));
    }
    setSelectedPreset(preset.label);
  };

  const handleApply = () => {
    const w = parseInt(width) || 1080;
    const h = parseInt(height) || 1080;
    controller.setCanvasSize(w, h);
    dispatch({ type: 'SET_CANVAS_SIZE', payload: { width: w, height: h } });
    dispatch({ type: 'CLOSE_PANEL' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <DialogContent
        className="max-w-xs mx-auto rounded-2xl"
        style={{ background: '#11141A', border: '1px solid rgba(0,245,255,0.15)' }}
        data-testid="canvas-size-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Canvas Size</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                data-testid={`preset-${p.label.replace(/\s+/g, '-').toLowerCase()}`}
                className="text-left px-2 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  background: selectedPreset === p.label ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: selectedPreset === p.label ? '1px solid rgba(0,245,255,0.4)' : '1px solid transparent',
                  color: selectedPreset === p.label ? '#00F5FF' : '#9ca3af',
                }}
              >
                <div className="font-medium">{p.label}</div>
                {p.w > 0 && <div className="text-[10px] opacity-70">{p.w}×{p.h}</div>}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Width (px)</Label>
              <Input
                type="number"
                value={width}
                onChange={(e) => { setWidth(e.target.value); setSelectedPreset('Custom'); }}
                className="h-8 text-xs"
                data-testid="input-canvas-width"
              />
            </div>
            <span className="text-muted-foreground mb-2">×</span>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Height (px)</Label>
              <Input
                type="number"
                value={height}
                onChange={(e) => { setHeight(e.target.value); setSelectedPreset('Custom'); }}
                className="h-8 text-xs"
                data-testid="input-canvas-height"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleApply} className="w-full" data-testid="button-apply-size">
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
