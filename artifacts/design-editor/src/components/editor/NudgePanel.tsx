import { useState } from 'react';
import { useEditor } from '@/store/editorStore';
import { Crosshair, X } from 'lucide-react';

interface NudgePanelProps {
  onNudge: (direction: 'up' | 'down' | 'left' | 'right', amount: number) => void;
}

const STEPS = [1, 2, 5, 10, 20] as const;

export default function NudgePanel({ onNudge }: NudgePanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'nudge';
  const [stepIdx, setStepIdx] = useState<number>(1);
  const nudgeStep = STEPS[stepIdx];

  const increaseStep = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const decreaseStep = () => setStepIdx((i) => Math.max(i - 1, 0));

  const arrowBtn =
    'bg-slate-900 border border-neutral-700 hover:border-cyan-500/50 rounded-lg flex items-center justify-center text-cyan-400 active:bg-cyan-950 transition-colors text-sm font-bold select-none cursor-pointer';

  if (!isOpen) return null;

  return (
    <div
      style={{
        background: '#11141A',
        borderTop: '1px solid rgba(0,245,255,0.2)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
      }}
      data-testid="nudge-panel"
    >
      <div className="px-4 pt-2 pb-1 flex items-center gap-3" style={{ paddingRight: '0.75rem' }}>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Crosshair size={12} className="text-primary" />
          <span className="text-xs font-semibold">Nudge</span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-muted-foreground">Step</span>
          <button
            onClick={decreaseStep}
            disabled={stepIdx <= 0}
            className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center text-xs font-bold text-neutral-400 disabled:opacity-30 border border-neutral-800 hover:border-cyan-500/40 flex-shrink-0"
            aria-label="Decrease step"
          >
            −
          </button>
          <span className="text-xs font-mono font-bold w-10 text-center flex-shrink-0" style={{ color: '#00F5FF' }}>
            {nudgeStep}px
          </span>
          <button
            onClick={increaseStep}
            disabled={stepIdx >= STEPS.length - 1}
            className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center text-xs font-bold text-neutral-400 disabled:opacity-30 border border-neutral-800 hover:border-cyan-500/40 flex-shrink-0"
            aria-label="Increase step"
          >
            +
          </button>
          <button
            onClick={() => dispatch({ type: 'CLOSE_PANEL' })}
            className="w-6 h-6 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-300 flex-shrink-0 ml-1"
            aria-label="Close nudge panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div
        className="flex items-center justify-center"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))', paddingTop: '4px' }}
      >
        <div className="grid grid-cols-3 gap-1.5" style={{ width: '116px', height: '116px' }}>
          <div />
          <button className={arrowBtn} onClick={() => onNudge('up', nudgeStep)} aria-label="Nudge up">▲</button>
          <div />
          <button className={arrowBtn} onClick={() => onNudge('left', nudgeStep)} aria-label="Nudge left">◀</button>
          <div
            className="rounded-lg flex items-center justify-center text-[10px] font-mono font-bold select-none"
            style={{ background: '#0f1218', border: '1px solid rgba(0,245,255,0.2)', color: '#00F5FF' }}
          >
            {nudgeStep}px
          </div>
          <button className={arrowBtn} onClick={() => onNudge('right', nudgeStep)} aria-label="Nudge right">▶</button>
          <div />
          <button className={arrowBtn} onClick={() => onNudge('down', nudgeStep)} aria-label="Nudge down">▼</button>
          <div />
        </div>
      </div>
    </div>
  );
}
