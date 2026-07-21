import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pylab.graphicdesign',
  appName: 'Graphic Design Studio',
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
};

export default config;
