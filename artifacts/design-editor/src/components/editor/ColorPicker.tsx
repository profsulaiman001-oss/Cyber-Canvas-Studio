import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── Color math utilities ─── */
function hsbToRgb(h: number, s: number, b: number): [number, number, number] {
  s = Math.max(0, Math.min(1, s));
  b = Math.max(0, Math.min(1, b));
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return b - b * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function rgbToHsb(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta + 6) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
  }
  return [h, max === 0 ? 0 : delta / max, max];
}

export function hexToHsb(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex);
  if (!rgb) return [0, 1, 1];
  return rgbToHsb(...rgb);
}

export function hsbToHex(h: number, s: number, b: number): string {
  const [r, g, bv] = hsbToRgb(h, s, b);
  return rgbToHex(r, g, bv);
}

/* ─── Core picker component ─── */
interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [hsb, setHsb] = useState<[number, number, number]>(() => hexToHsb(value));
  const [hexInput, setHexInput] = useState(() => value.replace('#', '').toUpperCase());
  const pickerRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);
  const pickDrag = useRef(false);
  const hueDrag = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const [h, s, b] = hsb;

  useEffect(() => {
    const newHsb = hexToHsb(value);
    setHsb(newHsb);
    setHexInput(value.replace('#', '').toUpperCase());
  }, [value]);

  const commit = useCallback((nh: number, ns: number, nb: number) => {
    const hex = hsbToHex(nh, ns, nb);
    setHsb([nh, ns, nb]);
    setHexInput(hex.replace('#', '').toUpperCase());
    onChangeRef.current(hex);
  }, []);

  /* Draw saturation/brightness square */
  useEffect(() => {
    const cv = pickerRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const W = cv.width, H = cv.height;
    const [hr, hg, hb] = hsbToRgb(h, 1, 1);
    ctx.fillStyle = `rgb(${hr},${hg},${hb})`;
    ctx.fillRect(0, 0, W, H);
    const gW = ctx.createLinearGradient(0, 0, W, 0);
    gW.addColorStop(0, 'rgba(255,255,255,1)');
    gW.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gW; ctx.fillRect(0, 0, W, H);
    const gB = ctx.createLinearGradient(0, 0, 0, H);
    gB.addColorStop(0, 'rgba(0,0,0,0)');
    gB.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = gB; ctx.fillRect(0, 0, W, H);
    const cx = s * W, cy = (1 - b) * H;
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  }, [h, s, b]);

  /* Draw hue strip */
  useEffect(() => {
    const cv = hueRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const H = cv.height, W = cv.width;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    [0, 60, 120, 180, 240, 300, 360].forEach((deg, i) => g.addColorStop(i / 6, `hsl(${deg},100%,50%)`));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const y = (h / 360) * H;
    ctx.fillStyle = 'white'; ctx.fillRect(0, Math.max(0, y - 2), W, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.5;
    ctx.strokeRect(0, Math.max(0, y - 2), W, 4);
  }, [h]);

  const pickerPick = useCallback((e: MouseEvent | React.MouseEvent) => {
    const cv = pickerRef.current; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const ns = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const nb = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    commit(h, ns, nb);
  }, [h, commit]);

  const huePick = useCallback((e: MouseEvent | React.MouseEvent) => {
    const cv = hueRef.current; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const nh = Math.max(0, Math.min(360, ((e.clientY - rect.top) / rect.height) * 360));
    commit(Math.round(nh), s, b);
  }, [s, b, commit]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (pickDrag.current) pickerPick(e);
      if (hueDrag.current) huePick(e);
    };
    const onUp = () => { pickDrag.current = false; hueDrag.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [pickerPick, huePick]);

  const handleHexChange = (raw: string) => {
    const v = raw.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase();
    setHexInput(v);
    if (v.length === 6) {
      const newHsb = hexToHsb('#' + v);
      setHsb(newHsb);
      onChangeRef.current('#' + v.toLowerCase());
    }
  };

  const previewHex = hsbToHex(h, s, b);

  return (
    <div className="space-y-2 pt-1 pb-1">
      <div className="flex gap-2 items-stretch">
        <canvas
          ref={pickerRef}
          width={182}
          height={148}
          className="rounded-lg flex-1 min-w-0"
          style={{ cursor: 'crosshair', touchAction: 'none', display: 'block' }}
          onMouseDown={(e) => { pickDrag.current = true; pickerPick(e); }}
        />
        <canvas
          ref={hueRef}
          width={18}
          height={148}
          className="rounded-lg flex-shrink-0"
          style={{ width: 18, height: 148, cursor: 'ns-resize', touchAction: 'none', display: 'block' }}
          onMouseDown={(e) => { hueDrag.current = true; huePick(e); }}
        />
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-md border border-border flex-shrink-0"
          style={{ background: previewHex }}
        />
        <div className="flex items-center gap-1 flex-1 h-8 border border-border rounded-md px-2">
          <span className="text-xs text-muted-foreground select-none">#</span>
          <input
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            maxLength={6}
            spellCheck={false}
            className="flex-1 bg-transparent text-xs font-mono text-foreground focus:outline-none uppercase"
            style={{ letterSpacing: '0.04em' }}
          />
        </div>
      </div>
    </div>
  );
}
