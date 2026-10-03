import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { colorToHexInput, formatRgba, isValidColorInput, parseColor } from './colorUtils';
import { Slider } from '@/components/ui/slider';

/* ─── Color math ─── */
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
  const color = parseColor(hex);
  return [color.red, color.green, color.blue];
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
  return rgbToHex(...hsbToRgb(h, s, b));
}

/* ─── Core picker ─── */
interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const opacityInputId = useId();
  const [hsb, setHsb] = useState<[number, number, number]>(() => hexToHsb(value));
  const [alpha, setAlpha] = useState(() => parseColor(value).alpha);
  const [colorInput, setColorInput] = useState(() => colorToHexInput(parseColor(value)));
  const [opacityInput, setOpacityInput] = useState(() => String(Math.round(parseColor(value).alpha * 100)));
  const pickerRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);
  const pickDrag = useRef(false);
  const hueDrag = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const [h, s, b] = hsb;

  /* Sync external value → internal state (but not when we're the source of change) */
  const lastEmittedRef = useRef('');
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const color = parseColor(value);
    setHsb(rgbToHsb(color.red, color.green, color.blue));
    setAlpha(color.alpha);
    setColorInput(colorToHexInput(color));
    setOpacityInput(String(Math.round(color.alpha * 100)));
  }, [value]);

  const commit = useCallback((nh: number, ns: number, nb: number, na = alpha) => {
    const [red, green, blue] = hsbToRgb(nh, ns, nb);
    const color = { red, green, blue, alpha: na };
    const formattedColor = formatRgba(color);
    setHsb([nh, ns, nb]);
    setAlpha(na);
    setColorInput(colorToHexInput(color));
    setOpacityInput(String(Math.round(na * 100)));
    lastEmittedRef.current = formattedColor;
    onChangeRef.current(formattedColor);
  }, [alpha]);

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

  /* ─── Unified pointer-based pick functions (mouse + touch) ─── */
  const pickerPick = useCallback((clientX: number, clientY: number) => {
    const cv = pickerRef.current; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const ns = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const nb = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    commit(h, ns, nb);
  }, [h, commit]);

  const huePick = useCallback((clientY: number) => {
    const cv = hueRef.current; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const nh = Math.max(0, Math.min(360, ((clientY - rect.top) / rect.height) * 360));
    commit(Math.round(nh), s, b);
  }, [s, b, commit]);

  /* Global pointer tracking for drag (handles mouse going outside canvas) */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (pickDrag.current) pickerPick(e.clientX, e.clientY);
      if (hueDrag.current) huePick(e.clientY);
    };
    const onUp = () => { pickDrag.current = false; hueDrag.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [pickerPick, huePick]);

  /* ─── Hex input handler: robust parsing, 3+6 digit support, strips garbage ─── */
  const handleColorInputChange = (raw: string) => {
    setColorInput(raw);
    const color = parseColor(raw);
    const trimmed = raw.trim();
    if (!isValidColorInput(trimmed)) return;
    const newHsb = rgbToHsb(color.red, color.green, color.blue);
    const formattedColor = formatRgba(color);
    setHsb(newHsb);
    setAlpha(color.alpha);
    setOpacityInput(String(Math.round(color.alpha * 100)));
    lastEmittedRef.current = formattedColor;
    onChangeRef.current(formattedColor);
  };

  const handleColorInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    handleColorInputChange(e.clipboardData.getData('text'));
  };

  const [previewRed, previewGreen, previewBlue] = hsbToRgb(h, s, b);
  const previewColor = `rgba(${previewRed}, ${previewGreen}, ${previewBlue}, ${alpha})`;
  const opacityPercent = Math.round(alpha * 100);
  const commitOpacity = (value: number) => {
    const next = Math.max(0, Math.min(100, Math.round(value)));
    setOpacityInput(String(next));
    commit(h, s, b, next / 100);
  };

  return (
    <div className="space-y-2 pt-1 pb-1">
      <div className="flex gap-2 items-stretch">
        {/* Saturation / Brightness square */}
        <canvas
          ref={pickerRef}
          width={182}
          height={148}
          className="rounded-lg flex-1 min-w-0"
          style={{ cursor: 'crosshair', touchAction: 'none', display: 'block' }}
          onMouseDown={(e) => { pickDrag.current = true; pickerPick(e.clientX, e.clientY); }}
          onTouchStart={(e) => {
            e.preventDefault();
            pickDrag.current = true;
            pickerPick(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            if (pickDrag.current) pickerPick(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchEnd={() => { pickDrag.current = false; }}
        />
        {/* Hue strip */}
        <canvas
          ref={hueRef}
          width={18}
          height={148}
          className="rounded-lg flex-shrink-0"
          style={{ width: 18, height: 148, cursor: 'ns-resize', touchAction: 'none', display: 'block' }}
          onMouseDown={(e) => { hueDrag.current = true; huePick(e.clientY); }}
          onTouchStart={(e) => {
            e.preventDefault();
            hueDrag.current = true;
            huePick(e.touches[0].clientY);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            if (hueDrag.current) huePick(e.touches[0].clientY);
          }}
          onTouchEnd={() => { hueDrag.current = false; }}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={opacityInputId} className="text-[11px] text-muted-foreground">Opacity</label>
          <div className="flex h-7 items-center rounded-md border border-border bg-black/20 px-1.5">
            <input
              id={opacityInputId}
              aria-label="Color opacity percentage"
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              value={opacityInput}
              onChange={(event) => {
                const raw = event.target.value;
                setOpacityInput(raw);
                if (raw === '') return;
                const parsed = Number(raw);
                if (Number.isFinite(parsed)) commitOpacity(parsed);
              }}
              onBlur={() => setOpacityInput(String(opacityPercent))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="w-10 bg-transparent text-right text-xs font-mono text-foreground outline-none"
              data-testid="color-opacity-input"
            />
            <span className="ml-0.5 text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <div
          className="relative flex h-5 items-center overflow-hidden rounded-full"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(${previewRed},${previewGreen},${previewBlue},0), rgba(${previewRed},${previewGreen},${previewBlue},1)), repeating-conic-gradient(#777 0% 25%, #bbb 0% 50%)`,
            backgroundSize: '100% 100%, 12px 12px',
            backgroundPosition: 'center, 0 0',
            backgroundBlendMode: 'normal',
          }}
        >
          <Slider
            min={0}
            max={100}
            step={1}
            value={[opacityPercent]}
            onValueChange={([next]) => commitOpacity(next)}
            aria-label="Color opacity"
            className="[&>span:first-child]:!bg-transparent [&>span:first-child>span]:!bg-transparent"
            data-testid="color-opacity-slider"
          />
        </div>
      </div>
      {/* Color preview swatch + hex input */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-md border border-border flex-shrink-0"
          style={{
            backgroundImage: `linear-gradient(${previewColor}, ${previewColor}), repeating-conic-gradient(#777 0% 25%, #bbb 0% 50%)`,
            backgroundSize: '100% 100%, 8px 8px',
          }}
        />
        <div className="flex items-center gap-1 flex-1 h-8 border border-border rounded-md px-2">
          <input
            value={colorInput}
            onChange={(e) => handleColorInputChange(e.target.value)}
            onPaste={handleColorInputPaste}
            onBlur={() => {
              const parsed = parseColor(value);
              setColorInput(colorToHexInput(parsed));
            }}
            maxLength={40}
            spellCheck={false}
            placeholder="#000000 or rgba(...)"
            className="flex-1 bg-transparent text-xs font-mono text-foreground focus:outline-none uppercase placeholder:text-muted-foreground/40"
            style={{ letterSpacing: '0.06em' }}
            aria-label="Color value"
            data-testid="color-value-input"
          />
        </div>
      </div>
    </div>
  );
}
