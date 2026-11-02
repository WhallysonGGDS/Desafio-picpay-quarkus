import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Consultas repetem uma vez (uma queda de rede curta não vira tela de erro). Mutações nunca repetem sozinhas:
// reenviar uma transferência por conta própria seria cobrar duas vezes.
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: 1 }, mutations: { retry: false } } });
}

const queryClient = createQueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
