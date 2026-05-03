import { MousePointer2, Plus, Layers, SlidersHorizontal, Download } from 'lucide-react';
import { useEditor, ActivePanel } from '@/store/editorStore';

interface BottomToolbarProps {
  hasSelection: boolean;
}

export default function BottomToolbar({ hasSelection }: BottomToolbarProps) {
  const { state, dispatch } = useEditor();

  const tools: { id: ActivePanel | 'select'; icon: React.ReactNode; label: string; action: () => void; disabled?: boolean }[] = [
    {
      id: 'select',
      icon: <MousePointer2 size={22} />,
      label: 'Select',
      action: () => {
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

  return (
    <div
      className="flex-shrink-0 flex items-center justify-around px-2"
      style={{
        height: '64px',
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
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 disabled:opacity-30"
            style={{
              color: isActive ? '#00F5FF' : '#6b7280',
              filter: isActive ? 'drop-shadow(0 0 6px #00F5FF80)' : 'none',
            }}
          >
            {tool.icon}
            <span className="text-[10px] font-medium leading-none">{tool.label}</span>
            {isActive && (
              <span
                className="absolute bottom-2 w-1 h-1 rounded-full"
                style={{ background: '#00F5FF', boxShadow: '0 0 4px #00F5FF' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
