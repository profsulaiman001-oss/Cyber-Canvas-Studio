import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject, Path as FabricPath, Canvas } from 'fabric';
import { useToast } from '@/hooks/use-toast';
import { Layers2 } from 'lucide-react';

type BoolOp = 'unite' | 'subtract' | 'intersect' | 'exclude' | 'divide' | 'trim' | 'weld' | 'compound';

interface OpDef {
  id: BoolOp;
  label: string;
  description: string;
  emoji: string;
}

const OPS: OpDef[] = [
  { id: 'unite',     label: 'Union',       description: 'Merge all selected shapes into one outline',       emoji: '⊕' },
  { id: 'subtract',  label: 'Subtract',    description: 'Top shape cuts away from bottom shape',            emoji: '⊖' },
  { id: 'intersect', label: 'Intersect',   description: 'Keep only the overlapping region',                emoji: '⊗' },
  { id: 'exclude',   label: 'Exclude',     description: 'Keep everything except the overlap (XOR)',        emoji: '⊘' },
  { id: 'divide',    label: 'Divide',      description: 'Split shapes at every intersection',              emoji: '⊞' },
  { id: 'trim',      label: 'Trim',        description: 'Remove portions hidden by overlapping shapes',    emoji: '✂' },
  { id: 'weld',      label: 'Weld',        description: 'Fuse touching outlines into a single shape',      emoji: '⊛' },
  { id: 'compound',  label: 'Compound',    description: 'Combine into a compound path (even-odd fill)',    emoji: '◈' },
];

let paperInitialized = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let paperLib: any = null;

async function getPaper() {
  if (paperInitialized && paperLib) return paperLib;
  const mod = await import('paper');
  paperLib = mod.default || mod;
  const offEl = document.createElement('canvas');
  offEl.width = 100; offEl.height = 100;
  paperLib.setup(offEl);
  paperInitialized = true;
  return paperLib;
}

