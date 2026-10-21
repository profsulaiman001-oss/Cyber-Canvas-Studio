import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Layers2, Lock, Search, Trash2, Unlock, Ungroup, X } from 'lucide-react';
import { Sheet, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEditor } from '@/store/editorStore';
import { Capacitor } from '@capacitor/core';
import type {
  CanvasController,
  LayerBlendMode,
  LayerExportFormat,
  LayerLockMode,
  LayerOrderNode,
  ObjectMeta,
} from '@/hooks/useFabricCanvas';
import LayerCard, { type LayerZOrderAction } from './LayerCard';
import { ResponsiveDrawerWrapper } from './ResponsiveDrawerWrapper';

interface LayersPanelProps {
  controller: CanvasController;
}

interface FlatLayer {
  obj: ObjectMeta;
  parentId: string | null;
  index: number;
  depth: number;
}

type LayerTypeFilter = 'All' | 'Text' | 'Shapes' | 'Images' | 'Groups';

function matchesLayerType(obj: ObjectMeta, filter: LayerTypeFilter): boolean {
  if (filter === 'All') return true;
  if (filter === 'Text') return ['textbox', 'i-text', 'text'].includes(obj.type);
  if (filter === 'Images') return obj.type === 'image';
  if (filter === 'Groups') return obj.type === 'group';
  return obj.type !== 'group' && obj.type !== 'image' &&
    !['textbox', 'i-text', 'text'].includes(obj.type);
}

function matchingLayerIds(
  nodes: ObjectMeta[],
  query: string,
  filter: LayerTypeFilter,
): Set<string> {
  const matches = new Set<string>();
  const visit = (node: ObjectMeta): boolean => {
    const ownMatch = node.name.toLocaleLowerCase().includes(query) && matchesLayerType(node, filter);
    const childMatch = node.children?.some(visit) ?? false;
    if (ownMatch || childMatch) matches.add(node.id);
    return ownMatch || childMatch;
  };
  nodes.forEach(visit);
  return matches;
}

function cloneLayerTree(nodes: ObjectMeta[]): ObjectMeta[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children ? cloneLayerTree(node.children) : undefined,
  }));
}

function flattenLayers(
  nodes: ObjectMeta[],
  collapsed: Record<string, boolean>,
  parentId: string | null = null,
  depth = 0,
): FlatLayer[] {
  return nodes.flatMap((obj, index) => [
    { obj, parentId, index, depth },
    ...(obj.type === 'group' && !collapsed[obj.id] && obj.children
      ? flattenLayers(obj.children, collapsed, obj.id, depth + 1)
      : []),
  ]);
}

function findLayer(nodes: ObjectMeta[], id: string): ObjectMeta | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findLayer(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function containsLayer(node: ObjectMeta, id: string): boolean {
  return node.id === id || Boolean(node.children?.some((child) => containsLayer(child, id)));
}

function removeLayer(
  nodes: ObjectMeta[],
  id: string,
  parentId: string | null = null,
): { node: ObjectMeta; parentId: string | null; index: number } | null {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) {
    const [node] = nodes.splice(index, 1);
    return { node, parentId, index };
  }
  for (const node of nodes) {
    if (node.children) {
      const removed = removeLayer(node.children, id, node.id);
      if (removed) return removed;
    }
  }
  return null;
}

function getChildrenAt(nodes: ObjectMeta[], parentId: string | null): ObjectMeta[] | null {
  if (!parentId) return nodes;
  const parent = findLayer(nodes, parentId);
  if (!parent || parent.type !== 'group') return null;
  if (!parent.children) parent.children = [];
  return parent.children;
}

