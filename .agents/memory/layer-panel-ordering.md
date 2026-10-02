---
name: Layer panel ordering
description: Durable rules for layer previews and z-order interactions in the editor.
---

Grouped layers should use Fabric's object-level data URL rendering so child fills, strokes, transforms, and relative positions are preserved. Layer drag-and-drop should calculate a final insertion slot from the pointer position and perform one canvas reorder on drop. Front/back and single-step controls should update the canvas, UI metadata, and undo history together.

The layer panel's compact row keeps the reorder handle, 40px preview, title/type badge, selection, visibility, lock, and More Actions control visible. Put fine z-order actions in the expandable shelf, while keeping rename, select/target, duplicate, group, delete, solo, and color tags available there or in existing panel-level group controls.

**Why:** Low-level object rendering can produce blank group thumbnails, while row-index-only drops feel stepwise and make z-order actions difficult to discover.

**Why:** The compact card reduces clutter without removing layer operations users already depend on.

**How to apply:** Include nested group content in visual-change signatures so thumbnails refresh after child edits, keep panel order conversion separate from canvas stack order, and expose explicit front/back/forward/backward controller methods from the expanded action shelf.