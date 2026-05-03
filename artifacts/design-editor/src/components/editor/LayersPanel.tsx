import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController, ObjectMeta } from '@/hooks/useFabricCanvas';

interface LayersPanelProps {
  controller: CanvasController;
}

const TYPE_ICONS: Record<string, string> = {
  rect: '▭',
  circle: '○',
  triangle: '△',
  line: '—',
  path: '~',
  'i-text': 'T',
  image: '🖼',
};

export default function LayersPanel({ controller }: LayersPanelProps) {
  const { state, dispatch } = useEditor();
  const isOpen = state.activePanel === 'layers';
  const { objects, selectedObject, getObjectById } = controller;

  const handleSelectLayer = (obj: ObjectMeta) => {
    controller.selectObjectById(obj.id);
  };

  const handleToggleVisibility = (obj: ObjectMeta) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.toggleVisibility(fabricObj);
  };

  const handleToggleLock = (obj: ObjectMeta) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.toggleLock(fabricObj);
  };

  const handleBringForward = (obj: ObjectMeta) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.bringForward(fabricObj);
  };

  const handleSendBackward = (obj: ObjectMeta) => {
    const fabricObj = getObjectById(obj.id);
    if (fabricObj) controller.sendBackward(fabricObj);
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
        style={{ maxHeight: '60vh', background: '#11141A', border: 'none' }}
        data-testid="layers-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold text-foreground">Layers</SheetTitle>
        </SheetHeader>

        {objects.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
            No layers yet
          </div>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 60px)' }}>
            {objects.map((obj) => {
              const isSelected = obj.id === selectedId;
              return (
                <div
                  key={obj.id}
                  onClick={() => handleSelectLayer(obj)}
                  className="flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors"
                  style={{
                    background: isSelected ? 'rgba(0,245,255,0.08)' : 'transparent',
                    borderLeft: isSelected ? '2px solid #00F5FF' : '2px solid transparent',
                  }}
                  data-testid={`layer-item-${obj.id}`}
                >
                  <span className="text-muted-foreground text-xs w-4 text-center select-none">
                    {TYPE_ICONS[obj.type] || '□'}
                  </span>
                  <span
                    className="flex-1 text-sm truncate"
                    style={{ color: obj.visible ? 'inherit' : '#4b5563' }}
                  >
                    {obj.name}
                  </span>

                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleToggleVisibility(obj)}
                      data-testid={`layer-visibility-${obj.id}`}
                    >
                      {obj.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleToggleLock(obj)}
                      data-testid={`layer-lock-${obj.id}`}
                    >
                      {obj.selectable ? <Unlock size={13} /> : <Lock size={13} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleBringForward(obj)}
                      data-testid={`layer-forward-${obj.id}`}
                    >
                      <ChevronUp size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleSendBackward(obj)}
                      data-testid={`layer-backward-${obj.id}`}
                    >
                      <ChevronDown size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
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
