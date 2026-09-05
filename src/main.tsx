import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import { WorldProvider } from 'koota/react';
import { world } from './sim/world.js';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorldProvider world={world}>
      <App />
    </WorldProvider>
  </StrictMode>
);
