---
name: Transform HUD
description: Shared live dimensions and angle overlay behavior for canvas transforms
---

Manual Fabric scaling/rotation and panel-driven transforms should share one controller-owned live telemetry state. The Canvas workspace renders the `W | H | angle` HUD as an external overlay and chooses pasteboard space above or beside the artboard before falling back.

**Why:** A single telemetry path keeps numeric controls, sliders, edge handles, and rotation handles visually consistent without putting measurement text over the design.

**How to apply:** Update the controller HUD state while a transform gesture or edit is active, clear it on pointer/mouse release or input blur, and keep the overlay mounted outside the printable artboard container.