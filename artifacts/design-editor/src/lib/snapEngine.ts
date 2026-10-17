export interface SnapAxisLock {
  guide: number;
  anchorIndex: number;
}

export interface AxisSnapResult {
  delta: number;
  lock: SnapAxisLock | null;
  guide: number | null;
}

/**
 * Acquire a guide within the threshold, then fade its pull to zero across the
 * release band. This keeps the alignment magnetic without trapping movement.
 */
export function resolveAxisSnap(
  anchors: number[],
  targets: number[],
  acquireThreshold: number,
  releaseThreshold: number,
  currentLock: SnapAxisLock | null,
): AxisSnapResult {
  if (currentLock && anchors[currentLock.anchorIndex] !== undefined) {
    const delta = currentLock.guide - anchors[currentLock.anchorIndex];
    const distance = Math.abs(delta);
    if (distance < releaseThreshold) {
      const weight = distance <= acquireThreshold
        ? 1
        : 1 - (distance - acquireThreshold) / (releaseThreshold - acquireThreshold);
      return {
        delta: delta * weight,
        lock: currentLock,
        guide: currentLock.guide,
      };
    }
  }

  let nearest: { delta: number; guide: number; anchorIndex: number; distance: number } | null = null;
  for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex++) {
    const anchor = anchors[anchorIndex];
    for (const guide of targets) {
      const delta = guide - anchor;
      const distance = Math.abs(delta);
      if (
        distance <= acquireThreshold &&
        (!nearest || distance < nearest.distance)
      ) {
        nearest = { delta, guide, anchorIndex, distance };
      }
    }
  }

  return nearest
    ? {
        delta: nearest.delta,
        lock: { guide: nearest.guide, anchorIndex: nearest.anchorIndex },
        guide: nearest.guide,
      }
    : { delta: 0, lock: null, guide: null };
}

export function getCardinalAngleSnap(angle: number, currentSnap: number | null): number | null {
  if (!Number.isFinite(angle)) return null;
  const normalized = ((angle % 360) + 360) % 360;
  const angularDistance = (a: number, b: number) =>
    Math.abs((((a - b) % 360) + 540) % 360 - 180);

  // A small release margin prevents the detent from flickering at its edge.
  if (currentSnap !== null && angularDistance(normalized, currentSnap) <= 4.5) {
    return currentSnap;
  }

  const nearest = Math.round(normalized / 90) * 90;
  return angularDistance(normalized, nearest) <= 3 ? nearest % 360 : null;
}
