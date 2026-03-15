/*
 * Service Worker registration helper
 *
 * This module registers the `public/sw.js` file created for the PWA.
 * It is safe to include in development (it will not register), and it
 * supports a callback so the app can react to updates (e.g. show a "refresh" prompt).
 */

export type ServiceWorkerConfig = {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
};

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    // 127.0.0.1/8
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/)
);

function registerValidSW(swUrl: string, config?: ServiceWorkerConfig) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      if (registration.waiting) {
        config?.onUpdate?.(registration);
      }

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content is available; notify the app.
              config?.onUpdate?.(registration);
            } else {
              // Content is cached for the first time.
              config?.onSuccess?.(registration);
            }
          }
        });
      });
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}

export function registerServiceWorker(config?: ServiceWorkerConfig) {
  if (import.meta.env.DEV) {
    // Do not register service worker in development to avoid caching issues.
    return;
  }

  if ('serviceWorker' in navigator) {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    // When running on localhost, check that a service worker still exists.
    if (isLocalhost) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fetch(swUrl)
        .then((response) => {
          // Ensure service worker exists, and that we really are getting a JS file.
          const contentType = response.headers.get('content-type');
          if (
            response.status === 404 ||
            (contentType && !contentType.includes('javascript'))
          ) {
            // No service worker found.  Probably a different app.
            navigator.serviceWorker.ready.then((registration) => {
              registration.unregister();
            });
          } else {
            registerValidSW(swUrl, config);
          }
        })
        .catch(() => {
          console.log('No internet connection found. App is running in offline mode.');
        });
    } else {
      registerValidSW(swUrl, config);
    }
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
