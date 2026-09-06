import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import './lib/familyCache';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { notifyAppUpdateReady } from './lib/swUpdate';

// Register the service worker after first paint so it doesn't compete with
// the JS/CSS/data needed to show the app on a phone.
const startServiceWorker = () => {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      notifyAppUpdateReady();
    },
  });
  window.__familytreeApplyUpdate = () => {
    void updateSW(true);
  };
};
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    window.setTimeout(startServiceWorker, 1);
  } else {
    window.addEventListener('load', () => startServiceWorker(), { once: true });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
