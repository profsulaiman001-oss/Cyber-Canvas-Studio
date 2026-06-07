import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject } from 'fabric';
import { Box } from 'lucide-react';
import ColorPicker from './ColorPicker';

interface ThreeDPanelProps { controller: CanvasController }

function SliderRow({ label, value, min, max, step = 1, onChange, unit = '' }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string;
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

export default function ThreeDPanel({ controller }: ThreeDPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'threeD';
  const obj = controller.selectedObject;

  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState(8);
  const [color, setColor] = useState('#333333');
  const [angle, setAngle] = useState(225);
  const [colorOpen, setColorOpen] = useState(false);

  const syncFromObj = useCallback(() => {
    if (!obj) return;
    const depth = (obj as FabricObject & Record<string, unknown>)._depth3d as
      { enabled?: boolean; steps?: number; color?: string; angle?: number } | undefined;
    if (depth) {
      setEnabled(!!depth.enabled);
      setAmount(depth.steps ?? 8);
      setColor(depth.color ?? '#333333');
      setAngle(depth.angle ?? 225);
    } else {
      setEnabled(false);
    }
  }, [obj]);

  useEffect(() => { syncFromObj(); }, [syncFromObj]);

  const applyDepth = useCallback((en: boolean, steps: number, col: string, ang: number) => {
    if (!obj) return;
    controller.apply3DDepth(obj, en ? { enabled: true, steps, color: col, angle: ang } : null);
    controller.commitChange();
  }, [obj, controller]);

  if (!obj) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '68vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="threed-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <Box size={15} className="text-primary" />
            3D Extrusion
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          <div className="flex items-center justify-between">
            <SectionLabel>3D Depth Effect</SectionLabel>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => { setEnabled(v); applyDepth(v, amount, color, angle); }}
            />
          </div>

          {enabled && (
            <div className="space-y-4 pl-2 border-l border-border">
              {/* Color picker */}
              <div>
                <button
                  className="flex items-center justify-between w-full py-0.5"
                  onClick={() => setColorOpen((o) => !o)}
                >
                  <Label className="text-xs text-muted-foreground cursor-pointer pointer-events-none">Depth Color</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border border-border flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs font-mono text-muted-foreground w-16 text-left">{color.toUpperCase()}</span>
                  </div>
                </button>
                {colorOpen && (
                  <div className="mt-2 mb-1">
                    <ColorPicker value={color} onChange={(v) => { setColor(v); applyDepth(true, amount, v, angle); }} />
                  </div>
                )}
              </div>

              <SliderRow label="Depth Steps" value={amount} min={1} max={30}
                onChange={(v) => { setAmount(v); applyDepth(true, v, color, angle); }} />
              <SliderRow label="Angle" value={angle} min={0} max={360} unit="°"
                onChange={(v) => { setAngle(v); applyDepth(true, amount, color, v); }} />

              {/* Visual angle preview */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground">Direction</span>
                <svg width="48" height="48" viewBox="-24 -24 48 48">
                  <circle cx="0" cy="0" r="20" fill="rgba(255,255,255,0.04)" stroke="rgba(0,245,255,0.2)" strokeWidth="1" />
                  <line
                    x1="0" y1="0"
                    x2={Math.cos(((angle - 180) * Math.PI) / 180) * 16}
                    y2={Math.sin(((angle - 180) * Math.PI) / 180) * 16}
                    stroke="#00F5FF" strokeWidth="2" strokeLinecap="round"
                  />
                  <circle cx="0" cy="0" r="2.5" fill="#00F5FF" />
                </svg>
              </div>
            </div>
          )}

          <div className="h-2" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
