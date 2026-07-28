import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ---------------------------------------------------------------------------
// Capgo Over-The-Air live update — app-ready signal
// ---------------------------------------------------------------------------
// With autoUpdate: true in capacitor.config.ts, Capgo automatically downloads
// and applies the latest bundle in the background on every app start.
// The only call the app must make is notifyAppReady(), which tells Capgo that
// the current bundle loaded successfully.  Without it, Capgo treats the launch
// as a failed boot and rolls back to the previous bundle after its timeout.
//
// Runs only inside a native Capacitor container (Android APK).  In a plain
// browser the dynamic import resolves to a no-op shim, so this is safe on web.
// ---------------------------------------------------------------------------
async function signalAppReady() {
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
  } catch {
    // Browser / offline / shim — nothing to do.
  }
}

// Fire-and-forget — must not delay the initial render.
signalAppReady();

createRoot(document.getElementById("root")!).render(<App />);
