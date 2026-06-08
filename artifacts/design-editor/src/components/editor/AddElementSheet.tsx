import { useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useEditor } from '@/store/editorStore';
import { CanvasController, BrushPreset } from '@/hooks/useFabricCanvas';
import { ImageIcon, Paintbrush } from 'lucide-react';

interface AddElementSheetProps {
  controller: CanvasController;
}

function ShapeCard({ label, onClick, testId, children }: {
  label: string; onClick: () => void; testId: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/50 transition-all active:scale-95"
      style={{ background: 'rgba(0,245,255,0.03)' }}
    >
      <div className="w-10 h-10 flex items-center justify-center text-primary">{children}</div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

const BRUSH_PRESETS: { id: BrushPreset; label: string; desc: string; color: string; icon: React.ReactNode }[] = [
  {
    id: 'standard',
    label: 'Paint Brush',
    desc: 'Rich freehand stroke',
    color: '#00F5FF',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current" strokeWidth="2">
        <path d="M3 17c0 1 1 2 2 2s3-2 3-4c0-1.5-1-2.5-3-2.5S2 13 2 14" />
        <path d="M7 15l10-10 2 2L9 17" />
      </svg>
    ),
  },
  {
    id: 'glow',
    label: 'Neon / Glow',
    desc: 'Ambient light emission',
    color: '#00F5FF',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current" strokeWidth="2">
        <path d="M12 2L8 12l4 2-2 8 8-12-4-2 2-6z" />
      </svg>
    ),
  },
  {
    id: 'airbrush',
    label: 'Airbrush',
    desc: 'Soft feathered spray',
    color: '#a78bfa',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current" strokeWidth="2">
        <circle cx="9" cy="12" r="3" />
        <path d="M12 12h8M18 9l3 3-3 3" />
        <circle cx="6" cy="8" r="1" /><circle cx="4" cy="14" r="1" /><circle cx="8" cy="16" r="1" />
      </svg>
    ),
  },
];

export default function AddElementSheet({ controller }: AddElementSheetProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'add';
  const imageInputRef = useRef<HTMLInputElement>(null);

  const close = () => dispatch({ type: 'CLOSE_PANEL' });
  const add = (fn: () => void) => { fn(); close(); };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await controller.addImageFromFile(file);
    close();
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const startBrush = (preset: BrushPreset) => {
    dispatch({ type: 'SET_BRUSH_PRESET', payload: preset });
    dispatch({ type: 'SET_TOOL', payload: 'brush' });
    close();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '80vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="add-element-sheet"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold">Add Element</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-safe space-y-5" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          {/* ── Draw / Brush ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Paintbrush size={12} />
                Draw
              </p>
              <span className="text-[10px] text-muted-foreground">
                Vector tools → <span className="text-primary">Vectors</span> tab
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {BRUSH_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => startBrush(preset.id)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all active:scale-95"
                  style={{
                    background: state.brushPreset === preset.id && state.activeTool === 'brush'
                      ? 'rgba(0,245,255,0.12)' : 'rgba(0,245,255,0.03)',
                    borderColor: state.brushPreset === preset.id && state.activeTool === 'brush'
                      ? '#00F5FF' : 'rgba(255,255,255,0.1)',
                    color: preset.color,
                  }}
                >
                  {preset.icon}
                  <span className="text-xs font-medium" style={{ color: preset.id === 'airbrush' ? '#a78bfa' : '#00F5FF' }}>
                    {preset.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{preset.desc}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3 px-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Brush Size</Label>
                <span className="text-xs text-muted-foreground">{state.brushSize}px</span>
              </div>
              <Slider
                min={1} max={80} step={1} value={[state.brushSize]}
                onValueChange={([v]) => dispatch({ type: 'SET_BRUSH_SIZE', payload: v })}
              />
            </div>
          </div>

          {/* ── Basic Shapes ── */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Basic Shapes</p>
            <div className="grid grid-cols-4 gap-2">
              <ShapeCard label="Square" onClick={() => add(controller.addRect)} testId="add-rect">
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><rect x="3" y="3" width="18" height="18" rx="1" /></svg>
              </ShapeCard>
              <ShapeCard label="Circle" onClick={() => add(controller.addCircle)} testId="add-circle">
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><circle cx="12" cy="12" r="9" /></svg>
              </ShapeCard>
              <ShapeCard label="Triangle" onClick={() => add(controller.addTriangle)} testId="add-triangle">
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><polygon points="12,4 22,20 2,20" /></svg>
              </ShapeCard>
              <ShapeCard label="Rt. Triangle" onClick={() => add(controller.addRightTriangle)} testId="add-right-triangle">
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><polygon points="4,20 4,4 20,20" /></svg>
              </ShapeCard>
            </div>
          </div>

          {/* ── More Shapes ── */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">More Shapes</p>
            <div className="grid grid-cols-4 gap-2">
              <ShapeCard label="Star" onClick={() => add(controller.addStar)} testId="add-star">
                <svg viewBox="-70 -70 140 140" className="w-7 h-7 fill-current">
                  <polygon points="0,-60 14,-20 56,-20 22,8 34,48 0,24 -34,48 -22,8 -56,-20 -14,-20" />
                </svg>
              </ShapeCard>
              <ShapeCard label="Hexagon" onClick={() => add(controller.addHexagon)} testId="add-hexagon">
                <svg viewBox="-70 -70 140 140" className="w-7 h-7 fill-current">
                  <polygon points="30,-52 60,0 30,52 -30,52 -60,0 -30,-52" />
                </svg>
              </ShapeCard>
              <ShapeCard label="Pentagon" onClick={() => add(controller.addPentagon)} testId="add-pentagon">
                <svg viewBox="-70 -70 140 140" className="w-7 h-7 fill-current">
                  <polygon points="0,-60 57,-19 35,50 -35,50 -57,-19" />
                </svg>
              </ShapeCard>
              <ShapeCard label="Heart" onClick={() => add(controller.addHeart)} testId="add-heart">
                <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
                  <path d="M12 21C12 21 3 14 3 8a4 4 0 0 1 8-1 1 1 0 0 0 2 0 4 4 0 0 1 8 1c0 6-9 13-9 13Z" />
                </svg>
              </ShapeCard>
              <ShapeCard label="Arrow" onClick={() => add(controller.addArrow)} testId="add-arrow">
                <svg viewBox="-60 -50 120 100" className="w-7 h-7 fill-current">
                  <polygon points="-55,-18 10,-18 10,-45 55,0 10,45 10,18 -55,18" />
                </svg>
              </ShapeCard>
            </div>
          </div>

          {/* ── Image ── */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Image</p>
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" data-testid="input-image-upload" />
            <Button variant="secondary" className="w-full gap-2" onClick={() => imageInputRef.current?.click()} data-testid="add-image">
              <ImageIcon size={15} />Import from Gallery
            </Button>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
