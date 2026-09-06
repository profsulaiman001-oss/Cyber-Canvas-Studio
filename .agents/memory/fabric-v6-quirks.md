---
name: Fabric serialization and v6 quirks
description: Non-obvious Fabric.js serialization, API differences, and caching edge cases in this codebase
---

- **Fabric 7 serialization:** `canvas.toJSON(extraProps)` ignores the argument; use `(c as any).toObject(extraProps)` whenever custom properties must be persisted.
- `canvas.loadFromJSON(json)` requires `(c as any).loadFromJSON(json)`
- `bringObjectForward` / `sendObjectBackwards` require `(c as any).bringObjectForward(obj)`
- `after:render` fires post ctx.restore() — use `ctx.setTransform(vp...)` before drawing overlays
- `PencilBrush.shadow` is a real `Shadow` object and works for glow effect
- `canvas.isDrawingMode = true` enables freehand; `path:created` event fires when stroke completes
- `FabricImage.fromURL(url)` is async and preferred over `fabric.Image.fromURL` callback style
- **Shadow mutation bug:** After `obj.set('shadow', newShadow)`, must call `(obj as any).setDirty?.(true)` then `canvas.requestRenderAll()` — `renderAll()` alone does NOT repaint cached shadow; `setDirty` forces cache invalidation
- **Path coordinates:** `(path as any).path` is `[string, ...number[]][]` with M/L/C/Q/Z commands; local coords centered at bbox center; use `util.transformPoint(pt, obj.calcTransformMatrix())` to get canvas-space coords
- `util.invertTransform(matrix as any)` works for computing inverse delta transforms — zero out [4] and [5] for pure delta (no translation)
- `path:created` event shape in v6: `{ path: FabricObject }` — access via `(e as Record<string, unknown>).path`

**Why:** These are undocumented breaking changes from v5 → v6 or subtle caching behaviours that caused runtime failures in previous sessions.
