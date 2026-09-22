---
name: Inner shadow geometry
description: Durable rules for rendering inner shadows that follow Fabric object contours
---

Inner shadows must use the object's native local geometry for both the clip and the inverse mask. Fabric paths require `pathOffset`, rounded rectangles require both `rx` and `ry`, and polygon points require their own `pathOffset`.

**Why:** Raw path commands and width/height rectangles use a different coordinate origin from Fabric's renderers, causing detached shadows and corner artifacts on transformed vectors.

**How to apply:** Trace native geometry in local object space, blur/offset the inverted shape, clip the destination to the same native path, and composite the generated shadow with `source-atop`.