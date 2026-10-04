import { useEffect } from 'react';
import { useEditor } from '@/store/editorStore';

type PanelRootRef = { readonly current: HTMLElement | null };

interface UsePanelOutsideDismissalOptions {
  active: boolean;
  panelRef: PanelRootRef;
  triggerSelector: string;
}

const PORTALED_PANEL_CONTROLS =
  '[data-radix-popper-content-wrapper], [data-radix-portal], [role="menu"], [role="listbox"], [role="dialog"]';

export function usePanelOutsideDismissal({
  active,
  panelRef,
  triggerSelector,
}: UsePanelOutsideDismissalOptions) {
  const { dispatch } = useEditor();

  useEffect(() => {
    if (!active) return;

    const dismissIfOutside = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`${triggerSelector}, ${PORTALED_PANEL_CONTROLS}`)) return;
      dispatch({ type: 'CLOSE_PANEL' });
    };
    const handlePointerDown = (event: PointerEvent) => dismissIfOutside(event.target);
    const handleFocusIn = (event: FocusEvent) => dismissIfOutside(event.target);

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
    };
  }, [active, dispatch, panelRef, triggerSelector]);
}