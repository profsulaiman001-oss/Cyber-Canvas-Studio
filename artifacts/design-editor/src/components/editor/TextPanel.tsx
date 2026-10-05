import { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { IText, Textbox } from 'fabric';
import { FONTS_STORE_KEY, StoredFont, injectFontFace } from './FontUploader';
import FontPicker from './FontPicker';
import { useToast } from '@/hooks/use-toast';
import { Type } from 'lucide-react';
import localforage from 'localforage';
import { ResponsiveDrawerWrapper } from './ResponsiveDrawerWrapper';
import {
  applyCharacterRangeStyle,
  getCharacterCount,
  getCharacterRangeStyleState,
} from '@/lib/characterStyles';
import type { CanvasTextProperties, CharacterStylePatch } from '@/types/canvas';

const SYSTEM_FONTS = ['Inter', 'Georgia', 'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Impact'];

interface TextPanelProps { controller: CanvasController }

function toColorInputValue(color: string | undefined): string {
  if (!color) return '#00F5FF';
  if (/^#[\da-f]{6}$/i.test(color)) return color;
  if (/^#[\da-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split('').map((part) => part + part).join('')}`;
  }
  const rgb = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!rgb) return '#00F5FF';
  return `#${rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))).toString(16).padStart(2, '0')).join('')}`;
}

function SliderRow({ label, value, min, max, step = 1, onChange, unit = '' }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs text-muted-foreground">{Math.round(value * 100) / 100}{unit}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} className="w-full" />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-1">{children}</p>;
}

export default function TextPanel({ controller }: TextPanelProps) {
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const isOpen = state.activePanel === 'text';
  const obj = controller.selectedObject;
  const isText = obj?.type === 'i-text' || obj?.type === 'text' || obj?.type === 'textbox';
  const textObj = isText ? (obj as IText) : null;

  /* ── Edit-mode state ── */
  const [textContent, setTextContent] = useState('');
  const [fontSize, setFontSize] = useState(40);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontWeight, setFontWeight] = useState('normal');
  const [fontStyle, setFontStyle] = useState('normal');
  const [underline, setUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState('left');
  const [charSpacing, setCharSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(1.16);
  const [glowEnabled, setGlowEnabled] = useState(false);
  const [glowColor, setGlowColor] = useState('#00F5FF');
  const [glowIntensity, setGlowIntensity] = useState(20);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);
  const [rangeFill, setRangeFill] = useState('#00F5FF');
  const [rangeBold, setRangeBold] = useState(false);
  const [rangeItalic, setRangeItalic] = useState(false);
  const [rangeUnderline, setRangeUnderline] = useState(false);

  /* ── Add-mode state ── */
  const [addContent, setAddContent] = useState('New Text');
  const [addFontSize, setAddFontSize] = useState(40);
  const [addFontFamily, setAddFontFamily] = useState('Inter');
  const [addFontWeight, setAddFontWeight] = useState('normal');
  const [addFontStyle, setAddFontStyle] = useState('normal');
  const [addUnderline, setAddUnderline] = useState(false);
  const [addTextAlign, setAddTextAlign] = useState('left');

  const fontInputRef = useRef<HTMLInputElement>(null);

  const allFonts = [...SYSTEM_FONTS, ...state.customFonts].sort((a, b) => a.localeCompare(b));
  void allFonts;

  /* ── Sync edit state from selected object ── */
  const syncFromObj = useCallback(() => {
    if (!textObj) return;
    setTextContent(textObj.text || '');
    setFontSize(textObj.fontSize || 40);
    setFontFamily((textObj.fontFamily as string) || 'Inter');
    setFontWeight((textObj.fontWeight as string) || 'normal');
    setFontStyle((textObj.fontStyle as string) || 'normal');
    setUnderline(!!(textObj as IText & { underline?: boolean }).underline);
    setTextAlign((textObj.textAlign as string) || 'left');
    setCharSpacing(typeof textObj.charSpacing === 'number'
      ? (textObj.charSpacing * (textObj.fontSize || 40)) / 1000
      : 0);
    setLineHeight(typeof textObj.lineHeight === 'number' ? textObj.lineHeight : 1.16);
    const initialEnd = Math.max(0, Math.min(4, getCharacterCount(textObj.text || '') - 1));
    setRangeStart(0);
    setRangeEnd(initialEnd);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const glow = (obj as any)?._glow as { enabled?: boolean; color?: string; intensity?: number } | undefined;
    if (glow?.enabled) {
      setGlowEnabled(true);
      setGlowColor(glow.color || '#00F5FF');
      setGlowIntensity(glow.intensity || 20);
    } else {
      setGlowEnabled(false);
    }
  }, [textObj, obj]);

  useEffect(() => { syncFromObj(); }, [syncFromObj]);

  /* ── Apply helpers (edit mode) ── */
  const apply = useCallback((props: Record<string, unknown>) => {
    if (!textObj) return;
    textObj.set(props);
    textObj.initDimensions();
    textObj.setCoords();
    textObj.dirty = true;
    controller.getCanvas()?.renderAll();
    controller.commitChange();
  }, [textObj, controller]);

  const applyFontFamily = (v: string) => {
    setFontFamily(v);
    apply({ fontFamily: v });
    const deduped = [v, ...state.recentFonts.filter((f) => f !== v)].slice(0, 6);
    dispatch({ type: 'SET_RECENT_FONTS', payload: deduped });
  };

  const applyBold = () => { const n = fontWeight === 'bold' ? 'normal' : 'bold'; setFontWeight(n); apply({ fontWeight: n }); };
  const applyItalic = () => { const n = fontStyle === 'italic' ? 'normal' : 'italic'; setFontStyle(n); apply({ fontStyle: n }); };
  const applyUnderline = () => { const n = !underline; setUnderline(n); apply({ underline: n }); };
  const applyTextAlign = (v: string) => { if (!v) return; setTextAlign(v); apply({ textAlign: v }); };
  const applyCharSpacing = (v: number) => {
    setCharSpacing(v);
    const size = Math.max(1, textObj?.fontSize || fontSize);
    apply({ charSpacing: (v * 1000) / size });
  };
  const applyLineHeight = (v: number) => { setLineHeight(v); apply({ lineHeight: v }); };

  useEffect(() => {
    if (!textObj) return;
    const count = getCharacterCount(textObj.text || '');
    if (count === 0) return;
    const start = Math.max(0, Math.min(count - 1, rangeStart));
    const end = Math.max(start, Math.min(count - 1, rangeEnd));
    const style = getCharacterRangeStyleState(
      textObj as IText & CanvasTextProperties,
      start,
      end,
    );
    setRangeBold(style.fontWeight === 'bold');
    setRangeItalic(style.fontStyle === 'italic');
    setRangeUnderline(style.underline === true);
    setRangeFill(toColorInputValue(style.fill));
  }, [textObj, rangeStart, rangeEnd, textContent]);

  const applyRangeStyle = (patch: CharacterStylePatch) => {
    if (!textObj || getCharacterCount(textObj.text || '') === 0) return;
    applyCharacterRangeStyle(
      textObj as IText & CanvasTextProperties,
      rangeStart,
      rangeEnd,
      patch,
    );
    controller.getCanvas()?.renderAll();
    controller.commitChange();
  };

  const applyGlowEffect = useCallback((en: boolean, color: string, intensity: number) => {
    controller.applyGlow(obj, en ? { enabled: true, color, intensity } : null);
    controller.commitChange();
  }, [obj, controller]);

  /* ── Add text to canvas (Textbox for wrapping support) ── */
  const handleAddToCanvas = useCallback(() => {
    const canvas = controller.getCanvas();
    if (!canvas) return;

    const cx = state.canvasSize.width / 2;
    const cy = state.canvasSize.height / 2;

    const newText = new Textbox(addContent.trim() || 'New Text', {
      left: cx - 125,
      top: cy - addFontSize / 2,
      width: 250,
      fontSize: addFontSize,
      fontFamily: addFontFamily,
      fontWeight: addFontWeight as 'normal' | 'bold',
      fontStyle: addFontStyle as 'normal' | 'italic',
      underline: addUnderline,
      textAlign: addTextAlign as 'left' | 'center' | 'right',
      fill: '#1A1A1A',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newText as any)._name = addContent.trim() || 'New Text';
    // Keep explicitly authored text names when the layer panel derives names
    // from the object content.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newText as any)._isCustomName = true;

    canvas.add(newText);
    canvas.setActiveObject(newText);
    canvas.renderAll();
    controller.pushUndoNow();

    if (addFontFamily !== 'Inter') {
      const deduped = [addFontFamily, ...state.recentFonts.filter((f) => f !== addFontFamily)].slice(0, 6);
      dispatch({ type: 'SET_RECENT_FONTS', payload: deduped });
    }
  }, [
    controller, state.canvasSize, state.recentFonts, dispatch,
    addContent, addFontSize, addFontFamily, addFontWeight, addFontStyle, addUnderline, addTextAlign,
  ]);

  /* ── Font import (supports multiple files in one batch) ── */
  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    const stored = (await localforage.getItem<StoredFont[]>(FONTS_STORE_KEY)) || [];
    let loaded = 0;
    let failed = 0;

    await Promise.all(files.map(async (file) => {
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

        if (!stored.find((f) => f.name === fontName)) {
          stored.push({ name: fontName, data: buffer, ext });
        }
        dispatch({ type: 'ADD_CUSTOM_FONT', payload: fontName });
        loaded += 1;
      } catch {
        failed += 1;
      }
    }));

    await localforage.setItem(FONTS_STORE_KEY, stored);

    if (loaded > 0) {
      toast({ title: 'Fonts loaded', description: `${loaded} font${loaded > 1 ? 's' : ''} ready to use` });
    }
    if (failed > 0) {
      toast({ title: 'Font error', description: `${failed} file${failed > 1 ? 's' : ''} could not be loaded`, variant: 'destructive' });
    }
    if (fontInputRef.current) fontInputRef.current.value = '';
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <ResponsiveDrawerWrapper
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '82vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="text-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <Type size={15} className="text-primary" />
            {isText ? 'Edit Text' : 'Add Text'}
          </SheetTitle>
        </SheetHeader>

        {/* ════ ADD MODE ════ */}
        {!isText ? (
          <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <SectionLabel>Text Content</SectionLabel>
            <textarea
              value={addContent}
              onChange={(e) => setAddContent(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit', fontFamily: addFontFamily }}
              placeholder="Enter text…"
            />

            <SectionLabel>Style</SectionLabel>
            <div className="flex gap-2">
              <Button variant={addFontWeight === 'bold' ? 'default' : 'secondary'} size="sm" className="flex-1 h-9 font-bold"
                onClick={() => setAddFontWeight(addFontWeight === 'bold' ? 'normal' : 'bold')}><Bold size={14} /></Button>
              <Button variant={addFontStyle === 'italic' ? 'default' : 'secondary'} size="sm" className="flex-1 h-9 italic"
                onClick={() => setAddFontStyle(addFontStyle === 'italic' ? 'normal' : 'italic')}><Italic size={14} /></Button>
              <Button variant={addUnderline ? 'default' : 'secondary'} size="sm" className="flex-1 h-9 underline"
                onClick={() => setAddUnderline(!addUnderline)}><Underline size={14} /></Button>
            </div>
            <ToggleGroup type="single" value={addTextAlign} onValueChange={(v) => v && setAddTextAlign(v)} className="justify-start gap-1">
              <ToggleGroupItem value="left" className="h-9 w-9 p-0"><AlignLeft size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="center" className="h-9 w-9 p-0"><AlignCenter size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="right" className="h-9 w-9 p-0"><AlignRight size={14} /></ToggleGroupItem>
            </ToggleGroup>

            <Separator />
            <SectionLabel>Typography</SectionLabel>
            <SliderRow label="Font Size" value={addFontSize} min={8} max={300} onChange={setAddFontSize} unit="px" />

            <Separator />
            <SectionLabel>Font</SectionLabel>
            <FontPicker
              value={addFontFamily}
              onChange={setAddFontFamily}
              systemFonts={SYSTEM_FONTS}
              customFonts={state.customFonts}
            />

            {state.recentFonts.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recent</p>
                <div className="flex flex-wrap gap-1.5">
                  {state.recentFonts.map((f) => (
                    <button key={f} type="button" onClick={() => setAddFontFamily(f)}
                      className="text-[10px] px-2 py-0.5 rounded border transition-all"
                      style={{
                        background: addFontFamily === f ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
                        borderColor: addFontFamily === f ? '#00F5FF' : 'rgba(255,255,255,0.1)',
                        color: addFontFamily === f ? '#00F5FF' : '#9ca3af', fontFamily: f,
                      }}>{f}</button>
                  ))}
                </div>
              </div>
            )}

            <Button type="button" className="w-full h-10 gap-2 font-semibold"
              style={{ background: 'linear-gradient(135deg, rgba(0,245,255,0.2) 0%, rgba(123,47,255,0.2) 100%)', border: '1px solid rgba(0,245,255,0.5)', color: '#00F5FF' }}
              onClick={handleAddToCanvas}>
              <Plus size={15} />Add to Canvas
            </Button>

            <Separator />
            <SectionLabel>Import Fonts</SectionLabel>
            <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple onChange={handleFontUpload} className="hidden" data-testid="input-font-upload-add" />
            <Button type="button" variant="secondary" size="sm" className="w-full gap-2 h-9" onClick={() => fontInputRef.current?.click()}>
              <Upload size={13} />
              Import Fonts (.ttf / .otf / .woff)
            </Button>

            <div className="h-2" />
          </div>

        ) : (

        /* ════ EDIT MODE ════ */
          <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <SectionLabel>Content</SectionLabel>
            <textarea
              value={textContent}
              onChange={(e) => {
                const nextText = e.target.value;
                const nextMax = Math.max(0, getCharacterCount(nextText) - 1);
                setTextContent(nextText);
                setRangeStart((value) => Math.min(value, nextMax));
                setRangeEnd((value) => Math.min(value, nextMax));
                apply({
                  text: nextText,
                  typographyTransform: 'none',
                  typographyOriginalText: nextText,
                });
              }}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit', fontFamily }}
              placeholder="Enter text…"
            />

            <Separator />
            <SectionLabel>Character Range</SectionLabel>
            <p className="text-[10px] text-muted-foreground">
              Apply fill, bold, italic, or underline to an inclusive character range. Positions start at 0.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-[10px] text-muted-foreground">
                From
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, getCharacterCount(textContent) - 1)}
                  value={rangeStart}
                  onChange={(event) => {
                    const max = Math.max(0, getCharacterCount(textContent) - 1);
                    const next = Math.max(0, Math.min(max, Math.floor(Number(event.currentTarget.value) || 0)));
                    setRangeStart(next);
                    if (next > rangeEnd) setRangeEnd(next);
                  }}
                  disabled={!getCharacterCount(textContent)}
                  aria-label="Character range start index"
                  data-testid="input-character-range-start"
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 text-xs text-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-40"
                />
              </label>
              <label className="space-y-1 text-[10px] text-muted-foreground">
                To
                <input
                  type="number"
                  min={rangeStart}
                  max={Math.max(0, getCharacterCount(textContent) - 1)}
                  value={rangeEnd}
                  onChange={(event) => {
                    const max = Math.max(0, getCharacterCount(textContent) - 1);
                    const next = Math.max(rangeStart, Math.min(max, Math.floor(Number(event.currentTarget.value) || 0)));
                    setRangeEnd(next);
                  }}
                  disabled={!getCharacterCount(textContent)}
                  aria-label="Character range end index"
                  data-testid="input-character-range-end"
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 text-xs text-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-40"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={rangeBold ? 'default' : 'secondary'}
                size="sm"
                className="h-9 min-w-9 font-bold"
                onClick={() => {
                  const next = !rangeBold;
                  setRangeBold(next);
                  applyRangeStyle({ fontWeight: next ? 'bold' : 'normal' });
                }}
                disabled={!getCharacterCount(textContent)}
                aria-label="Toggle bold for character range"
                aria-pressed={rangeBold}
                data-testid="button-character-range-bold"
              >
                <Bold size={14} />
              </Button>
              <Button
                type="button"
                variant={rangeItalic ? 'default' : 'secondary'}
                size="sm"
                className="h-9 min-w-9 italic"
                onClick={() => {
                  const next = !rangeItalic;
                  setRangeItalic(next);
                  applyRangeStyle({ fontStyle: next ? 'italic' : 'normal' });
                }}
                disabled={!getCharacterCount(textContent)}
                aria-label="Toggle italic for character range"
                aria-pressed={rangeItalic}
                data-testid="button-character-range-italic"
              >
                <Italic size={14} />
              </Button>
              <Button
                type="button"
                variant={rangeUnderline ? 'default' : 'secondary'}
                size="sm"
                className="h-9 min-w-9 underline"
                onClick={() => {
                  const next = !rangeUnderline;
                  setRangeUnderline(next);
                  applyRangeStyle({ underline: next });
                }}
                disabled={!getCharacterCount(textContent)}
                aria-label="Toggle underline for character range"
                aria-pressed={rangeUnderline}
                data-testid="button-character-range-underline"
              >
                <Underline size={14} />
              </Button>
              <label className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[10px] text-muted-foreground">
                Fill
                <input
                  type="color"
                  value={rangeFill}
                  onChange={(event) => {
                    setRangeFill(event.currentTarget.value);
                    applyRangeStyle({ fill: event.currentTarget.value });
                  }}
                  disabled={!getCharacterCount(textContent)}
                  aria-label="Set fill for character range"
                  data-testid="input-character-range-fill"
                  className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                />
              </label>
            </div>

            <SectionLabel>Style</SectionLabel>
            <div className="flex gap-2">
              <Button variant={fontWeight === 'bold' ? 'default' : 'secondary'} size="sm" className="flex-1 h-9 font-bold" onClick={applyBold}><Bold size={14} /></Button>
              <Button variant={fontStyle === 'italic' ? 'default' : 'secondary'} size="sm" className="flex-1 h-9 italic" onClick={applyItalic}><Italic size={14} /></Button>
              <Button variant={underline ? 'default' : 'secondary'} size="sm" className="flex-1 h-9 underline" onClick={applyUnderline}><Underline size={14} /></Button>
            </div>
            <ToggleGroup type="single" value={textAlign} onValueChange={applyTextAlign} className="justify-start gap-1">
              <ToggleGroupItem value="left" className="h-9 w-9 p-0"><AlignLeft size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="center" className="h-9 w-9 p-0"><AlignCenter size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="right" className="h-9 w-9 p-0"><AlignRight size={14} /></ToggleGroupItem>
            </ToggleGroup>

            <Separator />
            <SectionLabel>Typography</SectionLabel>
            <SliderRow label="Font Size" value={fontSize} min={8} max={300}
              onChange={(v) => {
                setFontSize(v);
                apply({ fontSize: v, charSpacing: (charSpacing * 1000) / Math.max(1, v) });
              }} unit="px" />
            <SliderRow label="Letter Spacing" value={charSpacing} min={-50} max={200} step={1} onChange={applyCharSpacing} unit="px" />
            <SliderRow label="Line Height" value={lineHeight} min={0.5} max={4} step={0.05} onChange={applyLineHeight} />

            <Separator />
            <SectionLabel>Font</SectionLabel>
            <FontPicker
              value={fontFamily}
              onChange={applyFontFamily}
              systemFonts={SYSTEM_FONTS}
              customFonts={state.customFonts}
              data-testid="text-panel-font-select"
            />

            {state.recentFonts.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recent</p>
                <div className="flex flex-wrap gap-1.5">
                  {state.recentFonts.map((f) => (
                    <button key={f} type="button" onClick={() => applyFontFamily(f)}
                      className="text-[10px] px-2 py-0.5 rounded border transition-all"
                      style={{
                        background: fontFamily === f ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
                        borderColor: fontFamily === f ? '#00F5FF' : 'rgba(255,255,255,0.1)',
                        color: fontFamily === f ? '#00F5FF' : '#9ca3af', fontFamily: f,
                      }}>{f}</button>
                  ))}
                </div>
              </div>
            )}

            <Separator />
            <SectionLabel>Import Fonts</SectionLabel>
            <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple onChange={handleFontUpload} className="hidden" data-testid="input-font-upload-edit" />
            <Button type="button" variant="secondary" size="sm" className="w-full gap-2 h-9" onClick={() => fontInputRef.current?.click()}>
              <Upload size={13} />
              Import Fonts (.ttf / .otf / .woff)
            </Button>

            {/* ── Glow Effect ── */}
            <Separator />
            <div className="flex items-center justify-between">
              <SectionLabel>Glow / Neon</SectionLabel>
              <Switch checked={glowEnabled} onCheckedChange={(v) => { setGlowEnabled(v); applyGlowEffect(v, glowColor, glowIntensity); }} />
            </div>
            {glowEnabled && (
              <div className="space-y-3 pl-2 border-l border-border">
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground w-12">Color</Label>
                  <input type="color" value={glowColor}
                    onChange={(e) => { setGlowColor(e.target.value); applyGlowEffect(true, e.target.value, glowIntensity); }}
                    className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent p-0.5 flex-shrink-0" />
                  <span className="text-xs font-mono text-muted-foreground">{glowColor.toUpperCase()}</span>
                </div>
                <SliderRow label="Intensity" value={glowIntensity} min={1} max={60}
                  onChange={(v) => { setGlowIntensity(v); applyGlowEffect(true, glowColor, v); }} />
              </div>
            )}

            <div className="h-2" />
          </div>
        )}
      </ResponsiveDrawerWrapper>
    </Sheet>
  );
}
