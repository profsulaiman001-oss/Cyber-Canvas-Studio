import { useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import FontUploader from './FontUploader';
import { ImageIcon, Type, Minus, PenTool } from 'lucide-react';

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

  const startPen = () => {
    controller.activatePenTool();
    dispatch({ type: 'SET_TOOL', payload: 'pen' });
    close();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '75vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="add-element-sheet"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold">Add Element</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-safe space-y-5" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          {/* Basic Shapes */}
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

          {/* More Shapes */}
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

          {/* Lines & Paths */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Lines & Paths</p>
            <div className="grid grid-cols-2 gap-2">
              <ShapeCard label="Straight Line" onClick={() => add(controller.addLine)} testId="add-line">
                <Minus size={28} />
              </ShapeCard>
              <ShapeCard label="Pen Tool" onClick={startPen} testId="add-pen">
                <PenTool size={24} />
              </ShapeCard>
            </div>
          </div>

          {/* Text */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Text</p>
            <Button className="w-full gap-2" onClick={() => add(controller.addText)} data-testid="add-text">
              <Type size={15} />Add Text
            </Button>
          </div>

          {/* Image */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Image</p>
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" data-testid="input-image-upload" />
            <Button variant="secondary" className="w-full gap-2" onClick={() => imageInputRef.current?.click()} data-testid="add-image">
              <ImageIcon size={15} />Import from Gallery
            </Button>
          </div>

          {/* Custom Fonts */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Custom Fonts</p>
            <FontUploader />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
