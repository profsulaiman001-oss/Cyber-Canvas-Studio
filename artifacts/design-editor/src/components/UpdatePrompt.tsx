/**
 * UpdatePrompt
 *
 * Runs only inside the native Capacitor container (Android APK).
 * On mount it silently downloads the latest Capgo bundle in the background.
 * If a new bundle arrives it surfaces a custom bottom-sheet asking the user
 * whether to apply the update immediately.
 *
 * Flow (autoUpdate: false in capacitor.config.ts):
 *   1. notifyAppReady()  ← already called in main.tsx, clears rollback flag
 *   2. download()        ← fetches latest bundle from Capgo cloud
 *   3. Show prompt       ← if a new bundle was returned
 *   4. set()             ← swaps the active bundle; WebView reloads instantly
 */

import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';

// Capgo BundleInfo shape (the fields we care about)
interface BundleInfo {
  id: string;
  version?: string;
}

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'ready'; bundle: BundleInfo }
  | { phase: 'applying' };

export default function UpdatePrompt() {
  const [updateState, setUpdateState] = useState<UpdateState>({ phase: 'idle' });
  const checkedRef = useRef(false);

  useEffect(() => {
    // Only ever run once, and only inside a native container.
    if (checkedRef.current || !Capacitor.isNativePlatform()) return;
    checkedRef.current = true;

    (async () => {
      try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

        // download() returns the bundle metadata if a newer version exists,
        // or resolves quietly (no throw) if we are already up-to-date.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bundle = await CapacitorUpdater.download({ url: 'AUTO', version: '' } as any) as BundleInfo | undefined;

        if (bundle?.id) {
          setUpdateState({ phase: 'ready', bundle });
        }
      } catch {
        // Offline, no update available, or running in dev — continue silently.
      }
    })();
  }, []);

  const handleApply = async () => {
    if (updateState.phase !== 'ready') return;
    const { bundle } = updateState;
    setUpdateState({ phase: 'applying' });

    try {
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
      // set() hot-swaps the active bundle and triggers an instant WebView reload.
      // Code after this line will not execute in the current session.
      await CapacitorUpdater.set({ id: bundle.id });
    } catch {
      // If set() fails, reset so the user can try again next launch.
      setUpdateState({ phase: 'idle' });
    }
  };

  const handleDismiss = () => setUpdateState({ phase: 'idle' });

  const isVisible = updateState.phase === 'ready' || updateState.phase === 'applying';

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999]"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={updateState.phase === 'applying' ? undefined : handleDismiss}
          />

          {/* Bottom sheet */}
          <motion.div
            key="sheet"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[10000] flex justify-center pb-safe"
          >
            <div
              className="w-full max-w-sm mx-4 mb-6 rounded-3xl overflow-hidden"
              style={{
                background: '#111520',
                border: '1px solid rgba(0,245,255,0.18)',
                boxShadow: '0 -4px 48px rgba(0,245,255,0.08), 0 24px 64px rgba(0,0,0,0.7)',
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div className="px-6 pt-2 pb-6 space-y-5">
                {/* Icon + heading */}
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: 'rgba(0,245,255,0.1)',
                      border: '1px solid rgba(0,245,255,0.25)',
                    }}
                  >
                    <RefreshCw size={18} color="#00F5FF" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold" style={{ color: '#E4E8EF' }}>
                      New update available
                    </p>
                    <p className="text-[12px] mt-1 leading-relaxed" style={{ color: '#4A5568' }}>
                      A new version of Cyber Studio is ready to install.
                      The app will reload instantly — your projects are safe.
                    </p>
                    {(updateState as { phase: string; bundle?: BundleInfo }).bundle?.version && (
                      <p className="text-[10px] font-mono mt-1.5" style={{ color: 'rgba(0,245,255,0.5)' }}>
                        v{(updateState as { phase: string; bundle?: BundleInfo }).bundle!.version}
                      </p>
                    )}
                  </div>

                  {updateState.phase !== 'applying' && (
                    <button
                      onClick={handleDismiss}
                      className="w-7 h-7 flex items-center justify-center rounded-xl flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      <X size={13} color="rgba(255,255,255,0.4)" />
                    </button>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleDismiss}
                    disabled={updateState.phase === 'applying'}
                    className="flex-1 py-3 rounded-2xl text-[13px] font-semibold transition-opacity disabled:opacity-40"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    Later
                  </button>

                  <button
                    onClick={handleApply}
                    disabled={updateState.phase === 'applying'}
                    className="flex-[2] py-3 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
                    style={{
                      background: 'linear-gradient(135deg, #00F5FF, #7B2FFF)',
                      color: '#fff',
                      boxShadow: '0 4px 20px rgba(0,245,255,0.25)',
                    }}
                  >
                    <RefreshCw
                      size={14}
                      className={updateState.phase === 'applying' ? 'animate-spin' : ''}
                    />
                    {updateState.phase === 'applying' ? 'Updating…' : 'Update Now'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
