---
name: Vector anchor editor
description: How the path anchor point drag-editor works in useFabricCanvas + Canvas.tsx
---

- Activated via `activateVectorEdit(obj)` — hides selection handles (`hasControls:false, hasBorders:false`), calls `refreshVectorAnchors()`
- `refreshVectorAnchors()` reads `(obj as any).path` array, extracts destination points for M/L/C/Q commands, transforms local→screen via `util.transformPoint + viewportTransform`, stores in `vectorAnchors` state
- Drag system: 3-call pattern — `vectorAnchorDragStart(idx)` saves initial localX/Y to `vectorDragStartRef`; `vectorAnchorDragMove(totalDx, totalDy)` applies total delta from start (not incremental); `vectorAnchorDragEnd()` calls pushUndo
- Canvas.tsx uses unified pointer handlers on SVG anchor groups, captures the pointer, and gives each anchor/tangent a transparent 44×44 CSS-pixel SVG hit pad; keep `touch-action:none` on the overlay and pass total client delta to the existing drag API
- VectorNodePanel is a single 56px bottom toolbar styled like the 3D bar; keep node navigation, add/delete, and Done visible, with nudge and redraw actions inside its dropdown popover
- Guide drag follows same pattern: `guideDragRef` tracks active guide, listeners compute new design-space position from client delta and zoom
- DeactivateVectorEdit restores `hasControls:true, hasBorders:true`, re-selects the object, clears anchor state

**Why:** Total-delta drag avoids stale closure issues with incremental deltas — the start position is captured once and total mouse travel from that point is applied on every move event.

**Touch behavior:** Pointer capture keeps a touch drag routed to its handle after the finger leaves its hit pad. The transparent hit pad expands interaction without changing the visual node or tangent size.

**How to apply:** Preserve pointer-ID checks and end the drag on both `pointerup` and `pointercancel`; do not replace the total-delta hook contract with incremental movement.

**Why:** The node-edit panel must leave the canvas visible on phones while retaining precision controls on demand.

**How to apply:** Keep the persistent panel to one 56px row; do not restore stacked mode controls, the nudge pad, or instruction copy to the always-visible area.
