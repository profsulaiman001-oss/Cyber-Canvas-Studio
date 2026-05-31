import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController, AlignType } from '@/hooks/useFabricCanvas';
import {
  AlignStartVertical, AlignEndVertical, AlignCenterVertical,
  AlignStartHorizontal, AlignEndHorizontal, AlignCenterHorizontal,
} from 'lucide-react';

interface AlignmentPanelProps { controller: CanvasController }

function AlignBtn({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-primary/50 active:scale-95 transition-all"
      style={{ background: 'rgba(0,245,255,0.03)' }}
    >
      <div className="text-primary">{icon}</div>
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
    </button>
  );
}

export default function AlignmentPanel({ controller }: AlignmentPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'alignment';
  const hasSelection = state.selectedObjectIds.length > 0;
  const multi = state.selectedObjectIds.length > 1;

  const align = (type: AlignType) => {
    const activeObject = controller.selectedObject;
    const fabricCanvas = controller.getCanvas();

    if (multi || !activeObject || !fabricCanvas) {
      controller.alignObjects(type);
      return;
    }

    // Capture explicit current canvas size
    const canvasW = state.canvasSize.width;
    const canvasH = state.canvasSize.height;

    // Use getScaledWidth/Height to accurately track large/scaled elements
    const objW = activeObject.getScaledWidth();
    const objH = activeObject.getScaledHeight();

    // Secure the object's current origin configuration 
    const origX = activeObject.originX || 'left';
    const origY = activeObject.originY || 'top';

    // Calculate exact Top-Left absolute standard baseline coordinates
    let targetLeft = activeObject.left || 0;
    let targetTop = activeObject.top || 0;

    // Horizontal Calculations
    if (type === 'left' || type === 'centerH' || type === 'right') {
      if (type === 'left') {
        targetLeft = 0;
      } else if (type === 'centerH') {
        targetLeft = (canvasW - objW) / 2;
      } else if (type === 'right') {
        targetLeft = canvasW - objW;
      }

      // If the object's anchor origin is centered, offset the coordinates by half its width
      if (origX === 'center') {
        targetLeft += objW / 2;
      } else if (origX === 'right') {
        targetLeft += objW;
      }
      
      activeObject.set('left', targetLeft);
    }

    // Vertical Calculations
    if (type === 'top' || type === 'centerV' || type === 'bottom') {
      if (type === 'top') {
        targetTop = 0;
      } else if (type === 'centerV') {
        targetTop = (canvasH - objH) / 2;
      } else if (type === 'bottom') {
        targetTop = canvasH - objH;
      }

      // If the object's anchor origin is centered, offset the coordinates by half its height
      if (origY === 'center') {
        targetTop += objH / 2;
      } else if (origY === 'bottom') {
        targetTop += objH;
      }

      activeObject.set('top', targetTop);
    }

    // Force vector updates and render canvas space
    activeObject.setCoords();
    fabricCanvas.renderAll();
    
    if (typeof fabricCanvas.fire === 'function') {
      fabricCanvas.fire('object:modified', { target: activeObject });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '55vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold">Align & Position</SheetTitle>
          <p className="text-xs text-muted-foreground">
            {multi
              ? 'Align selected objects relative to each other'
              : hasSelection
              ? 'Align selected object to canvas'
              : 'Select an object to align'}
          </p>
        </SheetHeader>

        <div className="px-4 space-y-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Horizontal</p>
            <div className="grid grid-cols-3 gap-2">
              <AlignBtn label="Left" icon={<AlignStartVertical size={22} />} onClick={() => align('left')} />
              <AlignBtn label="Center" icon={<AlignCenterVertical size={22} />} onClick={() => align('centerH')} />
              <AlignBtn label="Right" icon={<AlignEndVertical size={22} />} onClick={() => align('right')} />
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Vertical</p>
            <div className="grid grid-cols-3 gap-2">
              <AlignBtn label="Top" icon={<AlignStartHorizontal size={22} />} onClick={() => align('top')} />
              <AlignBtn label="Middle" icon={<AlignCenterHorizontal size={22} />} onClick={() => align('centerV')} />
              <AlignBtn label="Bottom" icon={<AlignEndHorizontal size={22} />} onClick={() => align('bottom')} />
            </div>
          </div>

          {!hasSelection && (
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground">No object selected</p>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary" size="sm"
                className="h-10 text-xs"
                disabled={!hasSelection}
                onClick={() => { align('centerH'); align('centerV'); }}
              >
                Center on Canvas
              </Button>
              <Button
                variant="secondary" size="sm"
                className="h-10 text-xs"
                disabled={!hasSelection}
                onClick={() => controller.duplicateSelected()}
              >
                Duplicate
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}