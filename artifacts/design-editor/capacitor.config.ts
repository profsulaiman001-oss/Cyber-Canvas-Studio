import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cyber.canvas.studio.cyber',
  appName: 'Cyber Studio',
  // Points at the Vite build output directory (relative to this file)
  webDir: 'dist/public',
  server: {
    // 'https' scheme ensures the Android WebView treats the local assets as a
    // secure origin, which is required for Service Workers and IndexedDB.
    androidScheme: 'https',
  },
  android: {
    // Allow the app to run fully offline; no cleartext traffic needed.
    allowMixedContent: false,
  },
  plugins: {
    CapacitorUpdater: {
      // Auto-update mode: Capgo silently downloads the latest bundle in the
      // background and applies it on the next app restart.  The app only
      // needs to call notifyAppReady() on startup to confirm the current
      // bundle is healthy and prevent an automatic rollback.
      autoUpdate: true,
    },
  },
};

export default config;
