import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from 'vite-plugin-pwa';

// Enable relative paths for Capacitor OR Electron desktop builds
const isDesktopOrMobile = process.env.CAPACITOR_BUILD === 'true' || process.env.ELECTRON_BUILD === 'true';
const isCapacitor = process.env.CAPACITOR_BUILD === 'true';
const isBuild = process.env.NODE_ENV === 'production' ||
                process.argv.includes('build') ||
                isDesktopOrMobile;

// For regular web builds BASE_PATH is required; Desktop/Capacitor builds always use './'
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

// Relative asset paths ('./') are required for local file:// loading in Electron & Capacitor
const resolvedBase = isDesktopOrMobile ? './' : (basePath ?? '/');

export default defineConfig({
  base: resolvedBase,
  plugins: [
    react(),
    tailwindcss(),
    // Only include the runtime error overlay during web development
    ...(!isDesktopOrMobile ? [runtimeErrorOverlay()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,jpg,jpeg,woff,woff2,ttf,otf}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
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
    !isDesktopOrMobile
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
