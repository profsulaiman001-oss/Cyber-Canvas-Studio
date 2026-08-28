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
        style={{
          background: 'repeating-conic-gradient(#151922 0% 25%, #10131a 0% 50%) 50% / 12px 12px',
        }}
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
        style={{ background: '#11141A' }}
      >
        <div className="h-full w-full rounded-full" style={thumbStyle} />
      </div>
    );
  }

  if (type === 'triangle') {
    return (
      <div
        className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-xl border border-white/10"
        style={{ background: '#11141A' }}
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
        style={{ background: '#11141A' }}
      >
        <span style={{ fontWeight: 700, fontSize: 31, color, lineHeight: 1, opacity: opacity ?? 1 }}>T</span>
      </div>
    );
  }

  if (type === 'line' || type === 'path') {
    return (
      <div
        className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-xl border border-white/10"
        style={{ background: '#11141A' }}
      >
        <div style={{ width: 48, height: 5, background: color, borderRadius: 4, opacity: opacity ?? 1 }} />
      </div>
    );
  }

  return (
    <div className="h-[84px] w-[84px] flex-shrink-0 rounded-xl border border-white/10 p-3" style={{ background: '#11141A' }}>
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
          <p className="mt-1 text-xs text-muted-foreground">Drag to reorder · Check layers to group</p>
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
                     className="mb-3 grid min-h-[154px] grid-cols-[28px_1fr] gap-4 rounded-2xl border p-4 transition-colors"
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
                       <GripVertical size={20} className="cursor-grab text-muted-foreground" />
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

                       <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-3" onClick={(e) => e.stopPropagation()}>
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