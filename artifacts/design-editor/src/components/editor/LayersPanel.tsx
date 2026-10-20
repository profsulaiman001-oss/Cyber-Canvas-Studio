import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Layers2, Ungroup, X } from 'lucide-react';
import { Sheet, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
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
  const selectedIds = state.selectedObjectIds;
  const [pendingDelete, setPendingDelete] = useState<ObjectMeta | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
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

  const displayedTree = dragTree || objects;
  const flatLayers = flattenLayers(displayedTree, collapsedGroups);

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

    const flat = flattenLayers(currentTree, collapsedGroups);
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
    if (!pendingDelete) return;
    const fabricObj = getObjectById(pendingDelete.id);
    if (fabricObj) controller.deleteObject(fabricObj);
    setPendingDelete(null);
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
      ? [...new Set([...selectedIds, id])]
      : selectedIds.filter((selectedId) => selectedId !== id);
    controller.selectObjectsByIds(nextIds);
  };

  const selectedGroup = selectedIds.length === 1 && findLayer(objects, selectedIds[0])?.type === 'group';

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
          <SheetHeader className="px-4 pb-3 pt-5">
            <div className="relative flex items-start justify-between gap-3 pr-10">
              <div>
                <SheetTitle className="text-sm font-semibold text-foreground">Layers</SheetTitle>
                <p className="mt-1 text-xs text-muted-foreground">Drag to reorder · Drop on folders to organize</p>
              </div>
              {selectedIds.length > 0 && (
                <span className="whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                  {selectedIds.length} selected
                </span>
              )}
            </div>
            {selectedIds.length >= 2 && (
              <Button className="mt-3 h-10 w-full gap-2" onClick={() => controller.groupSelected()} data-testid="button-group-selected">
                <Layers2 size={16} />
                Group Selected
              </Button>
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
          ) : (
            <div ref={listRef} className="overflow-y-auto px-3 pb-5" style={{ maxHeight: 'calc(82vh - 132px)' }}>
              {flatLayers.map(({ obj, parentId, index, depth }) => {
                const isSelected = selectedIds.includes(obj.id);
                const isSolo = controller.soloObjectId === obj.id;
                return (
                  <LayerCard
                    key={obj.id}
                    obj={obj}
                    lockMode={obj.lockMode}
                    blendMode={obj.blendMode}
                    depth={depth}
                    selected={isSelected}
                    selectedCount={selectedIds.length}
                    solo={isSolo}
                    collapsed={Boolean(collapsedGroups[obj.id])}
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
                    onToggleCollapse={() => setCollapsedGroups((current) => ({ ...current, [obj.id]: !current[obj.id] }))}
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
                    onGroup={() => controller.groupSelected()}
                    onDelete={() => setPendingDelete(obj)}
                  />
                );
              })}
            </div>
          )}
        </ResponsiveDrawerWrapper>
      </Sheet>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent className="w-[calc(100vw-32px)] max-w-md rounded-2xl border-border bg-[#11141A]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete layer?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this layer?</AlertDialogDescription>
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