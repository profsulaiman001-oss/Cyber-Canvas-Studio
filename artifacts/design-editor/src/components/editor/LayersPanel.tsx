import { useRef } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, GripVertical } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController, ObjectMeta } from '@/hooks/useFabricCanvas';

interface LayersPanelProps {
  controller: CanvasController;
}

/* ─── Shape thumbnail ─── */
function LayerThumb({ type, fill, imgSrc }: { type: string; fill?: string; imgSrc?: string }) {
  const color = fill && /^#[0-9a-fA-F]{3,8}$/.test(fill) ? fill : '#6b7280';

  if (type === 'image' && imgSrc) {
    return (
      <img
        src={imgSrc}
        draggable={false}
        className="rounded flex-shrink-0 object-cover border border-border"
        style={{ width: 32, height: 32 }}
      />
    );
  }

  if (type === 'circle') {
    return (
      <div
        className="flex-shrink-0 border border-border"
        style={{ width: 32, height: 32, borderRadius: '50%', background: color }}
      />
    );
  }

  if (type === 'triangle') {
    return (
      <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 32, height: 32 }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: '13px solid transparent',
          borderRight: '13px solid transparent',
          borderBottom: `22px solid ${color}`,
        }} />
      </div>
    );
  }

  if (type === 'i-text' || type === 'text') {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center rounded border border-border"
        style={{ width: 32, height: 32, background: '#1a1d24' }}
      >
        <span style={{ fontWeight: 700, fontSize: 17, color, lineHeight: 1 }}>T</span>
      </div>
    );
  }

  if (type === 'line' || type === 'path') {
    return (
      <div
        className="flex-shrink-0 flex items-center justify-center rounded border border-border"
        style={{ width: 32, height: 32, background: '#1a1d24' }}
      >
        <div style={{ width: 22, height: 2.5, background: color, borderRadius: 2 }} />
      </div>
    );
  }

  // Default: rectangle / star / polygon / unknown
  return (
    <div
      className="flex-shrink-0 rounded border border-border"
      style={{ width: 32, height: 32, background: color }}
    />
  );
}

export default function LayersPanel({ controller }: LayersPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'layers';
  const { objects, selectedObject, getObjectById } = controller;

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
    // Panel order is reversed relative to canvas stack
    const fromCanvasIdx = total - 1 - fromIdx;
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

  const handleDelete = (obj: ObjectMeta) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.deleteObject(fabricObj);
  };

  const selectedId = selectedObject
    ? (selectedObject as unknown as { _uid?: string })._uid
    : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '62vh', background: '#11141A', border: 'none' }}
        data-testid="layers-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold text-foreground">Layers</SheetTitle>
          <p className="text-xs text-muted-foreground">Drag to reorder</p>
        </SheetHeader>

        {objects.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            No layers yet
          </div>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(62vh - 70px)' }}>
            {objects.map((obj, idx) => {
              const isSelected = obj.id === selectedId;
              return (
                <div
                  key={obj.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => controller.selectObjectById(obj.id)}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
                  style={{
                    background: isSelected ? 'rgba(0,245,255,0.08)' : 'transparent',
                    borderLeft: isSelected ? '2px solid #00F5FF' : '2px solid transparent',
                    opacity: obj.visible ? 1 : 0.5,
                  }}
                  data-testid={`layer-item-${obj.id}`}
                >
                  {/* Drag handle */}
                  <GripVertical size={13} className="text-muted-foreground flex-shrink-0 cursor-grab" />

                  {/* Thumbnail */}
                  <LayerThumb type={obj.type} fill={obj.fill} imgSrc={obj.imgSrc} />

                  {/* Name */}
                  <span
                    className="flex-1 text-xs truncate min-w-0"
                    style={{ color: obj.visible ? 'inherit' : '#4b5563' }}
                  >
                    {obj.name}
                  </span>

                  {/* Controls */}
                  <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => handleToggleVisibility(obj)}
                      data-testid={`layer-visibility-${obj.id}`}
                    >
                      {obj.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => handleToggleLock(obj)}
                      data-testid={`layer-lock-${obj.id}`}
                    >
                      {obj.selectable ? <Unlock size={13} /> : <Lock size={13} />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(obj)}
                      data-testid={`layer-delete-${obj.id}`}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