function moveLayerInTree(
  source: ObjectMeta[],
  id: string,
  targetParentId: string | null,
  targetIndex: number,
): ObjectMeta[] {
  const next = cloneLayerTree(source);
  const removed = removeLayer(next, id);
  if (!removed || targetParentId === id || containsLayer(removed.node, targetParentId || '')) return source;

  const targetChildren = getChildrenAt(next, targetParentId);
  if (!targetChildren) return source;
  let insertAt = targetIndex;
  if (removed.parentId === targetParentId && removed.index < insertAt) insertAt -= 1;
  insertAt = Math.max(0, Math.min(insertAt, targetChildren.length));
  targetChildren.splice(insertAt, 0, removed.node);
  return hasSameLayerOrder(source, next) ? source : next;
}

function toOrderNodes(nodes: ObjectMeta[]): LayerOrderNode[] {
  return nodes.map((node) => ({
    id: node.id,
    children: node.children ? toOrderNodes(node.children) : [],
  }));
}

function hasSameLayerOrder(first: ObjectMeta[], second: ObjectMeta[]): boolean {
  return first.length === second.length && first.every((node, index) => {
    const other = second[index];
    return node.id === other.id &&
      hasSameLayerOrder(node.children ?? [], other.children ?? []);
  });
}

export default function LayersPanel({ controller }: LayersPanelProps) {
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const isOpen = state.activePanel === 'layers';
  const { objects, getObjectById } = controller;
  const [checkedIds, setCheckedIds] = useState<string[]>(state.selectedObjectIds);
  const preserveCheckboxesRef = useRef(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<LayerTypeFilter>('All');
  const [bulkOpacity, setBulkOpacity] = useState(100);
  const [dragTree, setDragTree] = useState<ObjectMeta[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragTreeRef = useRef<ObjectMeta[] | null>(null);
  const renderedTreeRef = useRef<ObjectMeta[] | null>(null);
  const dragSessionRef = useRef<{ pointerId: number; id: string } | null>(null);
  const dragPointRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const updateDragPreviewRef = useRef<(clientX: number, clientY: number) => ObjectMeta[] | null>(() => null);
  const pointerMoveHandlerRef = useRef<(event: PointerEvent) => void>(() => {});
  const pointerUpHandlerRef = useRef<(event: PointerEvent) => void>(() => {});
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (preserveCheckboxesRef.current) {
      preserveCheckboxesRef.current = false;
      return;
    }
    setCheckedIds(state.selectedObjectIds);
  }, [state.selectedObjectIds]);

  const displayedTree = dragTree || objects;
  const filteredMode = Boolean(searchQuery.trim()) || typeFilter !== 'All';
  const getVisibleLayerRows = (tree: ObjectMeta[]): FlatLayer[] => {
    const rows = flattenLayers(tree, filteredMode ? {} : collapsedGroups);
    if (!filteredMode) return rows;
    const visibleIds = matchingLayerIds(tree, searchQuery.trim().toLocaleLowerCase(), typeFilter);
    return rows.filter((row) => visibleIds.has(row.obj.id));
  };
  const flatLayers = getVisibleLayerRows(displayedTree);
  const selectedLayers = checkedIds
    .map((id) => findLayer(objects, id))
    .filter((obj): obj is ObjectMeta => Boolean(obj));
  const selectedRows = flattenLayers(objects, {})
    .filter((row) => checkedIds.includes(row.obj.id));
  const activeSelectionMatches = checkedIds.length === state.selectedObjectIds.length &&
    checkedIds.every((id) => state.selectedObjectIds.includes(id));
  const canGroupSelected = selectedRows.length >= 2 &&
    selectedRows.length === checkedIds.length &&
    selectedRows.every((row) => row.parentId === selectedRows[0].parentId) &&
    activeSelectionMatches &&
    selectedLayers.every((obj) => obj.lockMode !== 'full');
  const allSelectedVisible = selectedLayers.length > 0 && selectedLayers.every((obj) => obj.visible);
  const allSelectedLocked = selectedLayers.length > 0 && selectedLayers.every((obj) => obj.lockMode !== 'unlocked');
  const selectedSignature = checkedIds.join('|');

  useEffect(() => {
    if (checkedIds.length < 2) return;
    const firstMeta = findLayer(objects, checkedIds[0]);
    const firstObject = getObjectById(checkedIds[0]);
    if (!firstMeta || !firstObject) return;
    const opacity = firstMeta.type === 'image' || firstMeta.fill
      ? controller.getFillOpacity(firstObject)
      : controller.getStrokeOpacity(firstObject);
    setBulkOpacity(Math.round(opacity * 100));
  // A new selection should resync the bulk control; slider edits keep the
  // current selection signature stable while the values are applied.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSignature]);

  const handleBulkOpacityChange = (value: number) => {
    setBulkOpacity(value);
    controller.applyLayerOpacityToIds(checkedIds, value / 100);
  };

  const handleBulkLockToggle = () => {
    const nextMode = allSelectedLocked ? 'unlocked' : 'full';
    preserveCheckboxesRef.current = nextMode === 'full' &&
      checkedIds.some((id) => state.selectedObjectIds.includes(id));
    controller.setLayersLockMode(checkedIds, nextMode);
    if (nextMode === 'unlocked' && selectedRows.length === checkedIds.length &&
      selectedRows.every((row) => row.parentId === selectedRows[0]?.parentId)) {
      controller.selectObjectsByIds(checkedIds);
    }
  };

  const handleGroupSelected = () => {
    if (!canGroupSelected) {
      toast({
        title: 'Select layers from the same folder',
        description: 'To preserve folder hierarchy and stacking, group sibling layers together.',
      });
      return;
    }
    controller.groupSelected();
    setSearchQuery('');
    setTypeFilter('All');
  };

  useLayoutEffect(() => {
    if (draggingId && dragTree) renderedTreeRef.current = dragTree;
    else if (!draggingId) renderedTreeRef.current = null;
  }, [dragTree, draggingId]);

  const clearDragState = () => {
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    dragSessionRef.current = null;
    dragPointRef.current = null;
    dragTreeRef.current = null;
    renderedTreeRef.current = null;
    setDragTree(null);
    setDraggingId(null);
    setDropId(null);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Window-level listeners below still handle the drag if capture is unavailable.
    }
    const initialTree = cloneLayerTree(objects);
    dragSessionRef.current = { pointerId: event.pointerId, id };
    dragPointRef.current = { x: event.clientX, y: event.clientY };
    dragTreeRef.current = initialTree;
    renderedTreeRef.current = initialTree;
    setDragTree(initialTree);
    setDraggingId(id);
    setDropId(id);
  };

  const updateDragPreviewAtPoint = (clientX: number, clientY: number): ObjectMeta[] | null => {
    const session = dragSessionRef.current;
    const currentTree = renderedTreeRef.current ?? dragTreeRef.current;
    if (!session || !currentTree) return null;
    const currentDraggingId = session.id;

    const flat = getVisibleLayerRows(currentTree);
    const positionedRows = flat.flatMap((row) => {
      const card = cardRefs.current[row.obj.id];
      if (!card) return [];
      const rect = card.getBoundingClientRect();
      return [{ ...row, rect, centerY: rect.top + rect.height / 2 }];
    });
    const over = positionedRows.find(({ rect }) => clientY >= rect.top && clientY <= rect.bottom);
    const nearest = positionedRows.reduce<(typeof positionedRows)[number] | null>((best, row) => {
      if (!best) return row;
      return Math.abs(clientY - row.centerY) < Math.abs(clientY - best.centerY) ? row : best;
    }, null);
    const firstRow = positionedRows[0];
    const lastRow = positionedRows[positionedRows.length - 1];

    let targetParentId: string | null = null;
    let targetIndex = currentTree.length;
    let visualDropId: string | null = over?.obj.id ?? null;
    const listRect = listRef.current?.getBoundingClientRect();
    const rootRows = positionedRows.filter((row) => row.parentId === null);
    const rootIntent = Boolean(listRect && clientX < listRect.left + 52);
    const outsideTop = Boolean(firstRow && clientY < firstRow.rect.top);
    const outsideBottom = Boolean(lastRow && clientY > lastRow.rect.bottom);

    if (rootIntent || outsideTop || outsideBottom) {
      const rootTarget = rootRows.find((row) => clientY < row.centerY);
      targetIndex = rootTarget?.index ?? currentTree.length;
      visualDropId = rootTarget?.obj.id ?? rootRows[rootRows.length - 1]?.obj.id ?? null;
    } else {
      const targetRow = over ?? nearest;
      if (targetRow?.obj.type === 'group' && over === targetRow &&
        clientY < targetRow.rect.top + Math.min(58, targetRow.rect.height * 0.55)) {
        targetParentId = targetRow.obj.id;
        targetIndex = targetRow.obj.children?.length || 0;
        visualDropId = targetRow.obj.id;
      } else if (targetRow) {
        targetParentId = targetRow.parentId;
        targetIndex = targetRow.index + (clientY >= targetRow.centerY ? 1 : 0);
        visualDropId = targetRow.obj.id;
      } else {
        visualDropId = null;
      }
    }

    const nextTree = moveLayerInTree(currentTree, currentDraggingId, targetParentId, targetIndex);
    if (nextTree !== dragTreeRef.current) {
      dragTreeRef.current = nextTree;
      setDragTree(nextTree);
    }
    setDropId(visualDropId);
    return nextTree;
  };

  updateDragPreviewRef.current = updateDragPreviewAtPoint;

  const handlePointerMove = (event: PointerEvent) => {
    const session = dragSessionRef.current;
    if (!session || event.pointerId !== session.pointerId) return;
    event.preventDefault();
    dragPointRef.current = { x: event.clientX, y: event.clientY };
    updateDragPreviewAtPoint(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: PointerEvent) => {
    const session = dragSessionRef.current;
    if (!session || event.pointerId !== session.pointerId) return;
    event.preventDefault();
    dragPointRef.current = { x: event.clientX, y: event.clientY };
    const finalTree = updateDragPreviewRef.current(event.clientX, event.clientY) ?? dragTreeRef.current;
    if (finalTree) {
      const original = JSON.stringify(toOrderNodes(objects));
      const next = JSON.stringify(toOrderNodes(finalTree));
      if (original !== next) controller.reorderLayerTree(toOrderNodes(finalTree));
    }
    clearDragState();
  };

  pointerMoveHandlerRef.current = handlePointerMove;
  pointerUpHandlerRef.current = handlePointerUp;

  useEffect(() => {
    if (!draggingId) return;
    function scheduleAutoScroll() {
      if (autoScrollFrameRef.current !== null) return;
      autoScrollFrameRef.current = requestAnimationFrame(autoScroll);
    }
    function autoScroll() {
      autoScrollFrameRef.current = null;
      const list = listRef.current;
      const point = dragPointRef.current;
      if (!list || !point || !dragSessionRef.current) return;

      const rect = list.getBoundingClientRect();
      const edgeZone = 48;
      let scrollDelta = 0;
      if (point.y < rect.top + edgeZone && list.scrollTop > 0) {
        const strength = Math.min(1, (rect.top + edgeZone - point.y) / edgeZone);
        scrollDelta = -Math.ceil(1 + strength * 9);
      } else if (point.y > rect.bottom - edgeZone && list.scrollTop + list.clientHeight < list.scrollHeight) {
        const strength = Math.min(1, (point.y - (rect.bottom - edgeZone)) / edgeZone);
        scrollDelta = Math.ceil(1 + strength * 9);
      }

      if (!scrollDelta) return;
      const previousTop = list.scrollTop;
      list.scrollTop = Math.max(0, Math.min(list.scrollHeight - list.clientHeight, previousTop + scrollDelta));
      if (list.scrollTop === previousTop) return;
      updateDragPreviewRef.current(point.x, point.y);
      scheduleAutoScroll();
    }
    const onPointerMove = (event: PointerEvent) => {
      pointerMoveHandlerRef.current(event);
      scheduleAutoScroll();
    };
    const onPointerUp = (event: PointerEvent) => pointerUpHandlerRef.current(event);
    const onPointerCancel = (event: PointerEvent) => pointerUpHandlerRef.current(event);

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerCancel, { passive: false });
    scheduleAutoScroll();
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      if (autoScrollFrameRef.current !== null) {
        cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
    };
  }, [draggingId]);

  const startRename = (obj: ObjectMeta) => {
    setEditingId(obj.id);
    setEditingValue(obj.name);
  };

  const finishRename = () => {
    if (!editingId) return;
    const obj = getObjectById(editingId);
    if (obj && editingValue.trim()) controller.renameObject(obj, editingValue);
    setEditingId(null);
    setEditingValue('');
  };

  const handleToggleVisibility = (obj: ObjectMeta) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.toggleVisibility(fabricObj);
  };

  const handleLockModeChange = (obj: ObjectMeta, mode: LayerLockMode) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.setLayerLockMode(fabricObj, mode);
  };

  const handleBlendModeChange = (obj: ObjectMeta, mode: LayerBlendMode) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.setLayerBlendMode(fabricObj, mode);
  };

  const handleLayerExport = async (obj: ObjectMeta, format: LayerExportFormat) => {
    const fabricObj = getObjectById(obj.id);
    if (!fabricObj) return;
    const safeName = obj.name.trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'layer';
    const filename = `${safeName}.${format}`;
    try {
      const content = await controller.exportLayer(fabricObj, format);
      if (Capacitor.isNativePlatform()) {
        const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
          import('@capacitor/filesystem'),
          import('@capacitor/share'),
        ]);
        const written = await Filesystem.writeFile({
          path: filename,
          data: format === 'png' ? content.split(',')[1] : content,
          directory: Directory.Cache,
          ...(format === 'svg' ? { encoding: Encoding.UTF8 } : {}),
        });
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({
          title: `Export ${obj.name}`,
          text: filename,
          url: uri || written.uri,
          dialogTitle: 'Export layer',
        });
        toast({ title: 'Layer export ready', description: 'Choose where to save or share the file.' });
        return;
      }

      const href = format === 'png'
        ? content
        : URL.createObjectURL(new Blob([content], { type: 'image/svg+xml;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (format === 'svg') window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      toast({ title: 'Layer exported', description: filename });
    } catch (error) {
      toast({
        title: 'Layer export failed',
        description: error instanceof Error ? error.message : 'Could not export this layer.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (!pendingDeleteIds?.length) return;
    controller.deleteObjectsByIds(pendingDeleteIds);
    setPendingDeleteIds(null);
  };

  const handleZOrder = (obj: ObjectMeta, action: 'front' | 'back' | 'forward' | 'backward') => {
    const fabricObj = getObjectById(obj.id);
    if (!fabricObj) return;
    if (action === 'front') controller.bringToFront(fabricObj);
    if (action === 'back') controller.sendToBack(fabricObj);
    if (action === 'forward') controller.bringForward(fabricObj);
    if (action === 'backward') controller.sendBackward(fabricObj);
  };

  const handleDuplicate = (obj: ObjectMeta) => {
    controller.selectObjectById(obj.id);
    controller.duplicateSelected();
  };

  const handleToggleSelected = (id: string, checked: boolean) => {
    const nextIds = checked
      ? [...new Set([...checkedIds, id])]
      : checkedIds.filter((selectedId) => selectedId !== id);
    setCheckedIds(nextIds);
    controller.selectObjectsByIds(nextIds);
  };

  const selectedGroup = checkedIds.length === 1 &&
    state.selectedObjectIds.includes(checkedIds[0]) &&
    findLayer(objects, checkedIds[0])?.type === 'group';
  const filterOptions: LayerTypeFilter[] = ['All', 'Text', 'Shapes', 'Images', 'Groups'];

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
        <ResponsiveDrawerWrapper
          className="rounded-t-2xl p-0"
          showCloseButton={false}
          style={{
            maxHeight: '82vh',
            background: 'rgba(13, 17, 23, 0.90)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          data-testid="layers-panel"
        >
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close layers panel"
              data-testid="button-close-layers-panel"
              className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-80 transition-colors hover:bg-white/[0.08] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={(event) => {
                event.stopPropagation();
                dispatch({ type: 'CLOSE_PANEL' });
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </SheetClose>
          <SheetHeader className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0d1117]/95 px-4 pb-3 pt-5 backdrop-blur">
            <div className="relative flex items-start justify-between gap-3 pr-10">
              <div>
                <SheetTitle className="text-sm font-semibold text-foreground">Layers</SheetTitle>
                <p className="mt-1 text-xs text-muted-foreground">Drag to reorder · Drop on folders to organize</p>
              </div>
              {checkedIds.length > 0 && (
                <span className="whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                  {checkedIds.length} selected
                </span>
              )}
            </div>

            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                placeholder="Search layers"
                aria-label="Search layers by name"
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.035] pl-9 pr-3 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-300/20"
                data-testid="layers-search"
              />
            </label>

            <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5" role="group" aria-label="Filter layers by type">
              {filterOptions.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTypeFilter(filter)}
                  aria-pressed={typeFilter === filter}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    typeFilter === filter
                      ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100'
                      : 'border-white/[0.08] bg-white/[0.025] text-slate-400 hover:text-slate-200'
                  }`}
                  data-testid={`layers-filter-${filter.toLowerCase()}`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {checkedIds.length >= 2 && (
              <div
                className="mt-3 rounded-xl border border-cyan-300/20 bg-[#111820]/95 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
                data-testid="layers-bulk-toolbar"
                aria-label={`Bulk actions for ${selectedLayers.length} selected layers`}
              >
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="mr-auto shrink-0 px-1 text-[10px] font-semibold text-cyan-100">
                    {selectedLayers.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 px-2 text-[10px]"
                    onClick={handleGroupSelected}
                    disabled={!canGroupSelected}
                    title={canGroupSelected ? 'Group selected layers' : 'Group sibling layers together'}
                    data-testid="button-group-selected"
                  >
                    <Layers2 size={14} />
                    Group
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => controller.setLayersVisibility(checkedIds, !allSelectedVisible)}
                    aria-label={allSelectedVisible ? 'Hide selected layers' : 'Show selected layers'}
                    title={allSelectedVisible ? 'Hide selected layers' : 'Show selected layers'}
                    data-testid="button-bulk-visibility"
                  >
                    {allSelectedVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleBulkLockToggle}
                    aria-label={allSelectedLocked ? 'Unlock selected layers' : 'Lock selected layers'}
                    title={allSelectedLocked ? 'Unlock selected layers' : 'Lock selected layers'}
                    data-testid="button-bulk-lock"
                  >
                    {allSelectedLocked ? <Unlock size={15} /> : <Lock size={15} />}
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setPendingDeleteIds([...checkedIds])}
                    aria-label="Delete selected layers"
                    title="Delete selected layers"
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2 px-1">
                  <span className="shrink-0 text-[10px] text-slate-400">Opacity</span>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[bulkOpacity]}
                    onValueChange={([value]) => handleBulkOpacityChange(value)}
                    className="flex-1"
                    aria-label="Set opacity for selected layers"
                    data-testid="slider-bulk-opacity"
                  />
                  <span className="w-8 shrink-0 text-right font-mono text-[10px] text-cyan-100">{bulkOpacity}%</span>
                </div>
              </div>
            )}

            {selectedGroup && (
              <Button
                variant="outline"
                className="mt-3 h-10 w-full gap-2 border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => controller.ungroupSelected()}
                data-testid="button-ungroup-selected"
              >
                <Ungroup size={16} />
                Ungroup
              </Button>
            )}
          </SheetHeader>

          {objects.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">No layers yet</div>
          ) : flatLayers.length === 0 ? (
            <div className="flex h-24 flex-col items-center justify-center gap-1 px-4 text-center text-sm text-muted-foreground">
              <span>No layers match this search or filter.</span>
              <button
                type="button"
                className="text-xs text-cyan-200 hover:text-cyan-100"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('All');
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div
              ref={listRef}
              className="overflow-y-auto px-3 pb-5"
              style={{
                maxHeight: checkedIds.length >= 2
                  ? 'calc(82vh - 300px)'
                  : selectedGroup
                    ? 'calc(82vh - 230px)'
                    : 'calc(82vh - 190px)',
              }}
            >
              {flatLayers.map(({ obj, parentId, index, depth }) => {
                const isSelected = checkedIds.includes(obj.id);
                const isSolo = controller.soloObjectId === obj.id;
                return (
                  <LayerCard
                    key={obj.id}
                    obj={obj}
                    lockMode={obj.lockMode}
                    blendMode={obj.blendMode}
                    depth={depth}
                    selected={isSelected}
                    selectedCount={checkedIds.length}
                    solo={isSolo}
                    collapsed={!filteredMode && Boolean(collapsedGroups[obj.id])}
                    dropTarget={dropId === obj.id}
                    dragging={draggingId === obj.id}
                    editing={editingId === obj.id}
                    editingValue={editingValue}
                    cardRef={(node) => {
                      cardRefs.current[obj.id] = node;
                    }}
                    onSelect={() => controller.selectObjectById(obj.id)}
                    onDragStart={(event) => handlePointerDown(event, obj.id)}
                    onSelectChecked={(checked) => handleToggleSelected(obj.id, checked)}
                    onToggleVisibility={() => handleToggleVisibility(obj)}
                    onLockModeChange={(mode) => handleLockModeChange(obj, mode)}
                    onBlendModeChange={(mode) => handleBlendModeChange(obj, mode)}
                    onExport={(format) => void handleLayerExport(obj, format)}
                    onToggleSolo={() => {
                      const fabricObj = getObjectById(obj.id);
                      if (fabricObj) controller.toggleSolo(fabricObj);
                    }}
                    onToggleCollapse={() => {
                      if (!filteredMode) {
                        setCollapsedGroups((current) => ({ ...current, [obj.id]: !current[obj.id] }));
                      }
                    }}
                    onTagChange={(tag) => {
                      const fabricObj = getObjectById(obj.id);
                      if (fabricObj) controller.setLayerTag(fabricObj, tag);
                    }}
                    onZOrder={(action: LayerZOrderAction) => handleZOrder(obj, action)}
                    onStartRename={() => startRename(obj)}
                    onEditingValueChange={setEditingValue}
                    onFinishRename={finishRename}
                    onCancelRename={() => {
                      setEditingId(null);
                      setEditingValue('');
                    }}
                    onTargetSelect={() => controller.selectObjectById(obj.id)}
                    onDuplicate={() => handleDuplicate(obj)}
                    onGroup={handleGroupSelected}
                    onDelete={() => setPendingDeleteIds([obj.id])}
                  />
                );
              })}
            </div>
          )}
        </ResponsiveDrawerWrapper>
      </Sheet>

      <AlertDialog open={Boolean(pendingDeleteIds)} onOpenChange={(open) => !open && setPendingDeleteIds(null)}>
        <AlertDialogContent className="w-[calc(100vw-32px)] max-w-md rounded-2xl border-border bg-[#11141A]">
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingDeleteIds?.length === 1 ? 'Delete layer?' : `Delete ${pendingDeleteIds?.length ?? 0} layers?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteIds?.length === 1
                ? 'Are you sure you want to delete this layer?'
                : 'Are you sure you want to delete all selected layers?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteConfirm} data-testid="button-confirm-delete-layer">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}