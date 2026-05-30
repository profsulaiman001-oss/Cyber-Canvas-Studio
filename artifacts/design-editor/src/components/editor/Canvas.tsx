import { RefObject } from 'react';
import { PenPoint } from '@/hooks/useFabricCanvas';

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
}

export default function CanvasWorkspace({
  canvasRef, containerRef, hasObjects,
  gridEnabled, gridSize, transparentBg,
  penPoints, penActive,
  zoom, vpX, vpY,
}: CanvasProps) {
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
      {/* Grid overlay — only visible in workspace, not in export */}
      {gridEnabled && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,245,255,0.12) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,245,255,0.12) 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
            backgroundPosition: `${vpX % (gridSize * zoom)}px ${vpY % (gridSize * zoom)}px`,
          }}
        />
      )}

      {/* Empty state hint */}
      {!hasObjects && !penActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <p className="text-muted-foreground text-sm tracking-wide select-none">
            Tap + to add your first element
          </p>
        </div>
      )}

      {/* Pen tool SVG overlay */}
      {penActive && penPoints.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
          style={{ overflow: 'visible' }}
        >
          {/* Connecting line preview */}
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
          {/* Anchor dots */}
          {penPoints.map((p, i) => {
            const cx = p.x * zoom + vpX;
            const cy = p.y * zoom + vpY;
            const isFirst = i === 0;
            return (
              <g key={i}>
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
      )}

      {/* Pen tool instruction */}
      {penActive && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-20">
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
      )}

      <canvas
        ref={canvasRef}
        id="fabric-canvas"
        className="absolute top-0 left-0"
        data-testid="fabric-canvas"
      />
    </div>
  );
}
