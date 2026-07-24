import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ---------------------------------------------------------------------------
// Capgo Over-The-Air live update check
// ---------------------------------------------------------------------------
// Runs only inside a native Capacitor container (i.e. the Android APK).
// On plain web it does nothing — the Capacitor object is not present, so the
// dynamic import resolves but all calls are no-ops in the browser shim.
// The entire block is wrapped in try/catch so that offline devices or missing
// network access never surface an error to the user; the app always starts.
// ---------------------------------------------------------------------------
async function checkForOtaUpdate() {
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

    // Tell Capgo the current bundle loaded successfully.  This clears any
    // previous "failed" rollback flag so the updater won't auto-revert.
    await CapacitorUpdater.notifyAppReady();

    // Attempt to download the latest bundle from Capgo.
    // `url: 'AUTO'` resolves through the Capgo cloud using the appId from
    // capacitor.config.  If the device is offline or no update exists the
    // call throws and we swallow it silently below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const version = await CapacitorUpdater.download({ url: 'AUTO', version: '' } as any);

    if (version?.id) {
      const confirmed = window.confirm(
        'A new update is available! Would you like to update now?'
      );
      if (confirmed) {
        // Hot-swap the running web bundle with the newly downloaded one.
        await CapacitorUpdater.set({ id: version.id });
        // set() triggers a WebView reload — code after this line won't run.
      }
    }
  } catch {
    // Offline, no update available, or running in a plain browser — continue.
  }
}

// Fire-and-forget: do not await so it never delays the initial render.
checkForOtaUpdate();

createRoot(document.getElementById("root")!).render(<App />);
