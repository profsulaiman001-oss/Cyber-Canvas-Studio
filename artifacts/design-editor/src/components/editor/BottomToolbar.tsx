import { MousePointer2, Plus, Layers, SlidersHorizontal, Download, PenTool, X } from 'lucide-react';
import { useEditor, ActivePanel } from '@/store/editorStore';

interface BottomToolbarProps {
  hasSelection: boolean;
  penActive: boolean;
  onPenCancel: () => void;
}

export default function BottomToolbar({ hasSelection, penActive, onPenCancel }: BottomToolbarProps) {
  const { state, dispatch } = useEditor();

  const tools: { id: ActivePanel | 'select' | 'pen'; icon: React.ReactNode; label: string; action: () => void; disabled?: boolean; highlight?: boolean }[] = [
    {
      id: 'select',
      icon: <MousePointer2 size={22} />,
      label: 'Select',
      action: () => {
        if (penActive) { onPenCancel(); dispatch({ type: 'SET_TOOL', payload: 'select' }); return; }
        dispatch({ type: 'SET_TOOL', payload: 'select' });
        dispatch({ type: 'CLOSE_PANEL' });
      },
    },
    {
      id: 'add',
      icon: <Plus size={24} />,
      label: 'Add',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'add' }),
    },
    {
      id: 'layers',
      icon: <Layers size={22} />,
      label: 'Layers',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'layers' }),
    },
    {
      id: 'properties',
      icon: <SlidersHorizontal size={22} />,
      label: 'Style',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'properties' }),
      disabled: !hasSelection,
    },
    {
      id: 'export',
      icon: <Download size={22} />,
      label: 'Export',
      action: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'export' }),
    },
  ];

  if (penActive) {
    return (
      <div
        className="flex-shrink-0 flex items-start justify-around px-2 pt-3"
        style={{
          minHeight: '64px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          background: '#11141A',
          borderTop: '1px solid rgba(255,107,107,0.4)',
        }}
      >
        <button
          onClick={onPenCancel}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200"
          style={{ color: '#ff6b6b' }}
        >
          <X size={22} />
          <span className="text-[10px] font-medium leading-none">Cancel</span>
        </button>
        <div className="flex flex-col items-center gap-1 px-4 py-2">
          <PenTool size={22} style={{ color: '#00F5FF', filter: 'drop-shadow(0 0 6px #00F5FF80)' }} />
          <span className="text-[10px] font-medium leading-none" style={{ color: '#00F5FF' }}>Drawing</span>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_TOOL', payload: 'select' })}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200"
          style={{ color: '#6b7280' }}
        >
          <MousePointer2 size={22} />
          <span className="text-[10px] font-medium leading-none">Done</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 flex items-start justify-around px-2 pt-3"
      style={{
        minHeight: '64px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: '#11141A',
        borderTop: '1px solid rgba(0,245,255,0.15)',
      }}
      data-testid="bottom-toolbar"
    >
      {tools.map((tool) => {
        const isActive =
          tool.id === 'select'
            ? state.activeTool === 'select' && state.activePanel === null
            : state.activePanel === tool.id;

        return (
          <button
            key={tool.id}
            onClick={tool.disabled ? undefined : tool.action}
            disabled={tool.disabled}
            data-testid={`toolbar-${tool.id}`}
            className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 disabled:opacity-30"
            style={{
              color: isActive ? '#00F5FF' : '#6b7280',
              filter: isActive ? 'drop-shadow(0 0 6px #00F5FF80)' : 'none',
            }}
          >
            {tool.icon}
            <span className="text-[10px] font-medium leading-none">{tool.label}</span>
            {isActive && (
              <span
                className="absolute bottom-1 w-1 h-1 rounded-full"
                style={{ background: '#00F5FF', boxShadow: '0 0 4px #00F5FF' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
