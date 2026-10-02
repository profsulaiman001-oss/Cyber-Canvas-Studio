import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Minus,
  PenTool,
  Plus,
} from 'lucide-react';
import { VectorAnchor } from '@/hooks/useFabricCanvas';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface VectorNodePanelProps {
  vectorAnchors: VectorAnchor[];
  selectedAnchorIdx: number | null;
  onSelectAnchor: (idx: number | null) => void;
  onAddNode: () => void;
  onDeleteNode: () => void;
  onNudgeNode: (dx: number, dy: number) => void;
  onDone: () => void;
  onReactivatePen: () => void;
}

const ACCENT = '#00F5FF';

export default function VectorNodePanel({
  vectorAnchors,
  selectedAnchorIdx,
  onSelectAnchor,
  onAddNode,
  onDeleteNode,
  onNudgeNode,
  onDone,
  onReactivatePen,
}: VectorNodePanelProps) {
  // Only count real anchor points (not handles)
  const anchorOnlyList = vectorAnchors.filter((a) => a.kind === 'anchor');
  const totalAnchors = anchorOnlyList.length;
  const currentAnchorDisplay = selectedAnchorIdx === null ? '-' : selectedAnchorIdx + 1;

  const prevAnchor = () => {
    if (totalAnchors === 0) return;
    const cur = selectedAnchorIdx ?? 0;
    onSelectAnchor((cur - 1 + totalAnchors) % totalAnchors);
  };

  const nextAnchor = () => {
    if (totalAnchors === 0) return;
    const cur = selectedAnchorIdx ?? -1;
    onSelectAnchor((cur + 1) % totalAnchors);
  };

  const NUDGE_PX = 1;

  return (
    <div
      className="flex h-14 w-full min-w-0 flex-shrink-0 items-center gap-1 rounded-2xl border px-2"
      data-testid="vector-node-toolbar"
      style={{
        background: '#11141A',
        borderColor: 'rgba(0,245,255,0.3)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
      }}
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-0 rounded-xl border px-0.5"
        style={{ background: 'rgba(0,245,255,0.08)', borderColor: `${ACCENT}33` }}
        aria-label="Anchor point selector"
      >
        <button
          onClick={prevAnchor}
          disabled={totalAnchors === 0}
          aria-label="Previous anchor point"
          className="flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-cyan-300 transition-colors hover:bg-cyan-400/10 disabled:opacity-30 min-[380px]:w-8"
          style={{ touchAction: 'manipulation' }}
        >
          <ChevronLeft size={15} />
        </button>
        <span className="min-w-[60px] flex-1 whitespace-nowrap text-center font-mono text-[10px] font-bold text-cyan-300">
          {totalAnchors === 0 ? 'No nodes' : `Point ${currentAnchorDisplay} / ${totalAnchors}`}
        </span>
        <button
          onClick={nextAnchor}
          disabled={totalAnchors === 0}
          aria-label="Next anchor point"
          className="flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-cyan-300 transition-colors hover:bg-cyan-400/10 disabled:opacity-30 min-[380px]:w-8"
          style={{ touchAction: 'manipulation' }}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <button
        onClick={onAddNode}
        disabled={totalAnchors === 0}
        aria-label="Add node after selected point"
        title="Add node"
        className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 transition-colors hover:bg-emerald-400/20 disabled:opacity-30"
        style={{ touchAction: 'manipulation' }}
      >
        <Plus size={17} />
      </button>

      <button
        onClick={onDeleteNode}
        disabled={totalAnchors === 0 || selectedAnchorIdx === null}
        aria-label="Delete selected node"
        title="Delete selected node"
        className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg border border-red-400/30 bg-red-400/10 text-red-300 transition-colors hover:bg-red-400/20 disabled:opacity-30"
        style={{ touchAction: 'manipulation' }}
      >
        <Minus size={17} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="More vector tools: nudge and draw"
            title="More vector tools"
            className="flex h-10 w-8 shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] text-cyan-300 transition-colors hover:bg-cyan-400/10"
            style={{ touchAction: 'manipulation' }}
          >
            <Crosshair size={15} />
            <ChevronDown size={10} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          sideOffset={8}
          className="w-auto border-cyan-400/20 bg-[#11141A] p-2 text-foreground shadow-xl"
        >
          <DropdownMenuLabel className="px-2 pb-2 text-center text-[10px] uppercase tracking-wider text-cyan-300">
            Nudge · 1 px per tap
          </DropdownMenuLabel>
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Nudge selected anchor">
            {[
              { label: 'Nudge up', dx: 0, dy: -NUDGE_PX, icon: ArrowUp, column: 2, row: 1 },
              { label: 'Nudge left', dx: -NUDGE_PX, dy: 0, icon: ArrowLeft, column: 1, row: 2 },
              { label: 'Nudge right', dx: NUDGE_PX, dy: 0, icon: ArrowRight, column: 3, row: 2 },
              { label: 'Nudge down', dx: 0, dy: NUDGE_PX, icon: ArrowDown, column: 2, row: 3 },
            ].map(({ label, dx, dy, icon: Icon, column, row }) => (
              <DropdownMenuItem
                key={label}
                aria-label={label}
                disabled={selectedAnchorIdx === null}
                onSelect={(event) => {
                  event.preventDefault();
                  onNudgeNode(dx, dy);
                }}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] p-0 text-cyan-200 focus:bg-cyan-400/15 data-[disabled]:opacity-30 [&>svg]:size-4"
                style={{ gridColumn: column, gridRow: row, touchAction: 'manipulation' }}
              >
                <Icon aria-hidden="true" />
              </DropdownMenuItem>
            ))}
            <div
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-400/10 bg-cyan-400/[0.03]"
              style={{ gridColumn: 2, gridRow: 2 }}
              aria-hidden="true"
            >
              <div className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_6px_#00F5FF]" />
            </div>
          </div>
          <DropdownMenuSeparator className="my-2 bg-white/10" />
          <DropdownMenuItem
            onSelect={onReactivatePen}
            className="min-h-10 cursor-pointer gap-2 text-xs text-cyan-200 focus:bg-cyan-400/10"
          >
            <PenTool size={15} />
            Draw with pen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        onClick={onDone}
        aria-label="Done editing vector nodes"
        title="Done"
        className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/[0.08] px-2 text-[11px] font-semibold text-slate-100 transition-colors hover:bg-white/[0.12]"
        style={{ touchAction: 'manipulation' }}
      >
        <Check size={14} />
        Done
      </button>
    </div>
  );
}
