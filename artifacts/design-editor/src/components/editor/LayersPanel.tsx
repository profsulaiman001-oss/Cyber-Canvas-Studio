import { useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  GripVertical,
  Pencil,
  Layers2,
  Ungroup,
  ChevronsUp,
  ChevronsDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Sheet, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { CanvasController, ObjectMeta } from '@/hooks/useFabricCanvas';
import { ResponsiveDrawerWrapper } from './ResponsiveDrawerWrapper';

interface LayersPanelProps {
  controller: CanvasController;
}

/* ─── Shape thumbnail ─── */
const thumbnailSurfaceStyle = {
  background: 'repeating-conic-gradient(#303640 0% 25%, #222831 0% 50%) 50% / 12px 12px',
};

function LayerThumb({
  type,
  fill,
  stroke,
  opacity,
  imgSrc,
  thumbnailSrc,
}: {
  type: string;
  fill?: string;
  stroke?: string;
  opacity?: number;
  imgSrc?: string;
  thumbnailSrc?: string;
}) {
  // The rendered thumbnail is preferred because it includes Fabric gradients,
  // patterns, strokes, opacity, filters, and image textures.
  if (thumbnailSrc || imgSrc) {
    return (
      <div
        className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10"
        style={thumbnailSurfaceStyle}
      >
        <img
          src={thumbnailSrc || imgSrc}
          alt=""
          draggable={false}
          className="h-full w-full object-contain p-1.5"
          style={{ opacity: thumbnailSrc ? 1 : opacity ?? 1 }}
        />
      </div>
    );
  }

  // A string fill is the most accurate fallback for objects whose thumbnail
  // is temporarily unavailable. Use stroke before grey so outlined vectors
  // retain their actual current color.
  const color = fill || stroke || '#9CA3AF';
  const thumbStyle = { background: color, opacity: opacity ?? 1 };

  if (type === 'circle') {
    return (
      <div
        className="h-[84px] w-[84px] flex-shrink-0 rounded-xl border border-white/10 p-4"
        style={thumbnailSurfaceStyle}
      >
        <div className="h-full w-full rounded-full" style={thumbStyle} />
      </div>
    );
  }

  if (type === 'triangle') {
    return (
      <div
        className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-xl border border-white/10"
        style={thumbnailSurfaceStyle}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '17px solid transparent',
            borderRight: '17px solid transparent',
            borderBottom: `38px solid ${color}`,
            opacity: opacity ?? 1,
          }}
        />
      </div>
    );
  }

  if (type === 'i-text' || type === 'text' || type === 'textbox') {
    return (
      <div
        className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-xl border border-white/10"
        style={thumbnailSurfaceStyle}
      >
        <span style={{ fontWeight: 700, fontSize: 31, color, lineHeight: 1, opacity: opacity ?? 1 }}>T</span>
      </div>
    );
  }

  if (type === 'line' || type === 'path') {
    return (
      <div
        className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-xl border border-white/10"
        style={thumbnailSurfaceStyle}
      >
        <div style={{ width: 48, height: 5, background: color, borderRadius: 4, opacity: opacity ?? 1 }} />
      </div>
    );
  }

  return (
    <div className="h-[84px] w-[84px] flex-shrink-0 rounded-xl border border-white/10 p-3" style={thumbnailSurfaceStyle}>
      <div className="h-full w-full rounded-lg" style={thumbStyle} />
    </div>
  );
}

