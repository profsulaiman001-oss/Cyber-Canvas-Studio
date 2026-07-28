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
import { useToast } from '@/hooks/use-toast';
import { Download, FolderDown } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

interface ExportDialogProps {
  controller: CanvasController;
}

// ─── Web fallback: standard anchor-tag download ──────────────────────────────
function downloadViaLink(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ─── Native: write directly to device Downloads folder ───────────────────────
// Tries ExternalStorage/Download/ first (visible in Android Files/Downloads),
// falls back to Documents directory if external storage is unavailable.
async function saveToDeviceFiles(base64Data: string, filename: string, mimeType: string): Promise<string> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');

  // First attempt: ExternalStorage → Download/ (shows up in Android Downloads)
  try {
    const result = await Filesystem.writeFile({
      path: `Download/${filename}`,
      data: base64Data,
      directory: Directory.ExternalStorage,
      // Request write permission automatically if not yet granted
      recursive: true,
    });
    return result.uri;
  } catch {
    // ExternalStorage not available (e.g. older Android, sandboxed env) —
    // fall back to the app's Documents directory.
  }

  // Second attempt: Documents directory
  const result = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Documents,
    recursive: true,
  });
  return result.uri;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ExportDialog({ controller }: ExportDialogProps) {
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const isOpen = state.activePanel === 'export';

  const [format, setFormat]           = useState<'png' | 'jpeg'>('png');
  const [quality, setQuality]         = useState(95);
  const [scalePreset, setScalePreset] = useState('2');
  const [customScale, setCustomScale] = useState('2');
  const [exporting, setExporting]     = useState(false);

  const multiplier = scalePreset === 'custom' ? parseFloat(customScale) || 1 : parseFloat(scalePreset);

  const handleExport = async () => {
    const dataUrl = controller.exportCanvas(format, quality / 100, multiplier);
    if (!dataUrl) return;

    const ext      = format === 'jpeg' ? 'jpg' : 'png';
    const ts       = Math.floor(Date.now() / 1000);
    const filename = `CyberStudio_design_${ts}.${ext}`;
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

    setExporting(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // ── Native: save directly to device Downloads/Documents ──────────────
        try {
          const base64Data = dataUrl.split(',')[1];
          await saveToDeviceFiles(base64Data, filename, mimeType);

          toast({
            title: 'Saved to device files!',
            description: filename,
            duration: 3000,
          });
        } catch (nativeErr) {
          // Last resort: share sheet (lets user save manually via OS)
          try {
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            const { Share } = await import('@capacitor/share');
            const base64Data = dataUrl.split(',')[1];
            const cached = await Filesystem.writeFile({
              path: filename,
              data: base64Data,
              directory: Directory.Cache,
            });
            await Share.share({
              title: state.projectName || 'Design',
              text: 'Exported from Cyber Studio',
              files: [cached.uri],
              dialogTitle: 'Save or share your design',
            });
          } catch {
            console.warn('All native save paths failed', nativeErr);
            toast({
              title: 'Export failed',
              description: 'Could not write to device storage.',
              variant: 'destructive',
              duration: 4000,
            });
          }
        }
      } else {
        // ── Web / Dev mode: standard anchor download ──────────────────────────
        downloadViaLink(dataUrl, filename);
      }
    } finally {
      setExporting(false);
    }

    dispatch({ type: 'CLOSE_PANEL' });
  };

  const canvasSize = state.canvasSize || { width: 1080, height: 1080 };
  const exportW    = Math.round(canvasSize.width  * multiplier);
  const exportH    = Math.round(canvasSize.height * multiplier);
  const isNative   = Capacitor.isNativePlatform();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <DialogContent className="sm:max-w-md gap-4 p-4" data-testid="dialog-export">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Export Design</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Format */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Format</Label>
            <ToggleGroup
              type="single"
              value={format}
              onValueChange={(val) => val && setFormat(val as 'png' | 'jpeg')}
              className="justify-start gap-2"
              data-testid="toggle-group-format"
            >
              <ToggleGroupItem value="png"  className="h-8 text-xs px-4" data-testid="toggle-item-png">PNG</ToggleGroupItem>
              <ToggleGroupItem value="jpeg" className="h-8 text-xs px-4" data-testid="toggle-item-jpeg">JPEG</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Quality (JPEG only) */}
          {format === 'jpeg' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Quality</Label>
                <span className="text-xs font-mono">{quality}%</span>
              </div>
              <Slider
                value={[quality]}
                onValueChange={(vals) => setQuality(vals[0])}
                min={10} max={100} step={1}
                className="py-2"
                data-testid="slider-quality"
              />
            </div>
          )}

          {/* Scale preset */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Size Options</Label>
            <Select value={scalePreset} onValueChange={setScalePreset} data-testid="select-scale-preset">
              <SelectTrigger className="h-8 text-xs">
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

          {/* Custom multiplier */}
          {scalePreset === 'custom' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Multiplier</Label>
              <Input
                type="number" min="0.5" max="10" step="0.5"
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

          {/* Context hint */}
          {isNative && (
            <p className="text-[10px] text-center" style={{ color: 'rgba(0,245,255,0.45)' }}>
              Saves directly to Downloads on your device
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="w-full gap-2"
            data-testid="button-export"
          >
            {isNative ? <FolderDown size={14} /> : <Download size={14} />}
            {exporting
              ? 'Exporting…'
              : isNative
                ? `Save ${format.toUpperCase()} to Device`
                : `Download ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
