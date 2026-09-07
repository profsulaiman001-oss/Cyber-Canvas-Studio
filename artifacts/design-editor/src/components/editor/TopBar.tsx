import { useState, useRef } from 'react';
import { Undo2, Redo2, LayoutTemplate, Menu, Grid3x3, Magnet, AlignCenter, Palette, Settings2, Copy, ClipboardPaste, Lock, Unlock, RotateCcw } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TopBarProps {
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onOpenProjects?: () => void;
}

export default function TopBar({ onUndo, onRedo, onCopy, onPaste, onOpenProjects }: TopBarProps) {
  const { state, dispatch } = useEditor();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(state.projectName);
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
  const gridSettingsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNameClick = () => { setName(state.projectName); setEditing(true); setTimeout(() => inputRef.current?.select(), 50); };
  const handleNameBlur = () => { dispatch({ type: 'SET_PROJECT_NAME', payload: name.trim() || 'Untitled Design' }); setEditing(false); };
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') { setName(state.projectName); setEditing(false); }
  };

  const iconBtn = (active: boolean) => ({
    color: active ? '#00F5FF' : undefined,
    filter: active ? 'drop-shadow(0 0 4px #00F5FF80)' : undefined,
  });

  const setGridNumber = (type: 'SET_GRID_COLUMNS' | 'SET_GRID_ROWS', value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) dispatch({ type, payload: parsed });
  };
  const gridSwatches = ['#00F5FF', '#FFFFFF', '#111827', '#FF4D6D', '#FFD166', '#94A3B8'];

  return (
    <div
      className="flex-shrink-0 flex items-center"
      style={{ height: '52px', background: '#11141A', borderBottom: '1px solid rgba(0,245,255,0.1)' }}
      data-testid="top-bar"
    >
      {/* ── Fixed left: hamburger menu ── */}
      <div className="flex items-center px-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
              onClick={() => {
                if (onOpenProjects) onOpenProjects();
                else dispatch({ type: 'TOGGLE_PANEL', payload: 'project' });
              }} data-testid="button-open-projects">
              <Menu size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Projects</TooltipContent>
        </Tooltip>
      </div>

      {/* ── Project name (centered, fixed) ── */}
      <div className="flex justify-center items-center shrink-0 min-w-[110px] max-w-[160px]">
        {editing ? (
          <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur} onKeyDown={handleNameKeyDown}
            className="text-sm font-medium text-center bg-transparent border-b border-primary outline-none w-36 text-foreground" />
        ) : (
          <button onClick={handleNameClick}
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-2 truncate max-w-[150px]">
            {state.projectName}{state.isDirty && <span className="text-primary ml-1">•</span>}
          </button>
        )}
      </div>

      {/* ── Scrollable right section ── */}
      <div
        className="flex items-center gap-0.5 px-1 min-w-0 flex-1"
        style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Undo / Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onUndo} disabled={!state.canUndo}>
              <Undo2 size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onRedo} disabled={!state.canRedo}>
              <Redo2 size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 mx-0.5 shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Copy / Paste */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCopy}>
              <Copy size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy (Ctrl+C)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onPaste}>
              <ClipboardPaste size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Paste (Ctrl+V)</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 mx-0.5 shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

        {/* Grid toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
              style={iconBtn(state.gridEnabled)}>
              <Grid3x3 size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{state.gridEnabled ? 'Hide Grid' : 'Show Grid'}</TooltipContent>
        </Tooltip>

        {/* Grid settings — inline popover */}
        <div className="relative shrink-0" ref={gridSettingsRef}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                style={iconBtn(gridSettingsOpen)}
                onClick={() => setGridSettingsOpen((o) => !o)}
                data-testid="button-grid-settings"
              >
                <Settings2 size={13} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Grid Settings</TooltipContent>
          </Tooltip>

          {gridSettingsOpen && (
            <div
              className="absolute top-full right-0 mt-1 z-50 rounded-xl shadow-2xl p-3 space-y-3 w-[min(20rem,calc(100vw-1rem))] max-h-[calc(100vh-4.5rem)] overflow-y-auto"
              style={{ background: '#11141A', border: '1px solid rgba(0,245,255,0.2)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#00F5FF' }}>Grid Studio</p>
                  <p className="text-[10px] text-muted-foreground">{state.gridColumns} × {state.gridRows} alignment mesh</p>
                </div>
                <button
                  type="button"
                  aria-label={state.gridLocked ? 'Unlock grid dividers' : 'Lock grid dividers'}
                  onClick={() => dispatch({ type: 'TOGGLE_GRID_LOCKED' })}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium"
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

              <div className="rounded-lg p-2 space-y-2" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
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
                    <Input type="number" min={1} max={200} value={state.gridColumns}
                      onChange={(e) => setGridNumber('SET_GRID_COLUMNS', e.target.value)} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Rows</Label>
                    <Input type="number" min={1} max={200} value={state.gridRows}
                      onChange={(e) => setGridNumber('SET_GRID_ROWS', e.target.value)} className="h-7 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Column gap ({state.gridGapUnit})</Label>
                    <Input type="number" min={0} max={state.gridGapUnit === 'percent' ? 40 : 500} step={state.gridGapUnit === 'percent' ? 0.5 : 1}
                      value={state.gridColumnGap}
                      onChange={(e) => dispatch({ type: 'SET_GRID_GAP', payload: { axis: 'x', value: Number(e.target.value) || 0 } })}
                      className="h-7 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Row gap ({state.gridGapUnit})</Label>
                    <Input type="number" min={0} max={state.gridGapUnit === 'percent' ? 40 : 500} step={state.gridGapUnit === 'percent' ? 0.5 : 1}
                      value={state.gridRowGap}
                      onChange={(e) => dispatch({ type: 'SET_GRID_GAP', payload: { axis: 'y', value: Number(e.target.value) || 0 } })}
                      className="h-7 text-xs" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(['px', 'percent'] as const).map((unit) => (
                    <button key={unit} type="button" onClick={() => dispatch({ type: 'SET_GRID_GAP_UNIT', payload: unit })}
                      className="flex-1 rounded py-1 text-[10px] uppercase"
                      style={{
                        background: state.gridGapUnit === unit ? 'rgba(0,245,255,0.14)' : 'rgba(255,255,255,0.04)',
                        color: state.gridGapUnit === unit ? '#00F5FF' : '#94a3b8',
                        border: `1px solid ${state.gridGapUnit === unit ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >{unit === 'percent' ? '%' : 'px'}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg p-2 space-y-2" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Appearance</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <input aria-label="Grid color" type="color" value={state.gridColor}
                      onChange={(e) => dispatch({ type: 'SET_GRID_COLOR', payload: e.target.value })}
                      className="h-7 w-8 rounded border-0 bg-transparent p-0 cursor-pointer" />
                    <Input aria-label="Grid color HEX" value={state.gridColor}
                      onChange={(e) => dispatch({ type: 'SET_GRID_COLOR', payload: e.target.value })}
                      className="h-7 text-xs font-mono uppercase" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {gridSwatches.map((swatch) => (
                    <button key={swatch} type="button" aria-label={`Use ${swatch} grid color`}
                      onClick={() => dispatch({ type: 'SET_GRID_COLOR', payload: swatch })}
                      className="h-5 w-5 rounded-full border transition-transform hover:scale-110"
                      style={{ background: swatch, borderColor: state.gridColor.toLowerCase() === swatch.toLowerCase() ? '#00F5FF' : 'rgba(255,255,255,0.35)', boxShadow: state.gridColor.toLowerCase() === swatch.toLowerCase() ? '0 0 0 1px #00F5FF' : 'none' }}
                    />
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Opacity</Label>
                    <span className="text-[10px] font-mono text-foreground/70">{Math.round(state.gridOpacity * 100)}%</span>
                  </div>
                  <input type="range" min={5} max={100} value={Math.round(state.gridOpacity * 100)}
                    onChange={(e) => dispatch({ type: 'SET_GRID_OPACITY', payload: Number(e.target.value) / 100 })}
                    className="w-full accent-cyan-400" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Line weight</Label>
                    <span className="text-[10px] font-mono text-foreground/70">{state.gridLineWeight}px</span>
                  </div>
                  <input type="range" min={0.5} max={6} step={0.5} value={state.gridLineWeight}
                    onChange={(e) => dispatch({ type: 'SET_GRID_LINE_WEIGHT', payload: Number(e.target.value) })}
                    className="w-full accent-cyan-400" />
                </div>
              </div>

              <div className="rounded-lg p-2 space-y-2" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Slant / isometric</p>
                    <p className="text-[10px] text-muted-foreground/70">Angle the mesh for perspective guides</p>
                  </div>
                  <button type="button" onClick={() => dispatch({ type: 'TOGGLE_GRID_SLANT' })}
                    className="rounded px-2 py-1 text-[10px]"
                    style={{ background: state.gridSlanted ? 'rgba(0,245,255,0.14)' : 'rgba(255,255,255,0.05)', color: state.gridSlanted ? '#00F5FF' : '#94a3b8', border: `1px solid ${state.gridSlanted ? 'rgba(0,245,255,0.4)' : 'rgba(255,255,255,0.1)'}` }}
                  >{state.gridSlanted ? 'On' : 'Off'}</button>
                </div>
                <div className="space-y-1" style={{ opacity: state.gridSlanted ? 1 : 0.45 }}>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Angle</Label>
                    <span className="text-[10px] font-mono text-foreground/70">{state.gridSlantAngle}°</span>
                  </div>
                  <input type="range" min={-60} max={60} value={state.gridSlantAngle} disabled={!state.gridSlanted}
                    onChange={(e) => dispatch({ type: 'SET_GRID_SLANT_ANGLE', payload: Number(e.target.value) })}
                    className="w-full accent-cyan-400" />
                  <div className="flex justify-between text-[9px] text-muted-foreground"><span>-60°</span><span>0°</span><span>+60°</span></div>
                </div>
              </div>

              <div className="rounded-md px-2 py-1.5 text-[10px]" style={{ color: state.gridLocked ? '#94a3b8' : '#00F5FF', background: state.gridLocked ? 'rgba(255,255,255,0.035)' : 'rgba(0,245,255,0.07)' }}>
                {state.gridLocked ? 'Unlock dividers to drag individual rows and columns on the canvas.' : 'Drag the cyan handles on any divider to reposition it. Lock when finished.'}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">H Guides</Label>
                  <button type="button"
                    onClick={() => dispatch({ type: 'ADD_GUIDE', payload: { axis: 'h', pos: Math.round(state.canvasSize.height / 2) } })}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,245,255,0.1)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.3)' }}
                  >+ H</button>
                </div>
                {state.guides.h.map((pos, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] text-muted-foreground pl-1">
                    <span>{pos}px</span>
                    <button type="button" onClick={() => dispatch({ type: 'REMOVE_GUIDE', payload: { axis: 'h', idx: i } })} className="text-red-400 hover:text-red-300 px-1">✕</button>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">V Guides</Label>
                  <button type="button"
                    onClick={() => dispatch({ type: 'ADD_GUIDE', payload: { axis: 'v', pos: Math.round(state.canvasSize.width / 2) } })}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,245,255,0.1)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.3)' }}
                  >+ V</button>
                </div>
                {state.guides.v.map((pos, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] text-muted-foreground pl-1">
                    <span>{pos}px</span>
                    <button type="button" onClick={() => dispatch({ type: 'REMOVE_GUIDE', payload: { axis: 'v', idx: i } })} className="text-red-400 hover:text-red-300 px-1">✕</button>
                  </div>
                ))}
              </div>

              <button
                className="text-xs w-full text-center py-1 rounded"
                style={{ color: '#00F5FF', background: 'rgba(0,245,255,0.06)', border: '1px solid rgba(0,245,255,0.15)' }}
                onClick={() => setGridSettingsOpen(false)}
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Snap toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => dispatch({ type: 'TOGGLE_SNAP' })}
              style={iconBtn(state.snapToGrid)}>
              <Magnet size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{state.snapToGrid ? 'Disable Snap' : 'Snap to Grid'}</TooltipContent>
        </Tooltip>

        {/* Alignment panel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
              onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'alignment' })}
              style={iconBtn(state.activePanel === 'alignment')}>
              <AlignCenter size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Align & Position</TooltipContent>
        </Tooltip>

        {/* Canvas background */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
              onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'canvasBg' })}
              style={iconBtn(state.activePanel === 'canvasBg')}>
              <Palette size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Canvas Background</TooltipContent>
        </Tooltip>

        {/* Canvas size */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
              onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'canvasSize' })}>
              <LayoutTemplate size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Canvas Size</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
