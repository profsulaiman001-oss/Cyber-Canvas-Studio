import { useState } from 'react';
import { Sheet, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { PenTool, Minus, Spline, GitBranch, Scissors, Unlink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveDrawerWrapper } from './ResponsiveDrawerWrapper';

interface VectorsPanelProps {
  controller: CanvasController;
  onPenStart: () => void;
}

function ToolCard({
  icon, label, onClick, active = false, disabled = false, accent = '#00F5FF',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  accent?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex flex-col gap-1.5 p-3 rounded-xl border transition-all active:scale-95 disabled:opacity-30 text-left"
      style={{
        background: active ? `${accent}1a` : 'rgba(255,255,255,0.03)',
        borderColor: active ? accent : 'rgba(255,255,255,0.1)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div style={{ color: accent }}>{icon}</div>
        <span className="text-xs font-semibold" style={{ color: active ? accent : '#e5e7eb' }}>{label}</span>
      </div>
    </button>
  );
}

export default function VectorsPanel({ controller, onPenStart }: VectorsPanelProps) {
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const isOpen = state.activePanel === 'vectors';
  const isPenActive = state.activeTool === 'pen';
  const hasSelection = state.selectedObjectIds.length > 0;
  const multiSelection = state.selectedObjectIds.length >= 2;

  const [maskMode, setMaskMode] = useState<'apply' | 'release' | null>(null);

  const close = () => dispatch({ type: 'CLOSE_PANEL' });

  const startPen = () => {
    onPenStart();
    close();
  };

  const addLine = () => {
    controller.addLine();
    close();
  };

  const addBezier = () => {
    onPenStart();
    controller.activateBezierPen();
    close();
  };

  const addSpline = () => {
    onPenStart();
    controller.activateSplinePen();
    close();
  };

  const applyMask = () => {
    if (!multiSelection) {
      toast({
        title: 'Select 2 objects',
        description: 'Select the content layer and the mask shape together, then apply mask.',
      });
      return;
    }
    controller.applyMaskFromSelection();
    toast({ title: 'Mask applied', description: 'Top object is now clipping the layer below it.' });
    setMaskMode(null);
    close();
  };

  const releaseMask = () => {
    if (!hasSelection) {
      toast({ title: 'Select an object', description: 'Select a masked object to release its clip.' });
      return;
    }
    controller.releaseMask();
    toast({ title: 'Mask released', description: 'Clipping path removed from selection.' });
    setMaskMode(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <ResponsiveDrawerWrapper
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '72vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="vectors-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <GitBranch size={15} className="text-primary" />
            Vector Workshop
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 space-y-5" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

          {/* ── Path Creation Tools ── */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Path Creation</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ToolCard
                icon={<PenTool size={18} />}
                label="Pen Tool"
                onClick={startPen}
                active={isPenActive}
                accent="#00F5FF"
              />
              <ToolCard
                icon={<Minus size={18} />}
                label="Line Tool"
                onClick={addLine}
                accent="#00F5FF"
              />
              <ToolCard
                icon={<GitBranch size={18} />}
                label="Bézier Curve"
                onClick={addBezier}
                accent="#00F5FF"
              />
              <ToolCard
                icon={<Spline size={18} />}
                label="Spline Path"
                onClick={addSpline}
                accent="#00F5FF"
              />
            </div>
          </div>

          {/* ── Universal Mask Tool ── */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Clipping Mask</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ToolCard
                icon={<Scissors size={18} />}
                label="Apply Mask"
                onClick={applyMask}
                active={maskMode === 'apply'}
                accent="#00F5FF"
                disabled={!multiSelection}
              />
              <ToolCard
                icon={<Unlink size={18} />}
                label="Release Mask"
                onClick={releaseMask}
                active={maskMode === 'release'}
                accent="#00F5FF"
                disabled={!hasSelection}
              />
            </div>
          </div>

        </div>
      </ResponsiveDrawerWrapper>
    </Sheet>
  );
}
