import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Sem `globals`, o Testing Library não desmonta sozinho entre os testes.
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
