---
name: Floating effect panels
description: Shared layout rule for compact editor effect controls
---

Canvas effect tools such as Adjustments, Shadows, and 3D should render inside the relative bottom-toolbar wrapper as an absolute bottom-full floating pill with an optional inline expanded panel. They should not use a Sheet portal, full-screen backdrop, or backdrop blur while scrubbing.

**Why:** The canvas must remain fully visible during live effect editing, especially on mobile, and the shared toolbar wrapper keeps panel placement consistent above navigation.

**How to apply:** Mount the panel alongside the other bottom-toolbar effect panels in the Design Editor wrapper; keep the compact active-control bar always visible while the panel is open and animate only the optional expanded controls.