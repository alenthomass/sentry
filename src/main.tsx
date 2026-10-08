/* ============================================================================
   Sentry · Entry point
   Loads the fonts and base styles, then mounts the app into #root.
   ============================================================================ */

import { createRoot } from 'react-dom/client';
import { SentryApp } from './app/App';
import './app/fonts.css';
import './app/base.css';

createRoot(document.getElementById('root')!).render(<SentryApp />);

// Installable app: register the service worker on real websites only.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !(window as any).claude) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
