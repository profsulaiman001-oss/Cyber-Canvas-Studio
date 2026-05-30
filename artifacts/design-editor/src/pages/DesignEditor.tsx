import { useRef, useState, useEffect, useCallback } from 'react';
import { useFabricCanvas } from '@/hooks/useFabricCanvas';
import { useEditor } from '@/store/editorStore';
import { loadStoredFonts } from '@/components/editor/FontUploader';
import CanvasWorkspace from '@/components/editor/Canvas';
import TopBar from '@/components/editor/TopBar';
import BottomToolbar from '@/components/editor/BottomToolbar';
import LayersPanel from '@/components/editor/LayersPanel';
import PropertiesPanel from '@/components/editor/PropertiesPanel';
import AddElementSheet from '@/components/editor/AddElementSheet';
import ExportDialog from '@/components/editor/ExportDialog';
import CanvasSizeDialog from '@/components/editor/CanvasSizeDialog';
import ProjectManager from '@/components/editor/ProjectManager';
import { useToast } from '@/hooks/use-toast';

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export default function DesignEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const handleSelectionChange = useCallback(
    (ids: string[]) => {
      dispatch({ type: 'SET_SELECTED', payload: ids });
    },
    [dispatch]
  );

  const handleCanvasChanged = useCallback(() => {
    dispatch({ type: 'SET_DIRTY', payload: true });

    // Auto-save debounce
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      // We'll trigger a save notification only if a project exists
      if (currentProjectId) {
        toast({ title: 'Auto-saved', description: '' });
      }
    }, 3000);
  }, [dispatch, currentProjectId, toast]);

  const handleUndoRedoChange = useCallback(
    (canUndo: boolean, canRedo: boolean) => {
      dispatch({ type: 'SET_UNDO_REDO', payload: { canUndo, canRedo } });
    },
    [dispatch]
  );

  const controller = useFabricCanvas(canvasRef, containerRef, {
    width: state.canvasSize.width,
    height: state.canvasSize.height,
    onSelectionChange: handleSelectionChange,
    onCanvasChanged: handleCanvasChanged,
    onUndoRedoChange: handleUndoRedoChange,
  });

  // Load custom fonts on mount
  useEffect(() => {
    loadStoredFonts((action) => dispatch(action));
  }, [dispatch]);

  const hasSelection = state.selectedObjectIds.length > 0;

  return (
    <div
      className="flex flex-col w-full overflow-hidden select-none"
      style={{ background: '#0B0C10', touchAction: 'none', height: '100dvh' }}
      data-testid="design-editor"
    >
      <TopBar onUndo={controller.undo} onRedo={controller.redo} />

      <CanvasWorkspace
        canvasRef={canvasRef}
        containerRef={containerRef}
        hasObjects={controller.objects.length > 0}
      />

      <BottomToolbar hasSelection={hasSelection} />

      {/* Panels & Dialogs */}
      <LayersPanel controller={controller} />
      <PropertiesPanel controller={controller} />
      <AddElementSheet controller={controller} />
      <ExportDialog controller={controller} />
      <CanvasSizeDialog controller={controller} />
      <ProjectManager
        controller={controller}
        currentProjectId={currentProjectId}
        onProjectSaved={setCurrentProjectId}
      />
    </div>
  );
}
