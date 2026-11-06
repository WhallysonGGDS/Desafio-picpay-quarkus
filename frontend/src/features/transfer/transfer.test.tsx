import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '../../app/providers';
import { routes } from '../../app/router';
import { sessionKey } from '../../app/session';
import { errorResponse, mockSession } from '../../test/api';
import { loja, marina, page, rafael, summary, tx } from '../../test/fixtures';
import { currentUrl, renderApp, renderRoutes } from '../../test/render';
import { server } from '../../test/server';
import { statementKey } from '../statement/useStatement';

type Typist = ReturnType<typeof userEvent.setup>;

// Sem atraso entre as teclas: digitar um e-mail inteiro cabe folgado dentro dos 350 ms da busca.
const typist = () => userEvent.setup({ delay: null });

const SEARCH = 'E-mail ou CPF/CNPJ';
const AMOUNT = 'Valor em reais';
const SEND = 'Enviar R$ 250,00 para Rafael Costa';

/** As rotas da API que o fluxo usa, registrando o que chega: o que foi buscado e o que foi enviado. */
function api() {
  const searched: string[] = [];
  const sent: unknown[] = [];
  server.use(
    http.get('*/users/search', ({ request }) => {
      searched.push(new URL(request.url).searchParams.get('q') ?? '');
      return HttpResponse.json([summary(rafael)]);
    }),
    http.post('*/transaction', async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json(tx(), { status: 201 });
    }),
  );
  return { searched, sent };
}

async function pickRecipient(user: Typist, term = 'rafael@arco.demo') {
  await user.type(screen.getByLabelText(SEARCH), term);
  await user.click(await screen.findByRole('button', { name: /Rafael Costa/ }));
  await screen.findByRole('heading', { level: 1, name: 'Quanto?' });
}

async function enterAmount(user: Typist, text = '250,00') {
  await user.type(screen.getByLabelText(AMOUNT), text);
  await user.click(screen.getByRole('button', { name: 'Revisar envio' }));
  await screen.findByRole('heading', { level: 1, name: 'Confirmar.' });
}

/** Do começo ao botão de enviar: destinatário, valor, confirmação. */
async function reachConfirmation(user: Typist) {
  await pickRecipient(user);
  await enterAmount(user);
}

/**
 * Como renderApp, mas com o QueryClient do app de verdade (consultas repetem uma vez, mutações nunca) em vez do de
 * teste, que nunca repete nada e por isso não pega uma repetição que o app faria.
 */
