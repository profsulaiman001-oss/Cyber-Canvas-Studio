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
import ShapeModifiersPanel from '@/components/editor/ShapeModifiersPanel';
import NudgePanel from '@/components/editor/NudgePanel';
import AdjustPanel from '@/components/editor/AdjustPanel';
import StrokePanel from '@/components/editor/StrokePanel';
import ShadowsPanel from '@/components/editor/ShadowsPanel';
import ThreeDPanel from '@/components/editor/ThreeDPanel';
import VectorsPanel from '@/components/editor/VectorsPanel';
import ColorPicker from '@/components/editor/ColorPicker';
import { Slider } from '@/components/ui/slider';
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

  // Brush color picker as floating overlay (no layout shift on canvas)
  const [brushColorPickerOpen, setBrushColorPickerOpen] = useState(false);

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

  /* ── Directional Nudge — each step is its own undo entry ── */
  const handleNudgeElement = useCallback((direction: 'up' | 'down' | 'left' | 'right', amount: number) => {
    const activeObject = controller.selectedObject;
    const fabricCanvas = controller.getCanvas();
    if (!activeObject || !fabricCanvas) return;

    switch (direction) {
      case 'up':    activeObject.set('top',  (activeObject.top  || 0) - amount); break;
      case 'down':  activeObject.set('top',  (activeObject.top  || 0) + amount); break;
      case 'left':  activeObject.set('left', (activeObject.left || 0) - amount); break;
      case 'right': activeObject.set('left', (activeObject.left || 0) + amount); break;
    }
    activeObject.setCoords();
    fabricCanvas.renderAll();
    controller.pushUndoNow();
  }, [controller]);

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

  /* ── Brush activation ── */
  useEffect(() => {
    if (state.activeTool === 'brush') {
      controller.activateBrush(state.brushPreset, state.brushColor, state.brushSize);
    } else if (controller.isBrushActive) {
      controller.deactivateBrush();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTool, state.brushPreset, state.brushColor, state.brushSize]);

  /* ── Pan mode ── */
  useEffect(() => {
    controller.setPanMode(state.activeTool === 'pan');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTool]);

  /* ── Close brush picker when brush deactivates ── */
  useEffect(() => {
    if (state.activeTool !== 'brush') {
      setBrushColorPickerOpen(false);
    }
  }, [state.activeTool]);

  const penActive = state.activeTool === 'pen';
  const brushActive = state.activeTool === 'brush';
  const panActive = state.activeTool === 'pan';
  const hasSelection = state.selectedObjectIds.length > 0;
  const selectedType = controller.selectedObject?.type || '';
  const selectedIsText = ['i-text', 'text', 'textbox'].includes(selectedType);

  const handlePenCancel = useCallback(() => {
    controller.cancelPenTool();
    dispatch({ type: 'SET_TOOL', payload: 'select' });
  }, [controller, dispatch]);

  const handleBrushDone = useCallback(() => {
    controller.deactivateBrush();
    setBrushColorPickerOpen(false);
    dispatch({ type: 'SET_TOOL', payload: 'select' });
  }, [controller, dispatch]);

  const handleBrushColorChange = useCallback((color: string) => {
    dispatch({ type: 'SET_BRUSH_COLOR', payload: color });
  }, [dispatch]);

  const handleBrushSizeChange = useCallback((size: number) => {
    dispatch({ type: 'SET_BRUSH_SIZE', payload: size });
  }, [dispatch]);

  const vectorEditActive = controller.isVectorEditActive;

  const handleVectorEditStart = useCallback(() => {
    const obj = controller.selectedObject ?? controller.getCanvas()?.getActiveObject() ?? null;
    if (!obj || obj.type !== 'path') return;
    controller.activateVectorEdit(obj as import('fabric').FabricObject);
  }, [controller]);

  const handleVectorEditEnd = useCallback(() => {
    controller.deactivateVectorEdit();
  }, [controller]);

  const handleGuideMove = useCallback((axis: 'h' | 'v', idx: number, newPos: number) => {
    const g = state.guides;
    dispatch({ type: 'SET_GUIDES', payload: { ...g, [axis]: g[axis].map((p: number, i: number) => i === idx ? newPos : p) } });
  }, [state.guides, dispatch]);

  /* ── Eyedropper ── */
  const handleEyedropper = useCallback(async () => {
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
      } catch { /* user cancelled */ }
      return;
    }

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

  /* ── Vector pen start (from VectorsPanel) ── */
  const handleVectorsPenStart = useCallback(() => {
    controller.activatePenTool();
    dispatch({ type: 'SET_TOOL', payload: 'pen' });
  }, [controller, dispatch]);

  const zoomPercent = Math.round(controller.zoom * 100);

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
        canvasWidth={state.canvasSize.width}
        canvasHeight={state.canvasSize.height}
        vectorAnchors={controller.vectorAnchors}
        onVectorAnchorDragStart={controller.vectorAnchorDragStart}
        onVectorAnchorDragMove={controller.vectorAnchorDragMove}
        onVectorAnchorDragEnd={controller.vectorAnchorDragEnd}
        guides={state.guides}
        gridLocked={state.gridLocked}
        onGuideMove={handleGuideMove}
      />

      {/* ── Toolbar wrapper — position:relative so overlays float above without layout impact ── */}
      <div className="relative flex-shrink-0">

        {/* ── Brush Color Picker overlay — absolute, sits above toolbar, no canvas resize ── */}
        {brushActive && brushColorPickerOpen && (
          <div
            className="absolute bottom-full left-0 right-0 z-50 px-4 pt-4 pb-3"
            style={{
              background: '#11141A',
              borderTop: '1px solid rgba(0,245,255,0.3)',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold tracking-wider" style={{ color: '#00F5FF' }}>BRUSH COLOR</p>
              <button
                onClick={() => setBrushColorPickerOpen(false)}
                className="text-[10px] px-3 py-1 rounded-full"
                style={{ background: 'rgba(0,245,255,0.12)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.3)' }}
              >
                Close
              </button>
            </div>
            <ColorPicker value={state.brushColor} onChange={handleBrushColorChange} />
          </div>
        )}

        {/* ── Zoom Tray overlay — absolute, sits above toolbar ── */}
        {state.activePanel === 'zoom' && !brushActive && !penActive && (
          <div
            className="absolute bottom-full left-0 right-0 z-50 px-4 py-3"
            style={{
              background: '#11141A',
              borderTop: '1px solid rgba(167,139,250,0.4)',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center gap-2 mb-2 justify-between">
              <p className="text-xs font-semibold tracking-wider" style={{ color: '#a78bfa' }}>ZOOM</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={controller.zoomOut}
                  className="text-[10px] w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                  style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
                >
                  −
                </button>
                <span
                  className="text-xs font-mono font-bold min-w-[52px] text-center"
                  style={{ color: '#a78bfa' }}
                >
                  {zoomPercent}%
                </span>
                <button
                  onClick={controller.zoomIn}
                  className="text-[10px] w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                  style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
                >
                  +
                </button>
                <button
                  onClick={controller.resetZoom}
                  className="text-[10px] px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}
                >
                  Fit
                </button>
              </div>
            </div>
            <Slider
              min={10} max={500} step={5}
              value={[zoomPercent]}
              onValueChange={([v]) => controller.setZoomLevel(v)}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-muted-foreground">10%</span>
              <span className="text-[9px] text-muted-foreground">100%</span>
              <span className="text-[9px] text-muted-foreground">500%</span>
            </div>
          </div>
        )}

        <BottomToolbar
          hasSelection={hasSelection}
          penActive={penActive}
          brushActive={brushActive}
          panActive={panActive}
          selectedIsPath={selectedType === 'path'}
          selectedIsText={selectedIsText}
          selectedIsImage={selectedType === 'image'}
          vectorEditActive={vectorEditActive}
          onPenCancel={handlePenCancel}
          onBrushDone={handleBrushDone}
          onBrushColorChange={handleBrushColorChange}
          onBrushSizeChange={handleBrushSizeChange}
          onNeonIntensityChange={(v) => dispatch({ type: 'SET_NEON_INTENSITY', payload: v })}
          onVectorEditStart={handleVectorEditStart}
          onVectorEditEnd={handleVectorEditEnd}
          brushColorPickerOpen={brushColorPickerOpen}
          onToggleBrushColorPicker={() => setBrushColorPickerOpen((o) => !o)}
        />
      </div>

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
      <ShapeModifiersPanel controller={controller} />
      <NudgePanel onNudge={handleNudgeElement} />
      <AdjustPanel controller={controller} />
      <StrokePanel controller={controller} />
      <ShadowsPanel controller={controller} />
      <ThreeDPanel controller={controller} />
      <VectorsPanel controller={controller} onPenStart={handleVectorsPenStart} />
    </div>
  );
}
