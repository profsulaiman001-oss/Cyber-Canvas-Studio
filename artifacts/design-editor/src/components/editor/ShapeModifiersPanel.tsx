import { useState, useCallback } from 'react';
import { Sheet, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useEditor } from '@/store/editorStore';
import { CanvasController, FABRIC_EDITOR_CLONE_PROPS } from '@/hooks/useFabricCanvas';
import { FabricObject, Path as FabricPath, Canvas, Group } from 'fabric';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveDrawerWrapper } from './ResponsiveDrawerWrapper';
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
  // For images/groups, build the world-space polygon from the transform matrix.
  // Using obj.left/top directly is WRONG when originX/Y != 'left'/'top' (common
  // after transforms), causing the "center-shift" bug. calcTransformMatrix() maps
  // local half-extents to design/world coords correctly for any origin/rotation.
  if (obj.type === 'image' || obj.type === 'group' || obj.type === 'activeselection') {
    const m = obj.calcTransformMatrix();
    const halfW = (obj.width ?? 0) / 2;
    const halfH = (obj.height ?? 0) / 2;
    // Transform each local corner to world space: world = M * local
    const tx = (lx: number, ly: number) => ({
      x: m[0] * lx + m[2] * ly + m[4],
      y: m[1] * lx + m[3] * ly + m[5],
    });
    const tl = tx(-halfW, -halfH), tr = tx(halfW, -halfH);
    const br = tx(halfW, halfH),   bl = tx(-halfW, halfH);
    const poly = new pp.Path([
      new pp.Segment(new pp.Point(tl.x, tl.y)),
      new pp.Segment(new pp.Point(tr.x, tr.y)),
      new pp.Segment(new pp.Point(br.x, br.y)),
      new pp.Segment(new pp.Point(bl.x, bl.y)),
    ]);
    poly.closed = true;
    return poly;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (path as any)._isCustomName = true;
}

