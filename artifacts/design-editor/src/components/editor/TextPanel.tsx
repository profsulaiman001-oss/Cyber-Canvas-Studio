import { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { IText, Textbox } from 'fabric';
import { Type } from 'lucide-react';
import { ResponsiveDrawerWrapper } from './ResponsiveDrawerWrapper';
import {
  applyCharacterRangeStyle,
  getCharacterCount,
  getCharacterTextRange,
  getCharacterRangeStyleState,
} from '@/lib/characterStyles';
import type { CanvasTextProperties, CharacterStylePatch } from '@/types/canvas';

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-primary uppercase tracking-wider pt-1">{children}</p>;
}

interface CharacterRangeSelection {
  start: number;
  end: number;
}

export default function TextPanel({ controller }: TextPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'text';
  const obj = controller.selectedObject;
  const isText = obj?.type === 'i-text' || obj?.type === 'text' || obj?.type === 'textbox';
  const textObj = isText ? (obj as IText) : null;

  /* ── Edit-mode state ── */
  const [textContent, setTextContent] = useState('');
  const [textAlign, setTextAlign] = useState('left');
  const [selectedRange, setSelectedRange] = useState<CharacterRangeSelection | null>(null);
  const [rangeFill, setRangeFill] = useState('#00F5FF');
  const [rangeBold, setRangeBold] = useState(false);
  const [rangeItalic, setRangeItalic] = useState(false);
  const [rangeUnderline, setRangeUnderline] = useState(false);

  /* ── Add-mode state ── */
  const [addContent, setAddContent] = useState('New Text');
  const [addTextAlign, setAddTextAlign] = useState('left');

  const selectedRangeRef = useRef<CharacterRangeSelection | null>(null);

  const updateSelectedRange = useCallback((start: number, endExclusive: number, text: string) => {
    const count = getCharacterCount(text);
    const safeStart = Math.max(0, Math.min(count, Math.floor(start)));
    const safeEnd = Math.max(safeStart, Math.min(count, Math.floor(endExclusive)));
    const nextRange = safeEnd > safeStart
      ? { start: safeStart, end: safeEnd - 1 }
      : null;
    selectedRangeRef.current = nextRange;
    setSelectedRange(nextRange);
  }, []);

  const updateRangeFromTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    const start = getCharacterCount(textarea.value.slice(0, textarea.selectionStart));
    const end = getCharacterCount(textarea.value.slice(0, textarea.selectionEnd));
    updateSelectedRange(start, end, textarea.value);
  }, [updateSelectedRange]);

  /* ── Sync edit state from selected object ── */
  const syncFromObj = useCallback(() => {
    if (!textObj) {
      updateSelectedRange(0, 0, '');
      return;
    }
    setTextContent(textObj.text || '');
    setTextAlign((textObj.textAlign as string) || 'left');
    updateSelectedRange(
      textObj.isEditing ? textObj.selectionStart : 0,
      textObj.isEditing ? textObj.selectionEnd : 0,
      textObj.text || '',
    );
  }, [textObj, updateSelectedRange]);

  useEffect(() => { syncFromObj(); }, [syncFromObj]);

  useEffect(() => {
    const canvas = controller.getCanvas();
    if (!canvas || !textObj) return;

    const syncCanvasTextSelection = (event: { target: IText }) => {
      if (event.target !== textObj) return;
      const target = event.target;
      queueMicrotask(() => {
        updateSelectedRange(
          target.selectionStart,
          target.selectionEnd,
          target.text || '',
        );
      });
    };

    if (textObj.isEditing) {
      updateSelectedRange(textObj.selectionStart, textObj.selectionEnd, textObj.text || '');
    }
    canvas.on('text:selection:changed', syncCanvasTextSelection);
    return () => {
      canvas.off('text:selection:changed', syncCanvasTextSelection);
    };
  }, [controller, textObj, updateSelectedRange]);

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

  const applyTextAlign = (v: string) => { if (!v) return; setTextAlign(v); apply({ textAlign: v }); };

  useEffect(() => {
    if (!textObj || !selectedRange) {
      setRangeBold(false);
      setRangeItalic(false);
      setRangeUnderline(false);
      setRangeFill(toColorInputValue(typeof textObj?.fill === 'string' ? textObj.fill : undefined));
      return;
    }
    const style = getCharacterRangeStyleState(
      textObj as IText & CanvasTextProperties,
      selectedRange.start,
      selectedRange.end,
    );
    setRangeBold(style.fontWeight === 'bold');
    setRangeItalic(style.fontStyle === 'italic');
    setRangeUnderline(style.underline === true);
    setRangeFill(toColorInputValue(style.fill));
  }, [textObj, selectedRange]);

  const applyRangeStyle = (patch: CharacterStylePatch) => {
    const range = selectedRangeRef.current;
    if (!textObj || !range) return;
    applyCharacterRangeStyle(
      textObj as IText & CanvasTextProperties,
      range.start,
      range.end,
      patch,
    );
    controller.getCanvas()?.renderAll();
    controller.commitChange();
  };

  const selectedText = selectedRange && textObj
    ? getCharacterTextRange(textObj.text || '', selectedRange.start, selectedRange.end)
    : '';
  const hasCharacterSelection = Boolean(selectedRange);

  /* ── Add text to canvas (Textbox for wrapping support) ── */
  const handleAddToCanvas = useCallback(() => {
    const canvas = controller.getCanvas();
    if (!canvas) return;

    const cx = state.canvasSize.width / 2;
    const cy = state.canvasSize.height / 2;

    const newText = new Textbox(addContent.trim() || 'New Text', {
      left: cx - 125,
      top: cy - 20,
      width: 250,
      fontSize: 40,
      fontFamily: 'Inter',
      fontWeight: 'normal',
      fontStyle: 'normal',
      underline: false,
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
  }, [
    controller, state.canvasSize, addContent, addTextAlign,
  ]);

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
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit', fontFamily: 'Inter' }}
              placeholder="Enter text…"
            />

            <ToggleGroup type="single" value={addTextAlign} onValueChange={(v) => v && setAddTextAlign(v)} className="justify-start gap-1">
              <ToggleGroupItem value="left" className="h-9 w-9 p-0"><AlignLeft size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="center" className="h-9 w-9 p-0"><AlignCenter size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="right" className="h-9 w-9 p-0"><AlignRight size={14} /></ToggleGroupItem>
            </ToggleGroup>

            <Button type="button" className="w-full h-10 gap-2 font-semibold"
              style={{ background: 'linear-gradient(135deg, rgba(0,242,254,0.2) 0%, rgba(0,242,254,0.1) 100%)', border: '1px solid rgba(0,242,254,0.5)', color: '#00F2FE' }}
              onClick={handleAddToCanvas}>
              <Plus size={15} />Add to Canvas
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
                setTextContent(nextText);
                updateRangeFromTextarea(e.currentTarget);
                apply({
                  text: nextText,
                  typographyTransform: 'none',
                  typographyOriginalText: nextText,
                });
              }}
              onSelect={(e) => updateRangeFromTextarea(e.currentTarget)}
              onKeyUp={(e) => updateRangeFromTextarea(e.currentTarget)}
              onMouseUp={(e) => updateRangeFromTextarea(e.currentTarget)}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit', fontFamily: textObj?.fontFamily || 'Inter' }}
              placeholder="Enter text…"
            />

            <Separator />
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <SectionLabel>Highlight Styling</SectionLabel>
                <p className="text-[10px] text-muted-foreground">
                  Select text here or directly on the canvas.
                </p>
              </div>
              {selectedRange && (
                <span className="max-w-[55%] truncate rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] text-primary"
                  title={selectedText}>
                  “{selectedText}”
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
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
                disabled={!hasCharacterSelection}
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
                disabled={!hasCharacterSelection}
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
                disabled={!hasCharacterSelection}
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
                  disabled={!hasCharacterSelection}
                  aria-label="Set fill for character range"
                  data-testid="input-character-range-fill"
                  className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                />
              </label>
            </div>

            <ToggleGroup type="single" value={textAlign} onValueChange={applyTextAlign} className="justify-start gap-1">
              <ToggleGroupItem value="left" className="h-9 w-9 p-0"><AlignLeft size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="center" className="h-9 w-9 p-0"><AlignCenter size={14} /></ToggleGroupItem>
              <ToggleGroupItem value="right" className="h-9 w-9 p-0"><AlignRight size={14} /></ToggleGroupItem>
            </ToggleGroup>

            <div className="h-2" />
          </div>
        )}
      </ResponsiveDrawerWrapper>
    </Sheet>
  );
}
