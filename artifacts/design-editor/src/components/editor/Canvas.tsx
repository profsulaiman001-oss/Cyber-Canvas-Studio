import { RefObject } from 'react';

interface CanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  hasObjects: boolean;
}

export default function CanvasWorkspace({ canvasRef, containerRef, hasObjects }: CanvasProps) {
  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative"
      style={{
        background: `
          radial-gradient(circle at 50% 50%, #0f1118 0%, #0B0C10 100%)
        `,
      }}
      data-testid="canvas-workspace"
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,245,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,245,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {!hasObjects && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <p className="text-muted-foreground text-sm tracking-wide select-none">
            Tap + to add your first element
          </p>
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
