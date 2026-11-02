import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/tokens.css';
import './design/global.css';

// Provisório: as telas entram nas tarefas seguintes.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <h1>arco</h1>
  </StrictMode>,
);
