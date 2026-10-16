export const TRANSPARENT_CHECKERBOARD_BACKGROUND =
  'repeating-conic-gradient(#e0e0e0 0% 25%, #ffffff 0% 50%) 0 0 / 24px 24px';

export function repaintCanvasSurface(surface: HTMLElement | null): void {
  if (!surface?.isConnected) return;
  const background = surface.style.background;
  if (!background) return;

  // Force the browser to rebuild the CSS background layer after WebView resume.
  try {
    surface.style.background = 'transparent';
    void surface.offsetHeight;
  } finally {
    surface.style.background = background;
  }
}
