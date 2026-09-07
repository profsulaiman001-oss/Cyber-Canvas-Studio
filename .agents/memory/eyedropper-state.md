---
name: Eyedropper state
description: Selection and Color Studio context invariants for canvas color sampling
---

The eyedropper must snapshot the active Fabric object and the Color Studio mode/selected stop before sampling. While sampling, selection targeting and active controls are disabled so the rendered composite contains artwork pixels rather than selection chrome. On sampling or cancellation, restore the original active object before normal selection callbacks resume.

**Why:** Fabric can clear or replace selection during pointer interaction, which otherwise applies the sampled color to the wrong object or loses the gradient stop the user was editing.

**How to apply:** Keep the sampling target and gradient context in refs that outlive panel close/reopen; apply a sampled color directly to that captured target/stop and restore the original Color Studio context when the panel returns.