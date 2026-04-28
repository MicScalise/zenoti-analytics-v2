// =============================================================================
// main.tsx — React application entry point
// Implements: REQ-UI-01 (web app bootstrap)
// =============================================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

/**
 * Bootstrap the React application into the DOM.
 * Uses StrictMode for development warnings.
 * React Router handles all client-side routing.
 */
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in DOM');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
