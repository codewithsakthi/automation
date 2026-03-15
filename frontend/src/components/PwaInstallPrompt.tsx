import { useEffect, useMemo, useState } from 'react';

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

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-[min(420px,calc(100%-32px))] -translate-x-1/2 flex-col gap-2 rounded-2xl bg-card/90 p-3 shadow-lg backdrop-blur-sm ring-1 ring-border">
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
    </div>
  );
}