function renderWithProductionClient(route: string) {
  mockSession(marina);
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

const arcState = () => document.querySelector('[data-arc-state]')?.getAttribute('data-arc-state');
const send = () => screen.getByRole('button', { name: SEND });

describe('lojista', () => {
  // Quebra se: um lojista vir o formulário (o back-end recusaria o envio depois de ele preencher tudo).
  it('vê o aviso no lugar do formulário', async () => {
    renderApp('/transferir', { user: loja });

    expect(await screen.findByRole('heading', { level: 1, name: 'Lojas recebem, não enviam.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver carteira' })).toHaveAttribute('href', '/carteira');
    expect(screen.queryByLabelText(SEARCH)).toBeNull();
  });
});

describe('1 / 3: para quem', () => {
  it('abre com a pergunta em foco e o campo de busca', async () => {
    api();
    renderApp('/transferir', { user: marina });

    const title = await screen.findByRole('heading', { level: 1, name: 'Para quem?' });

    expect(title).toHaveFocus();
    expect(screen.getByText('Passo 1 de 3')).toBeInTheDocument();
    expect(screen.getByLabelText(SEARCH)).toBeInTheDocument();
  });

  // Quebra se: a busca sair antes dos 350 ms de pausa (uma requisição por tecla) ou sair com menos de 3 caracteres.
  it('espera 3 caracteres e 350 ms e mostra o resultado, com o documento mascarado', async () => {
    const { searched } = api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);

    await user.type(screen.getByLabelText(SEARCH), 'ra');
    expect(screen.getByText('Digite ao menos 3 caracteres.')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(searched).toEqual([]);

    await user.type(screen.getByLabelText(SEARCH), 'fael@arco.demo');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(searched).toEqual([]); // 200 ms depois da última tecla, ainda dentro da pausa

    const row = await screen.findByRole('button', { name: /Rafael Costa/ });
    expect(within(row).getByText('***.444.777-**')).toBeInTheDocument();
    expect(within(row).getByText('Pessoa')).toBeInTheDocument();
    expect(searched).toEqual(['rafael@arco.demo']);
  });

  // Quebra se: espaços nas pontas forem para o servidor (o e-mail "  rafael@arco.demo " não acharia ninguém).
  it('apara os espaços do que foi digitado antes de buscar', async () => {
    const { searched } = api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);

    await user.type(screen.getByLabelText(SEARCH), '  rafael@arco.demo ');
    await screen.findByRole('button', { name: /Rafael Costa/ });

    expect(searched).toEqual(['rafael@arco.demo']);
  });

  it('mostra uma loja como Loja', async () => {
    api();
    server.use(http.get('*/users/search', () => HttpResponse.json([summary(loja)])));
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);

    await user.type(screen.getByLabelText(SEARCH), 'loja');
    const row = await screen.findByRole('button', { name: /Loja Arco/ });

    expect(within(row).getByText('Loja')).toBeInTheDocument();
    expect(within(row).getByText('**.222.333/****-**')).toBeInTheDocument();
  });

  it('sem resultado mostra a mensagem de vazio', async () => {
    api();
    server.use(http.get('*/users/search', () => HttpResponse.json([])));
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);

    await user.type(screen.getByLabelText(SEARCH), 'ninguem@arco.demo');

    expect(await screen.findByText('Ninguém encontrado com esse e-mail ou documento.')).toBeInTheDocument();
  });

  // Quebra se: a falha da busca sumir em silêncio (a lista ficaria vazia sem motivo), a busca se repetir sozinha (o app
  // de verdade repete consultas uma vez, depois de 1 s: a mensagem demoraria a aparecer) ou digitar de novo não tentar
  // outra vez.
  it('falha na busca mostra a mensagem sob o campo, sem repetir sozinha, e digitar de novo tenta outra vez', async () => {
    let failures = 0;
    api();
    server.use(
      http.get('*/users/search', () => {
        failures += 1;
        return errorResponse(500, 'INTERNAL_ERROR');
      }),
    );
    renderWithProductionClient('/transferir');
    const user = typist();
    await screen.findByLabelText(SEARCH);

    await user.type(screen.getByLabelText(SEARCH), 'rafael@arco.demo');
    expect(await screen.findByText('Algo deu errado do nosso lado. Tente de novo.')).toBeInTheDocument();
    expect(failures).toBe(1);
    expect(screen.queryByRole('button', { name: /Rafael Costa/ })).toBeNull();

    api(); // o servidor volta
    await user.type(screen.getByLabelText(SEARCH), 'x');

    expect(await screen.findByRole('button', { name: /Rafael Costa/ })).toBeInTheDocument();
    expect(screen.queryByText('Algo deu errado do nosso lado. Tente de novo.')).toBeNull();
  });

  // Quebra se: a lista não avisar que ainda busca (aria-busy), ou mostrar resultados de um termo que já não é o digitado.
  it('enquanto busca, a lista leva aria-busy e não mostra resultado antigo', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    api();
    server.use(
      http.get('*/users/search', async () => {
        await gate;
        return HttpResponse.json([summary(rafael)]);
      }),
    );
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);

    await user.type(screen.getByLabelText(SEARCH), 'rafael@arco.demo');

    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(screen.queryByRole('button', { name: /Rafael Costa/ })).toBeNull();

    release();
    expect(await screen.findByRole('button', { name: /Rafael Costa/ })).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('escolher a linha avança ao valor e leva o foco ao título', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);

    await pickRecipient(user);

    expect(screen.getByRole('heading', { level: 1, name: 'Quanto?' })).toHaveFocus();
    expect(screen.getByText('Passo 2 de 3')).toBeInTheDocument();
  });

  // Quebra se: quem voltou ao primeiro passo, com o destinatário já escolhido, não puder seguir com ele pelo teclado.
  it('Enter com um destinatário já escolhido e nada na busca segue com ele', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await pickRecipient(user);
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await screen.findByRole('heading', { level: 1, name: 'Para quem?' });

    await user.clear(screen.getByLabelText(SEARCH));
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { level: 1, name: 'Quanto?' })).toBeInTheDocument();
  });

  // Quebra se: o Enter do campo não escolher o único resultado (digitar o e-mail inteiro e Enter é o caminho rápido),
  // ou escolher quando há mais de um (a pessoa nem viu as opções).
  it('Enter com um único resultado escolhe esse destinatário; com vários, não escolhe', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    server.use(http.get('*/users/search', () => HttpResponse.json([summary(rafael), summary(loja)])));

    await user.type(screen.getByLabelText(SEARCH), 'arco');
    await screen.findByRole('button', { name: /Loja Arco/ });
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 1, name: 'Para quem?' })).toBeInTheDocument();

    server.use(http.get('*/users/search', () => HttpResponse.json([summary(rafael)])));
    await user.clear(screen.getByLabelText(SEARCH));
    await user.type(screen.getByLabelText(SEARCH), 'rafael@arco.demo');
    await screen.findByRole('button', { name: /Rafael Costa/ });
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { level: 1, name: 'Quanto?' })).toBeInTheDocument();
  });
});

