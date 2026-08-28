---
name: Workspace dependency install
description: Environment-specific dependency installation behavior in the pnpm monorepo
---

When an artifact's manifest already declares dependencies but its local links are missing, install from the workspace with the artifact filter rather than adding packages at the repository root.

**Why:** The generic package helper can invoke a root-level add in a pnpm workspace, which targets the wrong package and may fail before restoring the artifact's dependencies.

**How to apply:** Preserve the existing package manifests and lockfile, then use the artifact's workspace filter for a frozen-lockfile install before restarting its managed workflow.