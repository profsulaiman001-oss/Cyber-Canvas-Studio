import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Minus,
  Move,
  PenTool,
  Plus,
  Spline,
  Square,
} from 'lucide-react';
import { VectorAnchor } from '@/hooks/useFabricCanvas';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type VectorParameter = 'point' | 'nudge' | 'addDelete' | 'pen';

interface VectorNodePanelProps {
  vectorAnchors: VectorAnchor[];
  selectedAnchorIdx: number | null;
  onSelectAnchor: (idx: number | null) => void;
  onAddNode: () => void;
  onDeleteNode: () => void;
  onNudgeNode: (dx: number, dy: number) => void;
  onSetNodePosition: (x: number, y: number) => void;
  onSetCurveType: (curve: 'corner' | 'curve') => void;
  onSetHandleConstraint: (enabled: boolean) => void;
  onDone: () => void;
  onReactivatePen: () => void;
}

const PARAMETER_LABELS: Record<VectorParameter, string> = {
  point: 'Point Select',
  nudge: 'Nudge',
  addDelete: 'Add / Delete',
  pen: 'Pen Draw',
};

const parameterIcons = {
  point: Crosshair,
  nudge: Move,
  addDelete: Plus,
  pen: PenTool,
};

function formatCoord(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function coordinateRange(value: number) {
  const lower = Math.floor(value / 100) * 100 - 500;
  const upper = Math.ceil(value / 100) * 100 + 500;
  return { min: Math.min(-5000, lower), max: Math.max(5000, upper) };
}

export default function VectorNodePanel({
  vectorAnchors,
  selectedAnchorIdx,
  onSelectAnchor,
  onAddNode,
  onDeleteNode,
  onNudgeNode,
  onSetNodePosition,
  onSetCurveType,
  onSetHandleConstraint,
  onDone,
  onReactivatePen,
}: VectorNodePanelProps) {
  const [activeParameter, setActiveParameter] = useState<VectorParameter>('point');
  const [expanded, setExpanded] = useState(false);
  const [handleConstraint, setHandleConstraint] = useState(true);
  const anchorOnlyList = vectorAnchors.filter((anchor) => anchor.kind === 'anchor');
  const totalAnchors = anchorOnlyList.length;
  const selectedAnchor = selectedAnchorIdx === null ? null : anchorOnlyList[selectedAnchorIdx] ?? null;
  const currentAnchorDisplay = selectedAnchorIdx === null ? '-' : selectedAnchorIdx + 1;
  const xRange = coordinateRange(selectedAnchor?.localX ?? 0);
  const yRange = coordinateRange(selectedAnchor?.localY ?? 0);
  const isCurve = selectedAnchor?.commandType === 'C' || selectedAnchor?.commandType === 'Q';

  const selectAnchor = (nextIndex: number) => {
    if (totalAnchors === 0) return;
    onSelectAnchor((nextIndex + totalAnchors) % totalAnchors);
  };

  const setConstraint = (enabled: boolean) => {
    setHandleConstraint(enabled);
    onSetHandleConstraint(enabled);
  };

  useEffect(() => {
    onSetHandleConstraint(handleConstraint);
  }, [handleConstraint, onSetHandleConstraint]);

  const nudgeActions = [
    { label: 'Nudge left', dx: -1, dy: 0, Icon: ArrowLeft },
    { label: 'Nudge right', dx: 1, dy: 0, Icon: ArrowRight },
    { label: 'Nudge up', dx: 0, dy: -1, Icon: ArrowUp },
    { label: 'Nudge down', dx: 0, dy: 1, Icon: ArrowDown },
  ];

  return (
    <div
      className="absolute bottom-full left-1/2 z-[9999] mb-2 w-[min(720px,calc(100vw-20px))] -translate-x-1/2"
      data-testid="vector-node-toolbar"
    >
      <div
        className={`overflow-hidden rounded-2xl transition-all duration-300 ${
          expanded ? 'mb-2 max-h-[min(72vh,620px)] overflow-y-auto opacity-100' : 'pointer-events-none max-h-0 opacity-0'
        }`}
        style={{
          background: '#11141A',
          border: expanded ? '1px solid rgba(0,245,255,0.25)' : '1px solid transparent',
          boxShadow: expanded ? '0 -8px 30px rgba(0,0,0,0.45)' : 'none',
        }}
        aria-hidden={!expanded}
      >
        <div className="space-y-4 px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Crosshair size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Vector Node Studio</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Precision path controls</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] text-muted-foreground">Point X</label>
                  <span className="font-mono text-[11px] text-primary">{selectedAnchor ? formatCoord(selectedAnchor.localX) : '—'}</span>
                </div>
                <Slider
                  min={xRange.min}
                  max={xRange.max}
                  step={0.1}
                  value={[selectedAnchor?.localX ?? 0]}
                  onValueChange={([x]) => selectedAnchor && onSetNodePosition(x, selectedAnchor.localY)}
                  disabled={!selectedAnchor}
                  aria-label="Selected point X coordinate"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] text-muted-foreground">Point Y</label>
                  <span className="font-mono text-[11px] text-primary">{selectedAnchor ? formatCoord(selectedAnchor.localY) : '—'}</span>
                </div>
                <Slider
                  min={yRange.min}
                  max={yRange.max}
                  step={0.1}
                  value={[selectedAnchor?.localY ?? 0]}
                  onValueChange={([y]) => selectedAnchor && onSetNodePosition(selectedAnchor.localX, y)}
                  disabled={!selectedAnchor}
                  aria-label="Selected point Y coordinate"
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-foreground">Constrain handles</div>
                  <div className="text-[10px] text-muted-foreground">Mirror opposite curve handle</div>
                </div>
                <Switch
                  checked={handleConstraint}
                  onCheckedChange={setConstraint}
                  disabled={!selectedAnchor}
                  aria-label="Constrain opposite Bezier handles"
                />
              </div>
              <div className="space-y-2">
                <div className="text-[11px] text-muted-foreground">Selected point curve type</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSetCurveType('corner')}
                    disabled={!selectedAnchor || selectedAnchor.commandType === 'M' || !isCurve}
                    aria-pressed={!isCurve}
                    className={`flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      !isCurve
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    <Square size={13} /> Corner
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetCurveType('curve')}
                    disabled={!selectedAnchor || selectedAnchor.commandType === 'M' || isCurve}
                    aria-pressed={isCurve}
                    className={`flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      isCurve
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-white/10 bg-white/[0.035] text-slate-300 hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    <Spline size={13} /> Curve
                  </button>
                </div>
                <p className="text-[9px] text-muted-foreground">A straight segment can be converted to a cubic curve.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex h-14 w-full min-w-0 items-center gap-1.5 rounded-2xl border px-2"
        style={{
          background: '#11141A',
          borderColor: 'rgba(0,245,255,0.3)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-primary transition-colors hover:bg-primary/10"
              aria-label={`Vector parameter: ${PARAMETER_LABELS[activeParameter]}`}
              title="Vector parameter"
              data-testid="button-vector-parameter"
            >
              <Crosshair size={14} />
              <ChevronDown size={11} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-48 border-cyan-400/20 bg-[#11141A] text-foreground">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">Vector parameter</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={activeParameter} onValueChange={(value) => setActiveParameter(value as VectorParameter)}>
              {(Object.keys(PARAMETER_LABELS) as VectorParameter[]).map((parameter) => {
                const Icon = parameterIcons[parameter];
                return (
                  <DropdownMenuRadioItem key={parameter} value={parameter} className="gap-2 text-xs data-[state=checked]:text-primary">
                    <Icon size={14} className="text-primary" />
                    {PARAMETER_LABELS[parameter]}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5" data-testid="vector-parameter-controls">
          {activeParameter === 'point' && (
            <div className="flex min-w-0 items-center gap-0.5 rounded-xl border border-primary/20 bg-primary/[0.06] px-0.5">
              <button
                type="button"
                onClick={() => selectAnchor((selectedAnchorIdx ?? 0) - 1)}
                disabled={totalAnchors === 0}
                aria-label="Previous vector point"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 disabled:opacity-35"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="min-w-[105px] whitespace-nowrap text-center font-mono text-[10px] font-semibold text-primary">
                {totalAnchors === 0 ? 'No nodes' : `Point ${currentAnchorDisplay} / ${totalAnchors}`}
              </span>
              <button
                type="button"
                onClick={() => selectAnchor((selectedAnchorIdx ?? -1) + 1)}
                disabled={totalAnchors === 0}
                aria-label="Next vector point"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 disabled:opacity-35"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          {activeParameter === 'nudge' && (
            <div className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.035] p-0.5" role="group" aria-label="Nudge selected vector point by one pixel">
              {nudgeActions.map(({ label, dx, dy, Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onNudgeNode(dx, dy)}
                  disabled={!selectedAnchor}
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 disabled:opacity-35"
                >
                  <Icon size={14} />
                </button>
              ))}
              <span className="px-1.5 font-mono text-[9px] text-muted-foreground">1px</span>
            </div>
          )}

          {activeParameter === 'addDelete' && (
            <>
              <button
                type="button"
                onClick={onAddNode}
                disabled={totalAnchors === 0}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[10px] font-medium text-slate-200 transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:opacity-35"
                aria-label="Add node"
              >
                <Plus size={14} /> Node
              </button>
              <button
                type="button"
                onClick={onDeleteNode}
                disabled={!selectedAnchor}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[10px] font-medium text-slate-200 transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary disabled:opacity-35"
                aria-label="Delete selected node"
              >
                <Minus size={14} /> Node
              </button>
            </>
          )}

          {activeParameter === 'pen' && (
            <button
              type="button"
              onClick={onReactivatePen}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[10px] font-medium text-slate-200 transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
            >
              <PenTool size={14} /> Draw with Pen
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onDone}
          aria-label="Done editing vector nodes"
          title="Done"
          className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[10px] font-semibold text-slate-100 transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
        >
          <Check size={14} />
          Done
        </button>
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
          aria-label={expanded ? 'Collapse vector node controls' : 'Expand vector node controls'}
          aria-expanded={expanded}
          data-testid="button-toggle-vector-drawer"
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>
    </div>
  );
}