describe('2 / 3: quanto', () => {
  it('mostra o disponível e, com valor válido, o saldo depois', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await pickRecipient(user);

    expect(screen.getByText(/^Disponível/)).toHaveTextContent('Disponível R$ 1.000,00');
    expect(screen.queryByText(/^Saldo depois/)).toBeNull();

    await user.type(screen.getByLabelText(AMOUNT), '250,00');

    expect(screen.getByText(/^Saldo depois/)).toHaveTextContent('Saldo depois R$ 750,00');
  });

  // RF1. Quebra se: o texto em formato brasileiro for lido errado (250,5 virar 250,05 ou 2505) ou for ao servidor com vírgula.
  it('valor digitado como "250,5" mostra "Saldo depois R$ 749,50" e envia amount "250.50" (RF1)', async () => {
    const { sent } = api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await pickRecipient(user);

    await user.type(screen.getByLabelText(AMOUNT), '250,5');
    expect(screen.getByText(/^Saldo depois/)).toHaveTextContent('Saldo depois R$ 749,50');
    await user.click(screen.getByRole('button', { name: 'Revisar envio' }));
    await user.click(await screen.findByRole('button', { name: /Enviar R\$ 250,50 para Rafael Costa/ }));

    await screen.findByRole('heading', { level: 1, name: 'Enviado.' });
    expect(sent).toEqual([{ receiverId: 2, amount: '250.50' }]);
  });

  // Quebra se: um valor acima do saldo passar do cliente (a pessoa só descobriria no fim, e o servidor receberia o pedido).
  it('valor acima do saldo é barrado no cliente: mensagem, botão desabilitado, Enter não avança, nada é enviado', async () => {
    const { sent } = api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await pickRecipient(user);

    await user.type(screen.getByLabelText(AMOUNT), '1.001,00');

    expect(screen.getByText('Saldo insuficiente para este valor.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar envio' })).toBeDisabled();
    expect(screen.queryByText(/^Saldo depois/)).toBeNull();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 1, name: 'Quanto?' })).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('o saldo inteiro é permitido: R$ 1.000,00 de R$ 1.000,00', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await pickRecipient(user);

    await user.type(screen.getByLabelText(AMOUNT), '1.000,00');

    expect(screen.getByText(/^Saldo depois/)).toHaveTextContent('Saldo depois R$ 0,00');
    expect(screen.getByRole('button', { name: 'Revisar envio' })).toBeEnabled();
  });

  // Quebra se: texto sem sentido (ou ambíguo) avançar, ou o erro de formato aparecer no meio da digitação ("1," é um
  // passo no caminho de "1,5", não um erro).
  it('formato inválido: sem mensagem enquanto digita; o Enter mostra o motivo e não avança; digitar limpa', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await pickRecipient(user);

    await user.type(screen.getByLabelText(AMOUNT), '1,');
    expect(screen.queryByText('Digite um valor válido, com até duas casas decimais.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Revisar envio' })).toBeDisabled();

    await user.keyboard('{Enter}');
    expect(screen.getByText('Digite um valor válido, com até duas casas decimais.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Quanto?' })).toBeInTheDocument();

    // a próxima digitação apaga a mensagem mesmo que o texto continue inválido ("1,x"): ela volta no próximo Enter
    await user.type(screen.getByLabelText(AMOUNT), 'x');
    expect(screen.queryByText('Digite um valor válido, com até duas casas decimais.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Revisar envio' })).toBeDisabled();

    await user.clear(screen.getByLabelText(AMOUNT));
    await user.type(screen.getByLabelText(AMOUNT), '15');
    expect(screen.getByRole('button', { name: 'Revisar envio' })).toBeEnabled();
  });

  // Quebra se: sair do campo com lixo digitado não explicar o porquê do botão desabilitado, ou reclamar de um campo
  // que a pessoa só tocou e deixou vazio (clicar em "Voltar" passa por aqui).
  it('sair do campo com valor inválido mostra o motivo; sair com o campo vazio não reclama', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await pickRecipient(user);

    await user.click(screen.getByLabelText(AMOUNT));
    await user.tab();
    expect(screen.queryByRole('alert')).toBeNull();

    await user.type(screen.getByLabelText(AMOUNT), 'abc');
    expect(screen.queryByText('Digite um valor válido, com até duas casas decimais.')).toBeNull();
    await user.tab();

    expect(screen.getByText('Digite um valor válido, com até duas casas decimais.')).toBeInTheDocument();
  });

  it('Enter com o campo vazio pede o valor', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await pickRecipient(user);

    await user.click(screen.getByLabelText(AMOUNT));
    await user.keyboard('{Enter}');

    expect(screen.getByText('Preencha este campo.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Quanto?' })).toBeInTheDocument();
  });

  it('Enter com valor válido avança à confirmação', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await pickRecipient(user);

    await user.type(screen.getByLabelText(AMOUNT), '250,00{Enter}');

    expect(await screen.findByRole('heading', { level: 1, name: 'Confirmar.' })).toHaveFocus();
  });
});

