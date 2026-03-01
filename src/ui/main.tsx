import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

const container = document.getElementById('root');
if (!container) {
  throw new Error('React mount root #root was not found');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
