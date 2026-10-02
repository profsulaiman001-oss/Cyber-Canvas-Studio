import { useRef, useState } from 'react';
import { Layers2, Ungroup } from 'lucide-react';
import { Sheet, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
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
import type { CanvasController, LayerOrderNode, ObjectMeta } from '@/hooks/useFabricCanvas';
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
  let insertAt = Math.max(0, Math.min(targetIndex, targetChildren.length));
  if (removed.parentId === targetParentId && removed.index < insertAt) insertAt -= 1;
  targetChildren.splice(Math.max(0, insertAt), 0, removed.node);
  return next;
}

function toOrderNodes(nodes: ObjectMeta[]): LayerOrderNode[] {
  return nodes.map((node) => ({
    id: node.id,
    children: node.children ? toOrderNodes(node.children) : [],
  }));
}

export default function LayersPanel({ controller }: LayersPanelProps) {
  const { state, dispatch } = useEditor();
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
  const listRef = useRef<HTMLDivElement | null>(null);

  const displayedTree = dragTree || objects;
  const flatLayers = flattenLayers(displayedTree, collapsedGroups);

  const clearDragState = () => {
    dragTreeRef.current = null;
    setDragTree(null);
    setDraggingId(null);
    setDropId(null);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const initialTree = cloneLayerTree(objects);
    dragTreeRef.current = initialTree;
    setDragTree(initialTree);
    setDraggingId(id);
    setDropId(id);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const currentTree = dragTreeRef.current;
    const currentDraggingId = draggingId;
    if (!currentTree || !currentDraggingId) return;
    event.preventDefault();

    const flat = flattenLayers(currentTree, collapsedGroups);
    const over = flat.find(({ obj }) => {
      const card = cardRefs.current[obj.id];
      if (!card) return false;
      const rect = card.getBoundingClientRect();
      return event.clientY >= rect.top && event.clientY <= rect.bottom;
    });

    let targetParentId: string | null = null;
    let targetIndex = currentTree.length;
    let visualDropId: string | null = over?.obj.id || null;

    if (over) {
      const overCard = cardRefs.current[over.obj.id];
      const overRect = overCard?.getBoundingClientRect();
      const listRect = listRef.current?.getBoundingClientRect();
      const isRootIntent = Boolean(listRect && event.clientX < listRect.left + 52);
      if (isRootIntent) {
        const rootRows = flat.filter((row) => row.parentId === null);
        const rootOver = rootRows.find((row) => {
          const card = cardRefs.current[row.obj.id];
          const rect = card?.getBoundingClientRect();
          return rect && event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
        targetIndex = rootOver ? rootOver.index + (event.clientY >= (cardRefs.current[rootOver.obj.id]?.getBoundingClientRect().top || 0) + (cardRefs.current[rootOver.obj.id]?.getBoundingClientRect().height || 0) / 2 ? 1 : 0) : currentTree.length;
        visualDropId = rootOver?.obj.id || null;
      } else if (over.obj.type === 'group' && overRect && event.clientY < overRect.top + Math.min(58, overRect.height * 0.55)) {
        targetParentId = over.obj.id;
        targetIndex = over.obj.children?.length || 0;
      } else {
        targetParentId = over.parentId;
        targetIndex = over.index + (overRect && event.clientY >= overRect.top + overRect.height / 2 ? 1 : 0);
      }
    }

    const nextTree = moveLayerInTree(currentTree, currentDraggingId, targetParentId, targetIndex);
    if (nextTree !== currentTree) {
      dragTreeRef.current = nextTree;
      setDragTree(nextTree);
    }
    setDropId(visualDropId);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const finalTree = dragTreeRef.current;
    if (finalTree) {
      const original = JSON.stringify(toOrderNodes(objects));
      const next = JSON.stringify(toOrderNodes(finalTree));
      if (original !== next) controller.reorderLayerTree(toOrderNodes(finalTree));
    }
    event.preventDefault();
    clearDragState();
  };

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

  const handleToggleLock = (obj: ObjectMeta) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.toggleLock(fabricObj);
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
          style={{
            maxHeight: '82vh',
            background: 'rgba(13, 17, 23, 0.90)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          data-testid="layers-panel"
        >
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
                    onDragMove={handlePointerMove}
                    onDragEnd={handlePointerUp}
                    onDragCancel={clearDragState}
                    onSelectChecked={(checked) => handleToggleSelected(obj.id, checked)}
                    onToggleVisibility={() => handleToggleVisibility(obj)}
                    onToggleLock={() => handleToggleLock(obj)}
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