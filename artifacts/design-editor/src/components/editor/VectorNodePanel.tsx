import { useState } from 'react';
import { MousePointer2, Plus, Minus, ChevronLeft, ChevronRight, PenTool, Move, Crosshair, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { VectorAnchor } from '@/hooks/useFabricCanvas';

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

type EditMode = 'handle' | 'nudge';

const ACCENT = '#7B2FFF';
const CYAN = '#00F5FF';

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
  const [mode, setMode] = useState<EditMode>('handle');

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

  const btn = (
    label: string,
    onClick: () => void,
    active = false,
    accentColor = ACCENT,
    disabled = false,
  ) => (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex items-center justify-center px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 disabled:opacity-30"
      style={{
        background: active ? `${accentColor}22` : 'rgba(255,255,255,0.06)',
        color: active ? accentColor : '#9ca3af',
        border: `1px solid ${active ? accentColor : 'rgba(255,255,255,0.1)'}`,
        boxShadow: active ? `0 0 8px ${accentColor}40` : 'none',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className="flex-shrink-0 px-3 pt-3"
      style={{
        background: '#0E1117',
        borderTop: `1px solid ${ACCENT}55`,
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      {/* ── Row 1: Mode tabs + Done ── */}
      <div className="flex items-center gap-2 mb-3">
        {/* Mode: Handle Adjust */}
        <button
          onClick={() => setMode('handle')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            background: mode === 'handle' ? `${ACCENT}22` : 'rgba(255,255,255,0.05)',
            color: mode === 'handle' ? ACCENT : '#6b7280',
            border: `1px solid ${mode === 'handle' ? ACCENT : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <Move size={13} />
          Handles
        </button>

        {/* Mode: Nudge Pad */}
        <button
          onClick={() => setMode('nudge')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            background: mode === 'nudge' ? `${ACCENT}22` : 'rgba(255,255,255,0.05)',
            color: mode === 'nudge' ? ACCENT : '#6b7280',
            border: `1px solid ${mode === 'nudge' ? ACCENT : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <Crosshair size={13} />
          Nudge
        </button>

        {/* Pen Draw — close vector edit, reactivate pen */}
        <button
          onClick={onReactivatePen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            background: 'rgba(0,245,255,0.08)',
            color: CYAN,
            border: `1px solid rgba(0,245,255,0.25)`,
          }}
        >
          <PenTool size={13} />
          Draw
        </button>

        <div className="flex-1" />

        {/* Done */}
        <button
          onClick={onDone}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
          style={{ background: 'rgba(255,255,255,0.08)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <MousePointer2 size={13} />
          Done
        </button>
      </div>

      {/* ── Row 2: Node navigator + Add/Delete ── */}
      <div className="flex items-center gap-2 mb-3">
        {/* Add / Delete */}
        <button
          onClick={onAddNode}
          disabled={totalAnchors === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:opacity-30"
          style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
          title="Add node after selected"
        >
          <Plus size={13} />
          Add
        </button>
        <button
          onClick={onDeleteNode}
          disabled={totalAnchors === 0 || selectedAnchorIdx === null}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:opacity-30"
          style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
          title="Delete selected node"
        >
          <Minus size={13} />
          Del
        </button>

        <div className="flex-1" />

        {/* Node navigator */}
        <div
          className="flex items-center gap-1 rounded-xl px-2 py-1"
          style={{ background: 'rgba(123,47,255,0.1)', border: `1px solid ${ACCENT}33` }}
        >
          <button
            onClick={prevAnchor}
            disabled={totalAnchors === 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-90 disabled:opacity-30"
            style={{ color: ACCENT }}
          >
            <ChevronLeft size={15} />
          </button>
          <span
            className="text-[11px] font-mono font-bold min-w-[64px] text-center"
            style={{ color: ACCENT }}
          >
            {totalAnchors === 0
              ? 'No nodes'
              : `Point ${currentAnchorDisplay} / ${totalAnchors}`}
          </span>
          <button
            onClick={nextAnchor}
            disabled={totalAnchors === 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-90 disabled:opacity-30"
            style={{ color: ACCENT }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* ── Row 3: Context area based on mode ── */}
      {mode === 'nudge' && (
        <div className="flex items-center justify-center">
          {/* 4-way nudge pad */}
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: '40px 40px 40px', gridTemplateRows: '40px 40px 40px' }}>
            {/* Row 1: up */}
            <div />
            <button
              onClick={() => onNudgeNode(0, -NUDGE_PX)}
              disabled={selectedAnchorIdx === null}
              className="flex items-center justify-center rounded-xl transition-all active:scale-90 disabled:opacity-30"
              style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}44`, color: ACCENT }}
            >
              <ArrowUp size={18} />
            </button>
            <div />
            {/* Row 2: left · indicator · right */}
            <button
              onClick={() => onNudgeNode(-NUDGE_PX, 0)}
              disabled={selectedAnchorIdx === null}
              className="flex items-center justify-center rounded-xl transition-all active:scale-90 disabled:opacity-30"
              style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}44`, color: ACCENT }}
            >
              <ArrowLeft size={18} />
            </button>
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}33` }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />
            </div>
            <button
              onClick={() => onNudgeNode(NUDGE_PX, 0)}
              disabled={selectedAnchorIdx === null}
              className="flex items-center justify-center rounded-xl transition-all active:scale-90 disabled:opacity-30"
              style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}44`, color: ACCENT }}
            >
              <ArrowRight size={18} />
            </button>
            {/* Row 3: down */}
            <div />
            <button
              onClick={() => onNudgeNode(0, NUDGE_PX)}
              disabled={selectedAnchorIdx === null}
              className="flex items-center justify-center rounded-xl transition-all active:scale-90 disabled:opacity-30"
              style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}44`, color: ACCENT }}
            >
              <ArrowDown size={18} />
            </button>
            <div />
          </div>

          <div className="ml-4 text-[10px] leading-relaxed max-w-[120px]" style={{ color: '#6b7280' }}>
            {selectedAnchorIdx === null
              ? 'Select a node first using the navigator →'
              : `Nudging Point ${currentAnchorDisplay}\n1px per tap`}
          </div>
        </div>
      )}

      {mode === 'handle' && (
        <div
          className="rounded-xl px-3 py-2 text-[10px] leading-relaxed"
          style={{ background: `${ACCENT}0a`, border: `1px solid ${ACCENT}22`, color: '#6b7280' }}
        >
          <span style={{ color: ACCENT }} className="font-semibold">Drag anchors</span> — move on canvas.{' '}
          <span style={{ color: ACCENT }} className="font-semibold">Drag diamonds</span> — adjust bezier curve tangent.
          Use the navigator to step through nodes precisely.
        </div>
      )}
    </div>
  );
}
