import { RefObject, useRef, useEffect } from 'react';
import { PenPoint, VectorAnchor } from '@/hooks/useFabricCanvas';

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
  brushActive?: boolean;
  eyedropperActive?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
  vectorAnchors?: VectorAnchor[];
  onVectorAnchorDragStart?: (idx: number) => void;
  onVectorAnchorDragMove?: (totalDx: number, totalDy: number) => void;
  onVectorAnchorDragEnd?: () => void;
  guides?: { h: number[]; v: number[] };
  gridLocked?: boolean;
  onGuideMove?: (axis: 'h' | 'v', idx: number, newDesignPos: number) => void;
}

export default function CanvasWorkspace({
  canvasRef, containerRef, hasObjects,
  gridEnabled, gridSize, transparentBg,
  penPoints, penActive,
  zoom, vpX, vpY,
  dragInfo, brushActive, eyedropperActive,
  canvasWidth = 1080,
  canvasHeight = 1080,
  vectorAnchors = [],
  onVectorAnchorDragStart,
  onVectorAnchorDragMove,
  onVectorAnchorDragEnd,
  guides,
  gridLocked = false,
  onGuideMove,
}: CanvasProps) {
  const tileSize = gridSize * zoom;
  const showEmptyHint = !hasObjects && !penActive && !brushActive;
  const showPenSvg = penActive && penPoints.length > 0;

  const canvasCursor = eyedropperActive ? 'crosshair' : penActive ? 'crosshair' : brushActive ? 'none' : 'default';

  /* ── Drag tooltip position ── */
  let tooltipLeft = 0, tooltipTop = 0;
  if (dragInfo && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    tooltipLeft = Math.min(dragInfo.clientX - rect.left + 14, rect.width - 130);
    tooltipTop = Math.max(dragInfo.clientY - rect.top - 38, 4);
  }

  /* ── Vector anchor drag ── */
  const anchorDragRef = useRef<{ idx: number; startClientX: number; startClientY: number } | null>(null);
  const onVectorDragMoveRef = useRef(onVectorAnchorDragMove);
  const onVectorDragEndRef = useRef(onVectorAnchorDragEnd);
  useEffect(() => { onVectorDragMoveRef.current = onVectorAnchorDragMove; }, [onVectorAnchorDragMove]);
  useEffect(() => { onVectorDragEndRef.current = onVectorAnchorDragEnd; }, [onVectorAnchorDragEnd]);

  useEffect(() => {
    if (!vectorAnchors.length) return;
    const onMove = (e: MouseEvent) => {
      if (!anchorDragRef.current) return;
      const dx = e.clientX - anchorDragRef.current.startClientX;
      const dy = e.clientY - anchorDragRef.current.startClientY;
      onVectorDragMoveRef.current?.(dx, dy);
    };
    const onUp = () => {
      if (anchorDragRef.current) {
        onVectorDragEndRef.current?.();
        anchorDragRef.current = null;
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [vectorAnchors.length]);

  /* ── Guide line drag ── */
  const guideDragRef = useRef<{ axis: 'h' | 'v'; idx: number; startClient: number; startDesign: number } | null>(null);
  const onGuideMoveRef = useRef(onGuideMove);
  useEffect(() => { onGuideMoveRef.current = onGuideMove; }, [onGuideMove]);

  useEffect(() => {
    if (gridLocked) return;
    const onMove = (e: MouseEvent) => {
      const drag = guideDragRef.current; if (!drag) return;
      const delta = drag.axis === 'h' ? e.clientY - drag.startClient : e.clientX - drag.startClient;
      const newDesignPos = Math.max(0, Math.round(drag.startDesign + delta / zoom));
      onGuideMoveRef.current?.(drag.axis, drag.idx, newDesignPos);
    };
    const onUp = () => { guideDragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [gridLocked, zoom]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative select-none"
      style={{
        background: `radial-gradient(circle at 50% 50%, #141722 0%, #08090C 100%)`,
        cursor: canvasCursor,
        overflow: 'auto',
        scrollbarWidth: 'none',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: '20px',
      }}
      data-testid="canvas-workspace"
    >
      <div
        className="relative overflow-hidden shadow-2xl border border-neutral-800/40"
        style={{
          width: `${canvasWidth * zoom}px`,
          height: `${canvasHeight * zoom}px`,
          flexShrink: 0,
          margin: 'auto',
          background: transparentBg ? `repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 20px 20px` : `#ffffff`,
        }}
      >
        <canvas ref={canvasRef} id="fabric-canvas" className="absolute top-0 left-0 w-full h-full" data-testid="fabric-canvas" />

        {/* High-contrast grid overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: gridEnabled ? 1 : 0,
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.3) 1px, transparent 1px),
              linear-gradient(rgba(255,255,255,0.25) 1.5px, transparent 1.5px),
              linear-gradient(90deg, rgba(255,255,255,0.25) 1.5px, transparent 1.5px)
            `,
            backgroundSize: `${tileSize}px ${tileSize}px, ${tileSize}px ${tileSize}px, ${tileSize}px ${tileSize}px, ${tileSize}px ${tileSize}px`,
            backgroundPosition: `${vpX % tileSize - 0.5}px ${vpY % tileSize - 0.5}px, ${vpX % tileSize - 0.5}px ${vpY % tileSize - 0.5}px, ${vpX % tileSize}px ${vpY % tileSize}px, ${vpX % tileSize}px ${vpY % tileSize}px`,
          }}
        />

        {/* Horizontal guide lines */}
        {guides?.h.map((pos, i) => {
          const yPx = pos * zoom + vpY;
          if (yPx < 0 || yPx > canvasHeight * zoom) return null;
          return (
            <div
              key={`gh${i}`}
              style={{
                position: 'absolute', left: 0, right: 0,
                top: yPx, height: 2,
                background: 'rgba(255, 80, 80, 0.85)',
                boxShadow: '0 0 4px rgba(255,80,80,0.7)',
                cursor: gridLocked ? 'default' : 'ns-resize',
                pointerEvents: gridLocked ? 'none' : 'auto',
                zIndex: 15,
              }}
              onMouseDown={(e) => {
                if (gridLocked) return;
                e.stopPropagation();
                guideDragRef.current = { axis: 'h', idx: i, startClient: e.clientY, startDesign: pos };
              }}
            />
          );
        })}

        {/* Vertical guide lines */}
        {guides?.v.map((pos, i) => {
          const xPx = pos * zoom + vpX;
          if (xPx < 0 || xPx > canvasWidth * zoom) return null;
          return (
            <div
              key={`gv${i}`}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: xPx, width: 2,
                background: 'rgba(255, 80, 80, 0.85)',
                boxShadow: '0 0 4px rgba(255,80,80,0.7)',
                cursor: gridLocked ? 'default' : 'ew-resize',
                pointerEvents: gridLocked ? 'none' : 'auto',
                zIndex: 15,
              }}
              onMouseDown={(e) => {
                if (gridLocked) return;
                e.stopPropagation();
                guideDragRef.current = { axis: 'v', idx: i, startClient: e.clientX, startDesign: pos };
              }}
            />
          );
        })}

        {/* Empty-state hint */}
        <div
          aria-hidden={!showEmptyHint}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 animate-fade-in"
          style={{ opacity: showEmptyHint ? 1 : 0 }}
        >
          <p className="text-neutral-400 text-sm tracking-wider font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">
            Tap + to add your first element
          </p>
        </div>

        {/* Pen SVG overlay */}
        <svg
          aria-hidden={!showPenSvg}
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
          style={{ overflow: 'visible', display: showPenSvg ? 'block' : 'none' }}
        >
          {penPoints.length >= 2 && (
            <polyline
              points={penPoints.map((p) => `${p.x * zoom + vpX},${p.y * zoom + vpY}`).join(' ')}
              fill="none" stroke="#00F5FF" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.6"
            />
          )}
          {penPoints.map((p, i) => {
            const cx = p.x * zoom + vpX;
            const cy = p.y * zoom + vpY;
            const isFirst = i === 0;
            return (
              <g key={`pt-${i}-${Math.round(p.x)}-${Math.round(p.y)}`}>
                <circle cx={cx} cy={cy} r={isFirst ? 7 : 5} fill={isFirst ? '#ff6b6b' : '#00F5FF'} stroke="#fff" strokeWidth="1.5" />
                {isFirst && penPoints.length >= 3 && (
                  <circle cx={cx} cy={cy} r={12} fill="none" stroke="#ff6b6b" strokeWidth="1" opacity="0.5" strokeDasharray="3 2" />
                )}
              </g>
            );
          })}
        </svg>

        {/* Vector anchor + handle editor overlay */}
        {vectorAnchors.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full z-30"
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            {/* Handle arm lines: connect each handle to its paired anchor */}
            {vectorAnchors
              .filter(a => a.kind === 'handle' && a.pairScreenX !== null)
              .map((a, i) => (
                <line key={`arm-${i}`}
                  x1={a.screenX} y1={a.screenY}
                  x2={a.pairScreenX!} y2={a.pairScreenY!}
                  stroke="rgba(123,47,255,0.55)" strokeWidth="1" strokeDasharray="3 2"
                  pointerEvents="none"
                />
              ))}

            {/* Anchors (circles) and Handles (diamonds) */}
            {vectorAnchors.map((anchor, i) => {
              const isHandle = anchor.kind === 'handle';
              return (
                <g
                  key={`va-${i}`}
                  style={{ pointerEvents: 'auto', cursor: 'move' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onVectorAnchorDragStart?.(i);
                    anchorDragRef.current = { idx: i, startClientX: e.clientX, startClientY: e.clientY };
                  }}
                >
                  {isHandle ? (
                    <>
                      {/* Handle hit-area */}
                      <circle cx={anchor.screenX} cy={anchor.screenY} r={9} fill="transparent" />
                      {/* Diamond shape */}
                      <rect
                        x={anchor.screenX - 4.5} y={anchor.screenY - 4.5}
                        width={9} height={9}
                        fill="#7B2FFF" stroke="white" strokeWidth={1.5}
                        transform={`rotate(45 ${anchor.screenX} ${anchor.screenY})`}
                      />
                    </>
                  ) : (
                    <>
                      {/* Anchor glow ring */}
                      <circle cx={anchor.screenX} cy={anchor.screenY} r={10} fill="rgba(0,245,255,0.12)" stroke="rgba(0,245,255,0.4)" strokeWidth={1} />
                      {/* Anchor dot */}
                      <circle cx={anchor.screenX} cy={anchor.screenY} r={5} fill="#00F5FF" stroke="white" strokeWidth={1.5} />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Pen instruction */}
      <div aria-hidden={!penActive} className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-20" style={{ display: penActive ? 'flex' : 'none' }}>
        <div className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(0,0,0,0.8)', color: '#00F5FF', border: '1px solid rgba(0,245,255,0.35)' }}>
          {penPoints.length === 0 ? 'Tap to place first anchor point' : penPoints.length < 3 ? `${penPoints.length} point${penPoints.length > 1 ? 's' : ''} — keep tapping` : 'Tap first point to close shape'}
        </div>
      </div>

      {/* Drag telemetry */}
      <div
        aria-hidden={!dragInfo}
        className="absolute pointer-events-none z-30 px-2 py-1 rounded-lg text-xs font-mono whitespace-nowrap"
        style={{
          display: dragInfo ? 'block' : 'none', left: tooltipLeft, top: tooltipTop,
          background: 'rgba(0,0,0,0.92)', color: '#00F5FF',
          border: '1px solid rgba(0,245,255,0.4)', boxShadow: '0 0 10px rgba(0,245,255,0.25)',
        }}
      >
        {dragInfo ? `${dragInfo.w} × ${dragInfo.h} px${dragInfo.angle !== 0 ? `  ·  ${dragInfo.angle}°` : ''}` : ''}
      </div>
    </div>
  );
}
