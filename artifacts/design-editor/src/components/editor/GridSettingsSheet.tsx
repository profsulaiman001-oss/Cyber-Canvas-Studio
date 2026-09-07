import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEditor } from '@/store/editorStore';
import { Lock, Unlock, RotateCcw } from 'lucide-react';

interface GridSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GRID_SWATCHES = ['#00F5FF', '#FFFFFF', '#111827', '#FF4D6D', '#FFD166', '#94A3B8'];

export default function GridSettingsSheet({ open, onOpenChange }: GridSettingsSheetProps) {
  const { state, dispatch } = useEditor();

  const setGridNumber = (type: 'SET_GRID_COLUMNS' | 'SET_GRID_ROWS', value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) dispatch({ type, payload: parsed });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{
          maxHeight: 'min(78vh, 720px)',
          background: '#11141A',
          border: '1px solid rgba(0,245,255,0.18)',
          overflowY: 'auto',
        }}
        data-testid="grid-settings-sheet"
      >
        <SheetHeader className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SheetTitle className="text-sm font-semibold" style={{ color: '#00F5FF' }}>
                Grid Studio
              </SheetTitle>
              <p className="text-[10px] text-muted-foreground mt-1">
                {state.gridColumns} × {state.gridRows} alignment mesh
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
                className="rounded-md px-2.5 py-1.5 text-[10px] font-medium"
                style={{
                  background: state.gridEnabled ? 'rgba(0,245,255,0.14)' : 'rgba(255,255,255,0.06)',
                  color: state.gridEnabled ? '#00F5FF' : '#94a3b8',
                  border: `1px solid ${state.gridEnabled ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.14)'}`,
                }}
              >
                {state.gridEnabled ? 'Grid visible' : 'Show grid'}
              </button>
              <button
                type="button"
                aria-label={state.gridLocked ? 'Unlock grid dividers' : 'Lock grid dividers'}
                onClick={() => dispatch({ type: 'TOGGLE_GRID_LOCKED' })}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-medium"
                style={{
                  background: state.gridLocked ? 'rgba(255,255,255,0.06)' : 'rgba(0,245,255,0.12)',
                  color: state.gridLocked ? '#cbd5e1' : '#00F5FF',
                  border: `1px solid ${state.gridLocked ? 'rgba(255,255,255,0.14)' : 'rgba(0,245,255,0.35)'}`,
                }}
              >
                {state.gridLocked ? <Lock size={11} /> : <Unlock size={11} />}
                {state.gridLocked ? 'Locked' : 'Unlocked'}
              </button>
            </div>
          </div>
        </SheetHeader>

        <div className="px-4 space-y-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
          <section className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Layout</p>
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESET_GRID_POSITIONS' })}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                title="Reset custom divider positions"
              >
                <RotateCcw size={10} /> Reset dividers
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Columns</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={state.gridColumns}
                  onChange={(e) => setGridNumber('SET_GRID_COLUMNS', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Rows</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={state.gridRows}
                  onChange={(e) => setGridNumber('SET_GRID_ROWS', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Column spacing ({state.gridGapUnit})</Label>
                <Input
                  type="number"
                  min={0}
                  max={state.gridGapUnit === 'percent' ? 40 : 500}
                  step={state.gridGapUnit === 'percent' ? 0.5 : 1}
                  value={state.gridColumnGap}
                  onChange={(e) => dispatch({ type: 'SET_GRID_GAP', payload: { axis: 'x', value: Number(e.target.value) || 0 } })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Row spacing ({state.gridGapUnit})</Label>
                <Input
                  type="number"
                  min={0}
                  max={state.gridGapUnit === 'percent' ? 40 : 500}
                  step={state.gridGapUnit === 'percent' ? 0.5 : 1}
                  value={state.gridRowGap}
                  onChange={(e) => dispatch({ type: 'SET_GRID_GAP', payload: { axis: 'y', value: Number(e.target.value) || 0 } })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {(['px', 'percent'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_GRID_GAP_UNIT', payload: unit })}
                  className="flex-1 rounded py-1.5 text-[10px] uppercase"
                  style={{
                    background: state.gridGapUnit === unit ? 'rgba(0,245,255,0.14)' : 'rgba(255,255,255,0.04)',
                    color: state.gridGapUnit === unit ? '#00F5FF' : '#94a3b8',
                    border: `1px solid ${state.gridGapUnit === unit ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {unit === 'percent' ? '%' : 'px'}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Appearance</p>
            <div className="flex items-center gap-2">
              <input
                aria-label="Grid color"
                type="color"
                value={state.gridColor}
                onChange={(e) => dispatch({ type: 'SET_GRID_COLOR', payload: e.target.value })}
                className="h-8 w-9 rounded border-0 bg-transparent p-0 cursor-pointer"
              />
              <Input
                aria-label="Grid color HEX"
                value={state.gridColor}
                onChange={(e) => dispatch({ type: 'SET_GRID_COLOR', payload: e.target.value })}
                className="h-8 flex-1 text-xs font-mono uppercase"
              />
            </div>
            <div className="flex gap-1.5">
              {GRID_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`Use ${swatch} grid color`}
                  onClick={() => dispatch({ type: 'SET_GRID_COLOR', payload: swatch })}
                  className="h-6 w-6 rounded-full border transition-transform hover:scale-110"
                  style={{
                    background: swatch,
                    borderColor: state.gridColor.toLowerCase() === swatch.toLowerCase() ? '#00F5FF' : 'rgba(255,255,255,0.35)',
                    boxShadow: state.gridColor.toLowerCase() === swatch.toLowerCase() ? '0 0 0 1px #00F5FF' : 'none',
                  }}
                />
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Opacity</Label>
                <span className="text-[10px] font-mono text-foreground/70">{Math.round(state.gridOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={Math.round(state.gridOpacity * 100)}
                onChange={(e) => dispatch({ type: 'SET_GRID_OPACITY', payload: Number(e.target.value) / 100 })}
                className="w-full accent-cyan-400"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Line weight</Label>
                <span className="text-[10px] font-mono text-foreground/70">{state.gridLineWeight}px</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={6}
                step={0.5}
                value={state.gridLineWeight}
                onChange={(e) => dispatch({ type: 'SET_GRID_LINE_WEIGHT', payload: Number(e.target.value) })}
                className="w-full accent-cyan-400"
              />
            </div>
          </section>

          <section className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Perspective</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Angle the mesh for perspective guides</p>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'TOGGLE_GRID_SLANT' })}
                className="rounded px-2.5 py-1.5 text-[10px]"
                style={{
                  background: state.gridSlanted ? 'rgba(0,245,255,0.14)' : 'rgba(255,255,255,0.05)',
                  color: state.gridSlanted ? '#00F5FF' : '#94a3b8',
                  border: `1px solid ${state.gridSlanted ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {state.gridSlanted ? 'Slant on' : 'Straight'}
              </button>
            </div>
            <div className="space-y-1" style={{ opacity: state.gridSlanted ? 1 : 0.45 }}>
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Slant angle</Label>
                <span className="text-[10px] font-mono text-foreground/70">{state.gridSlantAngle}°</span>
              </div>
              <input
                aria-label="Grid slant angle"
                type="range"
                min={-60}
                max={60}
                value={state.gridSlantAngle}
                disabled={!state.gridSlanted}
                onChange={(e) => dispatch({ type: 'SET_GRID_SLANT_ANGLE', payload: Number(e.target.value) })}
                className="w-full accent-cyan-400"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground"><span>-60°</span><span>0°</span><span>+60°</span></div>
            </div>
          </section>

          <div className="rounded-lg px-3 py-2 text-[10px]" style={{ color: state.gridLocked ? '#94a3b8' : '#00F5FF', background: state.gridLocked ? 'rgba(255,255,255,0.035)' : 'rgba(0,245,255,0.07)' }}>
            {state.gridLocked
              ? 'Unlock dividers to drag individual rows and columns on the canvas.'
              : 'Drag the cyan handles on any divider to reposition it. Lock when finished.'}
          </div>

          <section className="grid grid-cols-2 gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {(['h', 'v'] as const).map((axis) => {
              const label = axis === 'h' ? 'H Guides' : 'V Guides';
              const guidePositions = state.guides[axis];
              const max = axis === 'h' ? state.canvasSize.height : state.canvasSize.width;
              return (
                <div key={axis} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">{label}</Label>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'ADD_GUIDE', payload: { axis, pos: Math.round(max / 2) } })}
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: 'rgba(0,245,255,0.1)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.3)' }}
                    >
                      + {axis.toUpperCase()}
                    </button>
                  </div>
                  {guidePositions.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/60">None</p>
                  ) : (
                    guidePositions.map((pos, index) => (
                      <div key={`${axis}-${index}`} className="flex items-center justify-between pl-1 text-[10px] text-muted-foreground">
                        <span>{pos}px</span>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'REMOVE_GUIDE', payload: { axis, idx: index } })}
                          className="px-1 text-red-400 hover:text-red-300"
                          aria-label={`Remove ${label} guide at ${pos}px`}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}