describe('3 / 3: confirmar', () => {
  // Quebra se: o botão deixar de dizer o ato (quanto e para quem) ou a confirmação esconder o saldo depois.
  it('o botão diz o ato e a confirmação mostra para quem, quanto e o saldo depois', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);

    await reachConfirmation(user);

    expect(send()).toBeEnabled();
    expect(send().querySelector('svg')).not.toBeNull(); // a ação principal leva a seta
    const row = (term: string) => screen.getByText(term).nextElementSibling;
    expect(row('Para')).toHaveTextContent('Rafael Costa');
    expect(row('Valor')).toHaveTextContent('R$ 250,00');
    expect(row('Saldo depois')).toHaveTextContent('R$ 750,00');
    expect(arcState()).toBe('idle');
    // as pontas do arco: você, e só o primeiro nome do destinatário (o nome inteiro está no resumo)
    expect(screen.getByText('Você')).toBeInTheDocument();
    expect(screen.getByText('Rafael')).toBeInTheDocument();
  });

  // Quebra se: voltar apagar o que a pessoa já preencheu, ou perder a busca e o destinatário escolhido.
  it('voltar mantém valor, termo buscado e destinatário escolhido', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Quanto?' })).toHaveFocus();
    expect(screen.getByLabelText(AMOUNT)).toHaveValue('250,00');

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Para quem?' })).toBeInTheDocument();
    expect(screen.getByLabelText(SEARCH)).toHaveValue('rafael@arco.demo');
    expect(await screen.findByRole('button', { name: /Rafael Costa/ })).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByRole('button', { name: 'Seguir com Rafael' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Quanto?' })).toBeInTheDocument();
  });

  // O deslizar só vale entre passos, e a direção acompanha a navegação. A animação em si o jsdom não roda.
  it('a direção da troca de passo acompanha a navegação', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    const direction = () => document.querySelector('[data-direction]')?.getAttribute('data-direction');
    expect(direction()).toBe('initial');

    await pickRecipient(user);
    expect(direction()).toBe('forward');

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    await screen.findByRole('heading', { level: 1, name: 'Para quem?' });
    expect(direction()).toBe('back');
  });

  // Quebra se: digitar no meio do passo reiniciar a animação de entrada (a direção mudaria sob o mesmo elemento).
  it('digitar no passo não muda a direção', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);

    await user.type(screen.getByLabelText(SEARCH), 'raf');

    expect(document.querySelector('[data-direction]')?.getAttribute('data-direction')).toBe('initial');
  });
});

