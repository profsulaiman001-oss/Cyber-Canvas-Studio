import { useRef, useState, useEffect, useCallback } from 'react';
import { useFabricCanvas } from '@/hooks/useFabricCanvas';
import { getActiveProjectId, loadProjectById, useProjects } from '@/hooks/useProjects';
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
import CanvasBgDialog, { type BackgroundEyedropperContext } from '@/components/editor/CanvasBgDialog';
import ColorStudioPanel, { type ColorStudioEyedropperContext } from '@/components/editor/ColorStudioPanel';
import TextPanel from '@/components/editor/TextPanel';
import ShapeModifiersPanel from '@/components/editor/ShapeModifiersPanel';
import NudgePanel from '@/components/editor/NudgePanel';
import AdjustPanel from '@/components/editor/AdjustPanel';
import ZoomPanel from '@/components/editor/ZoomPanel';
import TransformPanel from '@/components/editor/TransformPanel';
import StrokePanel from '@/components/editor/StrokePanel';
import ShadowsPanel from '@/components/editor/ShadowsPanel';
import ThreeDPanel from '@/components/editor/ThreeDPanel';
import VectorsPanel from '@/components/editor/VectorsPanel';
import VectorNodePanel from '@/components/editor/VectorNodePanel';
import CropModal from '@/components/editor/CropModal';
import BrushPanel from '@/components/editor/BrushPanel';
import KeyboardShortcutsDialog from '@/components/editor/KeyboardShortcutsDialog';
import ContextMenu, { type ContextMenuActions } from '@/components/editor/ContextMenu';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useContextMenu } from '@/hooks/useContextMenu';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, Eye, SquareRoundCorner } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* Pixel multiplier used when rasterising any non-image canvas object for crop */
const RASTER_MULT = 2;

