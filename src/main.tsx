import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Safety global handlers for async promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.warn('[Leo AI Global Unhandled Promise Rejection Intercepted]:', event.reason);
});

window.addEventListener('error', (event) => {
  console.warn('[Leo AI Global Window Error Intercepted]:', event.message);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

