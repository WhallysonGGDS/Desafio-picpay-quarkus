import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { errorResponse } from '../../test/api';
import { loja, marina, page, tx } from '../../test/fixtures';
import { currentUrl, renderApp } from '../../test/render';
import { server } from '../../test/server';

const many = (n: number) => Array.from({ length: n }, (_, index) => tx({ id: 100 + index }));

function mockStatement(respond: (query: URLSearchParams) => Response | Promise<Response>) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get('*/transaction', ({ request }) => {
      const query = new URL(request.url).searchParams;
      queries.push(query);
      return respond(query);
    }),
  );
  return queries;
}

const balance = () => screen.findByTestId('wallet-balance');

describe('carteira', () => {
  // Quebra se: o saldo passar por número (1234567.89 viraria 1234567.8899999999) ou for arredondado na tela.
  it('o saldo vem da string da API, sem arredondar', async () => {
    mockStatement(() => HttpResponse.json(page([], 0)));
    renderApp('/carteira', { user: { ...marina, balance: '1234567.89' } });

    expect(await balance()).toHaveTextContent('R$ 1.234.567,89');
  });

  it('mostra o rótulo Saldo e o saldo inteiro, com duas casas', async () => {
    mockStatement(() => HttpResponse.json(page([], 0)));
    renderApp('/carteira', { user: marina });

    expect(await balance()).toHaveTextContent('R$ 1.000,00');
    expect(screen.getByText('Saldo')).toBeInTheDocument();
  });

  // Quebra se: a carteira pedir o extrato inteiro (ou a página errada) em vez das 5 últimas, ou perder o link do extrato.
  it('lista as 5 últimas movimentações e tem o link para o extrato', async () => {
    const queries = mockStatement(() => HttpResponse.json(page(many(5), 12, 0, 5)));
    renderApp('/carteira', { user: marina });

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(5));
    expect(queries[0]?.toString()).toBe('direction=all&page=0&size=5');
    expect(screen.getByRole('link', { name: 'Ver extrato' })).toHaveAttribute('href', '/extrato');
  });

  it('o botão Enviar dinheiro leva à tela de transferir', async () => {
    mockStatement(() => HttpResponse.json(page([], 0)));
    const { router } = renderApp('/carteira', { user: marina });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: 'Enviar dinheiro' }));

    await waitFor(() => expect(currentUrl(router)).toBe('/transferir'));
  });

  // Quebra se: a loja ganhar o botão de enviar (ela não envia: o servidor responderia 403) ou ficar sem explicação.
  it('carteira de lojista não mostra o botão de enviar e explica por quê', async () => {
    mockStatement(() => HttpResponse.json(page([], 0)));
    renderApp('/carteira', { user: loja });

    expect(await screen.findByText('Lojas recebem transferências.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Enviar dinheiro' })).toBeNull();
  });

  it('vazio: diz que não há movimentações', async () => {
    mockStatement(() => HttpResponse.json(page([], 0)));
    renderApp('/carteira', { user: marina });

    expect(await screen.findByText('Nenhuma movimentação por aqui.')).toBeInTheDocument();
  });

  // Quebra se: uma falha do extrato derrubar a carteira inteira (o saldo continua sendo o dado principal), ou
  // não deixar tentar de novo, ou chamar rede e servidor da mesma forma.
  it('erro nas movimentações: o saldo continua na tela, com o motivo e "Tentar de novo"', async () => {
    let mode: 'network' | 'server' | 'ok' = 'network';
    mockStatement(() => {
      if (mode === 'network') return HttpResponse.error();
      if (mode === 'server') return errorResponse(500, 'INTERNAL_ERROR');
      return HttpResponse.json(page([tx()], 1, 0, 5));
    });
    renderApp('/carteira', { user: marina });
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');
    expect(await balance()).toHaveTextContent('R$ 1.000,00');

    mode = 'server';
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado do nosso lado. Tente de novo.'));

    mode = 'ok';
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Rafael Costa')).toBeInTheDocument();
  });

  it('carregando as movimentações: linhas esqueléticas, e o saldo já aparece', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockStatement(async () => {
      await gate;
      return HttpResponse.json(page([tx()], 1, 0, 5));
    });
    renderApp('/carteira', { user: marina });

    expect(await balance()).toHaveTextContent('R$ 1.000,00');
    expect(screen.getByText('Carregando movimentações…').closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');

    release();
    expect(await screen.findByText('Rafael Costa')).toBeInTheDocument();
  });

  it('a região da carteira tem o nome da pessoa para quem usa leitor de tela', async () => {
    mockStatement(() => HttpResponse.json(page([tx()], 1, 0, 5)));
    renderApp('/carteira', { user: marina });

    const region = await screen.findByRole('region', { name: 'Carteira de Marina Alves' });
    expect(within(region).getByTestId('wallet-balance')).toBeInTheDocument();
  });
});
