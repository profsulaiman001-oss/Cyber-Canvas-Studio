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
      // Manual / custom-UI mode: the app downloads and applies updates itself
      // so it can show a branded prompt before reloading.  notifyAppReady()
      // is still required on every start to clear any pending rollback flag.
      autoUpdate: false,
    },
  },
};

export default config;
