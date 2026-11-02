import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './app/providers';
import { createAppRouter } from './app/router';
import './design/tokens.css';
import './design/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={createAppRouter()} />
    </Providers>
  </StrictMode>,
);
