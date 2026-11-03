import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  // O jsdom não rola: window.scrollTo só avisa "Not implemented". As telas rolam ao topo ao trocar de rota (RouteFocus), e os testes
  // que olham esse gesto o espiam por cima disto.
  window.scrollTo = () => undefined;
});

// Sem `globals`, o Testing Library não desmonta sozinho entre os testes.
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
