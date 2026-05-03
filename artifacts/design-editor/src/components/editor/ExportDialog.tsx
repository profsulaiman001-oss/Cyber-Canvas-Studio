import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { Download } from 'lucide-react';

interface ExportDialogProps {
  controller: CanvasController;
}

export default function ExportDialog({ controller }: ExportDialogProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'export';

  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [quality, setQuality] = useState(95);
  const [scalePreset, setScalePreset] = useState('2');
  const [customScale, setCustomScale] = useState('2');

  const multiplier = scalePreset === 'custom' ? parseFloat(customScale) || 1 : parseFloat(scalePreset);

  const handleExport = () => {
    const dataUrl = controller.exportCanvas(format, quality / 100, multiplier);
    if (!dataUrl) return;
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const filename = `${state.projectName.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
    dispatch({ type: 'CLOSE_PANEL' });
  };

  const { canvasSize } = state;
  const exportW = Math.round(canvasSize.width * multiplier);
  const exportH = Math.round(canvasSize.height * multiplier);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <DialogContent
        className="max-w-xs mx-auto rounded-2xl"
        style={{ background: '#11141A', border: '1px solid rgba(0,245,255,0.15)' }}
        data-testid="export-dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Export Canvas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Format</Label>
            <ToggleGroup
              type="single"
              value={format}
              onValueChange={(v) => v && setFormat(v as 'png' | 'jpeg')}
              className="gap-2"
              data-testid="toggle-format"
            >
              <ToggleGroupItem value="png" className="flex-1 text-xs" data-testid="format-png">PNG</ToggleGroupItem>
              <ToggleGroupItem value="jpeg" className="flex-1 text-xs" data-testid="format-jpg">JPG</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {format === 'jpeg' && (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground">Quality</Label>
                <span className="text-xs text-muted-foreground">{quality}%</span>
              </div>
              <Slider min={10} max={100} step={5} value={[quality]} onValueChange={([v]) => setQuality(v)} data-testid="slider-quality" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Scale / Resolution</Label>
            <Select value={scalePreset} onValueChange={setScalePreset}>
              <SelectTrigger className="text-xs h-8" data-testid="select-scale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1x — Original ({canvasSize.width}×{canvasSize.height})</SelectItem>
                <SelectItem value="2">2x — High Res ({canvasSize.width * 2}×{canvasSize.height * 2})</SelectItem>
                <SelectItem value="3">3x — Ultra ({canvasSize.width * 3}×{canvasSize.height * 3})</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scalePreset === 'custom' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Multiplier</Label>
              <Input
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={customScale}
                onChange={(e) => setCustomScale(e.target.value)}
                className="h-8 text-xs"
                data-testid="input-custom-scale"
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Output: {exportW} × {exportH} px
          </p>
        </div>

        <DialogFooter>
          <Button onClick={handleExport} className="w-full gap-2" data-testid="button-export">
            <Download size={14} />
            Download {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
