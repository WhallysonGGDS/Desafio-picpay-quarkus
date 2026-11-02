import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { errorResponse } from '../../test/api';
import { marina, page, tx } from '../../test/fixtures';
import { currentUrl, renderApp } from '../../test/render';
import { server } from '../../test/server';
import { MovementList, MovementRow } from './MovementRow';

const MINUS = '−';

// n transferências com ids distintos (as chaves da lista).
const many = (n: number, from = 100) => Array.from({ length: n }, (_, index) => tx({ id: from + index }));

// Registra GET /transaction e devolve as buscas recebidas, na ordem.
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

async function openStatement() {
  const view = renderApp('/extrato', { user: marina });
  await screen.findByRole('heading', { name: 'Extrato' });
  return view;
}

describe('MovementRow', () => {
  const renderRow = (transaction: ReturnType<typeof tx>) =>
    render(
      <MovementList>
        <MovementRow tx={transaction} />
      </MovementList>,
    );

  // Quebra se: o sentido da transferência se perder (quem enviou vê o valor positivo, ou o remetente aparece no lugar do destinatário).
  it('SENT mostra o destinatário e o valor negativo', () => {
    renderRow(tx());

    expect(screen.getByText('Rafael Costa')).toBeInTheDocument();
    expect(screen.getByText(`${MINUS}R$ 250,00`)).toBeInTheDocument();
    expect(screen.queryByText('Marina Alves')).toBeNull();
  });

  it('RECEIVED mostra o remetente e o valor positivo', () => {
    renderRow(tx({ direction: 'RECEIVED' }));

    expect(screen.getByText('Marina Alves')).toBeInTheDocument();
    expect(screen.getByText('+R$ 250,00')).toBeInTheDocument();
    expect(screen.queryByText('Rafael Costa')).toBeNull();
  });

  // Quebra se: o sinal voltar a ser o hífen de formatBRL (feio e ambíguo em coluna de números).
  it('usa o sinal de menos tipográfico (U+2212), não o hífen', () => {
    renderRow(tx());

    expect(screen.getByText(`${MINUS}R$ 250,00`)).toBeInTheDocument();
    expect(screen.queryByText('-R$ 250,00')).toBeNull();
  });

  // Quebra se: o horário UTC for mostrado sem passar para o fuso local (RF4): 02h30 UTC do dia 2 é 23h30 do dia 1º em São Paulo.
  it('mostra a data no fuso local, inclusive na virada de dia (RF4)', () => {
    renderRow(tx({ timestamp: '2026-11-02T02:30:00Z' }));

    const when = screen.getByText('01/11/2026 23:30');
    expect(when).toHaveAttribute('datetime', '2026-11-02T02:30:00Z');
  });

  // Quebra se: o leitor de tela ler três colunas soltas em vez de uma frase, ou o nome completo faltar no title.
  it('tem uma frase para leitor de tela e o nome completo no title', () => {
    renderRow(tx());

    expect(screen.getByText('Enviado para Rafael Costa em 01/11/2026 12:58, R$ 250,00')).toHaveClass('sr-only');
    expect(screen.getByText('Rafael Costa')).toHaveAttribute('title', 'Rafael Costa');
    expect(screen.getByText('01/11/2026 12:58').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true');
  });

  it('a frase do recebido diz de quem veio', () => {
    renderRow(tx({ direction: 'RECEIVED' }));

    expect(screen.getByText('Recebido de Marina Alves em 01/11/2026 12:58, R$ 250,00')).toBeInTheDocument();
  });

  // Quebra se: o valor passar por número (1234567.89 perderia precisão) ou for arredondado.
  it('o valor vem da string da API, sem arredondar', () => {
    renderRow(tx({ amount: '1234567.89' }));

    expect(screen.getByText(`${MINUS}R$ 1.234.567,89`)).toBeInTheDocument();
  });
});

describe('extrato', () => {
  // Quebra se: a aba mandar a direção errada ao back-end (a lista não corresponderia ao que a aba promete).
  it('cada aba chama a API com a direction certa', async () => {
    const queries = mockStatement(() => HttpResponse.json(page([tx()], 1)));
    await openStatement();
    const user = userEvent.setup();

    await screen.findByText('Rafael Costa');
    expect(queries.at(-1)?.toString()).toBe('direction=all&page=0&size=20');

    await user.click(screen.getByRole('tab', { name: 'Enviadas' }));
    await waitFor(() => expect(queries.at(-1)?.get('direction')).toBe('sent'));

    await user.click(screen.getByRole('tab', { name: 'Recebidas' }));
    await waitFor(() => expect(queries.at(-1)?.get('direction')).toBe('received'));

    await user.click(screen.getByRole('tab', { name: 'Tudo' }));
    await waitFor(() => expect(queries.at(-1)?.get('direction')).toBe('all'));
  });

  // Quebra se: as abas não forem abas de verdade (papéis, seleção e painel ligados ao leitor de tela).
  it('as abas seguem o padrão ARIA: uma selecionada, painel ligado a ela, setas trocam de aba', async () => {
    const queries = mockStatement(() => HttpResponse.json(page([tx()], 1)));
    await openStatement();
    const user = userEvent.setup();
    await screen.findByText('Rafael Costa');

    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Tudo', 'Enviadas', 'Recebidas']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Tudo');

    tabs[0]?.focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() => expect(queries.at(-1)?.get('direction')).toBe('sent'));
    expect(screen.getByRole('tab', { name: 'Enviadas' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Enviadas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Enviadas');

    await user.keyboard('{ArrowLeft}{ArrowLeft}'); // de Enviadas volta a Tudo e dá a volta até Recebidas
    expect(screen.getByRole('tab', { name: 'Recebidas' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Tudo' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Recebidas' })).toHaveFocus();
  });

  // Quebra se: "Carregar mais" não trouxer a página seguinte, repetir a primeira, ou continuar aparecendo no fim.
  it('"Carregar mais" traz a página 1 e some quando acabou', async () => {
    const queries = mockStatement((query) =>
      HttpResponse.json(query.get('page') === '0' ? page(many(20, 100), 25, 0) : page(many(5, 200), 25, 1)),
    );
    await openStatement();
    const user = userEvent.setup();

    expect(await screen.findByText('25 movimentações')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(20);

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(25));
    expect(queries.map((query) => query.get('page'))).toEqual(['0', '1']);
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('sem mais páginas, não oferece "Carregar mais"', async () => {
    mockStatement(() => HttpResponse.json(page(many(3), 3)));
    await openStatement();

    expect(await screen.findByText('3 movimentações')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  // Quebra se: o fim da lista for calculado com "<=" em vez de "<": com 20 movimentações e página de 20,
  // o botão pediria uma página 1 que não existe.
  it('com o total exatamente igual ao tamanho da página, não oferece "Carregar mais"', async () => {
    const queries = mockStatement(() => HttpResponse.json(page(many(20), 20)));
    await openStatement();

    expect(await screen.findByText('20 movimentações')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
    expect(queries).toHaveLength(1);
  });

  it('o contador fica no singular quando há uma só', async () => {
    mockStatement(() => HttpResponse.json(page([tx()], 1)));
    await openStatement();

    expect(await screen.findByText('1 movimentação')).toBeInTheDocument();
  });

  // Quebra se: um erro ao carregar a página seguinte apagar o que já estava na tela, ou não deixar tentar de novo.
  it('se "Carregar mais" falha, mantém as linhas, mostra o motivo e deixa tentar de novo', async () => {
    let failNext = true;
    mockStatement((query) => {
      if (query.get('page') === '0') return HttpResponse.json(page(many(20, 100), 25, 0));
      if (failNext) return errorResponse(500, 'INTERNAL_ERROR');
      return HttpResponse.json(page(many(5, 200), 25, 1));
    });
    await openStatement();
    const user = userEvent.setup();
    await screen.findByText('25 movimentações');

    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado do nosso lado. Tente de novo.');
    expect(screen.getAllByRole('listitem')).toHaveLength(20);

    failNext = false;
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(25));
  });

  it('vazio: diz que não há movimentações e não mostra contador nem "Carregar mais"', async () => {
    mockStatement(() => HttpResponse.json(page([], 0)));
    await openStatement();

    expect(await screen.findByText('Nenhuma movimentação por aqui.')).toBeInTheDocument();
    expect(screen.queryByText(/movimentaç(ão|ões)$/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  // Quebra se: erro de rede e erro de servidor passarem a dizer a mesma coisa (a spec exige estados distintos),
  // ou o erro não deixar tentar de novo.
  it('erro: mostra o motivo, diferencia rede de servidor e deixa tentar de novo', async () => {
    let mode: 'network' | 'server' | 'ok' = 'network';
    mockStatement(() => {
      if (mode === 'network') return HttpResponse.error();
      if (mode === 'server') return errorResponse(500, 'INTERNAL_ERROR');
      return HttpResponse.json(page([tx()], 1));
    });
    await openStatement();
    const user = userEvent.setup();

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');

    mode = 'server';
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado do nosso lado. Tente de novo.'));

    mode = 'ok';
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Rafael Costa')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // Quebra se: carregar mostrar um spinner, ou não avisar o leitor de tela de que está carregando.
  it('carregando: linhas esqueléticas com aria-busy, sem spinner', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockStatement(async () => {
      await gate;
      return HttpResponse.json(page([tx()], 1));
    });
    renderApp('/extrato', { user: marina });
    await screen.findByRole('heading', { name: 'Extrato' });

    expect(screen.getByText('Carregando movimentações…')).toBeInTheDocument();
    expect(screen.getByText('Carregando movimentações…').closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('progressbar')).toBeNull();

    release();
    expect(await screen.findByText('Rafael Costa')).toBeInTheDocument();
    expect(screen.queryByText('Carregando movimentações…')).toBeNull();
  });

  // Quebra se: a carteira (5 itens) e o extrato (20) dividirem o cache. O extrato abriria, por um instante, com as 5
  // linhas da carteira (e a paginação, calculada sobre elas, pularia as de 6 a 20).
  it('carteira (5) e extrato (20) não dividem cache: o tamanho faz parte da chave', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queries = mockStatement(async (query) => {
      if (query.get('size') === '5') return HttpResponse.json(page(many(5, 100), 25, 0, 5));
      await gate; // o extrato só responde quando o teste deixar
      return HttpResponse.json(page(many(20, 300), 25, 0, 20));
    });
    const { router } = renderApp('/carteira', { user: marina });
    await screen.findByText('Saldo');
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(5));
    const user = userEvent.setup();

    await user.click(screen.getByRole('link', { name: 'Ver extrato' }));

    await waitFor(() => expect(currentUrl(router)).toBe('/extrato'));
    expect(await screen.findByText('Carregando movimentações…')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0); // nada das 5 da carteira

    release();
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(20));
    expect(queries.map((query) => query.get('size'))).toEqual(['5', '20']);
  });
});
