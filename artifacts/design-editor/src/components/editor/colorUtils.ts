export interface RgbaColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function parseHexColor(value: string): RgbaColor | null {
  const match = value.trim().match(/^#?([0-9a-f]{3,8})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    hex = hex.split('').map((digit) => digit + digit).join('');
  }
  if (hex.length !== 6 && hex.length !== 8) return null;
  return {
    red: parseInt(hex.slice(0, 2), 16),
    green: parseInt(hex.slice(2, 4), 16),
    blue: parseInt(hex.slice(4, 6), 16),
    alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

function parseRgbColor(value: string): RgbaColor | null {
  const match = value.trim().match(/^rgba?\((.*)\)$/i);
  if (!match) return null;
  const parts = match[1]
    .replace(/\s*\/\s*/, ',')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length !== 3 && parts.length !== 4) return null;
  const parseChannel = (part: string) => {
    const parsed = parseFloat(part);
    if (!Number.isFinite(parsed)) return null;
    return clamp(part.endsWith('%') ? (parsed / 100) * 255 : parsed, 0, 255);
  };
  const [red, green, blue] = parts.slice(0, 3).map(parseChannel);
  if (red === null || green === null || blue === null) return null;
  let alpha = 1;
  if (parts[3] !== undefined) {
    const parsed = parseFloat(parts[3]);
    if (!Number.isFinite(parsed)) return null;
    alpha = clamp(parts[3].endsWith('%') ? parsed / 100 : parsed, 0, 1);
  }
  return {
    red: Math.round(red),
    green: Math.round(green),
    blue: Math.round(blue),
    alpha,
  };
}

export function isValidColorInput(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.toLowerCase() === 'transparent'
    || parseHexColor(trimmed) !== null
    || parseRgbColor(trimmed) !== null;
}

export function parseColor(value: string): RgbaColor {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === 'transparent') {
    return { red: 0, green: 0, blue: 0, alpha: 0 };
  }
  const direct = parseHexColor(trimmed) ?? parseRgbColor(trimmed);
  if (direct) return direct;

  if (typeof document !== 'undefined') {
    const context = document.createElement('canvas').getContext('2d');
    if (context) {
      context.fillStyle = '#000000';
      context.fillStyle = trimmed;
      const normalized = context.fillStyle;
      const parsed = parseHexColor(normalized) ?? parseRgbColor(normalized);
      if (parsed) return parsed;
    }
  }
  return { red: 0, green: 0, blue: 0, alpha: 1 };
}

export function formatRgba(color: RgbaColor): string {
  return `rgba(${Math.round(clamp(color.red, 0, 255))}, ${Math.round(clamp(color.green, 0, 255))}, ${Math.round(clamp(color.blue, 0, 255))}, ${clamp(color.alpha, 0, 1).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')})`;
}

export function colorWithAlpha(value: string, alpha: number): string {
  return formatRgba({ ...parseColor(value), alpha: clamp(alpha, 0, 1) });
}

export function colorOpacityPercent(value: string): number {
  return Math.round(parseColor(value).alpha * 100);
}

export function colorToHexInput(color: RgbaColor): string {
  const byte = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0').toUpperCase();
  const rgb = `#${byte(color.red)}${byte(color.green)}${byte(color.blue)}`;
  return color.alpha >= 1 ? rgb : `${rgb}${byte(color.alpha * 255)}`;
}

export function interpolateColor(first: string, second: string, ratio: number): string {
  const a = parseColor(first);
  const b = parseColor(second);
  const t = clamp(ratio, 0, 1);
  return formatRgba({
    red: a.red + (b.red - a.red) * t,
    green: a.green + (b.green - a.green) * t,
    blue: a.blue + (b.blue - a.blue) * t,
    alpha: a.alpha + (b.alpha - a.alpha) * t,
  });
}