export default function DesignEditor() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [sampledColor, setSampledColor] = useState<string | null>(null);
  const [sampledColorCommitted, setSampledColorCommitted] = useState<string | null>(null);
  const eyedropperTargetRef = useRef<ReturnType<typeof useFabricCanvas>['selectedObject']>(null);
  const eyedropperPanelRef = useRef<'colorStudio' | 'canvasBg'>('colorStudio');
  const eyedropperGradientContextRef = useRef<ColorStudioEyedropperContext>({
    mode: 'solid',
    selectedStop: 0,
  });
  const backgroundEyedropperContextRef = useRef<BackgroundEyedropperContext>({
    mode: 'solid',
    selectedStop: 0,
  });
  const lastEyedropperColorRef = useRef<string | null>(null);
  const eyedropperWasActiveRef = useRef(false);
  const { saveProject: persistProject } = useProjects();
  const currentProjectIdRef = useRef<string | null>(null);
  const editorStateRef = useRef(state);
  const controllerRef = useRef<ReturnType<typeof useFabricCanvas> | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeAttemptedRef = useRef(false);
  const pendingProjectActionRef = useRef<(() => Promise<void>) | null>(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exitBusy, setExitBusy] = useState(false);

  currentProjectIdRef.current = currentProjectId;
  editorStateRef.current = state;

  const [vpX, setVpX] = useState(0);
  const [vpY, setVpY] = useState(0);

  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const importImagesRef = useRef<HTMLInputElement>(null);
  const fillWithImageRef = useRef<HTMLInputElement>(null);
  const handleImportImages = useCallback(() => { importImagesRef.current?.click(); }, []);
  type RadiusTarget = 'all' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  const [radiusTarget, setRadiusTarget] = useState<RadiusTarget>('all');

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
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const projectId = currentProjectIdRef.current;
    if (!projectId) return;
    autoSaveTimerRef.current = setTimeout(async () => {
      const activeController = controllerRef.current;
      const latestState = editorStateRef.current;
      if (!activeController || (projectId !== null && currentProjectIdRef.current !== projectId)) return;
      const canvas = activeController.getCanvas();
      if (!canvas) return;
      try {
        const thumbnail = canvas.toDataURL({
          format: 'jpeg',
          quality: 0.3,
          multiplier: Math.min(200 / latestState.canvasSize.width, 200 / latestState.canvasSize.height),
        });
        const project = await persistProject(
          projectId,
          latestState.projectName,
          activeController.getJSON(),
          thumbnail,
          latestState.canvasSize.width,
          latestState.canvasSize.height,
        );
        if (currentProjectIdRef.current === projectId || projectId === null) {
          currentProjectIdRef.current = project.id;
          setCurrentProjectId(project.id);
          dispatch({ type: 'SET_DIRTY', payload: false });
        }
      } catch {
        // Manual Save remains available if a browser storage write fails.
      }
    }, 3000);
  }, [dispatch, persistProject]);

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
  controllerRef.current = controller;
  const {
    position: contextMenu,
    onContextMenu: handleCanvasContextMenu,
    onLongPress: handleCanvasLongPress,
    close: closeContextMenu,
  } = useContextMenu(controller);

  const saveCurrentProject = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const activeController = controllerRef.current ?? controller;
    const canvas = activeController.getCanvas();
    if (!canvas) return;
    const latestState = editorStateRef.current;
    const project = await persistProject(
      currentProjectIdRef.current,
      latestState.projectName,
      activeController.getJSON(),
      canvas.toDataURL({
        format: 'jpeg',
        quality: 0.3,
        multiplier: Math.min(200 / latestState.canvasSize.width, 200 / latestState.canvasSize.height),
      }),
      latestState.canvasSize.width,
      latestState.canvasSize.height,
    );
    currentProjectIdRef.current = project.id;
    setCurrentProjectId(project.id);
    dispatch({ type: 'SET_DIRTY', payload: false });
  }, [controller, dispatch, persistProject]);

  const createNewProject = useCallback(async () => {
    if (!window.confirm('Create a new project? Any unsaved changes will be replaced.')) return;
    const activeController = controllerRef.current ?? controller;
    const canvas = activeController.getCanvas();
    if (!canvas) return;
    const latestState = editorStateRef.current;
    await activeController.loadFromJSON({ version: '7.3.1', objects: [], background: '#ffffff' });
    canvas.renderAll();
    const project = await persistProject(
      null,
      'Untitled Design',
      activeController.getJSON(),
      canvas.toDataURL({
        format: 'jpeg',
        quality: 0.3,
        multiplier: Math.min(200 / latestState.canvasSize.width, 200 / latestState.canvasSize.height),
      }),
      latestState.canvasSize.width,
      latestState.canvasSize.height,
    );
    currentProjectIdRef.current = project.id;
    setCurrentProjectId(project.id);
    dispatch({ type: 'SET_PROJECT_NAME', payload: 'Untitled Design' });
    dispatch({ type: 'SET_DIRTY', payload: false });
    dispatch({ type: 'CLOSE_PANEL' });
  }, [controller, dispatch, persistProject]);

  const discardUnsavedChanges = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const activeController = controllerRef.current ?? controller;
    const projectId = currentProjectIdRef.current;
    if (projectId) {
      const savedProject = await loadProjectById(projectId);
      if (savedProject) {
        await activeController.loadFromJSON(savedProject.canvasJSON);
        activeController.setCanvasSize(savedProject.canvasWidth, savedProject.canvasHeight);
        dispatch({ type: 'SET_PROJECT_NAME', payload: savedProject.name });
        dispatch({ type: 'SET_CANVAS_SIZE', payload: { width: savedProject.canvasWidth, height: savedProject.canvasHeight } });
      }
    } else {
      await activeController.loadFromJSON({ version: '7.3.1', objects: [], background: '#ffffff' });
    }
    dispatch({ type: 'SET_DIRTY', payload: false });
  }, [controller, dispatch]);

  const requestProjectManager = useCallback(() => {
    if (state.activePanel === 'project') {
      dispatch({ type: 'TOGGLE_PANEL', payload: 'project' });
      return;
    }
    if (state.isDirty) {
      pendingProjectActionRef.current = null;
      setExitDialogOpen(true);
      return;
    }
    dispatch({ type: 'TOGGLE_PANEL', payload: 'project' });
  }, [dispatch, state.activePanel, state.isDirty]);

  const requestProjectNavigation = useCallback((action: () => Promise<void>) => {
    if (state.isDirty) {
      pendingProjectActionRef.current = action;
      setExitDialogOpen(true);
      return;
    }
    void action();
  }, [state.isDirty]);

  const handleExitChoice = useCallback(async (save: boolean) => {
    if (exitBusy) return;
    setExitBusy(true);
    try {
      if (save) {
        await saveCurrentProject();
      } else {
        await discardUnsavedChanges();
      }
      const pendingAction = pendingProjectActionRef.current;
      pendingProjectActionRef.current = null;
      setExitDialogOpen(false);
      if (pendingAction) {
        await pendingAction();
      } else {
        dispatch({ type: 'TOGGLE_PANEL', payload: 'project' });
      }
    } catch {
      toast({
        title: save ? 'Save failed' : 'Exit failed',
        description: save ? 'Your project could not be saved.' : 'The project could not be restored.',
        variant: 'destructive',
      });
    } finally {
      setExitBusy(false);
    }
  }, [discardUnsavedChanges, dispatch, exitBusy, saveCurrentProject, toast]);

  useEffect(() => {
    if (resumeAttemptedRef.current) return;
    resumeAttemptedRef.current = true;
    let cancelled = false;
    (async () => {
      const projectId = await getActiveProjectId();
      if (!projectId || cancelled) return;
      const project = await loadProjectById(projectId);
      if (!project || cancelled) return;
      await controller.loadFromJSON(project.canvasJSON);
      if (cancelled) return;
      controller.setCanvasSize(project.canvasWidth, project.canvasHeight);
      setCurrentProjectId(project.id);
      dispatch({ type: 'SET_PROJECT_NAME', payload: project.name });
      dispatch({ type: 'SET_CANVAS_SIZE', payload: { width: project.canvasWidth, height: project.canvasHeight } });
      dispatch({ type: 'SET_DIRTY', payload: false });
    })().catch(() => {
      // A missing or corrupt saved project must not block a fresh editor.
    });
    return () => {
      cancelled = true;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

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
      controller.activateBrush(state.brushPreset, state.brushColor, state.brushSize, state.brushOpacity, state.neonIntensity);
    } else if (controller.isBrushActive) {
      controller.deactivateBrush();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeTool, state.brushPreset, state.brushColor, state.brushSize, state.brushOpacity, state.neonIntensity]);

  useEffect(() => {
    controller.setPanMode(state.activeTool === 'pan');
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    dispatch({ type: 'SET_TOOL', payload: 'select' });
  }, [controller, dispatch]);

  const handleBrushColorChange = useCallback((color: string) => {
    dispatch({ type: 'SET_BRUSH_COLOR', payload: color });
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

  const handleGridPositionMove = useCallback((
    axis: 'h' | 'v',
    _idx: number,
    _newPos: number,
    positions: number[],
  ) => {
    dispatch({ type: 'SET_GRID_POSITIONS', payload: { axis, positions } });
    dispatch({ type: 'SET_DIRTY', payload: true });
  }, [dispatch]);

  /* ── Eyedropper ── */
  const applyEyedropperColor = useCallback((color: string) => {
    if (eyedropperPanelRef.current === 'canvasBg') {
      const backgroundContext = backgroundEyedropperContextRef.current;
      const currentBackground = editorStateRef.current.canvasBg;
      const nextBackground = backgroundContext.mode === 'solid'
        ? { ...currentBackground, type: 'solid' as const, color }
        : {
            ...currentBackground,
            type: 'gradient' as const,
            gradientType: backgroundContext.mode,
            gradientStops: currentBackground.gradientStops.map((stop, index) => (
              index === backgroundContext.selectedStop ? { ...stop, color } : { ...stop }
            )),
          };
      lastEyedropperColorRef.current = color;
      setSampledColor(color);
      dispatch({ type: 'SET_CANVAS_BG', payload: nextBackground });
      controller.setCanvasBackground(nextBackground);
      return;
    }

    const obj = eyedropperTargetRef.current ?? controller.selectedObject;
    const gradientContext = eyedropperGradientContextRef.current;
    lastEyedropperColorRef.current = color;
    setSampledColor(color);
    if (!obj) return;

    const fill = (obj as typeof obj & { fill?: unknown }).fill;
    const strokeWidth = Number((obj as typeof obj & { strokeWidth?: number }).strokeWidth ?? 0);
    const strokeOnly = obj.type === 'line'
      || (strokeWidth > 0 && (!fill || fill === 'transparent'));
    if (strokeOnly) {
      obj.set('stroke', color);
    } else if (gradientContext.mode !== 'solid') {
      const gradientConfig = (obj as typeof obj & {
        _gradientConfig?: {
          type?: 'linear' | 'radial' | 'angular';
          stops?: { offset: number; color: string }[];
          radialRadius?: number | null;
          angleDeg?: number;
          origin?: { x: number; y: number };
        };
      })._gradientConfig;
      const existingStops = gradientConfig?.stops
        ?? (fill && typeof fill === 'object' && 'colorStops' in fill
          ? (fill as { colorStops?: { offset: number; color: string }[] }).colorStops
          : undefined);
      if (existingStops && existingStops.length >= 2) {
        const stops = existingStops.map((stop, index) => (
          index === gradientContext.selectedStop ? { ...stop, color } : { ...stop }
        ));
        controller.applyGradientFill(
          obj,
          gradientContext.mode,
          stops,
          gradientConfig?.radialRadius ?? undefined,
          gradientConfig?.angleDeg ?? 0,
          gradientConfig?.origin ?? { x: 0.5, y: 0.5 },
          false,
        );
      }
    } else {
      obj.set('fill', color);
      // A sampled pixel is a solid replacement for an existing gradient.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (obj as any)._gradientConfig;
    }
    controller.getCanvas()?.requestRenderAll();
  }, [controller]);

  useEffect(() => {
    if (eyedropperWasActiveRef.current && !controller.eyedropperActive) {
      const panel = eyedropperPanelRef.current;
      dispatch({ type: 'TOGGLE_PANEL', payload: panel });
      const color = lastEyedropperColorRef.current;
      if (color) {
        setSampledColorCommitted(color);
        controller.commitChange();
        toast({
          title: `Color applied: ${color.toUpperCase()}`,
          description: 'Sampled from the canvas',
        });
      }
      eyedropperPanelRef.current = 'colorStudio';
    }
    eyedropperWasActiveRef.current = controller.eyedropperActive;
  }, [controller, dispatch, toast]);

  const handleEyedropper = useCallback(async (
    context: ColorStudioEyedropperContext | BackgroundEyedropperContext,
    panel: 'colorStudio' | 'canvasBg',
  ) => {
    eyedropperPanelRef.current = panel;
    if (panel === 'canvasBg') {
      backgroundEyedropperContextRef.current = context as BackgroundEyedropperContext;
      eyedropperTargetRef.current = null;
    } else {
      eyedropperGradientContextRef.current = context as ColorStudioEyedropperContext;
      eyedropperTargetRef.current = controller.selectedObject
        ?? controller.getCanvas()?.getActiveObject()
        ?? null;
    }
    lastEyedropperColorRef.current = null;
    setSampledColor(null);
    setSampledColorCommitted(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ('EyeDropper' in window && typeof (window as any).EyeDropper === 'function') {
      dispatch({ type: 'CLOSE_PANEL' });
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eyeDropper = new (window as any).EyeDropper();
        const result: { sRGBHex: string } = await eyeDropper.open();
        applyEyedropperColor(result.sRGBHex);
        setSampledColorCommitted(result.sRGBHex);
        controller.commitChange();
      } catch {
        // Browser picker cancellation is intentionally silent.
      } finally {
        dispatch({ type: 'TOGGLE_PANEL', payload: panel });
        eyedropperPanelRef.current = 'colorStudio';
      }
      return;
    }

    if (controller.eyedropperActive) {
      controller.deactivateEyedropper();
      return;
    }

    dispatch({ type: 'CLOSE_PANEL' });
    controller.activateEyedropper(applyEyedropperColor);
  }, [applyEyedropperColor, controller, dispatch]);

  const handleColorStudioEyedropper = useCallback((context: ColorStudioEyedropperContext) => {
    void handleEyedropper(context, 'colorStudio');
  }, [handleEyedropper]);

  const handleBackgroundEyedropper = useCallback((context: BackgroundEyedropperContext) => {
    void handleEyedropper(context, 'canvasBg');
  }, [handleEyedropper]);

  const handleVectorsPenStart = useCallback(() => {
    controller.activatePenTool();
    dispatch({ type: 'SET_TOOL', payload: 'pen' });
  }, [controller, dispatch]);

  const handleQuickExport = useCallback(() => {
    const dataUrl = controller.exportCanvas('png', 1, 1);
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${state.projectName || 'untitled'}_design.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [controller, state.projectName]);

  const handleKeyboardEyedropper = useCallback(() => {
    void handleEyedropper({ mode: 'solid', selectedStop: 0 }, 'colorStudio');
  }, [handleEyedropper]);

  const toggleGridStudio = useCallback(() => {
    setGridSettingsOpen((open) => !open);
  }, []);

  const setActiveTool = useCallback((tool: import('@/store/editorStore').ActiveTool) => {
    dispatch({ type: 'SET_TOOL', payload: tool });
  }, [dispatch]);

  useKeyboardShortcuts({
    controller,
    activeTool: state.activeTool,
    setTool: setActiveTool,
    toggleGrid: toggleGridStudio,
    onSave: saveCurrentProject,
    onNewProject: createNewProject,
    onOpenProject: requestProjectManager,
    onQuickExport: handleQuickExport,
    onEyedropper: handleKeyboardEyedropper,
    onShowHelp: () => setShortcutsOpen(true),
    onNudge: handleNudgeElement,
  });

  useEffect(() => {
    if (contextMenu) closeContextMenu();
  // The menu state intentionally stays out of this dependency list: opening
  // the menu must not immediately trigger the dismissal effect itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedObjectIds, state.activePanel, state.activeTool, controller.zoom, vpX, vpY, closeContextMenu]);

  const exportSelection = useCallback(() => {
    const selected = controller.getCanvas()?.getActiveObject() as
      | (import('fabric').FabricObject & { toCanvasElement?: (options?: Record<string, unknown>) => HTMLCanvasElement; toSVG?: () => string })
      | undefined;
    if (!selected) return;
    const filenameBase = (state.projectName || 'untitled').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const exportCanvas = selected.toCanvasElement?.({ multiplier: 2 });
    if (!exportCanvas) return;
    const link = document.createElement('a');
    link.href = exportCanvas.toDataURL('image/png');
    link.download = `${filenameBase}_selection.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [controller, state.projectName]);

  const saveReusableComponent = useCallback(() => {
    const selected = controller.getCanvas()?.getActiveObject();
    if (!selected) return;
    try {
      const components = JSON.parse(localStorage.getItem('cyber_studio_components') || '[]') as object[];
      components.push({
        name: `${state.projectName || 'Untitled'} component`,
        object: (selected as import('fabric').FabricObject & { toObject: (propertiesToInclude?: string[]) => object }).toObject(),
        savedAt: Date.now(),
      });
      localStorage.setItem('cyber_studio_components', JSON.stringify(components.slice(-50)));
      toast({ title: 'Reusable component saved', description: 'The selected object is available in this browser.' });
    } catch {
      toast({ title: 'Component save failed', description: 'This selection could not be stored locally.', variant: 'destructive' });
    }
  }, [controller, state.projectName, toast]);

  const contextMenuActions: ContextMenuActions = {
    onPaste: () => controller.pasteSelected(15),
    onPasteInPlace: () => controller.pasteSelected(0),
    onSelectAll: controller.selectAll,
    onClearSelection: controller.clearSelection,
    onResetZoom: () => controller.setZoomLevel(100),
    onFitCanvas: controller.resetZoom,
    onToggleGrid: () => dispatch({ type: 'TOGGLE_GRID' }),
    onToggleGuides: () => dispatch({ type: 'TOGGLE_GUIDES' }),
    onToggleSnap: () => dispatch({ type: 'TOGGLE_SNAP' }),
    onToggleRulers: () => dispatch({ type: 'TOGGLE_RULERS' }),
    onBackground: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'canvasBg' }),
    onToggleTransparency: () => {
      const nextBackground = state.canvasBg.type === 'transparent'
        ? { ...state.canvasBg, type: 'solid' as const, color: '#ffffff' }
        : { ...state.canvasBg, type: 'transparent' as const };
      dispatch({ type: 'SET_CANVAS_BG', payload: nextBackground });
      controller.setCanvasBackground(nextBackground);
    },
    onCanvasDimensions: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'canvasSize' }),
    onImportAsset: handleImportImages,
    onExportCanvas: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'export' }),
    onCut: () => { controller.copySelected(); controller.deleteSelected(); },
    onCopy: controller.copySelected,
    onCopyStyle: controller.copyStyle,
    onPasteStyle: controller.pasteStyle,
    onDuplicate: () => controller.duplicateSelected(15),
    onDelete: controller.deleteSelected,
    onCenterHorizontal: () => controller.alignObjects('centerH'),
    onCenterVertical: () => controller.alignObjects('centerV'),
    onCenterBoth: () => { controller.alignObjects('centerH'); controller.alignObjects('centerV'); },
    onAlignLeft: () => controller.alignObjects('left'),
    onAlignCenter: () => controller.alignObjects('centerH'),
    onAlignRight: () => controller.alignObjects('right'),
    onAlignTop: () => controller.alignObjects('top'),
    onAlignMiddle: () => controller.alignObjects('centerV'),
    onAlignBottom: () => controller.alignObjects('bottom'),
    onDistributeHorizontal: () => controller.distributeObjects('horizontal'),
    onDistributeVertical: () => controller.distributeObjects('vertical'),
    onBringForward: () => { const object = controller.getCanvas()?.getActiveObject(); if (object) controller.bringForward(object); },
    onSendBackward: () => { const object = controller.getCanvas()?.getActiveObject(); if (object) controller.sendBackward(object); },
    onBringToFront: () => { const object = controller.getCanvas()?.getActiveObject(); if (object) controller.bringToFront(object); },
    onSendToBack: () => { const object = controller.getCanvas()?.getActiveObject(); if (object) controller.sendToBack(object); },
    onGroup: controller.groupSelected,
    onUngroup: controller.ungroupSelected,
    onToggleLock: () => { const object = controller.getCanvas()?.getActiveObject(); if (object) controller.toggleLock(object); },
    onFlipHorizontal: controller.flipHorizontal,
    onFlipVertical: controller.flipVertical,
    onResetRotation: controller.resetRotation,
    onResetScale: controller.resetScale,
    onQuickColor: () => dispatch({ type: 'TOGGLE_PANEL', payload: 'colorStudio' }),
    onToggleShadow: () => {
      const object = controller.getCanvas()?.getActiveObject();
      if (!object) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentShadow = (object as any)._innerShadow;
      controller.applyInnerShadow(object, currentShadow?.enabled
        ? { ...currentShadow, enabled: false }
        : { enabled: true, color: '#000000', blur: 12, offsetX: 4, offsetY: 4, opacity: 0.35 });
    },
    onMask: controller.applyMaskFromSelection,
    onUnmask: controller.releaseMask,
    onExportSelection: exportSelection,
    onSaveComponent: saveReusableComponent,
  };


  /* ── Quick-tray: fill opacity + corner radius ── */
  const [quickFillOpacity, setQuickFillOpacity] = useState(100);
  const [opacityExpanded, setOpacityExpanded] = useState(false);
  const [quickCornerRadius, setQuickCornerRadius] = useState(0);
  const [quickCornerRadiusMax, setQuickCornerRadiusMax] = useState(50);
  const radiusRestoreValueRef = useRef(8);

  useEffect(() => {
    if (state.activePanel !== 'opacity-tool') setOpacityExpanded(false);
    const obj = controller.selectedObject;
    if (!obj) { setQuickFillOpacity(100); setQuickCornerRadius(0); return; }
    setQuickFillOpacity(Math.round(controller.getFillOpacity(obj) * 100));
    if (obj.type === 'rect') {
      const rx = (obj as import('fabric').FabricObject & { rx?: number }).rx ?? 0;
      const scaleX = (obj.scaleX ?? 1) || 1;
      const scaleY = (obj.scaleY ?? 1) || 1;
      const currentRadius = Math.round(rx * scaleX);
      const radiusMax = Math.max(4, Math.min(
        Math.round(obj.getScaledWidth() / 2),
        Math.round(obj.getScaledHeight() / 2),
      ));
      setQuickCornerRadius(currentRadius);
      radiusRestoreValueRef.current = currentRadius || Math.min(8, radiusMax);
      // Recompute max from the object's *current* scaled dimensions so the
      // Slider always reflects the live geometry — important when the panel
      // is (re-)opened after the object has been resized.
      setQuickCornerRadiusMax(radiusMax);
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
    const activeObjects = controller.getCanvas()?.getActiveObjects() ?? [];
    const selectionContainsImage = activeObjects.some((candidate) => {
      if (candidate.type === 'image') return true;
      const children = (candidate as import('fabric').FabricObject & {
        getObjects?: () => import('fabric').FabricObject[];
      }).getObjects?.() ?? [];
      return children.some((child) => child.type === 'image');
    }) || obj.type === 'image';

    // Shapes retain the editor's decoupled fill-opacity behavior so their
    // strokes are not unintentionally dimmed. Raster selections use Fabric's
    // object opacity directly and force their image caches dirty.
    if (selectionContainsImage) {
      controller.applyObjectOpacity(obj, v / 100);
    } else {
      controller.applyFillOpacity(obj, v / 100);
    }
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
    if (resolvedV > 0) radiusRestoreValueRef.current = resolvedV;
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
    if (!obj) {
      toast({
        title: 'Select an object first',
        description: 'Choose an image, shape, vector, or text object to crop.',
      });
      return;
    }

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
        onOpenProjects={requestProjectManager}
        gridSettingsOpen={gridSettingsOpen}
        onGridSettingsOpenChange={setGridSettingsOpen}
      />

      <CanvasWorkspace
        canvasRef={canvasRef}
        containerRef={containerRef}
        gridEnabled={state.gridEnabled}
        showGuides={state.showGuides}
        showRulers={state.showRulers}
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
        onEyedropperSample={controller.sampleEyedropperAt}
        onEyedropperFinish={controller.finishEyedropper}
        guides={state.guides}
        gridLocked={state.gridLocked}
        onGuideMove={handleGuideMove}
        gridColumns={state.gridColumns}
        gridRows={state.gridRows}
        gridColumnGap={state.gridColumnGap}
        gridRowGap={state.gridRowGap}
        gridGapUnit={state.gridGapUnit}
        gridColor={state.gridColor}
        gridOpacity={state.gridOpacity}
        gridLineWeight={state.gridLineWeight}
        gridSlanted={state.gridSlanted}
        gridSlantAngle={state.gridSlantAngle}
        gridColumnPositions={state.gridColumnPositions}
        gridRowPositions={state.gridRowPositions}
        onGridPositionMove={handleGridPositionMove}
        panActive={panActive}
        penLiveHandle={controller.penLiveHandle}
        selectedAnchorIdx={controller.selectedVectorAnchorIdx}
        onContextMenu={handleCanvasContextMenu}
        onLongPressContextMenu={handleCanvasLongPress}
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
        <AdjustPanel controller={controller} />
        <TransformPanel controller={controller} />
        <BrushPanel open={brushActive} onColorChange={handleBrushColorChange} />

        {/* The general alignment/nudge sheet is hidden while editing vector nodes. */}
        {!vectorEditActive && (
          <div className="absolute bottom-full left-0 right-0 z-50">
            <NudgePanel
              onNudge={handleNudgeElement}
              onAlign={controller.alignObjects}
              onDistribute={controller.distributeObjects}
            />
          </div>
        )}

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
              onSetNodePosition={controller.setSelectedVectorNodePosition}
              onSetCurveType={controller.setSelectedVectorNodeCurveType}
              onSetHandleConstraint={controller.setVectorHandleConstraint}
              onDone={handleVectorEditEnd}
              onReactivatePen={handleReactivatePen}
            />
          </div>
        )}

        <ZoomPanel controller={controller} />

        {/* Opacity Tool overlay — compact micro-panel, only shown when eligible object is selected */}
        {state.activePanel === 'opacity-tool' && hasSelection && !brushActive && !penActive && !vectorEditActive && (
          <div className="absolute bottom-full left-1/2 z-[9999] mb-2 flex w-[min(720px,calc(100vw-20px))] -translate-x-1/2 flex-col" data-testid="opacity-panel">
            <div
              className={`overflow-hidden rounded-2xl transition-all duration-300 ${
                opacityExpanded
                  ? 'mb-2 max-h-[min(72vh,650px)] overflow-y-auto opacity-100'
                  : 'pointer-events-none max-h-0 opacity-0'
              }`}
              style={{
                background: '#11141A',
                border: opacityExpanded ? '1px solid rgba(0,245,255,0.25)' : '1px solid transparent',
                boxShadow: opacityExpanded ? '0 -8px 30px rgba(0,0,0,0.45)' : 'none',
              }}
              aria-hidden={!opacityExpanded}
              data-testid="opacity-settings-drawer"
            >
              <div className="space-y-4 px-4 pb-4 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Eye size={14} className="text-primary" />
                    <span className="text-xs font-semibold text-primary">Opacity Settings</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Live transparency controls
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Selected object opacity</span>
                    <span className="font-mono text-[11px] text-primary">{quickFillOpacity}%</span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[quickFillOpacity]}
                    onValueChange={([value]) => handleFillOpacityChange(value)}
                    className="w-full"
                    aria-label="Selected object opacity"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Shapes keep stroke opacity independent; images use whole-object transparency.
                </p>
              </div>
            </div>

            <div
              className="flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2.5"
              style={{
                background: '#11141A',
                borderColor: 'rgba(0,245,255,0.3)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
              }}
              data-testid="opacity-compact-pill"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-12 max-w-[48px] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-primary hover:bg-primary/10"
                    aria-label="Choose opacity target"
                    title="Opacity target"
                  >
                    <Eye size={14} aria-hidden="true" />
                    <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={8} className="w-52 border-cyan-400/20 bg-[#11141A] text-foreground">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">
                    Opacity target
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value="selected-object">
                    <DropdownMenuRadioItem value="selected-object" className="gap-2 text-xs data-[state=checked]:text-primary">
                      Selected object
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="min-w-0 w-full flex-1">
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[quickFillOpacity]}
                  onValueChange={([value]) => handleFillOpacityChange(value)}
                  className="w-full"
                  aria-label="Opacity"
                />
              </div>
              <span className="min-w-[42px] shrink-0 text-right font-mono text-[10px] text-primary">
                {quickFillOpacity}%
              </span>
              <button
                type="button"
                onClick={() => setOpacityExpanded((open) => !open)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
                aria-label={opacityExpanded ? 'Collapse opacity settings' : 'Expand opacity settings'}
                aria-expanded={opacityExpanded}
              >
                {opacityExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>
        )}

        {/* Corner Radius Tool overlay — compact micro-panel, only shown for rect objects */}
        {state.activePanel === 'radius-tool' && hasSelection && selectedType === 'rect' && !brushActive && !penActive && !vectorEditActive && (
          <div className="absolute bottom-full left-1/2 z-[9999] mb-2 w-[min(720px,calc(100vw-20px))] -translate-x-1/2">
            <div
              className="flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2.5"
              style={{
                background: '#11141A',
                borderColor: 'rgba(0,245,255,0.3)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.55), 0 0 18px rgba(0,245,255,0.08)',
              }}
            >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 w-12 max-w-[48px] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-primary hover:bg-primary/10"
                      aria-label={`Choose radius corner, currently ${radiusTarget}`}
                      title="Corner radius"
                    >
                      <SquareRoundCorner size={14} aria-hidden="true" />
                      <ChevronDown size={11} className="shrink-0" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="w-52 border-cyan-400/20 bg-[#11141A] text-foreground">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-cyan-300">
                      Radius corner
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={radiusTarget}
                      onValueChange={(value) => setRadiusTarget(value as RadiusTarget)}
                    >
                      <DropdownMenuRadioItem value="all" className="gap-2 text-xs data-[state=checked]:text-primary">All Corners</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="top-left" className="gap-2 text-xs data-[state=checked]:text-primary">Top Left</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="top-right" className="gap-2 text-xs data-[state=checked]:text-primary">Top Right</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="bottom-left" className="gap-2 text-xs data-[state=checked]:text-primary">Bottom Left</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="bottom-right" className="gap-2 text-xs data-[state=checked]:text-primary">Bottom Right</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="min-w-0 w-full flex-1">
                  <Slider
                    min={0} max={quickCornerRadiusMax} step={1}
                    value={[quickCornerRadius]}
                    onValueChange={([v]) => handleCornerRadiusChange(v)}
                    className="w-full"
                    aria-label={`${radiusTarget} corner radius`}
                  />
                </div>
                <span className="min-w-[42px] shrink-0 text-right font-mono text-[10px] text-primary">
                  {quickCornerRadius}px
                </span>
                <Switch
                  checked={quickCornerRadius > 0}
                  onCheckedChange={(enabled) => {
                    if (enabled) {
                      handleCornerRadiusChange(radiusRestoreValueRef.current || Math.min(8, quickCornerRadiusMax));
                    } else {
                      if (quickCornerRadius > 0) radiusRestoreValueRef.current = quickCornerRadius;
                      handleCornerRadiusChange(0);
                    }
                  }}
                  disabled={!controller.selectedObject}
                  aria-label="Toggle corner radius"
                />
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
          onVectorEditStart={handleVectorEditStart}
          onVectorEditEnd={handleVectorEditEnd}
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
        onEyedropper={handleColorStudioEyedropper}
        sampledColor={sampledColor}
        sampledColorCommitted={sampledColorCommitted}
      />
      <AddElementSheet controller={controller} />
      <ExportDialog controller={controller} />
      <CanvasSizeDialog controller={controller} />
      <AlignmentPanel controller={controller} />
      <CanvasBgDialog
        controller={controller}
        eyedropperActive={controller.eyedropperActive}
        onEyedropper={handleBackgroundEyedropper}
        sampledColor={sampledColor}
        sampledColorCommitted={sampledColorCommitted}
      />
      <ProjectManager
        controller={controller}
        currentProjectId={currentProjectId}
        onProjectSaved={(id) => {
          currentProjectIdRef.current = id;
          setCurrentProjectId(id);
        }}
        onRequestNavigation={requestProjectNavigation}
      />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <ContextMenu
        open={contextMenu !== null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        hasSelection={state.selectedObjectIds.length > 0}
        selectionCount={state.selectedObjectIds.length}
        selectedIsGroup={controller.selectedObject?.type === 'group'}
        canPaste={controller.hasClipboard()}
        canPasteStyle={controller.hasStyleClipboard()}
        onClose={closeContextMenu}
        actions={contextMenuActions}
      />
      <TextPanel controller={controller} />
      <ShapeModifiersPanel controller={controller} />
      <VectorsPanel controller={controller} onPenStart={handleVectorsPenStart} />

      <AlertDialog
        open={exitDialogOpen}
        onOpenChange={(open) => {
          if (!open && !exitBusy) {
            pendingProjectActionRef.current = null;
            setExitDialogOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to exit without saving your changes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={exitBusy}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={exitBusy}
              onClick={() => void handleExitChoice(false)}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              Exit Without Saving
            </button>
            <button
              type="button"
              disabled={exitBusy}
              onClick={() => void handleExitChoice(true)}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              Save &amp; Exit
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
