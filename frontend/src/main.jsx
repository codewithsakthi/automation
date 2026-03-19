import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import * as Sentry from "@sentry/react";
import App from './App.jsx'
import { registerServiceWorker } from './serviceWorkerRegistration'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the service worker in production to enable offline support
registerServiceWorker({
  onUpdate: (registration) => {
    // Optional: you can show a toast to the user or auto-refresh.
    // This callback is invoked when a new service worker is waiting to activate.
    console.log('New version available. Refresh to update.');

    // Example: to auto-refresh uncomment below.
    // registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  },
});
