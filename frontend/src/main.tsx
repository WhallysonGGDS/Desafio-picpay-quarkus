import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
// Tokens e estilos globais vêm antes de qualquer componente: o CSS dos componentes, carregado depois, prevalece.
import './design/tokens.css';
import './design/global.css';
import { Providers } from './app/providers';
import { createAppRouter } from './app/router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={createAppRouter()} />
    </Providers>
  </StrictMode>,
);
