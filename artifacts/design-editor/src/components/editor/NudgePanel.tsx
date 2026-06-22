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

  const dirBtn =
    'w-8 h-8 bg-slate-900 border border-neutral-700 hover:border-cyan-500/50 rounded-lg flex items-center justify-center text-cyan-400 active:bg-cyan-950 transition-colors text-sm font-bold select-none cursor-pointer flex-shrink-0';
  const stepBtn =
    'w-6 h-6 bg-slate-900 rounded flex items-center justify-center text-xs font-bold text-neutral-400 disabled:opacity-30 border border-neutral-800 hover:border-cyan-500/40 flex-shrink-0';

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
      <div
        className="flex items-center gap-2 px-3"
        style={{ height: '50px', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* D-pad cluster: ← [↑↓] → */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button className={dirBtn} onClick={() => onNudge('left', nudgeStep)} aria-label="Nudge left">◀</button>
          <div className="flex flex-col gap-1">
            <button
              className="w-8 h-[14px] bg-slate-900 border border-neutral-700 hover:border-cyan-500/50 rounded flex items-center justify-center text-cyan-400 active:bg-cyan-950 transition-colors text-[10px] font-bold cursor-pointer flex-shrink-0"
              onClick={() => onNudge('up', nudgeStep)}
              aria-label="Nudge up"
            >▲</button>
            <button
              className="w-8 h-[14px] bg-slate-900 border border-neutral-700 hover:border-cyan-500/50 rounded flex items-center justify-center text-cyan-400 active:bg-cyan-950 transition-colors text-[10px] font-bold cursor-pointer flex-shrink-0"
              onClick={() => onNudge('down', nudgeStep)}
              aria-label="Nudge down"
            >▼</button>
          </div>
          <button className={dirBtn} onClick={() => onNudge('right', nudgeStep)} aria-label="Nudge right">▶</button>
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-neutral-800 flex-shrink-0 mx-1" />

        {/* Label + step control */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Crosshair size={12} className="text-primary flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground flex-shrink-0">Step</span>
          <button
            onClick={decreaseStep}
            disabled={stepIdx <= 0}
            className={stepBtn}
            aria-label="Decrease step"
          >−</button>
          <span
            className="text-xs font-mono font-bold w-10 text-center flex-shrink-0"
            style={{ color: '#00F5FF' }}
          >
            {nudgeStep}px
          </span>
          <button
            onClick={increaseStep}
            disabled={stepIdx >= STEPS.length - 1}
            className={stepBtn}
            aria-label="Increase step"
          >+</button>
        </div>

        {/* Close */}
        <button
          onClick={() => dispatch({ type: 'CLOSE_PANEL' })}
          className="w-7 h-7 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-300 flex-shrink-0"
          aria-label="Close nudge panel"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
