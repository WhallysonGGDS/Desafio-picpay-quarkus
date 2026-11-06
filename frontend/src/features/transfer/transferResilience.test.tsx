import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onlineManager } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockSession } from '../../test/api';
import { createQueryClient } from '../../app/providers';
import { marina, page, rafael, summary, tx } from '../../test/fixtures';
import { renderRoutes } from '../../test/render';
import { routes } from '../../app/router';
import { server } from '../../test/server';

// A vitrine liga o Lenis e o ScrollTrigger, que o jsdom não tem; estas telas não a usam.
vi.mock('../../showcase/useScrollScenes', () => ({ useScrollScenes: () => undefined }));

const SEARCH = 'E-mail ou CPF/CNPJ';
const AMOUNT = 'Valor em reais';
const SEND = 'Enviar R$ 250,00 para Rafael Costa';

afterEach(() => onlineManager.setOnline(true));

async function toConfirmation(person: ReturnType<typeof userEvent.setup>) {
  await person.type(await screen.findByLabelText(SEARCH), 'rafael@arco.demo');
  await person.click(await screen.findByRole('button', { name: /Rafael Costa/ }));
  await screen.findByRole('heading', { level: 1, name: 'Quanto?' });
  await person.type(screen.getByLabelText(AMOUNT), '250,00');
  await person.click(screen.getByRole('button', { name: 'Revisar envio' }));
  await screen.findByRole('heading', { level: 1, name: 'Confirmar.' });
}

// O envio nunca pode sair "no escuro" nem em dobro: o back-end não tem idempotência (RF2).
describe('envio: rede fora do ar e saída da tela com o envio a caminho', () => {
  // Quebra se: "Enviar" sem rede voltar a ser PAUSADO pela biblioteca de consultas (networkMode "online", o padrão): o clique não faz
  // nada, a tela fica em "Autorizando…" sem prazo, e quando a rede volta, minutos depois, o envio sai sozinho com a pessoa em outra tela.
  it('sem rede, o envio falha na hora como "não deu para confirmar", e nada sai quando a rede volta', async () => {
    const posts: unknown[] = [];
    mockSession(marina);
    server.use(
      http.get('*/users/search', () => HttpResponse.json([summary(rafael)])),
      http.post('*/transaction', async ({ request }) => {
        // O MSW atende dentro do próprio processo: "sem rede" é o fetch do navegador falhando.
        if (!onlineManager.isOnline()) return HttpResponse.error();
        posts.push(await request.json());
        return HttpResponse.json(tx(), { status: 201 });
      }),
    );
    // O cliente com os padrões do app (e não o dos testes de tela): é o networkMode dele que está em jogo.
    renderRoutes('/transferir', routes, createQueryClient());
    const person = userEvent.setup({ delay: null });
    await toConfirmation(person);

    act(() => onlineManager.setOnline(false)); // o navegador dispara "offline": modo avião, Wi-Fi que caiu
    await person.click(screen.getByRole('button', { name: SEND }));

    expect(await screen.findByText(/Não deu para confirmar/, undefined, { timeout: 3000 })).toBeInTheDocument();

    act(() => onlineManager.setOnline(true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(posts).toEqual([]);
  });

  // Quebra se: sair da tela com o envio a caminho e voltar deixar refazer o formulário e enviar de novo: o servidor receberia dois POSTs.
  it('com um envio ainda a caminho, voltar a Transferir não abre o formulário até ele terminar', async () => {
    const posts: unknown[] = [];
    const release: (() => void)[] = [];
    mockSession(marina);
    server.use(
      http.get('*/users/search', () => HttpResponse.json([summary(rafael)])),
      http.get('*/transaction', () => HttpResponse.json(page([], 0, 0, 20))),
      http.post('*/transaction', async ({ request }) => {
        posts.push(await request.json());
        await new Promise<void>((resolve) => release.push(resolve));
        return HttpResponse.json(tx(), { status: 201 });
      }),
    );
    renderRoutes('/transferir');
    const person = userEvent.setup({ delay: null });
    await toConfirmation(person);
    await person.click(screen.getByRole('button', { name: SEND }));
    await waitFor(() => expect(posts).toHaveLength(1));

    // A pessoa, impaciente, vai ao Extrato e volta a Transferir enquanto o envio ainda está a caminho.
    await person.click(screen.getByRole('link', { name: 'Extrato' }));
    await screen.findByRole('heading', { level: 1, name: 'Extrato' });
    await person.click(screen.getByRole('link', { name: 'Transferir' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Um envio ainda está a caminho.' })).toBeInTheDocument();
    expect(screen.queryByLabelText(SEARCH)).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver extrato' })).toHaveAttribute('href', '/extrato');
    expect(posts).toHaveLength(1);

    // Quando o envio termina, o formulário volta.
    await act(async () => {
      release.forEach((done) => done());
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Para quem?' })).toBeInTheDocument();
    expect(posts).toHaveLength(1);
  });
});
