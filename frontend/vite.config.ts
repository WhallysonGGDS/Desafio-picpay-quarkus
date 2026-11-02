import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Em desenvolvimento o Vite serve o front e repassa a API ao Quarkus. Empacotado, o Quinoa serve o `dist/` na mesma origem.
const API = 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  server: {
    proxy: { '/auth': API, '/users': API, '/transaction': API, '/hello': API },
  },
  test: {
    environment: 'jsdom',
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
