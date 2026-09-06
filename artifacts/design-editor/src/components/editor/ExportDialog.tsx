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
import { Capacitor } from '@capacitor/core';
import { Download, ImageDown } from 'lucide-react';

interface ExportDialogProps {
  controller: CanvasController;
}

export default function ExportDialog({ controller }: ExportDialogProps) {
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const isOpen = state.activePanel === 'export';

  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [quality, setQuality] = useState(95);
  const [scalePreset, setScalePreset] = useState('2');
  const [customScale, setCustomScale] = useState('2');
  const [isSaving, setIsSaving] = useState(false);

  const multiplier = scalePreset === 'custom' ? parseFloat(customScale) || 1 : parseFloat(scalePreset);

  const handleExport = async () => {
    // controller.exportCanvas now handles the viewport preservation and edge cropping internally!
    const dataUrl = controller.exportCanvas(format, quality / 100, multiplier);
    if (!dataUrl) return;
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const filename = `${state.projectName || 'untitled'}_design.${ext}`;

    /*
     * Native Android path: Media.savePhoto writes through Android's media
     * storage, creates an app album, and scans the resulting file so it is
     * visible to Google Photos/Gallery immediately. This branch is deliberately
     * before the browser download and is never used by Web or Electron.
     */
    if (Capacitor.isNativePlatform()) {
      setIsSaving(true);
      try {
        const [{ Media }, { Filesystem }] = await Promise.all([
          import('@capacitor-community/media'),
          import('@capacitor/filesystem'),
        ]);

        // Ask the Filesystem plugin for legacy public-storage permissions.
        // Media.getAlbums() below separately handles READ_MEDIA_IMAGES on
        // Android 13+ when gallery mode is enabled.
        await Filesystem.requestPermissions();

        const albumName = 'Cyber Canvas Studio';
        let albums = (await Media.getAlbums()).albums;
        let album = albums.find((candidate) => candidate.name === albumName);
        if (!album) {
          try {
            await Media.createAlbum({ name: albumName });
          } catch {
            // A concurrent export may have created it; resolve the identifier
            // from the refreshed album list below.
          }
          albums = (await Media.getAlbums()).albums;
          album = albums.find((candidate) => candidate.name === albumName);
        }

        if (!album?.identifier) {
          throw new Error('The Cyber Canvas Studio album could not be created');
        }

        const fileName = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
        await Media.savePhoto({
          path: dataUrl,
          albumIdentifier: album.identifier,
          fileName,
        });

        toast({
          title: 'Saved to Gallery',
          description: `Exported to the ${albumName} album`,
        });
        dispatch({ type: 'CLOSE_PANEL' });
      } catch (error) {
        toast({
          title: 'Gallery export failed',
          description: error instanceof Error ? error.message : 'Allow photo access and try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Existing Web and Electron behavior stays unchanged.
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    dispatch({ type: 'CLOSE_PANEL' });
  };

  const canvasSize = state.canvasSize || { width: 1080, height: 1080 };
  const exportW = Math.round(canvasSize.width * multiplier);
  const exportH = Math.round(canvasSize.height * multiplier);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <DialogContent className="sm:max-w-md gap-4 p-4" data-testid="dialog-export">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Export Design</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Format</Label>
            <ToggleGroup
              type="single"
              value={format}
              onValueChange={(val) => val && setFormat(val as 'png' | 'jpeg')}
              className="justify-start gap-2"
              data-testid="toggle-group-format"
            >
              <ToggleGroupItem value="png" className="h-8 text-xs px-4" data-testid="toggle-item-png">
                PNG
              </ToggleGroupItem>
              <ToggleGroupItem value="jpeg" className="h-8 text-xs px-4" data-testid="toggle-item-jpeg">
                JPEG
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {format === 'jpeg' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs text-muted-foreground">Quality</Label>
                <span className="text-xs font-mono">{quality}%</span>
              </div>
              <Slider
                value={[quality]}
                onValueChange={(vals) => setQuality(vals[0])}
                min={10}
                max={100}
                step={1}
                className="py-2"
                data-testid="slider-quality"
              />
            </div>
          )}

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
            {Capacitor.isNativePlatform() ? <ImageDown size={14} /> : <Download size={14} />}
            {isSaving ? 'Saving to Gallery…' : Capacitor.isNativePlatform() ? `Save to Gallery (${format.toUpperCase()})` : `Download ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}