describe('envio', () => {
  // RF1 + invalidação. Quebra se: o corpo sair com o valor em número, a transferência não atualizar o saldo da sessão,
  // ou o extrato guardado continuar valendo (a carteira mostraria o saldo e as movimentações de antes).
  it('caminho feliz: envia {receiverId, amount}, mostra "Enviado." e atualiza o saldo e o extrato', async () => {
    let balance = '1000.00';
    let sessionCalls = 0;
    const { sent } = api();
    server.use(
      http.get('*/users/me', () => {
        sessionCalls += 1;
        return HttpResponse.json({ ...marina, balance });
      }),
      http.post('*/transaction', async ({ request }) => {
        sent.push(await request.json());
        balance = '750.00';
        return HttpResponse.json(tx(), { status: 201 });
      }),
    );
    const { queryClient } = renderRoutes('/transferir');
    const user = typist();
    await screen.findByLabelText(SEARCH);
    queryClient.setQueryData(['statement', 'all', 5], { pages: [], pageParams: [] });
    await reachConfirmation(user);

    await user.click(send());

    expect(await screen.findByRole('heading', { level: 1, name: 'Enviado.' })).toHaveFocus();
    expect(screen.getByText(/para Rafael Costa\.$/)).toHaveTextContent('R$ 250,00 para Rafael Costa.');
    expect(sent).toEqual([{ receiverId: 2, amount: '250.00' }]);
    expect(screen.getByRole('link', { name: 'Ver extrato' })).toHaveAttribute('href', '/extrato');
    expect(screen.getByRole('button', { name: 'Nova transferência' })).toBeInTheDocument();
    expect(screen.queryByText(/Passo \d de 3/)).toBeNull();
    expect(arcState()).toBe('landed');

    await waitFor(() => expect(queryClient.getQueryData(sessionKey)).toMatchObject({ balance: '750.00' }));
    expect(sessionCalls).toBe(2);
    expect(queryClient.getQueryState(['statement', 'all', 5])?.isInvalidated).toBe(true);
  });

  // Quebra se: o arco não acompanhar o envio (autorizando enquanto a resposta não chega, pousou quando ela chega).
  it('o arco autoriza enquanto espera e pousa quando o servidor confirma', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    api();
    server.use(
      http.post('*/transaction', async () => {
        await gate;
        return HttpResponse.json(tx(), { status: 201 });
      }),
    );
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);

    await user.click(send());

    const busy = await screen.findByRole('button', { name: 'Autorizando…' });
    expect(busy).toBeDisabled();
    expect(busy.querySelector('svg')).toBeNull(); // a ação já está em curso: sem a seta que a oferece
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled();
    expect(arcState()).toBe('authorizing');

    release();
    await screen.findByRole('heading', { level: 1, name: 'Enviado.' });
    expect(arcState()).toBe('landed');
  });

  // RF2. Quebra se: um duplo clique mandar duas transferências.
  it('duplo clique envia uma vez só (RF2)', async () => {
    const { sent } = api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);

    await user.dblClick(send());
    await screen.findByRole('heading', { level: 1, name: 'Enviado.' });

    expect(sent).toHaveLength(1);
  });

  // RF2. O botão desabilitado já barra o segundo clique; o que sobra é o Enter (dois envios do formulário antes
  // de a tela redesenhar). Quebra se: a guarda síncrona do envio sair.
  it('dois envios no mesmo instante, antes de a tela redesenhar, enviam uma vez só (RF2)', async () => {
    const { sent } = api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);
    const form = send().closest('form')!;

    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await screen.findByRole('heading', { level: 1, name: 'Enviado.' });

    expect(sent).toHaveLength(1);
  });

  // Quebra se: a recusa do autorizador mexer no saldo, esconder o motivo ou não deixar tentar de novo.
  it('autorização recusada: mensagem, saldo intacto, arco recuado e "Tentar de novo" reenvia e conclui', async () => {
    let sessionCalls = 0;
    let attempts = 0;
    api();
    server.use(
      http.get('*/users/me', () => {
        sessionCalls += 1;
        return HttpResponse.json(marina);
      }),
      http.post('*/transaction', () => {
        attempts += 1;
        return attempts === 1 ? errorResponse(403, 'AUTHORIZATION_DENIED') : HttpResponse.json(tx(), { status: 201 });
      }),
    );
    const { queryClient } = renderRoutes('/transferir');
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);
    const sendButton = send();

    await user.click(sendButton);

    expect(
      await screen.findByText('O serviço de autorização recusou esta transferência. Seu saldo não mudou.'),
    ).toBeInTheDocument();
    expect(arcState()).toBe('retracted');
    expect(queryClient.getQueryData(sessionKey)).toMatchObject({ balance: '1000.00' });
    expect(sessionCalls).toBe(1);
    const retry = screen.getByRole('button', { name: 'Tentar de novo' });
    expect(retry).toHaveFocus();
    // É outro botão, não o de enviar com o texto trocado: num navegador de verdade o botão ocupado (desabilitado)
    // perde o foco, e só um botão novo, que já nasce com autoFocus, o devolve à pessoa. O jsdom não tira o foco de
    // um botão desabilitado, então só a identidade do nó prova que o mecanismo está lá.
    expect(retry).not.toBe(sendButton);
    expect(screen.queryByRole('button', { name: SEND })).toBeNull();

    await user.click(retry);

    expect(await screen.findByRole('heading', { level: 1, name: 'Enviado.' })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('autorizador fora do ar (503) segue o mesmo caminho', async () => {
    let attempts = 0;
    api();
    server.use(
      http.post('*/transaction', () => {
        attempts += 1;
        return attempts === 1 ? errorResponse(503, 'AUTHORIZER_UNAVAILABLE') : HttpResponse.json(tx(), { status: 201 });
      }),
    );
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);

    await user.click(send());

    expect(
      await screen.findByText('O serviço de autorização está fora do ar. Seu saldo não mudou. Tente de novo em instantes.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Enviado.' })).toBeInTheDocument();
  });

  // RF2. Quebra se: depois de "não deu para confirmar" houver botão de reenvio, ou algo reenviar sozinho (inclusive a
  // repetição automática do TanStack: aqui roda o cliente de verdade do app, não o de teste, que nunca repete). Se a
  // primeira tentativa tivesse chegado, o dinheiro sairia duas vezes. O primeiro intervalo de repetição é de 1 s.
  it('resultado desconhecido (a rede cai): sem botão de reenvio, link para o extrato, nada reenvia sozinho (RF2)', async () => {
    let attempts = 0;
    api();
    server.use(
      http.post('*/transaction', () => {
        attempts += 1;
        return HttpResponse.error();
      }),
    );
    renderWithProductionClient('/transferir');
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);

    await user.click(send());

    expect(await screen.findByRole('heading', { level: 1, name: 'Sem confirmação.' })).toHaveFocus();
    expect(
      screen.getByText('Não deu para confirmar se o envio aconteceu. Confira o extrato antes de tentar de novo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Não deu para confirmar');
    expect(screen.queryByRole('button', { name: /tentar de novo|enviar/i })).toBeNull();
    expect(screen.getByRole('link', { name: 'Conferir extrato' })).toHaveAttribute('href', '/extrato');
    expect(screen.getByRole('button', { name: 'Nova transferência' })).toBeInTheDocument();
    expect(arcState()).toBe('unconfirmed');
    expect(screen.getByRole('status')).toHaveTextContent('Sem confirmação');

    await new Promise((resolve) => setTimeout(resolve, 1300));

    expect(attempts).toBe(1);
  });

  it('500 também é resultado desconhecido', async () => {
    api();
    server.use(http.post('*/transaction', () => errorResponse(500, 'INTERNAL_ERROR')));
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);

    await user.click(send());

    expect(await screen.findByRole('heading', { level: 1, name: 'Sem confirmação.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tentar de novo|enviar/i })).toBeNull();
  });

  // RF2. Quebra se: depois de "não deu para confirmar" o saldo e o extrato ficarem como estavam. O envio PODE ter chegado, e
  // quem abrisse a carteira veria o saldo de antes (a consulta da sessão vale 30 s), concluiria que o dinheiro não saiu e
  // enviaria de novo.
  it('resultado desconhecido: o saldo e o extrato são buscados de novo, porque o envio pode ter chegado', async () => {
    let balance = '1000.00';
    let sessionCalls = 0;
    api();
    server.use(
      http.get('*/users/me', () => {
        sessionCalls += 1;
        return HttpResponse.json({ ...marina, balance });
      }),
      http.post('*/transaction', () => {
        balance = '750.00'; // o envio chegou ao servidor, mas a resposta se perdeu
        return HttpResponse.error();
      }),
    );
    const { queryClient } = renderRoutes('/transferir');
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);
    const guarded = [...statementKey, 'all', 5]; // o que a carteira guardou do extrato (a chave é a de useStatement)
    queryClient.setQueryData(guarded, page([tx()]));
    const before = sessionCalls;

    await user.click(send());
    await screen.findByRole('heading', { level: 1, name: 'Sem confirmação.' });

    await waitFor(() => expect(sessionCalls).toBeGreaterThan(before));
    await waitFor(() => expect(queryClient.getQueryData(sessionKey)).toMatchObject({ balance: '750.00' }));
    expect(queryClient.getQueryState(guarded)?.isInvalidated).toBe(true);
  });

  // Quebra se: "Nova transferência" não limpar tudo (o valor e o destinatário da anterior voltariam).
  it('"Nova transferência" começa do zero', async () => {
    api();
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);
    await user.click(send());
    await screen.findByRole('heading', { level: 1, name: 'Enviado.' });

    await user.click(screen.getByRole('button', { name: 'Nova transferência' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Para quem?' })).toHaveFocus();
    expect(screen.getByLabelText(SEARCH)).toHaveValue('');
    expect(arcState()).toBeUndefined();
  });
});

describe('recusas que a pessoa corrige', () => {
  // Quebra se: o saldo insuficiente do servidor não voltar ao passo do valor, ou a tela seguir com o saldo velho
  // (a pessoa insistiria num valor que não cabe).
  it('saldo insuficiente vindo do servidor volta ao passo do valor, com a mensagem e o saldo de verdade', async () => {
    let balance = '1000.00';
    api();
    server.use(
      http.get('*/users/me', () => HttpResponse.json({ ...marina, balance })),
      http.post('*/transaction', () => {
        balance = '100.00'; // o saldo mudou por outro caminho
        return errorResponse(422, 'INSUFFICIENT_BALANCE');
      }),
    );
    renderRoutes('/transferir');
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);

    await user.click(send());

    expect(await screen.findByRole('heading', { level: 1, name: 'Quanto?' })).toBeInTheDocument();
    expect(screen.getAllByText('Saldo insuficiente para este valor.')).toHaveLength(1);
    expect(screen.getByLabelText(AMOUNT)).toHaveValue('250,00');
    await waitFor(() => expect(screen.getByText(/^Disponível/)).toHaveTextContent('Disponível R$ 100,00'));
    expect(screen.getByRole('button', { name: 'Revisar envio' })).toBeDisabled();
  });

  // Quebra se: a recusa que SÓ o servidor conhece (aqui, validação) não aparecer no passo do valor, ou ficar presa
  // depois de a pessoa digitar de novo. O saldo insuficiente não prova isto: o cliente o deriva sozinho.
  it('recusa de validação do servidor volta ao passo do valor com a mensagem, e digitar a apaga', async () => {
    api();
    server.use(
      http.post('*/transaction', () => errorResponse(400, 'VALIDATION_ERROR', [{ field: 'amount', code: 'INVALID_AMOUNT' }])),
    );
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);

    await user.click(send());

    expect(await screen.findByRole('heading', { level: 1, name: 'Quanto?' })).toBeInTheDocument();
    expect(screen.getByText('Confira os dados informados.')).toBeInTheDocument();
    expect(screen.getByLabelText(AMOUNT)).toHaveValue('250,00');

    await user.type(screen.getByLabelText(AMOUNT), '1');
    expect(screen.queryByText('Confira os dados informados.')).toBeNull();
  });

  // Quebra se: destinatário inexistente continuar escolhido, ou o valor digitado se perder na volta.
  it('destinatário não encontrado (404) volta ao primeiro passo, sem destinatário, mantendo o valor', async () => {
    api();
    server.use(http.post('*/transaction', () => errorResponse(404, 'USER_NOT_FOUND')));
    renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);

    await user.click(send());

    expect(await screen.findByRole('heading', { level: 1, name: 'Para quem?' })).toBeInTheDocument();
    expect(screen.getByText('Não encontramos essa pessoa.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seguir com Rafael' })).toBeNull();

    // digitar de novo limpa a mensagem; escolher outra vez segue ao valor, que continua preenchido
    await user.type(screen.getByLabelText(SEARCH), '!');
    expect(screen.queryByText('Não encontramos essa pessoa.')).toBeNull();
    await user.clear(screen.getByLabelText(SEARCH));
    await user.type(screen.getByLabelText(SEARCH), 'rafael@arco.demo');
    await user.click(await screen.findByRole('button', { name: /Rafael Costa/ }));
    expect(await screen.findByLabelText(AMOUNT)).toHaveValue('250,00');
  });
});

