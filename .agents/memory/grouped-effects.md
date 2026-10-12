---
name: Grouped object effects
description: Preserve independent Fabric child styles and effects across grouping, union operations, caching, and ungrouping
---

- Regular groups should contain the original Fabric objects, not a flattened replacement path; Fabric serializes nested children and the editor's custom effect properties when passed its extra-property list.
- A single compound path cannot represent different child fills, gradients, patterns, strokes, shadows, or 3D settings. For Union/Compound with incompatible appearance, retain the styled originals in an editable group instead of silently copying only the first object's style.
- Custom inner shadows must draw during each object's own local `drawObject` pass and force a private cache even when objectCaching is off or a parent group is cached. A canvas-wide after-render pass misses grouped children and can paint over higher layers.

**Why:** Grouping is nondestructive when child objects remain intact, while heterogeneous paints/effects have no faithful one-path representation. Inner-shadow composition must also stay within the child's own pixels and z-order.

**How to apply:** Traverse nested groups before render to install per-object effect hooks; force the child cache for inner-shadow composition and mark all ancestor groups dirty when a child effect changes. When building boolean results, copy the complete compatible style/effect set or preserve original children as a group.
