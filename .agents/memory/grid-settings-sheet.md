---
name: Grid settings surface
description: Placement rule for grid controls opened from the editor top bar
---

Grid settings opened from the editor top bar should use a portal-backed bottom sheet. The top bar contains a horizontally scrollable action row, so inline absolute popovers can be clipped or appear not to mount.

**Why:** The grid settings action previously updated local open state while the popover lived inside the scroll container, making the control surface invisible on some viewport sizes.

**How to apply:** Keep both the grid and settings toolbar actions wired to the same controlled sheet state, and keep visibility, geometry, appearance, slant, lock, and guide controls inside that sheet.