import { useState, useRef } from 'react';
import { Undo2, Redo2, LayoutTemplate, Menu } from 'lucide-react';
import { useEditor } from '@/store/editorStore';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TopBarProps {
  onUndo: () => void;
  onRedo: () => void;
}

export default function TopBar({ onUndo, onRedo }: TopBarProps) {
  const { state, dispatch } = useEditor();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(state.projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNameClick = () => {
    setName(state.projectName);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const handleNameBlur = () => {
    const trimmed = name.trim() || 'Untitled Design';
    dispatch({ type: 'SET_PROJECT_NAME', payload: trimmed });
    setEditing(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') {
      setName(state.projectName);
      setEditing(false);
    }
  };

  return (
    <div
      className="flex-shrink-0 flex items-center px-3 gap-2"
      style={{
        height: '52px',
        background: '#11141A',
        borderBottom: '1px solid rgba(0,245,255,0.1)',
      }}
      data-testid="top-bar"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'project' })}
            data-testid="button-open-projects"
          >
            <Menu size={18} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Projects</TooltipContent>
      </Tooltip>

      <div className="flex-1 flex justify-center">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="text-sm font-medium text-center bg-transparent border-b border-primary outline-none w-48 text-foreground"
            data-testid="input-project-name"
          />
        ) : (
          <button
            onClick={handleNameClick}
            className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors px-2 truncate max-w-[160px]"
            data-testid="button-project-name"
          >
            {state.projectName}
            {state.isDirty && <span className="text-primary ml-1">•</span>}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onUndo}
              disabled={!state.canUndo}
              data-testid="button-undo"
            >
              <Undo2 size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRedo}
              disabled={!state.canRedo}
              data-testid="button-redo"
            >
              <Redo2 size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => dispatch({ type: 'TOGGLE_PANEL', payload: 'canvasSize' })}
              data-testid="button-canvas-size"
            >
              <LayoutTemplate size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Canvas Size</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
