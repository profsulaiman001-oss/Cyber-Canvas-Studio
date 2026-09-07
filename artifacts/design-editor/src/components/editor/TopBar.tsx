import { useRef, useState } from 'react';
import {
  AlignCenter,
  ClipboardPaste,
  Copy,
  Grid3x3,
  LayoutTemplate,
  Magnet,
  Menu,
  Palette,
  Redo2,
  Settings2,
  Undo2,
} from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import GridSettingsSheet from './GridSettingsSheet';

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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNameClick = () => {
    setName(state.projectName);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const handleNameBlur = () => {
    dispatch({ type: 'SET_PROJECT_NAME', payload: name.trim() || 'Untitled Design' });
    setEditing(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') {
      setName(state.projectName);
      setEditing(false);
    }
  };

  const iconBtn = (active: boolean) => ({
    color: active ? '#00F5FF' : undefined,
    filter: active ? 'drop-shadow(0 0 4px #00F5FF80)' : undefined,
  });

  return (
    <div
      className="flex-shrink-0 flex items-center"
      style={{ height: '52px', background: '#11141A', borderBottom: '1px solid rgba(0,245,255,0.1)' }}
      data-testid="top-bar"
    >
      <div className="flex items-center px-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                if (onOpenProjects) onOpenProjects();
                else dispatch({ type: 'TOGGLE_PANEL', payload: 'project' });
              }}
              data-testid="button-open-projects"
            >
              <Menu size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Projects</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex justify-center items-center shrink-0 min-w-[110px] max-w-[160px]">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="text-sm font-medium text-center bg-transparent border-b border-primary outline-none w-36 text-foreground"
          />
        ) : (
          <button onClick={handleNameClick} className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-2 truncate max-w-[150px]">
            {state.projectName}{state.isDirty && <span className="text-primary ml-1">•</span>}
          </button>
        )}
      </div>

      <div
        className="flex items-center gap-0.5 px-1 min-w-0 flex-1"
        style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setGridSettingsOpen(true)}
              style={iconBtn(state.gridEnabled)}
              data-testid="button-grid"
            >
              <Grid3x3 size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Grid Settings</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              style={iconBtn(gridSettingsOpen)}
              onClick={() => setGridSettingsOpen(true)}
              data-testid="button-grid-settings"
            >
              <Settings2 size={13} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Grid Settings</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => dispatch({ type: 'TOGGLE_SNAP' })} style={iconBtn(state.snapToGrid)}>
              <Magnet size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{state.snapToGrid ? 'Disable Snap' : 'Snap to Grid'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'alignment' })}
              style={iconBtn(state.activePanel === 'alignment')}
            >
              <AlignCenter size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Align &amp; Position</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'canvasBg' })}
              style={iconBtn(state.activePanel === 'canvasBg')}
            >
              <Palette size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Canvas Background</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'canvasSize' })}>
              <LayoutTemplate size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Canvas Size</TooltipContent>
        </Tooltip>
      </div>

      <GridSettingsSheet open={gridSettingsOpen} onOpenChange={setGridSettingsOpen} />
    </div>
  );
}