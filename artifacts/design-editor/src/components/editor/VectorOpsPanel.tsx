import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useEditor } from '@/store/editorStore';
import { CanvasController } from '@/hooks/useFabricCanvas';
import { FabricObject, Path as FabricPath, Canvas } from 'fabric';
import { useToast } from '@/hooks/use-toast';
import { GitMerge } from 'lucide-react';

type BoolOp = 'unite' | 'subtract' | 'intersect' | 'exclude' | 'divide' | 'trim' | 'weld' | 'compound';

interface OpDef {
  id: BoolOp;
  label: string;
  description: string;
  emoji: string;
}

const OPS: OpDef[] = [
  { id: 'unite',     label: 'Union',       description: 'Merge all selected paths into one',           emoji: '⊕' },
  { id: 'subtract',  label: 'Subtract',    description: 'Top path cuts away from bottom path',          emoji: '⊖' },
  { id: 'intersect', label: 'Intersect',   description: 'Keep only the overlapping region',             emoji: '⊗' },
  { id: 'exclude',   label: 'Exclude',     description: 'Keep everything except the overlap (XOR)',     emoji: '⊘' },
  { id: 'divide',    label: 'Divide',      description: 'Split paths at every intersection',            emoji: '⊞' },
  { id: 'trim',      label: 'Trim',        description: 'Remove portions hidden by overlapping paths',  emoji: '✂' },
  { id: 'weld',      label: 'Weld',        description: 'Fuse touching outlines into a single shape',   emoji: '⊛' },
  { id: 'compound',  label: 'Compound',    description: 'Combine into a compound path (even-odd fill)', emoji: '◈' },
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

function fabricObjToWorldPath(
  obj: FabricObject,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pp: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any | null {
  const svgStr = obj.toSVG();
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svgStr}</svg>`,
    'image/svg+xml'
  );
  const pathEl = doc.querySelector('path');
  if (!pathEl) return null;

  const d = pathEl.getAttribute('d');
  if (!d) return null;

  const p = new pp.Path(d);

  const transformAttr = pathEl.getAttribute('transform') || '';
  const matMatch = transformAttr.match(/matrix\(\s*([-\d.e+]+(?:[,\s]+[-\d.e+]+){5})\s*\)/);
  if (matMatch) {
    const vals = matMatch[1].trim().split(/[,\s]+/).map(Number);
    if (vals.length >= 6) {
      p.transform(new pp.Matrix(vals[0], vals[1], vals[2], vals[3], vals[4], vals[5]));
    }
  }

  return p;
}

function tagNewPath(path: FabricPath, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (path as any)._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (path as any)._name = name;
}

async function performCompound(paths: FabricObject[], canvas: Canvas): Promise<boolean> {
  const validPaths = paths.filter((o) => o.type === 'path');
  if (validPaths.length < 2) return false;

  const dParts: string[] = [];
  for (const obj of validPaths) {
    const svgStr = obj.toSVG();
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${svgStr}</svg>`,
      'image/svg+xml'
    );
    const pathEl = doc.querySelector('path');
    if (!pathEl) continue;
    const d = pathEl.getAttribute('d');
    if (!d) continue;
    const transformAttr = pathEl.getAttribute('transform') || '';
    const matMatch = transformAttr.match(/matrix\(\s*([-\d.e+]+(?:[,\s]+[-\d.e+]+){5})\s*\)/);
    if (matMatch) {
      const vals = matMatch[1].trim().split(/[,\s]+/).map(Number);
      if (vals.length >= 6) {
        const [a, b, c, dd, e, f] = vals;
        const pp = await getPaper();
        const tempPath = new pp.Path(d);
        tempPath.transform(new pp.Matrix(a, b, c, dd, e, f));
        dParts.push(tempPath.pathData);
        tempPath.remove();
        continue;
      }
    }
    dParts.push(d);
  }

  if (dParts.length < 2) return false;
  const combinedD = dParts.join(' ');
  const refObj = validPaths[0];
  const newPath = new FabricPath(combinedD, {
    fill: (refObj.fill as string) || '#00F5FF',
    stroke: (refObj.stroke as string) || undefined,
    strokeWidth: refObj.strokeWidth || 0,
    opacity: refObj.opacity ?? 1,
    fillRule: 'evenodd',
  });
  tagNewPath(newPath, 'Compound Path');
  validPaths.forEach((o) => canvas.remove(o));
  canvas.add(newPath);
  canvas.setActiveObject(newPath);
  canvas.renderAll();
  return true;
}