function tagNewGroup(group: Group, name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = group as any;
  target._uid = `obj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  target._name = name;
  target._isCustomName = true;
}

function refFill(objs: FabricObject[]): string {
  for (const o of objs) if (typeof o.fill === 'string' && o.fill) return o.fill;
  return '#00F5FF';
}

const UNION_STYLE_KEYS = [
  'fill',
  'stroke',
  'strokeWidth',
  'strokeDashArray',
  'strokeDashOffset',
  'strokeLineCap',
  'strokeLineJoin',
  'strokeMiterLimit',
  'strokeUniform',
  'opacity',
  'shadow',
  'fillRule',
  'paintFirst',
  'globalCompositeOperation',
  'backgroundColor',
  'effect3D',
  'innerShadow',
  '_depth3d',
  '_innerShadow',
  '_glow',
  '_gradientConfig',
  '_textureKey',
  '_origFill',
  '_adjustmentBase',
  '_adjustments',
  'typographyNeon',
  'typographyTransform',
  'typographyOriginalText',
] as const;

function hasUniformUnionStyle(objs: FabricObject[]): boolean {
  if (objs.some((obj) =>
    obj.type === 'image' ||
    (obj.fill != null && typeof obj.fill !== 'string') ||
    (obj.stroke != null && typeof obj.stroke !== 'string')
  )) {
    // Gradients/patterns and image pixels are object-local paints. Flattening
    // them into a new path changes their coordinate space or drops their pixels.
    return false;
  }

  const signatures = objs.map((obj) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serialized = (obj as any).toObject(FABRIC_EDITOR_CLONE_PROPS) as Record<string, unknown>;
    return JSON.stringify(Object.fromEntries(
      UNION_STYLE_KEYS.map((key) => [key, serialized[key]]),
    ));
  });
  return signatures.every((signature) => signature === signatures[0]);
}

function preserveAsStyledGroup(objs: FabricObject[], canvas: Canvas, name: string) {
  // This is the lossless representation when one compound path cannot carry
  // several different fills, gradients, strokes, shadows, or 3D settings.
  const originalOrder = canvas.getObjects();
  const selectedSet = new Set(objs);
  const topmostSelectedIndex = Math.max(...objs.map((obj) => originalOrder.indexOf(obj)));
  const groupIndex = topmostSelectedIndex < 0
    ? -1
    : originalOrder.slice(0, topmostSelectedIndex + 1).filter((obj) => !selectedSet.has(obj)).length;

  canvas.discardActiveObject();
  const group = new Group(objs);
  canvas.remove(...objs);
  tagNewGroup(group, name);
  if (groupIndex >= 0) canvas.insertAt(Math.min(groupIndex, canvas.getObjects().length), group);
  else canvas.add(group);
  canvas.setActiveObject(group);
  canvas.renderAll();
}

function cloneEffectConfig<T>(value: T): T {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function copyEditorEffects(source: FabricObject, target: FabricObject) {
  const effectKeys = [
    '_depth3d',
    '_innerShadow',
    '_glow',
    '_gradientConfig',
    '_textureKey',
    '_origFill',
    '_adjustmentBase',
    '_adjustments',
    'effect3D',
    'innerShadow',
    'typographyNeon',
    'typographyTransform',
    'typographyOriginalText',
  ];
  const sourceRecord = source as FabricObject & Record<string, unknown>;
  const targetRecord = target as FabricObject & Record<string, unknown>;
  effectKeys.forEach((key) => {
    if (sourceRecord[key] !== undefined) {
      targetRecord[key] = cloneEffectConfig(sourceRecord[key]);
    }
  });
  target.dirty = true;
}

function makeStyledResultPath(
  pathData: string,
  source: FabricObject,
  name: string,
  overrides: { fillRule?: 'nonzero' | 'evenodd' } = {},
) {
  const path = new FabricPath(pathData, {
    fill: source.fill ?? refFill([source]),
    stroke: source.stroke,
    strokeWidth: source.strokeWidth,
    strokeDashArray: source.strokeDashArray ? [...source.strokeDashArray] : source.strokeDashArray,
    strokeDashOffset: source.strokeDashOffset,
    strokeLineCap: source.strokeLineCap,
    strokeLineJoin: source.strokeLineJoin,
    strokeMiterLimit: source.strokeMiterLimit,
    strokeUniform: source.strokeUniform,
    opacity: source.opacity,
    shadow: source.shadow,
    fillRule: overrides.fillRule ?? source.fillRule,
    paintFirst: source.paintFirst,
    globalCompositeOperation: source.globalCompositeOperation,
    backgroundColor: source.backgroundColor,
    visible: source.visible,
  });
  tagNewPath(path, name);
  copyEditorEffects(source, path);
  return path;
}

async function performCompound(objs: FabricObject[], canvas: Canvas): Promise<boolean | 'styled-group'> {
  if (!hasUniformUnionStyle(objs)) {
    preserveAsStyledGroup(objs, canvas, 'Compound (Styles Preserved)');
    return 'styled-group';
  }

  const pp = await getPaper();
  pp.project.clear();

  // Capture bounding box BEFORE removing objects
  const activeObj = canvas.getActiveObject();
  const selBB = activeObj?.getBoundingRect();
  const origLeft = selBB?.left ?? (objs[0]?.left ?? 0);
  const origTop  = selBB?.top  ?? (objs[0]?.top  ?? 0);

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

  const newPath = makeStyledResultPath(combinedD, objs[0], 'Compound Path', { fillRule: 'evenodd' });
  objs.forEach((o) => canvas.remove(o));
  canvas.add(newPath);

  // Fix coordinate drift: align the new path to the original selection position
  newPath.setCoords();
  const newBB = newPath.getBoundingRect();
  const dl = origLeft - newBB.left;
  const dt = origTop  - newBB.top;
  if (Math.abs(dl) > 0.5 || Math.abs(dt) > 0.5) {
    newPath.set({ left: (newPath.left ?? 0) + dl, top: (newPath.top ?? 0) + dt });
    newPath.setCoords();
  }

  canvas.setActiveObject(newPath);
  canvas.renderAll();
  return true;
}

async function performBooleanOp(objs: FabricObject[], op: BoolOp, canvas: Canvas): Promise<boolean | 'styled-group'> {
  if (op === 'compound') return performCompound(objs, canvas);
  if (objs.length < 2) return false;
  if (op === 'unite' && !hasUniformUnionStyle(objs)) {
    preserveAsStyledGroup(objs, canvas, 'Union (Styles Preserved)');
    return 'styled-group';
  }

  // Capture bounding box BEFORE removing objects
  const activeObj = canvas.getActiveObject();
  const selBB = activeObj?.getBoundingRect();
  const origLeft = selBB?.left ?? (objs[0]?.left ?? 0);
  const origTop  = selBB?.top  ?? (objs[0]?.top  ?? 0);

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

    // ── Image-aware result: preserve texture via absolutePositioned clipPath ──
    // The result path is in world/design coordinates. For raster images, applying
    // it as an absolutePositioned clipPath preserves the pixel texture exactly,
    // instead of replacing the image with a solid-filled vector path (Bug 1 fix).
    const imageObj = objs.find((o) => o.type === 'image');
    if (imageObj) {
      // The clip shape lives in design-space (absolutePositioned:true = ignores
      // the parent object's own transform, clips in canvas coordinates).
      const clipShape = new FabricPath(resultPathData, {
        absolutePositioned: true,
        fill: 'black',          // colour irrelevant — only the shape matters
        stroke: undefined,
        strokeWidth: 0,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clonedImg: FabricObject = await (imageObj as any).clone(FABRIC_EDITOR_CLONE_PROPS);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (clonedImg as any).clipPath = clipShape;
      objs.forEach((o) => canvas.remove(o));
      canvas.add(clonedImg);
      canvas.setActiveObject(clonedImg);
      canvas.renderAll();
      return true;
    }

    // ── Vector-only result: create a filled FabricPath ──
    const opLabels: Record<string, string> = {
      unite: 'Union', subtract: 'Subtract', intersect: 'Intersect',
      exclude: 'Exclude', divide: 'Divide', trim: 'Trim', weld: 'Weld',
    };
    const newPath = makeStyledResultPath(resultPathData, objs[0], `${opLabels[op] || op} Result`);

    objs.forEach((o) => canvas.remove(o));
    canvas.add(newPath);

    // Fix coordinate drift: align the result path to the original selection position
    newPath.setCoords();
    const newBB = newPath.getBoundingRect();
    const dl = origLeft - newBB.left;
    const dt = origTop  - newBB.top;
    if (Math.abs(dl) > 0.5 || Math.abs(dt) > 0.5) {
      newPath.set({ left: (newPath.left ?? 0) + dl, top: (newPath.top ?? 0) + dt });
      newPath.setCoords();
    }

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
      const result = await performBooleanOp(objs, op, c);
      if (result) {
        controller.pushUndoNow();
        controller.syncObjects();
        toast({
          title: result === 'styled-group'
            ? `${OPS.find(o => o.id === op)?.label} kept as a styled group`
            : `${OPS.find(o => o.id === op)?.label} applied`,
          description: result === 'styled-group'
            ? 'Different fills or effects cannot be represented by one path, so the original styled objects were preserved.'
            : undefined,
        });
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
      <ResponsiveDrawerWrapper
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      </ResponsiveDrawerWrapper>
    </Sheet>
  );
}
