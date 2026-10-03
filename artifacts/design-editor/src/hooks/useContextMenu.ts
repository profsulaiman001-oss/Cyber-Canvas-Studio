import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
} from 'react';
import type { CanvasController } from './useFabricCanvas';

export interface LongPressPosition {
  clientX: number;
  clientY: number;
  preventDefault: () => void;
}

type LongPressCallback = (position: LongPressPosition) => void;
type PressSource = 'pointer' | 'touch';

interface ActivePress {
  source: PressSource;
  originX: number;
  originY: number;
  clientX: number;
  clientY: number;
  pointerId?: number;
  fired: boolean;
  preventDefault: () => void;
}

/**
 * Long-press recognition for a touch pointer, with Touch Events as a fallback
 * for browsers that do not dispatch Pointer Events.
 */
export function useLongPress(onLongPress: LongPressCallback, threshold = 500) {
  const callbackRef = useRef(onLongPress);
  const activePressRef = useRef<ActivePress | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = onLongPress;
  }, [onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    activePressRef.current = null;
  }, []);

  const begin = useCallback((
    source: PressSource,
    clientX: number,
    clientY: number,
    nativeEvent: Event,
    pointerId?: number,
  ) => {
    cancel();
    const preventDefault = () => {
      if (nativeEvent.cancelable) nativeEvent.preventDefault();
    };
    const press: ActivePress = {
      source,
      originX: clientX,
      originY: clientY,
      clientX,
      clientY,
      pointerId,
      fired: false,
      preventDefault,
    };
    activePressRef.current = press;

    // The viewport already owns touch scrolling; preventing the initiating
    // touch event also prevents browser callouts while the timer is pending.
    preventDefault();

    timerRef.current = setTimeout(() => {
      if (activePressRef.current !== press) return;
      press.fired = true;
      press.preventDefault();
      callbackRef.current({
        clientX: press.clientX,
        clientY: press.clientY,
        preventDefault: press.preventDefault,
      });
      timerRef.current = null;
    }, threshold);
  }, [cancel, threshold]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') return;
    const activePress = activePressRef.current;
    if (activePress && activePress.pointerId !== event.pointerId) {
      cancel();
      return;
    }
    begin('pointer', event.clientX, event.clientY, event.nativeEvent, event.pointerId);
  }, [begin, cancel]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const activePress = activePressRef.current;
    if (!activePress || activePress.source !== 'pointer' || activePress.pointerId !== event.pointerId || activePress.fired) return;
    if (Math.hypot(event.clientX - activePress.originX, event.clientY - activePress.originY) > 10) {
      cancel();
      return;
    }
    activePress.clientX = event.clientX;
    activePress.clientY = event.clientY;
  }, [cancel]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const activePress = activePressRef.current;
    if (activePress?.source === 'pointer' && activePress.pointerId === event.pointerId) cancel();
  }, [cancel]);

  const onTouchStart = useCallback((event: ReactTouchEvent<HTMLElement>) => {
    // Pointer Events fire before Touch Events in browsers that support both.
    if (activePressRef.current?.source === 'pointer') return;
    if (event.touches.length !== 1) {
      cancel();
      return;
    }
    const touch = event.touches[0];
    if (touch) begin('touch', touch.clientX, touch.clientY, event.nativeEvent);
  }, [begin, cancel]);

  const onTouchMove = useCallback((event: ReactTouchEvent<HTMLElement>) => {
    const activePress = activePressRef.current;
    if (!activePress || activePress.source !== 'touch' || activePress.fired) return;
    if (event.touches.length !== 1) {
      cancel();
      return;
    }
    const touch = event.touches[0];
    if (touch && Math.hypot(touch.clientX - activePress.originX, touch.clientY - activePress.originY) > 10) {
      cancel();
      return;
    }
    if (touch) {
      activePress.clientX = touch.clientX;
      activePress.clientY = touch.clientY;
    }
  }, [cancel]);

  const onTouchEnd = useCallback(() => {
    if (activePressRef.current?.source === 'touch') cancel();
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
  };
}

export function useContextMenu(controller: CanvasController) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const openAt = useCallback((clientX: number, clientY: number) => {
    const canvas = controller.getCanvas();
    if (!canvas) return;

    // Fabric caches hit-test data while it processes pointer gestures. Clear it
    // so the context menu always resolves the exact client coordinates here.
    (canvas as typeof canvas & { _resetTransformEventData?: () => void })._resetTransformEventData?.();
    const hitTestEvent = {
      clientX,
      clientY,
      target: canvas.upperCanvasEl,
      type: 'contextmenu',
    } as unknown as PointerEvent;
    const target = canvas.findTarget(hitTestEvent).target;
    const activeObjects = canvas.getActiveObjects();

    if (target && !activeObjects.includes(target)) {
      canvas.setActiveObject(target);
      canvas.requestRenderAll();
    } else if (!target && activeObjects.length > 0) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }

    // Allow Fabric's selection events to update editor state before the menu
    // renders its selection-specific actions.
    window.setTimeout(() => setPosition({ x: clientX, y: clientY }), 0);
  }, [controller]);

  const onContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    // These must run before hit-testing so Fabric or a child overlay cannot
    // consume the browser's context-menu event.
    event.preventDefault();
    event.stopPropagation();
    openAt(event.clientX, event.clientY);
  }, [openAt]);

  const onLongPress = useCallback(({ clientX, clientY, preventDefault }: LongPressPosition) => {
    preventDefault();
    if (typeof navigator !== 'undefined') {
      try {
        navigator.vibrate?.(50);
      } catch {
        // Haptics are optional and may be blocked by the browser.
      }
    }
    openAt(clientX, clientY);
  }, [openAt]);

  const close = useCallback(() => setPosition(null), []);

  return { position, openAt, onContextMenu, onLongPress, close };
}