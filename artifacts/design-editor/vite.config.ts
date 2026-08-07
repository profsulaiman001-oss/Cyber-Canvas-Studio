import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from 'vite-plugin-pwa';

// When CAPACITOR_BUILD=true we produce a self-contained static bundle with
// relative paths so the Android WebView can load it from the local filesystem.
const isCapacitor = process.env.CAPACITOR_BUILD === 'true';
const isBuild = process.env.NODE_ENV === 'production' ||
                process.argv.includes('build') ||
                isCapacitor;

// For regular web builds BASE_PATH is required; Capacitor builds always use './'
const rawPort = process.env.PORT;
if (!isBuild && !rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}
const port = Number(rawPort || '3000');
if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;
if (!isBuild && !basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

// Capacitor APK needs relative asset paths ('./'). Web preview uses basePath.
const resolvedBase = isCapacitor ? './' : (basePath ?? '/');

export default defineConfig({
  base: resolvedBase,
  plugins: [
    react(),
    tailwindcss(),
    // Only include the runtime error overlay during web development
    ...(!isCapacitor ? [runtimeErrorOverlay()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      // Inline the service worker into the bundle so it is always up-to-date
      injectRegister: 'auto',
      // Include every static asset so the SW can cache the full app shell
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      workbox: {
        // Cache ALL bundled assets: JS chunks, CSS, fonts, images
        globPatterns: ['**/*.{js,css,html,ico,svg,png,jpg,jpeg,woff,woff2,ttf,otf}'],
        // Serve index.html for any navigation miss (SPA routing + offline)
        navigateFallback: 'index.html',
        // Keep the SW in control even when assets have been updated
        cleanupOutdatedCaches: true,
        // Runtime caching: serve font files from cache-first
        runtimeCaching: [
          {
            urlPattern: /\.(?:woff2?|ttf|otf)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      manifest: {
        name: 'Graphic Design Studio',
        short_name: 'DesignStudio',
        description: 'Offline Graphic Design Editor — Cyber-Studio',
        theme_color: '#00F5FF',
        background_color: '#0B0C10',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined &&
    !isCapacitor
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    // Ensure all assets are inlined or placed relative to index.html
    // so the Capacitor WebView can resolve them without a server.
    assetsInlineLimit: 0,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
