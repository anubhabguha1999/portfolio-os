import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'dead-lock-skeleton/dist/style.css';
import './index.css';
import '@/hooks/useAppTheme';
import { App } from '@/app/App';
import { legacyHashTarget } from '@/app/legacy-hash';

// Old links used hash routing (/#/resumes). Move them to clean paths before the router reads the URL.
const legacy = legacyHashTarget(window.location.hash);
if (legacy) window.history.replaceState(null, '', legacy);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