async function performBooleanOp(
  paths: FabricObject[],
  op: BoolOp,
  canvas: Canvas
): Promise<boolean> {
  if (op === 'compound') return performCompound(paths, canvas);

  const validPaths = paths.filter((o) => o.type === 'path');
  if (validPaths.length < 2) return false;

  const pp = await getPaper();
  pp.project.clear();

  const paperPaths: unknown[] = [];
  for (const obj of validPaths) {
    const p = fabricObjToWorldPath(obj, pp);
    if (p) paperPaths.push(p);
  }

  if (paperPaths.length < 2) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paperPaths.forEach((p) => (p as any).remove());
    return false;
  }

  const paperOp =
    op === 'unite'     ? 'unite'    :
    op === 'subtract'  ? 'subtract' :
    op === 'intersect' ? 'intersect':
    op === 'exclude'   ? 'exclude'  :
    op === 'divide'    ? 'divide'   :
    op === 'trim'      ? 'subtract' :
    op === 'weld'      ? 'unite'    : 'unite';

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = paperPaths[0];
    for (let i = 1; i < paperPaths.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next = result[paperOp]?.(paperPaths[i] as any);
      if (next == null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        paperPaths.forEach((p) => (p as any).remove?.());
        return false;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (paperPaths[i] as any).remove?.();
      result = next;
    }

    const resultPathData: string = result.pathData || '';
    result.remove?.();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (paperPaths[0] as any).remove?.();
    pp.project.clear();

    if (!resultPathData.trim()) return false;

    const refObj = validPaths[0];
    const newPath = new FabricPath(resultPathData, {
      fill: (refObj.fill as string) || '#00F5FF',
      stroke: (refObj.stroke as string) || undefined,
      strokeWidth: refObj.strokeWidth || 0,
      opacity: refObj.opacity ?? 1,
    });
    const opLabels: Record<string, string> = {
      unite: 'Union', subtract: 'Subtract', intersect: 'Intersect',
      exclude: 'Exclude', divide: 'Divide', trim: 'Trim', weld: 'Weld',
    };
    tagNewPath(newPath, `${opLabels[op] || op} Result`);

    validPaths.forEach((o) => canvas.remove(o));
    canvas.add(newPath);
    canvas.setActiveObject(newPath);
    canvas.renderAll();
    return true;
  } catch (err) {
    pp.project.clear();
    console.warn('Boolean op error:', err);
    return false;
  }
}

interface VectorOpsPanelProps { controller: CanvasController }

export default function VectorOpsPanel({ controller }: VectorOpsPanelProps) {
  const { state, dispatch } = useEditor();
  const { toast } = useToast();
  const isOpen = state.activePanel === 'vectorOps';
  const [processing, setProcessing] = useState<BoolOp | null>(null);

  const canvas = controller.getCanvas();
  const activeObjs = canvas?.getActiveObjects() || [];
  const pathObjs = activeObjs.filter((o) => o.type === 'path');
  const canOperate = pathObjs.length >= 2;

  const handleOp = useCallback(async (op: BoolOp) => {
    const c = controller.getCanvas();
    if (!c) return;
    const objs = c.getActiveObjects().filter((o) => o.type === 'path');
    if (objs.length < 2) {
      toast({ title: 'Select at least 2 path objects', variant: 'destructive' });
      return;
    }
    setProcessing(op);
    try {
      const ok = await performBooleanOp(objs, op, c);
      if (ok) {
        controller.syncObjects();
        toast({ title: `${OPS.find(o => o.id === op)?.label} applied` });
      } else {
        toast({ title: 'Operation produced no result', description: 'Paths may not intersect', variant: 'destructive' });
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
        data-testid="vector-ops-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-sm font-semibold flex items-center gap-2">
            <GitMerge size={15} className="text-primary" />
            Vector Boolean Operations
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
            <span>{canOperate ? `✓ ${pathObjs.length} paths selected — ready` : 'Select 2 or more path objects to enable operations'}</span>
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
            Operations work on selected Path objects. Results are new vector paths.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
