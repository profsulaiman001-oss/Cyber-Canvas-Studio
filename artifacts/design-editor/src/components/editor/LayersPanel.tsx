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
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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

interface LayersPanelProps {
  controller: CanvasController;
}

/* ─── Shape thumbnail ─── */
function LayerThumb({
  type,
  fill,
  thumbnailSrc,
}: {
  type: string;
  fill?: string;
  thumbnailSrc?: string;
}) {
  // The rendered thumbnail is preferred because it includes Fabric gradients,
  // patterns, strokes, opacity, filters, and image textures.
  if (thumbnailSrc) {
    return (
      <div
        className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border"
        style={{
          background: 'repeating-conic-gradient(#242832 0% 25%, #1b1e25 0% 50%) 50% / 10px 10px',
        }}
      >
        <img
          src={thumbnailSrc}
          alt=""
          draggable={false}
          className="h-full w-full object-contain p-1"
        />
      </div>
    );
  }

  const color = fill || '#6b7280';

  if (type === 'circle') {
    return (
      <div
        className="h-16 w-16 flex-shrink-0 rounded-lg border border-border p-3"
        style={{ background: '#1a1d24' }}
      >
        <div className="h-full w-full rounded-full" style={{ background: color }} />
      </div>
    );
  }

  if (type === 'triangle') {
    return (
      <div
        className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-border"
        style={{ background: '#1a1d24' }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: '17px solid transparent',
            borderRight: '17px solid transparent',
            borderBottom: `30px solid ${color}`,
          }}
        />
      </div>
    );
  }

  if (type === 'i-text' || type === 'text' || type === 'textbox') {
    return (
      <div
        className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-border"
        style={{ background: '#1a1d24' }}
      >
        <span style={{ fontWeight: 700, fontSize: 27, color, lineHeight: 1 }}>T</span>
      </div>
    );
  }

  if (type === 'line' || type === 'path') {
    return (
      <div
        className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-border"
        style={{ background: '#1a1d24' }}
      >
        <div style={{ width: 38, height: 4, background: color, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div className="h-16 w-16 flex-shrink-0 rounded-lg border border-border p-2" style={{ background: '#1a1d24' }}>
      <div className="h-full w-full rounded-md" style={{ background: color }} />
    </div>
  );
}

export default function LayersPanel({ controller }: LayersPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'layers';
  const { objects, getObjectById } = controller;
  const selectedIds = state.selectedObjectIds;
  const [pendingDelete, setPendingDelete] = useState<ObjectMeta | null>(null);

  /* ─── Drag-and-drop state ─── */
  const dragFromIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragFromIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  };

  const handleDrop = (toIdx: number) => {
    const fromIdx = dragFromIdx.current;
    if (fromIdx === null || fromIdx === toIdx) {
      dragFromIdx.current = null;
      dragOverIdx.current = null;
      return;
    }
    const total = objects.length;
    // Panel order is reversed relative to canvas stack.
    const toCanvasIdx = total - 1 - toIdx;
    const obj = getObjectById(objects[fromIdx].id);
    if (obj) controller.moveObjectToIndex(obj, toCanvasIdx);
    dragFromIdx.current = null;
    dragOverIdx.current = null;
  };

  const handleDragEnd = () => {
    dragFromIdx.current = null;
    dragOverIdx.current = null;
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
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0"
          style={{ maxHeight: '82vh', background: '#11141A', border: 'none' }}
          data-testid="layers-panel"
        >
          <SheetHeader className="px-4 pb-3 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <SheetTitle className="text-sm font-semibold text-foreground">Layers</SheetTitle>
                <p className="mt-1 text-xs text-muted-foreground">Drag to reorder · Select layers to group</p>
              </div>
              {selectedIds.length > 0 && (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                  {selectedIds.length} selected
                </span>
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
              {objects.map((obj, idx) => {
                const isSelected = selectedIds.includes(obj.id);
                return (
                  <div
                    key={obj.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleCardClick(obj)}
                    className="mb-3 grid min-h-[116px] grid-cols-[24px_1fr] gap-3 rounded-xl border p-3 transition-colors"
                    style={{
                      background: isSelected ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.025)',
                      borderColor: isSelected ? 'rgba(0,245,255,0.6)' : 'rgba(255,255,255,0.08)',
                      borderLeftWidth: isSelected ? 3 : 1,
                      borderLeftColor: isSelected ? '#00F5FF' : 'rgba(255,255,255,0.08)',
                      opacity: obj.visible ? 1 : 0.56,
                    }}
                    data-testid={`layer-item-${obj.id}`}
                  >
                    <div className="flex flex-col items-center justify-between py-1">
                      <GripVertical size={18} className="cursor-grab text-muted-foreground" />
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleToggleSelected(obj.id, checked === true)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${obj.name}`}
                        className="h-5 w-5"
                        data-testid={`layer-select-${obj.id}`}
                      />
                    </div>

                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <LayerThumb type={obj.type} fill={obj.fill} thumbnailSrc={obj.thumbnailSrc} />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-semibold text-foreground"
                            title={obj.name}
                            style={{ color: obj.visible ? undefined : '#6b7280' }}
                          >
                            {obj.name}
                          </p>
                          <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                            {obj.type === 'textbox' || obj.type === 'i-text' ? 'Text' : obj.type}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 border-t border-white/5 pt-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-lg"
                          onClick={() => handleToggleVisibility(obj)}
                          aria-label={obj.visible ? `Hide ${obj.name}` : `Show ${obj.name}`}
                          data-testid={`layer-visibility-${obj.id}`}
                        >
                          {obj.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-lg"
                          onClick={() => handleToggleLock(obj)}
                          aria-label={obj.selectable ? `Lock ${obj.name}` : `Unlock ${obj.name}`}
                          data-testid={`layer-lock-${obj.id}`}
                        >
                          {obj.selectable ? <Unlock size={16} /> : <Lock size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-lg"
                          onClick={() => handleEdit(obj)}
                          aria-label={`Edit ${obj.name}`}
                          data-testid={`layer-edit-${obj.id}`}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-lg text-destructive hover:text-destructive"
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
        </SheetContent>
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