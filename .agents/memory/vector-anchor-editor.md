---
name: Vector anchor editor
description: How the path anchor point drag-editor works in useFabricCanvas + Canvas.tsx
---

- Activated via `activateVectorEdit(obj)` — hides selection handles (`hasControls:false, hasBorders:false`), calls `refreshVectorAnchors()`
- `refreshVectorAnchors()` reads `(obj as any).path`, subtracts `pathOffset`, and applies both `calcTransformMatrix()` and the full viewport matrix; refresh on object moving/scaling/rotating/modified so handles track body transforms
- Drag system: 3-call pattern — `vectorAnchorDragStart(idx)` saves initial localX/Y to `vectorDragStartRef`; `vectorAnchorDragMove(totalDx, totalDy)` applies total delta from start (not incremental); `vectorAnchorDragEnd()` calls pushUndo
- Canvas.tsx uses unified pointer handlers on SVG anchor groups, captures the pointer, and gives each anchor/tangent a transparent 44×44 CSS-pixel SVG hit pad; keep `touch-action:none` on the overlay and pass total client delta to the existing drag API
- VectorNodePanel is one 56px dark-glass bar modeled on ThreeDPanel: a left parameter dropdown, active controls in the center, and Done plus an expand arrow on the right
- Vector parameters are Point Select, Nudge, Add / Delete, and Pen Draw; show only the selected parameter's compact controls in the bar
- Keep nudge arrows inline in the bar, never in a large centered popup; put precise coordinates, handle constraints, and curve types in the expandable drawer
- Use neutral dark-glass styling with cyan active states for add/delete; avoid red/green action borders
- Guide drag follows same pattern: `guideDragRef` tracks active guide, listeners compute new design-space position from client delta and zoom
- DeactivateVectorEdit restores `hasControls:true, hasBorders:true`, re-selects the object, clears anchor state

**Why:** Total-delta drag avoids stale closure issues with incremental deltas — the start position is captured once and total mouse travel from that point is applied on every move event.

**Touch behavior:** Pointer capture keeps a touch drag routed to its handle after the finger leaves its hit pad. The transparent hit pad expands interaction without changing the visual node or tangent size.

**How to apply:** Preserve pointer-ID checks and end the drag on both `pointerup` and `pointercancel`; do not replace the total-delta hook contract with incremental movement.

**Why:** The node overlay stores screen-space coordinates. Updating only the Fabric object's position leaves those coordinates stale even though the path itself uses its current transform.

**How to apply:** Keep path nodes in local path coordinates; recompute the overlay from the object and viewport matrices on each transform event rather than translating every path command during body movement.

**Why:** The node-edit panel must leave the canvas visible on phones while retaining precision controls on demand.

**How to apply:** Keep the persistent panel to one 56px row and match ThreeDPanel's dropdown-plus-drawer hierarchy. Do not restore stacked mode controls, a large nudge pad, or instruction copy to the always-visible area.