/**
 * Convert ANY FabricObject (Rect, Circle, Triangle, Path, Group, Image…) to a
 * paper.js path in world coordinates by leveraging Fabric's toSVG() output and
 * paper.js's own SVG import engine (expandShapes:true converts all primitives
 * to explicit path data — no manual rect/circle/polygon math needed).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fabricObjToWorldPath(obj: FabricObject, pp: any): Promise<any | null> {
  // For images/groups just use a bounding-box rectangle — they have no vector outline
  if (obj.type === 'image' || obj.type === 'group' || obj.type === 'activeselection') {
    const w = obj.getScaledWidth();
    const h = obj.getScaledHeight();
    const l = obj.left ?? 0;
    const t = obj.top ?? 0;
    return new pp.Path.Rectangle(new pp.Rectangle(l, t, w, h));
  }

  const svgStr = obj.toSVG();
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${svgStr}</svg>`,
    'image/svg+xml'
  );
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return null;

  try {
    // paper.js importSVG with expandShapes:true automatically converts rect/circle/ellipse/polygon
    // to Path objects, and applyMatrix:true bakes the world transform in.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imported: any = pp.project.importSVG(svgEl, { expandShapes: true, applyMatrix: true });
    if (!imported) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function collect(item: any) {
      if (item instanceof pp.Path || item instanceof pp.CompoundPath) {
        if (result === null) {
          result = item;
        } else {
          const u = result.unite(item);
          item.remove?.();
          result.remove?.();
          result = u;
        }
      } else if (item.children) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const child of item.children) collect(child);
      }
    }

    if (imported instanceof pp.Path || imported instanceof pp.CompoundPath) {
      result = imported;
    } else {
      collect(imported);
      if (imported !== result) imported.remove?.();
    }

    return result;
  } catch (err) {
    console.warn('[ShapeModifiers] SVG import error:', err);
    return null;
  }
}

function tagNewPath(path: FabricPath, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (path as any)._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (path as any)._name = name;
}

function refFill(objs: FabricObject[]): string {
  for (const o of objs) if (typeof o.fill === 'string' && o.fill) return o.fill;
  return '#00F5FF';
}

async function performCompound(objs: FabricObject[], canvas: Canvas): Promise<boolean> {
  const pp = await getPaper();
  pp.project.clear();

  const dParts: string[] = [];
  for (const obj of objs) {
    const p = await fabricObjToWorldPath(obj, pp);
    if (!p) continue;
    dParts.push(p.pathData || '');
    p.remove?.();
  }
  pp.project.clear();

  const combinedD = dParts.filter(Boolean).join(' ');
  if (!combinedD.trim()) return false;

  const newPath = new FabricPath(combinedD, {
    fill: refFill(objs),
    stroke: (objs[0].stroke as string) || undefined,
    strokeWidth: objs[0].strokeWidth || 0,
    opacity: objs[0].opacity ?? 1,
    fillRule: 'evenodd',
  });
  tagNewPath(newPath, 'Compound Path');
  objs.forEach((o) => canvas.remove(o));
  canvas.add(newPath);
  canvas.setActiveObject(newPath);
  canvas.renderAll();
  return true;
}

async function performBooleanOp(objs: FabricObject[], op: BoolOp, canvas: Canvas): Promise<boolean> {
  if (op === 'compound') return performCompound(objs, canvas);
  if (objs.length < 2) return false;

  const pp = await getPaper();
  pp.project.clear();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paperPaths: any[] = [];
  for (const obj of objs) {
    const p = await fabricObjToWorldPath(obj, pp);
    if (p) paperPaths.push(p);
  }

  if (paperPaths.length < 2) {
    paperPaths.forEach((p) => p.remove?.());
    pp.project.clear();
    return false;
  }

  const paperOp =
    op === 'unite'     ? 'unite'     :
    op === 'subtract'  ? 'subtract'  :
    op === 'intersect' ? 'intersect' :
    op === 'exclude'   ? 'exclude'   :
    op === 'divide'    ? 'divide'    :
    op === 'trim'      ? 'subtract'  :
    op === 'weld'      ? 'unite'     : 'unite';

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = paperPaths[0];
    for (let i = 1; i < paperPaths.length; i++) {
      const next = result[paperOp]?.(paperPaths[i]);
      if (next == null) {
        paperPaths.forEach((p) => p.remove?.());
        pp.project.clear();
        return false;
      }
      paperPaths[i].remove?.();
      result = next;
    }

    const resultPathData: string = result.pathData || '';
    result.remove?.();
    paperPaths[0].remove?.();
    pp.project.clear();

    if (!resultPathData.trim()) return false;

    const opLabels: Record<string, string> = {
      unite: 'Union', subtract: 'Subtract', intersect: 'Intersect',
      exclude: 'Exclude', divide: 'Divide', trim: 'Trim', weld: 'Weld',
    };
    const newPath = new FabricPath(resultPathData, {
      fill: refFill(objs),
      stroke: (objs[0].stroke as string) || undefined,
      strokeWidth: objs[0].strokeWidth || 0,
      opacity: objs[0].opacity ?? 1,
    });
    tagNewPath(newPath, `${opLabels[op] || op} Result`);

    objs.forEach((o) => canvas.remove(o));
    canvas.add(newPath);
    canvas.setActiveObject(newPath);
    canvas.renderAll();
    return true;
  } catch (err) {
    pp.project.clear();
    console.warn('[ShapeModifiers] Boolean op error:', err);
    return false;
  }
}

interface ShapeModifiersPanelProps { controller: CanvasController }

export default function ShapeModifiersPanel({ controller }: ShapeModifiersPanelProps) {
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const isOpen = state.activePanel === 'shapeModifiers';
  const [processing, setProcessing] = useState<BoolOp | null>(null);

  const canvas = controller.getCanvas();
  const activeObjs = canvas?.getActiveObjects() || [];
  // Accept ANY visible object type — primitives are auto-converted to paths
  const validObjs = activeObjs.filter(
    (o) => !['activeselection'].includes(o.type || '')
  );
  const canOperate = activeObjs.length >= 2;

  const handleOp = useCallback(async (op: BoolOp) => {
    const c = controller.getCanvas();
    if (!c) return;
    const objs = c.getActiveObjects().filter((o) => !['activeselection'].includes(o.type || ''));
    if (objs.length < 2) {
      toast({ title: 'Select at least 2 objects', variant: 'destructive' });
      return;
    }
    setProcessing(op);
    try {
      const ok = await performBooleanOp(objs, op, c);
      if (ok) {
        controller.syncObjects();
        toast({ title: `${OPS.find(o => o.id === op)?.label} applied` });
      } else {
        toast({ title: 'Operation produced no result', description: 'Objects may not overlap', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Operation failed', description: String(e), variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  }, [controller, toast]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_PANEL' })}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0"
        style={{ maxHeight: '70vh', background: '#11141A', border: 'none', overflowY: 'auto' }}
        data-testid="shape-modifiers-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers2 size={15} className="text-primary" />
            Shape Modifiers
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: canOperate ? 'rgba(0,245,255,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${canOperate ? 'rgba(0,245,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: canOperate ? '#00F5FF' : '#6b7280',
            }}
          >
            <span>
              {canOperate
                ? `✓ ${activeObjs.length} objects selected — Rects, Circles, Triangles & Paths all supported`
                : 'Select 2 or more shapes to enable boolean operations'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {OPS.map((op) => (
              <button
                key={op.id}
                disabled={!canOperate || processing !== null}
                onClick={() => handleOp(op.id)}
                className="flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-all disabled:opacity-40"
                style={{
                  background: processing === op.id ? 'rgba(0,245,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${processing === op.id ? '#00F5FF' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xl leading-none">{op.emoji}</span>
                  <span className="text-sm font-semibold text-foreground">{op.label}</span>
                  {processing === op.id && (
                    <span className="ml-auto text-[10px] text-primary animate-pulse">working…</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">{op.description}</p>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-center pb-1">
            Works on all shape types. Non-path geometry is auto-converted before the operation.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
