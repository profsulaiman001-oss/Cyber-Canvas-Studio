import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject, Shadow, IText, Rect } from 'fabric';

interface PropertiesPanelProps {
  controller: CanvasController;
}

const SYSTEM_FONTS = ['Inter', 'Georgia', 'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Impact'];

function ColorInput({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId: string }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent p-0.5"
          data-testid={testId}
        />
        <span className="text-xs font-mono text-muted-foreground w-16">{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step = 1, onChange, unit = '' }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs text-muted-foreground">{Math.round(value)}{unit}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} className="w-full" />
    </div>
  );
}

export default function PropertiesPanel({ controller }: PropertiesPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'properties';
  const obj = controller.selectedObject;

  const [fill, setFill] = useState('#00F5FF');
  const [stroke, setStroke] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [opacity, setOpacity] = useState(100);
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowBlur, setShadowBlur] = useState(10);
  const [shadowOffsetX, setShadowOffsetX] = useState(5);
  const [shadowOffsetY, setShadowOffsetY] = useState(5);
  const [rx, setRx] = useState(0);
  const [fontSize, setFontSize] = useState(40);
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontWeight, setFontWeight] = useState('normal');
  const [fontStyle, setFontStyle] = useState('normal');
  const [textAlign, setTextAlign] = useState('left');
  const [charSpacing, setCharSpacing] = useState(0);

  const isText = obj?.type === 'i-text' || obj?.type === 'text';
  const isRect = obj?.type === 'rect';
  const allFonts = [...SYSTEM_FONTS, ...state.customFonts];

  const syncFromObject = useCallback(() => {
    if (!obj) return;
    const o = obj as FabricObject & Record<string, unknown>;
    setFill(typeof o.fill === 'string' ? o.fill : '#00F5FF');
    setStroke(typeof o.stroke === 'string' && o.stroke ? o.stroke : '#000000');
    setStrokeWidth(typeof o.strokeWidth === 'number' ? o.strokeWidth : 0);
    setOpacity(typeof o.opacity === 'number' ? Math.round(o.opacity * 100) : 100);
    const shadow = o.shadow as Shadow | null;
    if (shadow) {
      setShadowEnabled(true);
      setShadowColor(shadow.color || '#000000');
      setShadowBlur(shadow.blur || 10);
      setShadowOffsetX(shadow.offsetX || 5);
      setShadowOffsetY(shadow.offsetY || 5);
    } else {
      setShadowEnabled(false);
    }
    if (isRect) setRx(typeof o.rx === 'number' ? o.rx : 0);
    if (isText) {
      const t = obj as IText;
      setFontSize(t.fontSize || 40);
      setFontFamily((t.fontFamily as string) || 'Inter');
      setFontWeight((t.fontWeight as string) || 'normal');
      setFontStyle((t.fontStyle as string) || 'normal');
      setTextAlign((t.textAlign as string) || 'left');
      setCharSpacing(typeof t.charSpacing === 'number' ? t.charSpacing / 10 : 0);
    }
  }, [obj, isText, isRect]);

  useEffect(() => { syncFromObject(); }, [syncFromObject]);

  const apply = useCallback((props: Record<string, unknown>) => {
    if (!obj) return;
    obj.set(props);
    controller.getCanvas()?.renderAll();
    controller.syncObjects();
  }, [obj, controller]);

  const applyFill = (v: string) => { setFill(v); apply({ fill: v }); };
  const applyStroke = (v: string) => { setStroke(v); apply({ stroke: v }); };
  const applyStrokeWidth = (v: number) => { setStrokeWidth(v); apply({ strokeWidth: v }); };
  const applyOpacity = (v: number) => { setOpacity(v); apply({ opacity: v / 100 }); };
  const applyRx = (v: number) => { setRx(v); apply({ rx: v, ry: v }); };
  const applyFontSize = (v: number) => { setFontSize(v); apply({ fontSize: v }); };
  const applyFontFamily = (v: string) => { setFontFamily(v); apply({ fontFamily: v }); };
  const applyBold = () => {
    const next = fontWeight === 'bold' ? 'normal' : 'bold';
    setFontWeight(next);
    apply({ fontWeight: next });
  };
  const applyItalic = () => {
    const next = fontStyle === 'italic' ? 'normal' : 'italic';
    setFontStyle(next);
    apply({ fontStyle: next });
  };
  const applyTextAlign = (v: string) => { if (!v) return; setTextAlign(v); apply({ textAlign: v }); };
  const applyCharSpacing = (v: number) => { setCharSpacing(v); apply({ charSpacing: v * 10 }); };

  const applyShadow = useCallback((enabled: boolean, color: string, blur: number, ox: number, oy: number) => {
    if (!obj) return;
    if (enabled) {
      obj.set('shadow', new Shadow({ color, blur, offsetX: ox, offsetY: oy }));
    } else {
      obj.set('shadow', null);
    }
    controller.getCanvas()?.renderAll();
  }, [obj, controller]);

  if (!obj) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '65vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="properties-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
          <SheetTitle className="text-sm font-semibold">Style</SheetTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => controller.duplicateSelected()} data-testid="button-duplicate">
              <Copy size={13} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => controller.deleteSelected()} data-testid="button-delete-selected">
              <Trash2 size={13} />
            </Button>
          </div>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4">
          <ColorInput label="Fill" value={fill} onChange={applyFill} testId="color-fill" />
          <ColorInput label="Stroke" value={stroke} onChange={applyStroke} testId="color-stroke" />
          <SliderRow label="Stroke Width" value={strokeWidth} min={0} max={30} onChange={applyStrokeWidth} />
          <SliderRow label="Opacity" value={opacity} min={0} max={100} onChange={applyOpacity} unit="%" />
          {isRect && <SliderRow label="Corner Radius" value={rx} min={0} max={100} onChange={applyRx} />}

          <Separator />

          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Drop Shadow</Label>
            <Switch
              checked={shadowEnabled}
              onCheckedChange={(v) => {
                setShadowEnabled(v);
                applyShadow(v, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY);
              }}
              data-testid="switch-shadow"
            />
          </div>

          {shadowEnabled && (
            <div className="space-y-3 pl-2 border-l border-border">
              <ColorInput label="Shadow Color" value={shadowColor} onChange={(v) => { setShadowColor(v); applyShadow(true, v, shadowBlur, shadowOffsetX, shadowOffsetY); }} testId="color-shadow" />
              <SliderRow label="Blur" value={shadowBlur} min={0} max={50} onChange={(v) => { setShadowBlur(v); applyShadow(true, shadowColor, v, shadowOffsetX, shadowOffsetY); }} />
              <SliderRow label="Offset X" value={shadowOffsetX} min={-50} max={50} onChange={(v) => { setShadowOffsetX(v); applyShadow(true, shadowColor, shadowBlur, v, shadowOffsetY); }} />
              <SliderRow label="Offset Y" value={shadowOffsetY} min={-50} max={50} onChange={(v) => { setShadowOffsetY(v); applyShadow(true, shadowColor, shadowBlur, shadowOffsetX, v); }} />
            </div>
          )}

          {isText && (
            <>
              <Separator />
              <p className="text-xs font-medium text-primary">Typography</p>
              <Select value={fontFamily} onValueChange={applyFontFamily}>
                <SelectTrigger className="w-full text-xs h-8" data-testid="select-font-family">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allFonts.map((f) => (
                    <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <SliderRow label="Font Size" value={fontSize} min={8} max={300} onChange={applyFontSize} />
              <SliderRow label="Letter Spacing" value={charSpacing} min={-50} max={200} onChange={applyCharSpacing} />

              <div className="flex gap-2">
                <Button
                  variant={fontWeight === 'bold' ? 'default' : 'secondary'}
                  size="sm"
                  className="flex-1 h-8"
                  onClick={applyBold}
                  data-testid="button-bold"
                >
                  <Bold size={13} />
                </Button>
                <Button
                  variant={fontStyle === 'italic' ? 'default' : 'secondary'}
                  size="sm"
                  className="flex-1 h-8 italic"
                  onClick={applyItalic}
                  data-testid="button-italic"
                >
                  <Italic size={13} />
                </Button>
              </div>

              <ToggleGroup
                type="single"
                value={textAlign}
                onValueChange={applyTextAlign}
                className="justify-start gap-1"
                data-testid="toggle-text-align"
              >
                <ToggleGroupItem value="left" className="h-8 w-8 p-0" data-testid="align-left"><AlignLeft size={13} /></ToggleGroupItem>
                <ToggleGroupItem value="center" className="h-8 w-8 p-0" data-testid="align-center"><AlignCenter size={13} /></ToggleGroupItem>
                <ToggleGroupItem value="right" className="h-8 w-8 p-0" data-testid="align-right"><AlignRight size={13} /></ToggleGroupItem>
              </ToggleGroup>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
