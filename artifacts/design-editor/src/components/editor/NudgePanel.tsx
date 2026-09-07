import { useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Minus,
  Move,
  Plus,
} from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import type { AlignType } from '@/hooks/useFabricCanvas';

interface NudgePanelProps {
  onNudge: (direction: 'up' | 'down' | 'left' | 'right', amount: number) => void;
  onAlign?: (type: AlignType) => void;
  onDistribute?: (axis: 'horizontal' | 'vertical') => void;
}

const STEPS = [1, 2, 5, 10] as const;

const iconButtonClass =
  'flex h-7 w-7 items-center justify-center rounded-md text-cyan-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-100 active:scale-95';

const alignmentButtonClass =
  'flex min-w-[72px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-2 py-2 text-[10px] text-slate-300 transition-colors hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-100 active:scale-[0.98]';

export default function NudgePanel({ onNudge, onAlign, onDistribute }: NudgePanelProps) {
  const { state } = useEditor();
  const isOpen = state.activePanel === 'nudge';
  const [stepIdx, setStepIdx] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const nudgeStep = STEPS[stepIdx];

  if (!isOpen) return null;

  const alignCenter = () => {
    onAlign?.('centerH');
    onAlign?.('centerV');
  };

  return (
    <div className="pointer-events-none flex justify-center px-3 pb-2" data-testid="nudge-panel">
      <div
        className="pointer-events-auto w-fit max-w-[min(760px,calc(100vw-24px))] overflow-hidden rounded-2xl border"
        style={{
          background: 'rgba(17,20,26,0.97)',
          borderColor: 'rgba(0,245,255,0.24)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.5), 0 0 18px rgba(0,245,255,0.05)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex min-h-12 items-center gap-2 px-2.5 py-2 sm:gap-2.5 sm:px-3">
          <div
            className="flex shrink-0 items-center gap-0.5 rounded-xl border p-1"
            style={{ background: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,255,255,0.1)' }}
            aria-label="Nudge directions"
          >
            <button className={iconButtonClass} onClick={() => onNudge('left', nudgeStep)} aria-label="Nudge left">
              <ArrowLeft size={15} />
            </button>
            <div className="flex flex-col gap-0.5">
              <button className={iconButtonClass} onClick={() => onNudge('up', nudgeStep)} aria-label="Nudge up">
                <ArrowUp size={14} />
              </button>
              <button className={iconButtonClass} onClick={() => onNudge('down', nudgeStep)} aria-label="Nudge down">
                <ArrowDown size={14} />
              </button>
            </div>
            <button className={iconButtonClass} onClick={() => onNudge('right', nudgeStep)} aria-label="Nudge right">
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="h-7 w-px shrink-0 bg-white/10" />

          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.035] p-1">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              onClick={() => setStepIdx((idx) => Math.max(0, idx - 1))}
              disabled={stepIdx === 0}
              aria-label="Decrease nudge step"
            >
              <Minus size={13} />
            </button>
            <span className="min-w-9 text-center font-mono text-[11px] font-semibold text-cyan-300">{nudgeStep}px</span>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              onClick={() => setStepIdx((idx) => Math.min(STEPS.length - 1, idx + 1))}
              disabled={stepIdx === STEPS.length - 1}
              aria-label="Increase nudge step"
            >
              <Plus size={13} />
            </button>
          </div>

          <div className="h-7 w-px shrink-0 bg-white/10" />
          <div className="flex min-w-[30px] items-center gap-1.5 sm:min-w-[76px]">
            <Move size={13} className="shrink-0 text-cyan-300" />
            <span className="hidden text-[10px] text-slate-400 sm:inline">Nudge:</span>
            <span className="font-mono text-[11px] font-semibold text-cyan-300">{nudgeStep}px</span>
          </div>

          <button
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse precision alignment options' : 'Expand precision alignment options'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {expanded && (
          <div
            className="border-t px-2.5 pb-2.5 pt-2.5 sm:px-3"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">Precision align</span>
              <span className="text-[10px] text-slate-500">Selected objects or canvas bounds</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button className={alignmentButtonClass} onClick={() => onAlign?.('top')} disabled={!onAlign}>
                <AlignStartHorizontal size={13} /> Top
              </button>
              <button className={alignmentButtonClass} onClick={alignCenter} disabled={!onAlign}>
                <AlignCenterHorizontal size={13} /> Center
              </button>
              <button className={alignmentButtonClass} onClick={() => onAlign?.('bottom')} disabled={!onAlign}>
                <AlignEndHorizontal size={13} /> Bottom
              </button>
              <button className={alignmentButtonClass} onClick={() => onAlign?.('left')} disabled={!onAlign}>
                <AlignStartVertical size={13} /> Left
              </button>
              <button className={alignmentButtonClass} onClick={() => onAlign?.('right')} disabled={!onAlign}>
                <AlignEndVertical size={13} /> Right
              </button>
              <button className={alignmentButtonClass} onClick={() => onDistribute?.('horizontal')} disabled={!onDistribute}>
                <AlignHorizontalSpaceBetween size={13} /> Distribute H
              </button>
              <button className={alignmentButtonClass} onClick={() => onDistribute?.('vertical')} disabled={!onDistribute}>
                <AlignVerticalSpaceBetween size={13} /> Distribute V
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}