---
name: Vector anchor editor
description: How the path anchor point drag-editor works in useFabricCanvas + Canvas.tsx
---

- Activated via `activateVectorEdit(obj)` — hides selection handles (`hasControls:false, hasBorders:false`), calls `refreshVectorAnchors()`
- `refreshVectorAnchors()` reads `(obj as any).path` array, extracts destination points for M/L/C/Q commands, transforms local→screen via `util.transformPoint + viewportTransform`, stores in `vectorAnchors` state
- Drag system: 3-call pattern — `vectorAnchorDragStart(idx)` saves initial localX/Y to `vectorDragStartRef`; `vectorAnchorDragMove(totalDx, totalDy)` applies total delta from start (not incremental); `vectorAnchorDragEnd()` calls pushUndo
- Canvas.tsx renders anchor SVG overlay with per-anchor `onMouseDown` + global window `mousemove/mouseup` listeners using a ref for the current drag callback (avoids stale closures)
- Guide drag follows same pattern: `guideDragRef` tracks active guide, listeners compute new design-space position from client delta and zoom
- DeactivateVectorEdit restores `hasControls:true, hasBorders:true`, re-selects the object, clears anchor state

**Why:** Total-delta drag avoids stale closure issues with incremental deltas — the start position is captured once and total mouse travel from that point is applied on every move event.
