import { QueryClientProvider } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from './providers';

describe('createQueryClient (o cliente do app, não o de teste)', () => {
  // Quebra se: mutações passarem a repetir sozinhas. Uma transferência que falhou por rede seria reenviada sem a
  // pessoa saber, e se a primeira tivesse chegado o dinheiro sairia duas vezes. O primeiro intervalo de repetição
  // do TanStack é de 1 s, por isso a espera.
  it('uma mutação que falha nunca é repetida sozinha', async () => {
    const client = createQueryClient();
    let calls = 0;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => {
            calls += 1;
            throw new Error('rede');
          },
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    await new Promise((resolve) => setTimeout(resolve, 1300));

    expect(calls).toBe(1);
  });
});
