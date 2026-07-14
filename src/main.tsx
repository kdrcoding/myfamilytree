import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@xyflow/react/dist/style.css';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// Installable app: the service worker precaches the shell and silently
// updates itself whenever a new version is deployed.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
