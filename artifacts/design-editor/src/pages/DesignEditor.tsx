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
import AlignmentPanel from '@/components/editor/AlignmentPanel';
import CanvasBgDialog from '@/components/editor/CanvasBgDialog';
import ColorStudioPanel from '@/components/editor/ColorStudioPanel';
import TextPanel from '@/components/editor/TextPanel';
import VectorOpsPanel from '@/components/editor/VectorOpsPanel';
import AdjustPanel from '@/components/editor/AdjustPanel';
import { useToast } from '@/hooks/use-toast';

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export default function DesignEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const [vpX, setVpX] = useState(0);
  const [vpY, setVpY] = useState(0);

  const handleSelectionChange = useCallback(
    (ids: string[]) => { dispatch({ type: 'SET_SELECTED', payload: ids }); },
    [dispatch]
  );

  const handleCanvasChanged = useCallback(() => {
    dispatch({ type: 'SET_DIRTY', payload: true });
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (currentProjectId) toast({ title: 'Auto-saved', description: '' });
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

  /* ── Directional Nudge Vector Engine Movement Pipeline ── */
  const handleNudgeElement = useCallback((direction: 'up' | 'down' | 'left' | 'right', amount: number) => {
    const activeObject = controller.selectedObject;
    const fabricCanvas = controller.getCanvas();

    if (!activeObject || !fabricCanvas) return;

    // Adjust positional metadata maps along correct canvas layout axes
    switch (direction) {
      case 'up':
        activeObject.set('top', (activeObject.top || 0) - amount);
        break;
      case 'down':
        activeObject.set('top', (activeObject.top || 0) + amount);
        break;
      case 'left':
        activeObject.set('left', (activeObject.left || 0) - amount);
        break;
      case 'right':
        activeObject.set('left', (activeObject.left || 0) + amount);
        break;
    }

    // Force vector matrix calculation and update canvas frames instantly
    activeObject.setCoords();
    fabricCanvas.renderAll();
    handleCanvasChanged();
  }, [controller, handleCanvasChanged]);

  // Load custom fonts on mount
  useEffect(() => { loadStoredFonts((action) => dispatch(action)); }, [dispatch]);

  // Sync grid options into canvas controller whenever they change
  useEffect(() => {
    controller.setGridOptions(state.gridEnabled, state.snapToGrid, state.gridSize);
  }, [state.gridEnabled, state.snapToGrid, state.gridSize, controller.setGridOptions]);

  // Track viewport position for grid overlay alignment
  useEffect(() => {
    const c = controller.getCanvas();
    if (!c) return;
    const onRender = () => {
      const vp = c.viewportTransform;
      if (vp) { setVpX(vp[4]); setVpY(vp[5]); }
    };
    c.on('after:render', onRender);
    return () => { c.off('after:render', onRender); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync canvas bg on mount
  useEffect(() => {
    controller.setCanvasBackground(state.canvasBg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Brush activation: whenever tool or brush params change ── */
  useEffect(() => {
    if (state.activeTool === 'brush') {
      controller.activateBrush(state.brushPreset, state.brushColor, state.brushSize);
    } else if (controller.isBrushActive) {
      controller.deactivateBrush();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTool, state.brushPreset, state.brushColor, state.brushSize]);

  const penActive = state.activeTool === 'pen';
  const brushActive = state.activeTool === 'brush';
  const hasSelection = state.selectedObjectIds.length > 0;

  const handlePenCancel = useCallback(() => {
    controller.cancelPenTool();
    dispatch({ type: 'SET_TOOL', payload: 'select' });
  }, [controller, dispatch]);

  const handleBrushDone = useCallback(() => {
    controller.deactivateBrush();
    dispatch({ type: 'SET_TOOL', payload: 'select' });
  }, [controller, dispatch]);

  const handleBrushColorChange = useCallback((color: string) => {
    dispatch({ type: 'SET_BRUSH_COLOR', payload: color });
  }, [dispatch]);

  const handleBrushSizeChange = useCallback((size: number) => {
    dispatch({ type: 'SET_BRUSH_SIZE', payload: size });
  }, [dispatch]);

  const [vectorEditActive, setVectorEditActive] = useState(false);

  const handleVectorEditStart = useCallback(() => {
    const obj = controller.selectedObject;
    if (!obj || obj.type !== 'path') return;
    controller.activateVectorEdit(obj);
    setVectorEditActive(true);
  }, [controller]);

  const handleVectorEditEnd = useCallback(() => {
    controller.deactivateVectorEdit();
    setVectorEditActive(false);
  }, [controller]);

  const handleGuideMove = useCallback((axis: 'h' | 'v', idx: number, newPos: number) => {
    const g = state.guides;
    dispatch({ type: 'SET_GUIDES', payload: { ...g, [axis]: g[axis].map((p: number, i: number) => i === idx ? newPos : p) } });
  }, [state.guides, dispatch]);

  /* ── Eyedropper: prefer native EyeDropper API, fall back to canvas sampler ── */
  const handleEyedropper = useCallback(async () => {
    // Native EyeDropper API (Chrome 95+, Edge 95+)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ('EyeDropper' in window && typeof (window as any).EyeDropper === 'function') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eyeDropper = new (window as any).EyeDropper();
        const result: { sRGBHex: string } = await eyeDropper.open();
        const color = result.sRGBHex;
        const obj = controller.selectedObject;
        if (obj) {
          obj.set('fill', color);
          controller.getCanvas()?.renderAll();
          controller.syncObjects();
          toast({ title: `Color applied: ${color.toUpperCase()}`, description: 'Picked from screen' });
        } else {
          toast({ title: `Color picked: ${color.toUpperCase()}`, description: 'Select an object to apply it' });
        }
      } catch {
        // User pressed Escape or browser denied — silently ignore
      }
      return;
    }

    // Fallback: canvas-based sampler (samples from the Fabric canvas on click)
    if (controller.eyedropperActive) {
      controller.deactivateEyedropper();
      return;
    }
    dispatch({ type: 'CLOSE_PANEL' });
    controller.activateEyedropper((color) => {
      const obj = controller.selectedObject;
      if (obj) {
        obj.set('fill', color);
        controller.getCanvas()?.renderAll();
        controller.syncObjects();
        toast({ title: `Color applied: ${color.toUpperCase()}`, description: 'Fill color updated from canvas sample' });
      } else {
        toast({ title: `Color picked: ${color.toUpperCase()}`, description: 'Select an object first to apply the color' });
      }
    });
  }, [controller, dispatch, toast]);

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
        gridEnabled={state.gridEnabled}
        gridSize={state.gridSize}
        transparentBg={state.canvasBg.type === 'transparent'}
        penPoints={controller.penPoints}
        penActive={penActive}
        onPenClose={controller.closePenPath}
        zoom={controller.zoom}
        vpX={vpX}
        vpY={vpY}
        dragInfo={controller.dragInfo}
        brushActive={brushActive}
        eyedropperActive={controller.eyedropperActive}

        // Dynamic live sizes hooked straight to layout engine states
        canvasWidth={state.canvasSize.width}
        canvasHeight={state.canvasSize.height}
        selectedElementId={state.selectedObjectIds[0] || null}
        onNudgeElement={handleNudgeElement}
        vectorAnchors={controller.vectorAnchors}
        onVectorAnchorDragStart={controller.vectorAnchorDragStart}
        onVectorAnchorDragMove={controller.vectorAnchorDragMove}
        onVectorAnchorDragEnd={controller.vectorAnchorDragEnd}
        guides={state.guides}
        gridLocked={state.gridLocked}
        onGuideMove={handleGuideMove}
      />

      <BottomToolbar
        hasSelection={hasSelection}
        penActive={penActive}
        brushActive={brushActive}
        selectedIsPath={controller.selectedObject?.type === 'path'}
        selectedIsText={controller.selectedObject?.type === 'i-text' || controller.selectedObject?.type === 'text'}
        selectedIsImage={controller.selectedObject?.type === 'image'}
        vectorEditActive={vectorEditActive}
        onPenCancel={handlePenCancel}
        onBrushDone={handleBrushDone}
        onBrushColorChange={handleBrushColorChange}
        onBrushSizeChange={handleBrushSizeChange}
        onNeonIntensityChange={(v) => dispatch({ type: 'SET_NEON_INTENSITY', payload: v })}
        onVectorEditStart={handleVectorEditStart}
        onVectorEditEnd={handleVectorEditEnd}
      />

      {/* Panels & Dialogs */}
      <LayersPanel controller={controller} />
      <PropertiesPanel controller={controller} />
      <ColorStudioPanel
        controller={controller}
        eyedropperActive={controller.eyedropperActive}
        onEyedropper={handleEyedropper}
      />
      <AddElementSheet controller={controller} />
      <ExportDialog controller={controller} />
      <CanvasSizeDialog controller={controller} />
      <AlignmentPanel controller={controller} />
      <CanvasBgDialog controller={controller} />
      <ProjectManager
        controller={controller}
        currentProjectId={currentProjectId}
        onProjectSaved={setCurrentProjectId}
      />
      <TextPanel controller={controller} />
      <VectorOpsPanel controller={controller} />
      <AdjustPanel controller={controller} />
    </div>
  );
}