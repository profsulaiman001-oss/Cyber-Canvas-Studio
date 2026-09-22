import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Eye,
  EyeOff,
  Folder,
  GripVertical,
  Layers2,
  Lock,
  Pencil,
  Target,
  Trash2,
  Ungroup,
  Unlock,
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
import { CanvasController, LayerOrderNode, LayerTag, ObjectMeta } from '@/hooks/useFabricCanvas';
import { ResponsiveDrawerWrapper } from './ResponsiveDrawerWrapper';

interface LayersPanelProps {
  controller: CanvasController;
}

const TAG_COLORS: Record<LayerTag, string> = {
  red: '#FF4D6D',
  cyan: '#00F5FF',
  yellow: '#FFD166',
  green: '#34D399',
  purple: '#A78BFA',
};

const TAG_LABELS: Record<LayerTag, string> = {
  red: 'Red',
  cyan: 'Cyan',
  yellow: 'Yellow',
  green: 'Green',
  purple: 'Purple',
};

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
  if (thumbnailSrc || imgSrc) {
    return (
      <div
        className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10"
        style={{ background: 'repeating-conic-gradient(#151922 0% 25%, #10131a 0% 50%) 50% / 12px 12px' }}
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

  const color = fill || stroke || '#9CA3AF';
  const thumbStyle = { background: color, opacity: opacity ?? 1 };

  if (type === 'circle') {
    return (
      <div className="h-[72px] w-[72px] flex-shrink-0 rounded-xl border border-white/10 p-4" style={{ background: '#11141A' }}>
        <div className="h-full w-full rounded-full" style={thumbStyle} />
      </div>
    );
  }

  if (type === 'triangle') {
    return (
      <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-xl border border-white/10" style={{ background: '#11141A' }}>
        <div style={{ width: 0, height: 0, borderLeft: '17px solid transparent', borderRight: '17px solid transparent', borderBottom: `38px solid ${color}`, opacity: opacity ?? 1 }} />
      </div>
    );
  }

  if (type === 'i-text' || type === 'text' || type === 'textbox') {
    return (
      <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-xl border border-white/10" style={{ background: '#11141A' }}>
        <span style={{ fontWeight: 700, fontSize: 28, color, lineHeight: 1, opacity: opacity ?? 1 }}>T</span>
      </div>
    );
  }

  if (type === 'line' || type === 'path') {
    return (
      <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-xl border border-white/10" style={{ background: '#11141A' }}>
        <div style={{ width: 46, height: 5, background: color, borderRadius: 4, opacity: opacity ?? 1 }} />
      </div>
    );
  }

  return (
    <div className="h-[72px] w-[72px] flex-shrink-0 rounded-xl border border-white/10 p-3" style={{ background: '#11141A' }}>
      <div className="h-full w-full rounded-lg" style={thumbStyle} />
    </div>
  );
}

function ColorTagSelector({
  name,
  value,
  onChange,
}: {
  name: string;
  value?: LayerTag;
  onChange: (tag?: LayerTag) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        aria-label={`Color tag for ${name}`}
        title="Color tag"
      >
        <span className="h-3.5 w-3.5 rounded-full border border-white/30" style={{ background: value ? TAG_COLORS[value] : 'transparent' }} />
      </Button>
      {open && (
        <div
          className="absolute bottom-full right-0 z-20 mb-2 flex items-center gap-1 rounded-xl border border-white/10 bg-[#171B24] p-1.5 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          {(Object.keys(TAG_COLORS) as LayerTag[]).map((tag) => (
            <button
              key={tag}
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10"
              onClick={() => {
                onChange(tag);
                setOpen(false);
              }}
              aria-label={`Set ${TAG_LABELS[tag]} tag`}
              title={TAG_LABELS[tag]}
            >
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: TAG_COLORS[tag] }} />
            </button>
          ))}
          {value && (
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/10 hover:text-foreground"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              aria-label="Clear color tag"
              title="Clear tag"
            >
              <span className="h-3.5 w-3.5 rounded-full border border-white/40" />
            </button>
          )}
        </div>
      )}
    </div>
  );
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
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editingId) editingInputRef.current?.focus();
  }, [editingId]);

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

  const selectedGroup = selectedIds.length === 1 && findLayer(objects, selectedIds[0])?.type === 'group';

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
                const isGroup = obj.type === 'group';
                const isSolo = controller.soloObjectId === obj.id;
                const accentColor = obj.tag ? TAG_COLORS[obj.tag] : isSelected ? '#00F5FF' : 'rgba(255,255,255,0.08)';
                return (
                  <div
                    key={obj.id}
                    ref={(node) => {
                      cardRefs.current[obj.id] = node;
                    }}
                    onClick={() => controller.selectObjectById(obj.id)}
                    className="relative mb-3 grid min-h-[146px] grid-cols-[28px_1fr] gap-3 rounded-2xl border p-3 transition-[background-color,border-color,box-shadow,opacity]"
                    style={{
                      marginLeft: Math.min(depth, 4) * 16,
                      background: isSelected ? 'rgba(0,245,255,0.1)' : 'rgba(255,255,255,0.025)',
                      borderColor: isSelected ? 'rgba(0,245,255,0.6)' : 'rgba(255,255,255,0.08)',
                      borderLeftWidth: 3,
                      borderLeftColor: accentColor,
                      opacity: draggingId === obj.id ? 0.68 : obj.visible ? 1 : 0.56,
                      boxShadow: dropId === obj.id && draggingId ? '0 0 0 1px rgba(0,245,255,0.45), inset 0 3px 0 rgba(0,245,255,0.9)' : undefined,
                    }}
                    data-testid={`layer-item-${obj.id}`}
                  >
                    <div className="flex flex-col items-center justify-between py-1">
                      <div
                        onPointerDown={(event) => handlePointerDown(event, obj.id)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={clearDragState}
                        className="cursor-grab rounded-lg p-1 text-muted-foreground hover:bg-white/10 active:cursor-grabbing"
                        style={{ touchAction: 'none' }}
                        title={`Drag ${obj.name} to reorder or organize`}
                        aria-label={`Drag ${obj.name} to reorder or organize`}
                      >
                        <GripVertical size={20} />
                      </div>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleToggleSelected(obj.id, checked === true)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${obj.name}`}
                        className="h-6 w-6"
                        data-testid={`layer-select-${obj.id}`}
                      />
                    </div>

                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {isGroup ? (
                          <button
                            type="button"
                            className="absolute left-[-13px] top-4 z-10 rounded-md bg-[#11141A] p-0.5 text-muted-foreground hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCollapsedGroups((current) => ({ ...current, [obj.id]: !current[obj.id] }));
                            }}
                            aria-label={collapsedGroups[obj.id] ? `Expand ${obj.name}` : `Collapse ${obj.name}`}
                          >
                            {collapsedGroups[obj.id] ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                          </button>
                        ) : null}
                        {isGroup ? <Folder size={18} className="flex-shrink-0 text-primary" /> : null}
                        <LayerThumb type={obj.type} fill={obj.fill} stroke={obj.stroke} opacity={obj.opacity} imgSrc={obj.imgSrc} thumbnailSrc={obj.thumbnailSrc} />
                        <div className="min-w-0 flex-1">
                          {editingId === obj.id ? (
                            <input
                              ref={editingInputRef}
                              value={editingValue}
                              onChange={(event) => setEditingValue(event.target.value)}
                              onBlur={finishRename}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') event.currentTarget.blur();
                                if (event.key === 'Escape') {
                                  setEditingId(null);
                                  setEditingValue('');
                                }
                              }}
                              className="h-8 w-full rounded-md border border-primary/50 bg-black/20 px-2 text-sm font-semibold text-foreground outline-none"
                              aria-label={`Rename ${obj.name}`}
                            />
                          ) : (
                            <p
                              className="cursor-text truncate text-[15px] font-semibold text-foreground"
                              title={`${obj.name} — double-click to rename`}
                              onDoubleClick={(event) => {
                                event.stopPropagation();
                                startRename(obj);
                              }}
                              style={{ color: obj.visible ? undefined : '#6b7280' }}
                            >
                              {obj.name}
                            </p>
                          )}
                          <p className="mt-1 truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                            {isGroup ? `${obj.children?.length || 0} items` : obj.type === 'textbox' || obj.type === 'i-text' ? 'Text' : obj.type}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1 border-t border-white/5 pt-2" onClick={(event) => event.stopPropagation()}>
                        <ColorTagSelector
                          name={obj.name}
                          value={obj.tag}
                          onChange={(tag) => {
                            const fabricObj = getObjectById(obj.id);
                            if (fabricObj) controller.setLayerTag(fabricObj, tag);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-9 w-9 rounded-xl ${isSolo ? 'bg-primary/15 text-primary' : ''}`}
                          onClick={() => {
                            const fabricObj = getObjectById(obj.id);
                            if (fabricObj) controller.toggleSolo(fabricObj);
                          }}
                          aria-label={isSolo ? `Exit solo mode for ${obj.name}` : `Solo ${obj.name}`}
                          title={isSolo ? 'Exit solo mode' : 'Solo layer'}
                          data-testid={`layer-solo-${obj.id}`}
                        >
                          <Target size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => handleZOrder(obj, 'front')} aria-label={`Bring ${obj.name} to front`} title="Bring to front">
                          <ChevronsUp size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => handleZOrder(obj, 'forward')} aria-label={`Bring ${obj.name} forward`} title="Bring forward">
                          <ArrowUp size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => handleZOrder(obj, 'backward')} aria-label={`Send ${obj.name} backward`} title="Send backward">
                          <ArrowDown size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => handleZOrder(obj, 'back')} aria-label={`Send ${obj.name} to back`} title="Send to back">
                          <ChevronsDown size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => handleToggleVisibility(obj)} aria-label={obj.visible ? `Hide ${obj.name}` : `Show ${obj.name}`}>
                          {obj.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => handleToggleLock(obj)} aria-label={obj.selectable ? `Lock ${obj.name}` : `Unlock ${obj.name}`}>
                          {obj.selectable ? <Unlock size={16} /> : <Lock size={16} />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => startRename(obj)} aria-label={`Rename ${obj.name}`} title="Rename">
                          <Pencil size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive hover:text-destructive" onClick={() => setPendingDelete(obj)} aria-label={`Delete ${obj.name}`}>
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