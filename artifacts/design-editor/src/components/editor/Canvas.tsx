import { RefObject } from 'react';
import { PenPoint } from '@/hooks/useFabricCanvas';

export interface DragInfo {
  w: number;
  h: number;
  angle: number;
  clientX: number;
  clientY: number;
}

interface CanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  hasObjects: boolean;
  gridEnabled: boolean;
  gridSize: number;
  transparentBg: boolean;
  penPoints: PenPoint[];
  penActive: boolean;
  onPenClose: () => void;
  zoom: number;
  vpX: number;
  vpY: number;
  dragInfo: DragInfo | null;
}

export default function CanvasWorkspace({
  canvasRef, containerRef, hasObjects,
  gridEnabled, gridSize, transparentBg,
  penPoints, penActive,
  zoom, vpX, vpY,
  dragInfo,
}: CanvasProps) {
  const tileSize = gridSize * zoom;
  const showEmptyHint = !hasObjects && !penActive;
  const showPenSvg = penActive && penPoints.length > 0;

  /* ── Telemetry tooltip position (clamped inside container) ── */
  let tooltipLeft = 0;
  let tooltipTop = 0;
  if (dragInfo && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    tooltipLeft = Math.min(dragInfo.clientX - rect.left + 14, rect.width - 130);
    tooltipTop  = Math.max(dragInfo.clientY - rect.top  - 38, 4);
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative"
      style={{
        background: transparentBg
          ? `repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 20px 20px`
          : `radial-gradient(circle at 50% 50%, #0f1118 0%, #0B0C10 100%)`,
        cursor: penActive ? 'crosshair' : 'default',
      }}
      data-testid="canvas-workspace"
    >
      {/*
        All overlay layers are ALWAYS present in the DOM.
        Visibility is controlled via `opacity` / `display` so React never
        inserts or removes siblings adjacent to <canvas>.
      */}

      {/* Grid overlay — stable node, opacity driven */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: gridEnabled ? 1 : 0,
          backgroundImage: `
            linear-gradient(rgba(0,245,255,0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,245,255,0.12) 1px, transparent 1px)
          `,
          backgroundSize: `${tileSize}px ${tileSize}px`,
          backgroundPosition: `${vpX % tileSize}px ${vpY % tileSize}px`,
        }}
      />

      {/* Empty-state hint — stable node, opacity driven */}
      <div
        aria-hidden={!showEmptyHint}
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
        style={{ opacity: showEmptyHint ? 1 : 0 }}
      >
        <p className="text-muted-foreground text-sm tracking-wide select-none">
          Tap + to add your first element
        </p>
      </div>

      {/* Pen SVG overlay — stable node, display driven */}
      <svg
        aria-hidden={!showPenSvg}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        style={{ overflow: 'visible', display: showPenSvg ? 'block' : 'none' }}
      >
        {penPoints.length >= 2 && (
          <polyline
            points={penPoints.map((p) => `${p.x * zoom + vpX},${p.y * zoom + vpY}`).join(' ')}
            fill="none"
            stroke="#00F5FF"
            strokeWidth="1.5"
            strokeDasharray="6 3"
            opacity="0.6"
          />
        )}
        {penPoints.map((p, i) => {
          const cx = p.x * zoom + vpX;
          const cy = p.y * zoom + vpY;
          const isFirst = i === 0;
          return (
            <g key={`pt-${i}-${Math.round(p.x)}-${Math.round(p.y)}`}>
              <circle
                cx={cx} cy={cy} r={isFirst ? 7 : 5}
                fill={isFirst ? '#ff6b6b' : '#00F5FF'}
                stroke="#fff" strokeWidth="1.5"
              />
              {isFirst && penPoints.length >= 3 && (
                <circle cx={cx} cy={cy} r={12} fill="none" stroke="#ff6b6b" strokeWidth="1" opacity="0.5" strokeDasharray="3 2" />
              )}
            </g>
          );
        })}
      </svg>

      {/* Pen instruction — stable node, display driven */}
      <div
        aria-hidden={!penActive}
        className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-20"
        style={{ display: penActive ? 'flex' : 'none' }}
      >
        <div
          className="px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(0,0,0,0.75)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.3)' }}
        >
          {penPoints.length === 0
            ? 'Tap to place first anchor point'
            : penPoints.length < 3
            ? `${penPoints.length} point${penPoints.length > 1 ? 's' : ''} — keep tapping`
            : 'Tap first point to close shape'}
        </div>
      </div>

      {/* Transformation telemetry — shown while dragging / scaling / rotating */}
      <div
        aria-hidden={!dragInfo}
        className="absolute pointer-events-none z-30 px-2 py-1 rounded-lg text-xs font-mono whitespace-nowrap"
        style={{
          display: dragInfo ? 'block' : 'none',
          left: tooltipLeft,
          top: tooltipTop,
          background: 'rgba(0,0,0,0.88)',
          color: '#00F5FF',
          border: '1px solid rgba(0,245,255,0.35)',
          boxShadow: '0 0 8px rgba(0,245,255,0.2)',
        }}
      >
        {dragInfo ? `${dragInfo.w} × ${dragInfo.h} px${dragInfo.angle !== 0 ? `  ·  ${dragInfo.angle}°` : ''}` : ''}
      </div>

      <canvas
        ref={canvasRef}
        id="fabric-canvas"
        className="absolute top-0 left-0"
        data-testid="fabric-canvas"
      />
    </div>
  );
}
