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
import VectorNodePanel from '@/components/editor/VectorNodePanel';
import CropModal from '@/components/editor/CropModal';
import ColorPicker from '@/components/editor/ColorPicker';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Droplet, SquareRoundCorner } from 'lucide-react';

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/* Pixel multiplier used when rasterising any non-image canvas object for crop */
const RASTER_MULT = 2;

export default function DesignEditor() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const [vpX, setVpX] = useState(0);
  const [vpY, setVpY] = useState(0);

  const [brushColorPickerOpen, setBrushColorPickerOpen] = useState(false);

  /* ── Unified crop modal state ── */
  type CropMode = 'image' | 'fill' | 'raster';
  const [cropOpen,    setCropOpen]    = useState(false);
  const [cropMode,    setCropMode]    = useState<CropMode>('image');
  // fill mode
  const [pendingFillFile, setPendingFillFile] = useState<File | null>(null);
  const pendingFillTargetRef = useRef<import('fabric').FabricObject | null>(null);
  // raster mode
  const [rasterDataUrl, setRasterDataUrl] = useState('');
  const [rasterSrcW,    setRasterSrcW]    = useState(1);
  const [rasterSrcH,    setRasterSrcH]    = useState(1);
  const rasterObjRef     = useRef<import('fabric').FabricObject | null>(null);
  // Keep the original object's visual center and source-to-design scale so a
  // cropped raster replacement remains aligned for shapes, paths, groups, and
  // text.
  const rasterDesignLeft = useRef(0);
  const rasterDesignTop  = useRef(0);
  const rasterScaleX     = useRef(1 / RASTER_MULT);
  const rasterScaleY     = useRef(1 / RASTER_MULT);

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
    onCanvasChanged:   handleCanvasChanged,
    onUndoRedoChange:  handleUndoRedoChange,
  });

  /* ── Directional Nudge ── */
  const handleNudgeElement = useCallback((direction: 'up' | 'down' | 'left' | 'right', amount: number) => {
    const activeObject  = controller.selectedObject;
    const fabricCanvas  = controller.getCanvas();
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

  useEffect(() => { loadStoredFonts((action) => dispatch(action)); }, [dispatch]);

  useEffect(() => {
    controller.setGridOptions(state.gridEnabled, state.snapToGrid, state.gridSize);
  }, [state.gridEnabled, state.snapToGrid, state.gridSize, controller.setGridOptions]);

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

  useEffect(() => {
    controller.setCanvasBackground(state.canvasBg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.canvasBg]);

  useEffect(() => {
    if (state.activeTool === 'brush') {
      controller.activateBrush(state.brushPreset, state.brushColor, state.brushSize);
    } else if (controller.isBrushActive) {
      controller.deactivateBrush();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTool, state.brushPreset, state.brushColor, state.brushSize]);

  useEffect(() => {
    controller.setPanMode(state.activeTool === 'pan');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTool]);

  useEffect(() => {
    if (state.activeTool !== 'brush') setBrushColorPickerOpen(false);
  }, [state.activeTool]);

  const penActive    = state.activeTool === 'pen';
  const brushActive  = state.activeTool === 'brush';
  const panActive    = state.activeTool === 'pan';
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
    controller.setSelectedVectorAnchorIdx(null);
  }, [controller]);

  const handleReactivatePen = useCallback(() => {
    controller.deactivateVectorEdit();
    controller.setSelectedVectorAnchorIdx(null);
    controller.activatePenTool();
    dispatch({ type: 'SET_TOOL', payload: 'pen' });
  }, [controller, dispatch]);

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

  const handleVectorsPenStart = useCallback(() => {
    controller.activatePenTool();
    dispatch({ type: 'SET_TOOL', payload: 'pen' });
  }, [controller, dispatch]);

  const zoomPercent = Math.round(controller.zoom * 100);

  /* ── Quick-tray: object opacity + corner radius ── */
  const [quickFillOpacity, setQuickFillOpacity] = useState(100);
  const [quickCornerRadius, setQuickCornerRadius] = useState(0);
  const [quickCornerRadiusMax, setQuickCornerRadiusMax] = useState(50);

  useEffect(() => {
    const obj = controller.selectedObject;
    if (!obj) { setQuickFillOpacity(100); setQuickCornerRadius(0); return; }
    // The toolbar opacity control is object-wide. Reading obj.opacity works
    // for images, text, groups, paths, and standard vector shapes alike.
    setQuickFillOpacity(Math.round((obj.opacity ?? 1) * 100));
    if (obj.type === 'rect') {
      const rx = (obj as import('fabric').FabricObject & { rx?: number }).rx ?? 0;
      const scaleX = (obj.scaleX ?? 1) || 1;
      const scaleY = (obj.scaleY ?? 1) || 1;
      setQuickCornerRadius(Math.round(rx * scaleX));
      // Recompute max from the object's *current* scaled dimensions so the
      // Slider always reflects the live geometry — important when the panel
      // is (re-)opened after the object has been resized.
      setQuickCornerRadiusMax(Math.max(4, Math.min(
        Math.round(obj.getScaledWidth() / 2),
        Math.round(obj.getScaledHeight() / 2),
      )));
      void scaleY; // used above for rxMax via getScaledHeight
    } else {
      setQuickCornerRadius(0);
    }
  // Include activePanel so re-opening the radius tray always re-syncs the
  // max from live object dimensions (fixes the stale-max / two-step bug).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller.selectedObject, state.activePanel]);

  const handleFillOpacityChange = useCallback((v: number) => {
    setQuickFillOpacity(v);
    const obj = controller.selectedObject;
    if (!obj) return;
    const opacityValue = Math.max(0, Math.min(1, v / 100));
    // Apply opacity directly to the selected Fabric object. This must not be
    // fill-only because images and non-shape objects may have no string fill
    // or gradient color stops to modify.
    obj.set('opacity', opacityValue);
    obj.setCoords();
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
  }, [controller]);

  const handleCornerRadiusChange = useCallback((v: number) => {
    const obj = controller.selectedObject;
    if (!obj || obj.type !== 'rect') return;
    const scaleX = (obj.scaleX ?? 1) || 1;
    const scaleY = (obj.scaleY ?? 1) || 1;
    // Recompute the true geometric max from the live object dimensions so that
    // even if the Slider's `max` prop was stale (and emitted a clamped value),
    // we detect the user is at 100% of the rail and apply the real maximum.
    // Formula: max screen-space radius = min(scaledW, scaledH) / 2
    const liveMax = Math.max(4, Math.min(
      Math.round(obj.getScaledWidth() / 2),
      Math.round(obj.getScaledHeight() / 2),
    ));
    // If the incoming v equals the slider's (potentially stale) max, treat it
    // as a request for full rounding and promote it to the live max.
    const resolvedV = (quickCornerRadiusMax > 0 && v === quickCornerRadiusMax) ? liveMax : Math.min(v, liveMax);
    setQuickCornerRadius(resolvedV);
    // Keep slider max in sync with live geometry for subsequent drags.
    if (liveMax !== quickCornerRadiusMax) setQuickCornerRadiusMax(liveMax);
    // Convert screen-space radius to local (unscaled) space for Fabric, and
    // hard-cap at obj.width/2 & obj.height/2 — the values Fabric itself clamps
    // to — so the shape always fully rounds on the first interaction.
    const localW = (obj as import('fabric').FabricObject & { width?: number }).width ?? 0;
    const localH = (obj as import('fabric').FabricObject & { height?: number }).height ?? 0;
    const rx = Math.min(resolvedV / scaleX, localW / 2);
    const ry = Math.min(resolvedV / scaleY, localH / 2);
    // Mark dirty explicitly so Fabric 6 re-draws rounded corners immediately
    // on the very first slider interaction (without dirty=true the cached
    // texture is reused and the change is invisible).
    obj.set({ rx, ry });
    obj.dirty = true;
    controller.getCanvas()?.requestRenderAll();
    controller.commitChange();
  }, [controller, quickCornerRadiusMax]);

  /* ── Image toolbar actions ── */
  const importImagesRef = useRef<HTMLInputElement>(null);
  const fillWithImageRef = useRef<HTMLInputElement>(null);

  const handleImportImages = useCallback(() => { importImagesRef.current?.click(); }, []);

  const handleImportImageFiles = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      await controller.addImageFromFile(file);
    }
  }, [controller]);

  const handleFillWithImage = useCallback(() => { fillWithImageRef.current?.click(); }, []);

  /* Fill-with-image: store target + file, open CropModal in fill mode */
  const handleFillImageFile = useCallback((file: File) => {
    const obj = controller.selectedObject;
    if (!obj) return;
    pendingFillTargetRef.current = obj;
    setPendingFillFile(file);
    setCropMode('fill');
    setCropOpen(true);
  }, [controller]);

  /* ── Universal crop handler ── */
  const handleCropImage = useCallback(() => {
    const obj = controller.selectedObject;
    if (!obj) return;

    if (obj.type === 'image') {
      // Fabric-native crop via cropX/cropY
      const image = obj as import('fabric').FabricImage;
      const element = image.getElement?.() as HTMLImageElement | undefined;
      const sourceW = element?.naturalWidth || element?.width || obj.width || 1;
      const sourceH = element?.naturalHeight || element?.height || obj.height || 1;
      rasterObjRef.current = obj;
      rasterDesignLeft.current = obj.left ?? 0;
      rasterDesignTop.current = obj.top ?? 0;
      rasterScaleX.current = (obj.getScaledWidth() || sourceW) / sourceW;
      rasterScaleY.current = (obj.getScaledHeight() || sourceH) / sourceH;
      setCropMode('image');
      setCropOpen(true);
      return;
    }

    // Any other object (vector, text, group…) → render the object itself.
    // Fabric's object renderer handles gradients, patterns, clip paths,
    // grouped children, text, pen paths, and custom shapes without bringing
    // the canvas background or viewport transform into the crop source.
    try {
      const renderObject = (obj as import('fabric').FabricObject & {
        toCanvasElement?: (options?: Record<string, unknown>) => HTMLCanvasElement;
      }).toCanvasElement;
      if (!renderObject) throw new Error('Object renderer unavailable');
      const offscreen = renderObject.call(obj, {
        multiplier: RASTER_MULT,
        enableRetinaScaling: false,
      });
      if (!offscreen?.width || !offscreen.height) throw new Error('Object renderer returned an empty canvas');

      rasterObjRef.current     = obj;
      rasterDesignLeft.current = obj.left ?? 0;
      rasterDesignTop.current  = obj.top ?? 0;
      rasterScaleX.current     = (obj.getScaledWidth() || offscreen.width / RASTER_MULT) / offscreen.width;
      rasterScaleY.current     = (obj.getScaledHeight() || offscreen.height / RASTER_MULT) / offscreen.height;
      setRasterDataUrl(offscreen.toDataURL('image/png'));
      setRasterSrcW(offscreen.width);
      setRasterSrcH(offscreen.height);
      setCropMode('raster');
      setCropOpen(true);
    } catch {
      toast({ title: 'Cannot prepare selection', description: 'This object could not be rendered for cropping', variant: 'destructive' });
    }
  }, [controller, toast]);

  /* ── Crop apply callbacks ── */
  const handleApplyImage = useCallback((
    cropX: number, cropY: number, cropW: number, cropH: number, circular: boolean,
  ) => {
    const obj = controller.selectedObject;
    if (!obj) return;
    controller.cropImage(obj, cropX, cropY, cropW, cropH);
    if (circular) controller.applyCircularCrop(obj);
  }, [controller]);

  const handleApplyFill = useCallback((canvas: HTMLCanvasElement) => {
    const obj = pendingFillTargetRef.current;
    if (obj) controller.fillShapeWithImage(obj, canvas);
    setPendingFillFile(null);
    pendingFillTargetRef.current = null;
  }, [controller]);

  const handleApplyRaster = useCallback(async (
    canvas: HTMLCanvasElement,
    circular: boolean,
    cropX = 0,
    cropY = 0,
    cropW = canvas.width,
    cropH = canvas.height,
  ) => {
    const obj = rasterObjRef.current;
    const fabricCanvas = controller.getCanvas();
    if (!obj || !fabricCanvas) return;
    // If circular was requested, clip the output canvas to a circle before adding
    if (circular) {
      const cw = canvas.width, ch = canvas.height;
      const tmp = document.createElement('canvas');
      tmp.width = cw; tmp.height = ch;
      const ctx2d = tmp.getContext('2d')!;
      ctx2d.beginPath();
      ctx2d.ellipse(cw / 2, ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
      ctx2d.clip();
      ctx2d.drawImage(canvas, 0, 0);
      canvas = tmp;
    }

    // Move the replacement by the crop's center offset. The source is in
    // raster pixels, while the refs store the original object's center in
    // Fabric design units. Transformed previews already contain their flip
    // or rotation, so the replacement itself starts at angle zero.
    const offsetX = (cropX + cropW / 2 - rasterSrcW / 2) * rasterScaleX.current;
    const offsetY = (cropY + cropH / 2 - rasterSrcH / 2) * rasterScaleY.current;
    const replacementLeft = rasterDesignLeft.current + offsetX;
    const replacementTop = rasterDesignTop.current + offsetY;

    // Remove original, add the raster crop at the adjusted design position
    fabricCanvas.remove(obj);
    await controller.addRasterLayer(
      canvas,
      replacementLeft,
      replacementTop,
      RASTER_MULT,
      {
        scaleX: rasterScaleX.current,
        scaleY: rasterScaleY.current,
      },
    );
    rasterObjRef.current = null;
  }, [controller, rasterSrcW, rasterSrcH]);

  const closeCrop = useCallback(() => {
    setCropOpen(false);
    setPendingFillFile(null);
    pendingFillTargetRef.current = null;
  }, []);

  return (
    <div
      className="flex flex-col w-full overflow-hidden select-none"
      style={{ background: '#0B0C10', touchAction: 'none', height: '100dvh' }}
      data-testid="design-editor"
    >
      <TopBar
        onUndo={controller.undo}
        onRedo={controller.redo}
        onCopy={controller.copySelected}
        onPaste={controller.pasteSelected}
      />

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
        panActive={panActive}
        penLiveHandle={controller.penLiveHandle}
        selectedAnchorIdx={controller.selectedVectorAnchorIdx}
      />

      {/* Hidden file inputs */}
      <input
        ref={importImagesRef}
        type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files?.length) { handleImportImageFiles(e.target.files); e.target.value = ''; } }}
      />
      <input
        ref={fillWithImageRef}
        type="file" accept="image/*" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) { handleFillImageFile(e.target.files[0]); e.target.value = ''; } }}
      />

      {/* ── Toolbar wrapper ── */}
      <div className="relative flex-shrink-0">
        <ShadowsPanel controller={controller} />
        <ThreeDPanel controller={controller} />

        {/* Brush Color Picker overlay */}
        {brushActive && brushColorPickerOpen && (
          <div
            className="absolute bottom-full left-0 right-0 z-50 px-4 pt-4 pb-3"
            style={{ background: '#11141A', borderTop: '1px solid rgba(0,245,255,0.3)', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}
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

        {/* Nudge overlay */}
        <div className="absolute bottom-full left-0 right-0 z-50">
          <NudgePanel onNudge={handleNudgeElement} />
        </div>

        {/* Vector Node Panel — replaces nudge/zoom trays when in vector edit mode */}
        {vectorEditActive && (
          <div className="absolute bottom-full left-0 right-0 z-50">
            <VectorNodePanel
              vectorAnchors={controller.vectorAnchors}
              selectedAnchorIdx={controller.selectedVectorAnchorIdx}
              onSelectAnchor={controller.setSelectedVectorAnchorIdx}
              onAddNode={controller.addVectorNodeAfter}
              onDeleteNode={controller.deleteSelectedVectorNode}
              onNudgeNode={controller.nudgeSelectedVectorNode}
              onDone={handleVectorEditEnd}
              onReactivatePen={handleReactivatePen}
            />
          </div>
        )}

        {/* Zoom Tray overlay */}
        {state.activePanel === 'zoom' && !brushActive && !penActive && (
          <div
            className="absolute bottom-full left-0 right-0 z-50 px-4 py-3"
            style={{ background: '#11141A', borderTop: '1px solid rgba(0,245,255,0.4)', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center gap-2 mb-2 justify-between">
              <p className="text-xs font-semibold tracking-wider" style={{ color: '#00F5FF' }}>ZOOM</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={controller.zoomOut}
                  className="text-[10px] w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                  style={{ background: 'rgba(0,245,255,0.12)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.3)' }}
                >−</button>
                <span className="text-xs font-mono font-bold min-w-[52px] text-center" style={{ color: '#00F5FF' }}>{zoomPercent}%</span>
                <button
                  onClick={controller.zoomIn}
                  className="text-[10px] w-7 h-7 rounded-lg flex items-center justify-center font-bold"
                  style={{ background: 'rgba(0,245,255,0.12)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.3)' }}
                >+</button>
                <button
                  onClick={controller.resetZoom}
                  className="text-[10px] px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(0,245,255,0.08)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.2)' }}
                >Fit</button>
              </div>
            </div>
            <Slider
              min={10} max={100} step={5}
              value={[zoomPercent]}
              onValueChange={([v]) => controller.setZoomLevel(v)}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-muted-foreground">10%</span>
              <span className="text-[9px] text-muted-foreground">50%</span>
              <span className="text-[9px] text-muted-foreground">100%</span>
            </div>
          </div>
        )}

        {/* Opacity Tool overlay — compact micro-panel, only shown when eligible object is selected */}
        {state.activePanel === 'opacity-tool' && hasSelection && !brushActive && !penActive && !vectorEditActive && (
          <div
            className="absolute bottom-full left-0 right-0 z-50 px-4 py-3"
            style={{ background: '#11141A', borderTop: '1px solid rgba(0,245,255,0.4)', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center gap-3">
              <Droplet size={14} style={{ color: '#00F5FF', flexShrink: 0 }} />
              <span className="text-xs font-semibold tracking-wider shrink-0" style={{ color: '#00F5FF' }}>OPACITY</span>
              <span className="text-[10px] font-medium tabular-nums shrink-0" style={{ color: '#00F5FF', minWidth: '30px', textAlign: 'right' }}>
                {quickFillOpacity}%
              </span>
              <Slider
                min={0} max={100} step={1}
                value={[quickFillOpacity]}
                onValueChange={([v]) => handleFillOpacityChange(v)}
                className="flex-1"
              />
              <button
                onClick={() => dispatch({ type: 'CLOSE_PANEL' })}
                className="text-[10px] px-2 py-1 rounded-lg shrink-0"
                style={{ background: 'rgba(0,245,255,0.1)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.3)' }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Corner Radius Tool overlay — compact micro-panel, only shown for rect objects */}
        {state.activePanel === 'radius-tool' && hasSelection && selectedType === 'rect' && !brushActive && !penActive && !vectorEditActive && (
          <div
            className="absolute bottom-full left-0 right-0 z-50 px-4 py-3"
            style={{ background: '#11141A', borderTop: '1px solid rgba(0,245,255,0.3)', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center gap-3">
              <SquareRoundCorner size={14} style={{ color: '#00F5FF', flexShrink: 0 }} />
              <span className="text-xs font-semibold tracking-wider shrink-0" style={{ color: '#00F5FF' }}>RADIUS</span>
              <span className="text-[10px] font-medium tabular-nums shrink-0" style={{ color: '#00F5FF', minWidth: '24px', textAlign: 'right' }}>
                {quickCornerRadius}
              </span>
              <Slider
                min={0} max={quickCornerRadiusMax} step={1}
                value={[quickCornerRadius]}
                onValueChange={([v]) => handleCornerRadiusChange(v)}
                className="flex-1"
              />
              <button
                onClick={() => dispatch({ type: 'CLOSE_PANEL' })}
                className="text-[10px] px-2 py-1 rounded-lg shrink-0"
                style={{ background: 'rgba(0,245,255,0.1)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.3)' }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        <StrokePanel controller={controller} />

        <BottomToolbar
          hasSelection={hasSelection}
          penActive={penActive}
          brushActive={brushActive}
          panActive={panActive}
          selectedIsPath={selectedType === 'path'}
          selectedIsText={selectedIsText}
          selectedIsImage={selectedType === 'image'}
          isRect={selectedType === 'rect'}
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
          onImportImages={handleImportImages}
          onFillWithImage={handleFillWithImage}
          onCropImage={handleCropImage}
        />
      </div>

      {/* ── Unified Crop Modal — handles image, fill, and any-object (raster) modes ── */}
      <CropModal
        open={cropOpen}
        onClose={closeCrop}
        mode={cropMode}
        fabricObj={cropMode === 'image' ? controller.selectedObject : null}
        file={cropMode === 'fill' ? pendingFillFile : null}
        dataUrl={cropMode === 'raster' ? rasterDataUrl : undefined}
        sourceW={cropMode === 'raster' ? rasterSrcW : undefined}
        sourceH={cropMode === 'raster' ? rasterSrcH : undefined}
        onApplyImage={handleApplyImage}
        onApplyFill={handleApplyFill}
        onApplyRaster={handleApplyRaster}
         onFlipH={cropMode === 'fill' ? undefined : () => controller.flipHorizontal()}
         onFlipV={cropMode === 'fill' ? undefined : () => controller.flipVertical()}
         onRotate90={cropMode === 'fill' ? undefined : () => controller.rotate90()}
      />

      {/* Panels & Dialogs */}
      <LayersPanel controller={controller} />
      <PropertiesPanel controller={controller} onCrop={handleCropImage} />
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
      <AdjustPanel controller={controller} />
      <VectorsPanel controller={controller} onPenStart={handleVectorsPenStart} />
    </div>
  );
}
