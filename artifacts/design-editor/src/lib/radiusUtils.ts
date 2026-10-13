import type { CornerRadiusValues } from '@/types/canvas';

const KAPPA = 0.5522847498;

export interface CornerRadiusGeometry {
  topLeft: { rx: number; ry: number };
  topRight: { rx: number; ry: number };
  bottomRight: { rx: number; ry: number };
  bottomLeft: { rx: number; ry: number };
}

function normalizeCornerRadii(
  width: number,
  height: number,
  radii: CornerRadiusValues,
  scaleX: number,
  scaleY: number,
): CornerRadiusGeometry {
  const sx = Math.max(Math.abs(scaleX) || 1, 0.0001);
  const sy = Math.max(Math.abs(scaleY) || 1, 0.0001);
  const radius = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
  const values: CornerRadiusGeometry = {
    topLeft: { rx: radius(radii.topLeft) / sx, ry: radius(radii.topLeft) / sy },
    topRight: { rx: radius(radii.topRight) / sx, ry: radius(radii.topRight) / sy },
    bottomRight: { rx: radius(radii.bottomRight) / sx, ry: radius(radii.bottomRight) / sy },
    bottomLeft: { rx: radius(radii.bottomLeft) / sx, ry: radius(radii.bottomLeft) / sy },
  };
  const ratios = [
    values.topLeft.rx + values.topRight.rx > 0
      ? width / (values.topLeft.rx + values.topRight.rx)
      : 1,
    values.bottomLeft.rx + values.bottomRight.rx > 0
      ? width / (values.bottomLeft.rx + values.bottomRight.rx)
      : 1,
    values.topLeft.ry + values.bottomLeft.ry > 0
      ? height / (values.topLeft.ry + values.bottomLeft.ry)
      : 1,
    values.topRight.ry + values.bottomRight.ry > 0
      ? height / (values.topRight.ry + values.bottomRight.ry)
      : 1,
  ];
  const factor = Math.max(0, Math.min(1, ...ratios));
  Object.values(values).forEach((corner) => {
    corner.rx *= factor;
    corner.ry *= factor;
  });
  return values;
}

/** Appends a Fabric-centered rounded rectangle path with independently sized corners. */
export function appendCornerRadiusPath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radii: CornerRadiusValues,
  scaleX: number,
  scaleY: number,
): void {
  const x = -width / 2;
  const y = -height / 2;
  const right = x + width;
  const bottom = y + height;
  const corners = normalizeCornerRadii(width, height, radii, scaleX, scaleY);
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;

  ctx.moveTo(x + topLeft.rx, y);
  ctx.lineTo(right - topRight.rx, y);
  if (topRight.rx > 0 || topRight.ry > 0) {
    ctx.bezierCurveTo(
      right - topRight.rx + KAPPA * topRight.rx,
      y,
      right,
      y + topRight.ry - KAPPA * topRight.ry,
      right,
      y + topRight.ry,
    );
  }
  ctx.lineTo(right, bottom - bottomRight.ry);
  if (bottomRight.rx > 0 || bottomRight.ry > 0) {
    ctx.bezierCurveTo(
      right,
      bottom - bottomRight.ry + KAPPA * bottomRight.ry,
      right - bottomRight.rx + KAPPA * bottomRight.rx,
      bottom,
      right - bottomRight.rx,
      bottom,
    );
  }
  ctx.lineTo(x + bottomLeft.rx, bottom);
  if (bottomLeft.rx > 0 || bottomLeft.ry > 0) {
    ctx.bezierCurveTo(
      x + bottomLeft.rx - KAPPA * bottomLeft.rx,
      bottom,
      x,
      bottom - bottomLeft.ry + KAPPA * bottomLeft.ry,
      x,
      bottom - bottomLeft.ry,
    );
  }
  ctx.lineTo(x, y + topLeft.ry);
  if (topLeft.rx > 0 || topLeft.ry > 0) {
    ctx.bezierCurveTo(
      x,
      y + topLeft.ry - KAPPA * topLeft.ry,
      x + topLeft.rx - KAPPA * topLeft.rx,
      y,
      x + topLeft.rx,
      y,
    );
  }
  ctx.closePath();
}

/** SVG counterpart to appendCornerRadiusPath, using the same clamped geometry. */
export function buildCornerRadiusPathData(
  width: number,
  height: number,
  radii: CornerRadiusValues,
  scaleX: number,
  scaleY: number,
): string {
  const x = -width / 2;
  const y = -height / 2;
  const right = x + width;
  const bottom = y + height;
  const corners = normalizeCornerRadii(width, height, radii, scaleX, scaleY);
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;
  const n = (value: number) => String(Math.round(value * 1000) / 1000);

  return [
    `M ${n(x + topLeft.rx)} ${n(y)}`,
    `L ${n(right - topRight.rx)} ${n(y)}`,
    `C ${n(right - topRight.rx + KAPPA * topRight.rx)} ${n(y)} ${n(right)} ${n(y + topRight.ry - KAPPA * topRight.ry)} ${n(right)} ${n(y + topRight.ry)}`,
    `L ${n(right)} ${n(bottom - bottomRight.ry)}`,
    `C ${n(right)} ${n(bottom - bottomRight.ry + KAPPA * bottomRight.ry)} ${n(right - bottomRight.rx + KAPPA * bottomRight.rx)} ${n(bottom)} ${n(right - bottomRight.rx)} ${n(bottom)}`,
    `L ${n(x + bottomLeft.rx)} ${n(bottom)}`,
    `C ${n(x + bottomLeft.rx - KAPPA * bottomLeft.rx)} ${n(bottom)} ${n(x)} ${n(bottom - bottomLeft.ry + KAPPA * bottomLeft.ry)} ${n(x)} ${n(bottom - bottomLeft.ry)}`,
    `L ${n(x)} ${n(y + topLeft.ry)}`,
    `C ${n(x)} ${n(y + topLeft.ry - KAPPA * topLeft.ry)} ${n(x + topLeft.rx - KAPPA * topLeft.rx)} ${n(y)} ${n(x + topLeft.rx)} ${n(y)}`,
    'Z',
  ].join(' ');
}
