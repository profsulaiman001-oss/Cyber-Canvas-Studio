import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { PenTool, Minus, Spline, GitBranch, Scissors, Unlink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VectorsPanelProps {
  controller: CanvasController;
  onPenStart: () => void;
}

function ToolCard({
  icon, label, desc, onClick, active = false, disabled = false, accent = '#00F5FF',
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
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
      <p className="text-[10px] leading-tight" style={{ color: '#6b7280' }}>{desc}</p>
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
    controller.addBezierCurve();
    close();
  };

  const addSpline = () => {
    controller.addSplinePath();
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
      <SheetContent
        side="bottom"
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
            <div className="grid grid-cols-2 gap-2">
              <ToolCard
                icon={<PenTool size={18} />}
                label="Pen Tool"
                desc="Click to place anchor points and draw open or closed paths"
                onClick={startPen}
                active={isPenActive}
                accent="#00F5FF"
              />
              <ToolCard
                icon={<Minus size={18} />}
                label="Line Tool"
                desc="Add a straight vector connector line to the canvas"
                onClick={addLine}
                accent="#00F5FF"
              />
              <ToolCard
                icon={<GitBranch size={18} />}
                label="Bézier Curve"
                desc="S-curve cubic bézier path with editable control handles"
                onClick={addBezier}
                accent="#7B2FFF"
              />
              <ToolCard
                icon={<Spline size={18} />}
                label="Spline Path"
                desc="Smooth continuous quadratic spline through multiple points"
                onClick={addSpline}
                accent="#7B2FFF"
              />
            </div>
          </div>

          {/* ── Universal Mask Tool ── */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Clipping Mask</p>

            {/* How-to hint */}
            <div
              className="rounded-xl px-3 py-2.5 mb-3 text-[10px] leading-relaxed"
              style={{ background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.15)', color: '#9ca3af' }}
            >
              <span className="font-semibold" style={{ color: '#00F5FF' }}>How to apply:</span> Select any 2 objects together
              (the topmost becomes the clip shape). Works on images, shapes, text, and vector paths.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ToolCard
                icon={<Scissors size={18} />}
                label="Apply Mask"
                desc={multiSelection ? 'Ready — clip top object onto bottom layer' : 'Select 2 objects first'}
                onClick={applyMask}
                active={maskMode === 'apply'}
                accent="#ff922b"
                disabled={!multiSelection}
              />
              <ToolCard
                icon={<Unlink size={18} />}
                label="Release Mask"
                desc={hasSelection ? 'Remove clipping path from selection' : 'Select a masked object first'}
                onClick={releaseMask}
                active={maskMode === 'release'}
                accent="#f87171"
                disabled={!hasSelection}
              />
            </div>
          </div>

          {/* ── Status indicator ── */}
          {multiSelection && (
            <div
              className="rounded-xl px-3 py-2 flex items-center gap-2"
              style={{ background: 'rgba(255,146,43,0.08)', border: '1px solid rgba(255,146,43,0.25)' }}
            >
              <Scissors size={13} style={{ color: '#ff922b', flexShrink: 0 }} />
              <span className="text-[10px]" style={{ color: '#ff922b' }}>
                {state.selectedObjectIds.length} objects selected — ready to apply mask
              </span>
            </div>
          )}
          {hasSelection && !multiSelection && (
            <div
              className="rounded-xl px-3 py-2 flex items-center gap-2"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              <Unlink size={13} style={{ color: '#f87171', flexShrink: 0 }} />
              <span className="text-[10px]" style={{ color: '#f87171' }}>
                1 object selected — Release Mask available
              </span>
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
