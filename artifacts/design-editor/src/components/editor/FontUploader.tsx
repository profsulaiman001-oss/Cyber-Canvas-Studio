import { useRef } from 'react';
import { Upload, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { useToast } from '@/hooks/use-toast';
import localforage from 'localforage';

const FONTS_STORE_KEY = 'cyber_studio_custom_fonts';

interface StoredFont {
  name: string;
  data: ArrayBuffer;
}

export async function loadStoredFonts(dispatch: (action: { type: 'ADD_CUSTOM_FONT'; payload: string }) => void) {
  const stored = await localforage.getItem<StoredFont[]>(FONTS_STORE_KEY);
  if (!stored) return;
  for (const font of stored) {
    const face = new FontFace(font.name, font.data);
    try {
      await face.load();
      document.fonts.add(face);
      dispatch({ type: 'ADD_CUSTOM_FONT', payload: font.name });
    } catch {
      // ignore
    }
  }
}

export default function FontUploader() {
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;

    const rawName = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]/g, ' ').trim();
    const fontName = rawName || 'Custom Font';

    try {
      const buffer = await file.arrayBuffer();
      const face = new FontFace(fontName, buffer);
      await face.load();
      document.fonts.add(face);

      const stored = (await localforage.getItem<StoredFont[]>(FONTS_STORE_KEY)) || [];
      if (!stored.find((f) => f.name === fontName)) {
        stored.push({ name: fontName, data: buffer });
        await localforage.setItem(FONTS_STORE_KEY, stored);
      }

      dispatch({ type: 'ADD_CUSTOM_FONT', payload: fontName });
      toast({ title: 'Font loaded', description: `"${fontName}" is ready to use` });
    } catch {
      toast({ title: 'Font error', description: 'Could not load this font file', variant: 'destructive' });
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    inputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-font-upload"
      />
      <Button
        type="button"
        variant="secondary"
        className="w-full gap-2"
        onClick={handleButtonClick}
        data-testid="button-upload-font"
      >
        <Upload size={14} />
        Upload Font (.ttf / .otf)
      </Button>

      {state.customFonts.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Loaded fonts:</p>
          {state.customFonts.map((font) => (
            <div key={font} className="flex items-center gap-2 text-sm px-2 py-1 rounded bg-secondary/50">
              <Type size={12} className="text-primary" />
              <span style={{ fontFamily: font }}>{font}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
