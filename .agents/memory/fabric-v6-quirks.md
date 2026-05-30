---
name: Fabric v6 TypeScript quirks
description: Methods and patterns in Fabric.js v6 that require workarounds due to TypeScript type definitions
---

## Methods requiring `(c as any)` casts

These Canvas instance methods have incorrect/missing type signatures in Fabric v6:

- `c.toJSON([...extraProps])` — types say 0 args, but runtime accepts an array
- `c.loadFromJSON(json)` — types may mismatch; cast to any
- `c.bringObjectForward(obj)` — types say 0 args in some versions
- `c.sendObjectBackwards(obj)` — same as above

**Why:** The `@types/fabric` or built-in types shipped with Fabric v6 are not always in sync with the runtime API.

**How to apply:** Wrap with `(c as any).methodName(arg)` and suppress with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`

## TFiller not exported from root

`TFiller` is NOT a named export from `'fabric'`. Use `Pattern | Gradient` or `any` instead.

## Custom properties on FabricObject

Assigning custom props like `_isPenAux`, `_innerShadow`, etc.:
- Use `(obj as unknown as Record<string, unknown>).myProp = value`
- Or `(obj as any).myProp = value`
- Do NOT use `obj as FabricObject & { myProp: T }` — TS will complain about insufficient overlap

## Canvas events

- `'viewport:transform'` is NOT in `CanvasEvents` — use `'after:render'` to read the current viewport transform instead
- `'after:render'` fires with `{ ctx: CanvasRenderingContext2D }` — useful for custom drawing passes (inner shadow, etc.)
