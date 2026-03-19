import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

// Minimal wrong definitions for the BeforeInstallPrompt event.
// Browsers expose this event for Android install prompts.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function getIsIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function getIsInStandaloneMode() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  return (
    (navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(getIsInStandaloneMode());
  const [showPrompt, setShowPrompt] = useState(false);

  const isIos = useMemo(() => getIsIos(), []);
  const showIosPrompt = isIos && !isInstalled;

  useEffect(() => {
    const handler = (event: any) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setShowPrompt(true);
    };

    const appInstalledHandler = () => {
      setIsInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handler as any);
    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as any);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt && !showIosPrompt) return null;
  if (typeof document === 'undefined') return null;

  const handleClosePrompt = () => {
    setDeferredPrompt(null);
    setShowPrompt(false);
    // Mark as installed so dismissing doesn't keep resurfacing the prompt.
    setIsInstalled(true);
  };

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9999] flex w-[min(420px,calc(100%-24px))] max-w-[90vw] flex-col gap-2 rounded-2xl bg-card/95 p-4 pt-5 pr-5 shadow-xl backdrop-blur-md ring-1 ring-border sm:bottom-6 sm:right-6">
      <button
        type="button"
        aria-label="Close install prompt"
        onClick={handleClosePrompt}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <span className="text-base leading-none">✕</span>
      </button>

      {showPrompt && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Install SPARK</p>
            <p className="text-xs text-muted-foreground">Get offline access and a native-like experience.</p>
          </div>
          <button
            onClick={handleInstallClick}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-background shadow-sm hover:bg-primary/90"
          >
            Install
          </button>
        </div>
      )}

      {showIosPrompt && (
        <div className="flex items-start gap-3">
          <div className="mt-1 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">+</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Add to Home Screen</p>
            <p className="text-xs text-muted-foreground">
              Tap <span className="font-semibold">Share</span> → <span className="font-semibold">Add to Home Screen</span>.
            </p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
