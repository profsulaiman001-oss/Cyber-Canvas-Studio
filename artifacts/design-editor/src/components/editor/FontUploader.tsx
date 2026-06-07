import { useRef } from 'react';
import { Upload, Type, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { useToast } from '@/hooks/use-toast';
import localforage from 'localforage';

export const FONTS_STORE_KEY = 'cyber_studio_custom_fonts';

export interface StoredFont {
  name: string;
  data: ArrayBuffer;
  ext?: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function injectFontFace(fontName: string, buffer: ArrayBuffer, ext = 'ttf') {
  const styleId = `font-face-${fontName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '')}`;
  const existing = document.getElementById(styleId);
  if (existing) existing.remove();

  const formatMap: Record<string, string> = {
    ttf: 'truetype',
    otf: 'opentype',
    woff: 'woff',
    woff2: 'woff2',
  };
  const format = formatMap[ext.toLowerCase()] || 'truetype';
  const mimeMap: Record<string, string> = {
    ttf: 'font/ttf',
    otf: 'font/otf',
    woff: 'font/woff',
    woff2: 'font/woff2',
  };
  const mime = mimeMap[ext.toLowerCase()] || 'font/ttf';
  const base64 = arrayBufferToBase64(buffer);
  const dataUrl = `data:${mime};base64,${base64}`;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `@font-face { font-family: '${fontName}'; src: url('${dataUrl}') format('${format}'); font-display: block; }`;
  document.head.appendChild(style);
}

export async function loadStoredFonts(
  dispatch: (action: { type: 'ADD_CUSTOM_FONT'; payload: string }) => void
) {
  const stored = await localforage.getItem<StoredFont[]>(FONTS_STORE_KEY);
  if (!stored) return;
  for (const font of stored) {
    try {
      const face = new FontFace(font.name, font.data);
      await face.load();
      document.fonts.add(face);
      injectFontFace(font.name, font.data, font.ext || 'ttf');
      dispatch({ type: 'ADD_CUSTOM_FONT', payload: font.name });
    } catch {
      // ignore corrupted entries
    }
  }
}

export async function removeStoredFont(
  fontName: string,
  dispatch: (action: { type: 'REMOVE_CUSTOM_FONT'; payload: string }) => void
) {
  const stored = (await localforage.getItem<StoredFont[]>(FONTS_STORE_KEY)) || [];
  const updated = stored.filter((f) => f.name !== fontName);
  await localforage.setItem(FONTS_STORE_KEY, updated);

  const styleId = `font-face-${fontName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '')}`;
  document.getElementById(styleId)?.remove();

  dispatch({ type: 'REMOVE_CUSTOM_FONT', payload: fontName });
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

    const extMatch = file.name.match(/\.(ttf|otf|woff2?)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'ttf';
    const rawName = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]/g, ' ').trim();
    const fontName = rawName || 'Custom Font';

    try {
      const buffer = await file.arrayBuffer();
      const face = new FontFace(fontName, buffer);
      await face.load();
      document.fonts.add(face);
      injectFontFace(fontName, buffer, ext);

      const stored = (await localforage.getItem<StoredFont[]>(FONTS_STORE_KEY)) || [];
      if (!stored.find((f) => f.name === fontName)) {
        stored.push({ name: fontName, data: buffer, ext });
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

  const handleDelete = async (fontName: string) => {
    await removeStoredFont(fontName, dispatch);
    toast({ title: 'Font removed', description: `"${fontName}" deleted` });
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
        Upload Font (.ttf / .otf / .woff)
      </Button>

      {state.customFonts.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Custom fonts:</p>
          {[...state.customFonts].sort((a, b) => a.localeCompare(b)).map((font) => (
            <div
              key={font}
              className="flex items-center justify-between gap-2 px-2 py-1 rounded"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Type size={12} className="text-primary flex-shrink-0" />
                <span className="text-xs truncate" style={{ fontFamily: font }}>{font}</span>
              </div>
              <button
                onClick={() => handleDelete(font)}
                className="text-destructive hover:text-red-400 flex-shrink-0 p-1 rounded"
                title={`Delete ${font}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