export default function LayersPanel({ controller }: LayersPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'layers';
  const { objects, getObjectById } = controller;
  const selectedIds = state.selectedObjectIds;
  const [pendingDelete, setPendingDelete] = useState<ObjectMeta | null>(null);

  /* ─── Pointer drag-and-drop state ─── */
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragIdRef = useRef<string | null>(null);
  const dragOrderIdsRef = useRef<string[] | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [dragOrderIds, setDragOrderIds] = useState<string[] | null>(null);

  const orderedObjects = dragOrderIds
    ? dragOrderIds
      .map((id) => objects.find((item) => item.id === id))
      .filter((item): item is ObjectMeta => Boolean(item))
    : objects;

  const clearDragState = () => {
    dragIdRef.current = null;
    dragOrderIdsRef.current = null;
    setDraggingIdx(null);
    setDropIdx(null);
    setDragOrderIds(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const ids = objects.map((item) => item.id);
    dragIdRef.current = id;
    dragOrderIdsRef.current = ids;
    setDragOrderIds(ids);
    setDraggingIdx(ids.indexOf(id));
    setDropIdx(ids.indexOf(id));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const draggedId = dragIdRef.current;
    const currentIds = dragOrderIdsRef.current;
    if (!draggedId || !currentIds) return;
    e.preventDefault();

    const remainingIds = currentIds.filter((id) => id !== draggedId);
    let insertionIndex = remainingIds.length;
    for (let index = 0; index < remainingIds.length; index += 1) {
      const card = cardRefs.current[remainingIds[index]];
      if (!card) continue;
      const rect = card.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        insertionIndex = index;
        break;
      }
    }

    const nextIds = [...remainingIds];
    nextIds.splice(insertionIndex, 0, draggedId);
    const changed = nextIds.some((id, index) => id !== currentIds[index]);
    if (!changed) return;

    dragOrderIdsRef.current = nextIds;
    setDragOrderIds(nextIds);
    setDraggingIdx(insertionIndex);
    setDropIdx(insertionIndex);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const finalIds = dragOrderIdsRef.current;
    const draggedId = dragIdRef.current;
    if (!finalIds || !draggedId) {
      clearDragState();
      return;
    }

    e.preventDefault();
    const originalIds = objects.map((item) => item.id);
    const changed = finalIds.some((id, index) => id !== originalIds[index]);
    if (changed) {
      const orderedFabricObjects = finalIds
        .map((id) => getObjectById(id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      controller.reorderObjects(orderedFabricObjects);
    }
    clearDragState();
  };

  const handleToggleVisibility = (obj: ObjectMeta) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.toggleVisibility(fabricObj);
  };

  const handleToggleLock = (obj: ObjectMeta) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.toggleLock(fabricObj);
  };

  const handleEdit = (obj: ObjectMeta) => {
    controller.selectObjectById(obj.id);
    const isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox';
    dispatch({ type: 'TOGGLE_PANEL', payload: isText ? 'text' : 'properties' });
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

  const handleToggleSelected = (id: string, checked: boolean) => {
    const nextIds = checked
      ? [...new Set([...selectedIds, id])]
      : selectedIds.filter((selectedId) => selectedId !== id);
    controller.selectObjectsByIds(nextIds);
  };

  const handleCardClick = (obj: ObjectMeta) => {
    controller.selectObjectById(obj.id);
  };

  const selectedGroup =
    selectedIds.length === 1 && objects.find((obj) => obj.id === selectedIds[0])?.type === 'group';

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
        <ResponsiveDrawerWrapper
          className="rounded-t-2xl p-0"
          style={{ maxHeight: '82vh', background: '#11141A', border: 'none' }}
          data-testid="layers-panel"
        >
          <SheetHeader className="px-4 pb-3 pt-5">
            <div className="relative flex items-start justify-between gap-3 pr-10">
              <div>
                <SheetTitle className="text-sm font-semibold text-foreground">Layers</SheetTitle>
                <p className="mt-1 text-xs text-muted-foreground">Drag to reorder · Check layers to group</p>
              </div>
              {selectedIds.length > 0 && (
                <div className="flex shrink-0 items-center gap-3">
                  <span className="whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                    {selectedIds.length} selected
                  </span>
                </div>
              )}
            </div>
            {selectedIds.length >= 2 && (
              <Button
                className="mt-3 h-10 w-full gap-2"
                onClick={() => controller.groupSelected()}
                data-testid="button-group-selected"
              >
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
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              No layers yet
            </div>
          ) : (
            <div className="overflow-y-auto px-3 pb-5" style={{ maxHeight: 'calc(82vh - 132px)' }}>
              {orderedObjects.map((obj, idx) => {
                const isSelected = selectedIds.includes(obj.id);
                return (
                  <div
                    key={obj.id}
                    ref={(node) => {
                      cardRefs.current[obj.id] = node;
                    }}
                    onClick={() => handleCardClick(obj)}
                    className="mb-3 grid min-h-[154px] grid-cols-[28px_1fr] gap-4 rounded-2xl border p-4 transition-[background-color,border-color,box-shadow,opacity]"
                    style={{
                      background: isSelected ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.025)',
                      borderColor: isSelected ? 'rgba(0,245,255,0.6)' : 'rgba(255,255,255,0.08)',
                      borderLeftWidth: isSelected ? 3 : 1,
                      borderLeftColor: isSelected ? '#00F5FF' : 'rgba(255,255,255,0.08)',
                      opacity: draggingIdx === idx ? 0.72 : obj.visible ? 1 : 0.56,
                      boxShadow: dropIdx === idx && draggingIdx !== null
                        ? 'inset 0 3px 0 rgba(0,245,255,0.9), 0 0 0 1px rgba(0,245,255,0.35)'
                        : undefined,
                    }}
                    data-testid={`layer-item-${obj.id}`}
                  >
                    <div className="flex flex-col items-center justify-between py-1">
                       <div
                          onPointerDown={(e) => handlePointerDown(e, obj.id)}
                          onPointerMove={handlePointerMove}
                          onPointerUp={handlePointerUp}
                          onPointerCancel={clearDragState}
                          className="cursor-grab rounded-lg p-1 text-muted-foreground hover:bg-white/10 active:cursor-grabbing"
                          style={{ touchAction: 'none' }}
                         title={`Drag ${obj.name} to reorder`}
                         aria-label={`Drag ${obj.name} to reorder`}
                       >
                         <GripVertical size={20} />
                       </div>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleToggleSelected(obj.id, checked === true)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${obj.name}`}
                         className="h-6 w-6"
                        data-testid={`layer-select-${obj.id}`}
                      />
                    </div>

                    <div className="flex min-w-0 flex-col gap-4">
                       <div className="flex min-w-0 items-center gap-4">
                         <LayerThumb type={obj.type} fill={obj.fill} stroke={obj.stroke} opacity={obj.opacity} imgSrc={obj.imgSrc} thumbnailSrc={obj.thumbnailSrc} />
                        <div className="min-w-0 flex-1">
                          <p
                             className="truncate text-[15px] font-semibold text-foreground"
                            title={obj.name}
                            style={{ color: obj.visible ? undefined : '#6b7280' }}
                          >
                            {obj.name}
                          </p>
                           <p className="mt-1 truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                            {obj.type === 'textbox' || obj.type === 'i-text' ? 'Text' : obj.type}
                          </p>
                        </div>
                      </div>

                       <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-white/5 pt-3" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => handleZOrder(obj, 'front')}
                          aria-label={`Bring ${obj.name} to front`}
                          title="Bring to front"
                          data-testid={`layer-front-${obj.id}`}
                        >
                          <ChevronsUp size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => handleZOrder(obj, 'forward')}
                          aria-label={`Bring ${obj.name} forward`}
                          title="Bring forward"
                          data-testid={`layer-forward-${obj.id}`}
                        >
                          <ArrowUp size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => handleZOrder(obj, 'backward')}
                          aria-label={`Send ${obj.name} backward`}
                          title="Send backward"
                          data-testid={`layer-backward-${obj.id}`}
                        >
                          <ArrowDown size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => handleZOrder(obj, 'back')}
                          aria-label={`Send ${obj.name} to back`}
                          title="Send to back"
                          data-testid={`layer-back-${obj.id}`}
                        >
                          <ChevronsDown size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                           className="h-11 w-11 rounded-xl"
                          onClick={() => handleToggleVisibility(obj)}
                          aria-label={obj.visible ? `Hide ${obj.name}` : `Show ${obj.name}`}
                          data-testid={`layer-visibility-${obj.id}`}
                        >
                          {obj.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                           className="h-11 w-11 rounded-xl"
                          onClick={() => handleToggleLock(obj)}
                          aria-label={obj.selectable ? `Lock ${obj.name}` : `Unlock ${obj.name}`}
                          data-testid={`layer-lock-${obj.id}`}
                        >
                          {obj.selectable ? <Unlock size={16} /> : <Lock size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                           className="h-11 w-11 rounded-xl"
                          onClick={() => handleEdit(obj)}
                          aria-label={`Edit ${obj.name}`}
                          data-testid={`layer-edit-${obj.id}`}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                           className="h-11 w-11 rounded-xl text-destructive hover:text-destructive"
                          onClick={() => setPendingDelete(obj)}
                          aria-label={`Delete ${obj.name}`}
                          data-testid={`layer-delete-${obj.id}`}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
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
            <AlertDialogDescription>
              Are you sure you want to delete this layer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              data-testid="button-confirm-delete-layer"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}