describe('sessão (RF3)', () => {
  // Quebra se: um 401 no meio do envio deixar a pessoa numa tela que não funciona mais em vez de levá-la a entrar.
  it('401 no meio do envio leva a /entrar?next=%2Ftransferir (RF3)', async () => {
    api();
    server.use(http.post('*/transaction', () => errorResponse(401, 'UNAUTHENTICATED')));
    const { router, queryClient } = renderApp('/transferir', { user: marina });
    const user = typist();
    await screen.findByLabelText(SEARCH);
    await reachConfirmation(user);

    await user.click(send());

    await waitFor(() => expect(currentUrl(router)).toBe('/entrar?next=%2Ftransferir'));
    expect(queryClient.getQueryData(sessionKey)).toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar na carteira' })).toBeInTheDocument();
  });
});

// O jsdom não anima: o que a pessoa com movimento reduzido vê só se garante lendo o CSS-fonte. Caminho por node:path
// (o Vite reescreve `new URL(..., import.meta.url)` no jsdom).
describe('TransferPage.module.css (movimento)', () => {
  const css = () => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'TransferPage.module.css'), 'utf8');

  // Quebra se: o deslizar do passo continuar com movimento reduzido ligado.
  it('com movimento reduzido, a troca de passo não anima', () => {
    const reduced = css().split('@media (prefers-reduced-motion: reduce)')[1] ?? '';

    expect(reduced).toMatch(/\.stage[^{]*\{[^}]*animation:\s*none/);
  });

  // Quebra se: o deslizar mover outra coisa que transform e opacidade (layout a cada quadro).
  it('o deslizar só anima transform e opacidade', () => {
    const keyframes = [...css().matchAll(/@keyframes[^{]+\{((?:[^{}]|\{[^}]*\})*)\}/g)].map((match) => match[1] ?? '');

    expect(keyframes.length).toBeGreaterThan(0);
    for (const body of keyframes) {
      const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
      expect(properties.filter((name) => name !== 'opacity' && name !== 'transform')).toEqual([]);
    }
  });
});
