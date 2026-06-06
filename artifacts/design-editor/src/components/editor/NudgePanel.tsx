import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useEditor } from '@/store/editorStore';
import { Crosshair } from 'lucide-react';

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
    'bg-slate-900 border border-neutral-700 hover:border-cyan-500/50 rounded-xl flex items-center justify-center text-cyan-400 active:bg-cyan-950 transition-colors text-base font-bold select-none cursor-pointer';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{
          maxHeight: '260px',
          height: '260px',
          background: '#11141A',
          border: 'none',
          overflow: 'hidden',
        }}
        data-testid="nudge-panel"
      >
        <SheetHeader className="px-4 pt-3 pb-1 flex flex-row items-center justify-between">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <Crosshair size={14} className="text-primary" />
            Nudge Tool
          </SheetTitle>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-medium">Step Speed</span>
            <button
              onClick={decreaseStep}
              disabled={stepIdx <= 0}
              className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center text-xs font-bold text-neutral-400 disabled:opacity-30 border border-neutral-800 hover:border-cyan-500/40"
            >
              −
            </button>
            <span
              className="text-sm font-mono font-bold w-12 text-center"
              style={{ color: '#00F5FF' }}
            >
              {nudgeStep}px
            </span>
            <button
              onClick={increaseStep}
              disabled={stepIdx >= STEPS.length - 1}
              className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center text-xs font-bold text-neutral-400 disabled:opacity-30 border border-neutral-800 hover:border-cyan-500/40"
            >
              +
            </button>
          </div>
        </SheetHeader>

        <div
          className="flex items-center justify-center"
          style={{ paddingTop: '8px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="grid grid-cols-3 gap-2" style={{ width: '168px', height: '168px' }}>
            {/* Row 1 */}
            <div />
            <button className={arrowBtn} style={{ fontSize: '18px' }} onClick={() => onNudge('up', nudgeStep)}>▲</button>
            <div />
            {/* Row 2 */}
            <button className={arrowBtn} style={{ fontSize: '18px' }} onClick={() => onNudge('left', nudgeStep)}>◀</button>
            <div
              className="rounded-xl flex items-center justify-center text-xs font-mono font-bold select-none"
              style={{ background: '#0f1218', border: '1px solid rgba(0,245,255,0.2)', color: '#00F5FF' }}
            >
              {nudgeStep}px
            </div>
            <button className={arrowBtn} style={{ fontSize: '18px' }} onClick={() => onNudge('right', nudgeStep)}>▶</button>
            {/* Row 3 */}
            <div />
            <button className={arrowBtn} style={{ fontSize: '18px' }} onClick={() => onNudge('down', nudgeStep)}>▼</button>
            <div />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
