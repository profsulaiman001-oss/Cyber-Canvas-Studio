import { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { IText, Shadow } from 'fabric';
import { FONTS_STORE_KEY, StoredFont, injectFontFace, removeStoredFont } from './FontUploader';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Type } from 'lucide-react';
import localforage from 'localforage';

const SYSTEM_FONTS = ['Inter', 'Georgia', 'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Impact'];

interface TextPanelProps { controller: CanvasController }

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
  const isText = obj?.type === 'i-text' || obj?.type === 'text';
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
  const [depthEnabled, setDepthEnabled] = useState(false);
  const [depthAmount, setDepthAmount] = useState(8);
  const [depthColor, setDepthColor] = useState('#333333');
  const [depthAngle, setDepthAngle] = useState(225);

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
    setCharSpacing(typeof textObj.charSpacing === 'number' ? textObj.charSpacing / 10 : 0);
    setLineHeight(typeof textObj.lineHeight === 'number' ? textObj.lineHeight : 1.16);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const glow = (obj as any)?._glow as { enabled?: boolean; color?: string; intensity?: number } | undefined;
    if (glow?.enabled) {
      setGlowEnabled(true);
      setGlowColor(glow.color || '#00F5FF');
      setGlowIntensity(glow.intensity || 20);
    } else {
      setGlowEnabled(false);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const depth = (obj as any)?._depth3d as { enabled?: boolean; steps?: number; color?: string; angle?: number } | undefined;
    if (depth?.enabled) {
      setDepthEnabled(true);
      setDepthAmount(depth.steps ?? 8);
      setDepthColor(depth.color ?? '#333333');
      setDepthAngle(depth.angle ?? 225);
    } else {
      setDepthEnabled(false);
    }
  }, [textObj, obj]);

  useEffect(() => { syncFromObj(); }, [syncFromObj]);

  /* ── Apply helpers (edit mode) ── */
  const apply = useCallback((props: Record<string, unknown>) => {
    if (!textObj) return;
    textObj.set(props);
    controller.getCanvas()?.renderAll();
    controller.syncObjects();
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
  const applyCharSpacing = (v: number) => { setCharSpacing(v); apply({ charSpacing: v * 10 }); };
  const applyLineHeight = (v: number) => { setLineHeight(v); apply({ lineHeight: v }); };

  const applyGlowEffect = useCallback((en: boolean, color: string, intensity: number) => {
    controller.applyGlow(obj, en ? { enabled: true, color, intensity } : null);
  }, [obj, controller]);

  const applyDepth = useCallback((en: boolean, amount: number, color: string, angle: number) => {
    if (!obj) return;
    controller.apply3DDepth(obj, en ? { enabled: true, steps: amount, color, angle } : null);
  }, [obj, controller]);

  /* ── Add text to canvas ── */
  const handleAddToCanvas = useCallback(() => {
    const canvas = controller.getCanvas();
    if (!canvas) return;

    const cx = state.canvasSize.width / 2;
    const cy = state.canvasSize.height / 2;

    const newText = new IText(addContent.trim() || 'New Text', {
      left: cx - 80,
      top: cy - addFontSize / 2,
      fontSize: addFontSize,
      fontFamily: addFontFamily,
      fontWeight: addFontWeight as 'normal' | 'bold',
      fontStyle: addFontStyle as 'normal' | 'italic',
      underline: addUnderline,
      textAlign: addTextAlign as 'left' | 'center' | 'right',
      fill: '#1A1A1A',
    });

    // Tag with uid + name (mirrors useFabricCanvas internal pattern)
    const seq = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newText as any)._uid = `itext-${seq}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newText as any)._name = `Text ${seq % 10000}`;

    canvas.add(newText);
    canvas.setActiveObject(newText);
    canvas.renderAll();
    controller.syncObjects();

    if (addFontFamily !== 'Inter') {
      const deduped = [addFontFamily, ...state.recentFonts.filter((f) => f !== addFontFamily)].slice(0, 6);
      dispatch({ type: 'SET_RECENT_FONTS', payload: deduped });
    }
  }, [
    controller, state.canvasSize, state.recentFonts, dispatch,
    addContent, addFontSize, addFontFamily, addFontWeight, addFontStyle, addUnderline, addTextAlign,
  ]);

  /* ── Font import (shared between modes) ── */
  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (fontInputRef.current) fontInputRef.current.value = '';
  };

  const handleDeleteFont = async (fontName: string) => {
    await removeStoredFont(fontName, dispatch);
    toast({ title: 'Font removed', description: `"${fontName}" deleted` });
  };

  /* ── Shared Font Library section ── */
  const FontLibrarySection = (
    <>
      <Separator />
      <SectionLabel>Font Library</SectionLabel>
      <input
        ref={fontInputRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        onChange={handleFontUpload}
        className="hidden"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full gap-2 h-9"
        onClick={() => fontInputRef.current?.click()}
      >
        <Upload size={13} />
        Import Font (.ttf / .otf / .woff)
      </Button>

      {state.customFonts.length > 0 && (
        <div className="space-y-1">
          {[...state.customFonts].sort((a, b) => a.localeCompare(b)).map((font) => (
            <div
              key={font}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Type size={11} className="text-primary flex-shrink-0" />
                <span className="text-xs truncate" style={{ fontFamily: font }}>{font}</span>
              </div>
              <button
                onClick={() => handleDeleteFont(font)}
                className="text-destructive hover:text-red-400 p-1 rounded flex-shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '82vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="text-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <Type size={15} className="text-primary" />
            Add Text
          </SheetTitle>
        </SheetHeader>

        {/* ════════════════════════════════════════════════════
            ADD MODE — no text selected
        ════════════════════════════════════════════════════ */}
        {!isText ? (
          <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

            {/* Content input */}
            <SectionLabel>Text Content</SectionLabel>
            <textarea
              value={addContent}
              onChange={(e) => setAddContent(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'inherit',
                fontFamily: addFontFamily,
              }}
              placeholder="Enter text…"
            />

            {/* Style toggles */}
            <SectionLabel>Style</SectionLabel>
            <div className="flex gap-2">
              <Button
                variant={addFontWeight === 'bold' ? 'default' : 'secondary'}
                size="sm" className="flex-1 h-9 font-bold"
                onClick={() => setAddFontWeight(addFontWeight === 'bold' ? 'normal' : 'bold')}
              >
                <Bold size={14} />
              </Button>
              <Button
                variant={addFontStyle === 'italic' ? 'default' : 'secondary'}
                size="sm" className="flex-1 h-9 italic"
                onClick={() => setAddFontStyle(addFontStyle === 'italic' ? 'normal' : 'italic')}
              >
                <Italic size={14} />
              </Button>
              <Button
                variant={addUnderline ? 'default' : 'secondary'}
                size="sm" className="flex-1 h-9 underline"
                onClick={() => setAddUnderline(!addUnderline)}
              >
                <Underline size={14} />
              </Button>
            </div>
            <ToggleGroup type="single" value={addTextAlign} onValueChange={(v) => v && setAddTextAlign(v)} className="justify-start gap-1">
              <ToggleGroupItem value="left" className="h-9 w-9 p-0"><AlignLeft size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="center" className="h-9 w-9 p-0"><AlignCenter size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="right" className="h-9 w-9 p-0"><AlignRight size={14} /></ToggleGroupItem>
            </ToggleGroup>

            {/* Typography */}
            <Separator />
            <SectionLabel>Typography</SectionLabel>
            <SliderRow
              label="Font Size" value={addFontSize} min={8} max={300}
              onChange={setAddFontSize} unit="px"
            />

            {/* Font selection */}
            <Separator />
            <SectionLabel>Font</SectionLabel>
            <Select value={addFontFamily} onValueChange={setAddFontFamily}>
              <SelectTrigger className="w-full text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_FONTS.map((f) => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                ))}
                {state.customFonts.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Custom</div>
                    {[...state.customFonts].sort((a, b) => a.localeCompare(b)).map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>

            {/* Recent fonts */}
            {state.recentFonts.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recent</p>
                <div className="flex flex-wrap gap-1.5">
                  {state.recentFonts.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setAddFontFamily(f)}
                      className="text-[10px] px-2 py-0.5 rounded border transition-all"
                      style={{
                        background: addFontFamily === f ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
                        borderColor: addFontFamily === f ? '#00F5FF' : 'rgba(255,255,255,0.1)',
                        color: addFontFamily === f ? '#00F5FF' : '#9ca3af',
                        fontFamily: f,
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add to canvas CTA */}
            <Button
              type="button"
              className="w-full h-10 gap-2 font-semibold"
              style={{
                background: 'linear-gradient(135deg, rgba(0,245,255,0.2) 0%, rgba(123,47,255,0.2) 100%)',
                border: '1px solid rgba(0,245,255,0.5)',
                color: '#00F5FF',
              }}
              onClick={handleAddToCanvas}
            >
              <Plus size={15} />
              Add to Canvas
            </Button>

            {/* Font library (persistent) */}
            {FontLibrarySection}

            <div className="h-2" />
          </div>
        ) : (

        /* ════════════════════════════════════════════════════
            EDIT MODE — text object selected
        ════════════════════════════════════════════════════ */
          <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

            {/* ── Content ── */}
            <SectionLabel>Content</SectionLabel>
            <textarea
              value={textContent}
              onChange={(e) => {
                setTextContent(e.target.value);
                apply({ text: e.target.value });
              }}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit', fontFamily }}
              placeholder="Enter text…"
            />

            {/* ── Style ── */}
            <SectionLabel>Style</SectionLabel>
            <div className="flex gap-2">
              <Button
                variant={fontWeight === 'bold' ? 'default' : 'secondary'}
                size="sm" className="flex-1 h-9 font-bold"
                onClick={applyBold}
              >
                <Bold size={14} />
              </Button>
              <Button
                variant={fontStyle === 'italic' ? 'default' : 'secondary'}
                size="sm" className="flex-1 h-9 italic"
                onClick={applyItalic}
              >
                <Italic size={14} />
              </Button>
              <Button
                variant={underline ? 'default' : 'secondary'}
                size="sm" className="flex-1 h-9 underline"
                onClick={applyUnderline}
              >
                <Underline size={14} />
              </Button>
            </div>
            <ToggleGroup type="single" value={textAlign} onValueChange={applyTextAlign} className="justify-start gap-1">
              <ToggleGroupItem value="left" className="h-9 w-9 p-0"><AlignLeft size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="center" className="h-9 w-9 p-0"><AlignCenter size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="right" className="h-9 w-9 p-0"><AlignRight size={14} /></ToggleGroupItem>
            </ToggleGroup>

            {/* ── Typography ── */}
            <Separator />
            <SectionLabel>Typography</SectionLabel>
            <SliderRow label="Font Size" value={fontSize} min={8} max={300}
              onChange={(v) => { setFontSize(v); apply({ fontSize: v }); }} unit="px" />
            <SliderRow label="Letter Spacing" value={charSpacing} min={-50} max={200}
              step={1} onChange={applyCharSpacing} />
            <SliderRow label="Line Height" value={lineHeight} min={0.5} max={4}
              step={0.05} onChange={applyLineHeight} />

            {/* ── Font Selection ── */}
            <Separator />
            <SectionLabel>Font</SectionLabel>
            <Select value={fontFamily} onValueChange={applyFontFamily}>
              <SelectTrigger className="w-full text-xs h-9" data-testid="text-panel-font-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_FONTS.map((f) => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                ))}
                {state.customFonts.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Custom</div>
                    {[...state.customFonts].sort((a, b) => a.localeCompare(b)).map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>

            {/* Recent fonts chips */}
            {state.recentFonts.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recent</p>
                <div className="flex flex-wrap gap-1.5">
                  {state.recentFonts.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => applyFontFamily(f)}
                      className="text-[10px] px-2 py-0.5 rounded border transition-all"
                      style={{
                        background: fontFamily === f ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
                        borderColor: fontFamily === f ? '#00F5FF' : 'rgba(255,255,255,0.1)',
                        color: fontFamily === f ? '#00F5FF' : '#9ca3af',
                        fontFamily: f,
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Font Library ── */}
            {FontLibrarySection}

            {/* ── Glow Effect ── */}
            <Separator />
            <div className="flex items-center justify-between">
              <SectionLabel>Glow / Neon</SectionLabel>
              <Switch
                checked={glowEnabled}
                onCheckedChange={(v) => {
                  setGlowEnabled(v);
                  applyGlowEffect(v, glowColor, glowIntensity);
                }}
              />
            </div>
            {glowEnabled && (
              <div className="space-y-3 pl-2 border-l border-border">
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground w-12">Color</Label>
                  <input
                    type="color"
                    value={glowColor}
                    onChange={(e) => { setGlowColor(e.target.value); applyGlowEffect(true, e.target.value, glowIntensity); }}
                    className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent p-0.5 flex-shrink-0"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{glowColor.toUpperCase()}</span>
                </div>
                <SliderRow
                  label="Intensity" value={glowIntensity} min={1} max={60}
                  onChange={(v) => { setGlowIntensity(v); applyGlowEffect(true, glowColor, v); }}
                />
              </div>
            )}

            {/* ── 3D Extrusion ── */}
            <Separator />
            <div className="flex items-center justify-between">
              <SectionLabel>3D Extrusion</SectionLabel>
              <Switch
                checked={depthEnabled}
                onCheckedChange={(v) => {
                  setDepthEnabled(v);
                  applyDepth(v, depthAmount, depthColor, depthAngle);
                }}
              />
            </div>
            {depthEnabled && (
              <div className="space-y-3 pl-2 border-l border-border">
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-muted-foreground w-12">Color</Label>
                  <input
                    type="color"
                    value={depthColor}
                    onChange={(e) => { setDepthColor(e.target.value); applyDepth(true, depthAmount, e.target.value, depthAngle); }}
                    className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent p-0.5 flex-shrink-0"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{depthColor.toUpperCase()}</span>
                </div>
                <SliderRow label="Depth (steps)" value={depthAmount} min={1} max={30}
                  onChange={(v) => { setDepthAmount(v); applyDepth(true, v, depthColor, depthAngle); }} />
                <SliderRow label="Angle" value={depthAngle} min={0} max={360}
                  onChange={(v) => { setDepthAngle(v); applyDepth(true, depthAmount, depthColor, v); }} unit="°" />
              </div>
            )}

            <div className="h-2" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
