---
name: Fabric canvas resume
description: Recover the Fabric canvas after Android WebView pause, gesture cancellation, or context restoration
---

**Rule:** Treat `touchcancel` and `pointercancel` as interrupted gestures, not as normal pointer-up. When the native app pauses, clear Fabric's in-flight transform/drawing state and temporary document listeners, then restore Fabric's temporarily removed down-event listener. On resume, reset the backing stores at the current zoom, preserve the viewport, recalculate offsets, redraw the surface and controls, and invalidate object caches. Do not recreate the canvas or reload project objects just to recover rendering.

**Why:** Android can cancel a touch when the app backgrounds. Fabric's touch path attaches document move/end listeners during a gesture and normally cleans them up on touch-end; missing the cancel path can leave transforms and event state stranded, making subsequent taps behave like ghost continuations.

**How to apply:** Scope visibility/native lifecycle listeners to the canvas instance and remove them on cleanup. Track application-owned animation frames; Fabric coalesces its own render request, so cancel it on pause and synchronously redraw once the page is visible.
