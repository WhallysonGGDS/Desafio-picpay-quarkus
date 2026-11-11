import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { errorResponse } from '../../test/api';
import { marina } from '../../test/fixtures';
import { currentUrl, renderApp } from '../../test/render';
import { server } from '../../test/server';

type User = ReturnType<typeof userEvent.setup>;

async function openLogin(route = '/entrar') {
  const view = renderApp(route);
  await screen.findByRole('heading', { name: 'Entrar na carteira' });
  return view;
}

async function openRegister(route = '/criar-conta') {
  const view = renderApp(route);
  await screen.findByRole('heading', { name: 'Criar minha carteira' });
  return view;
}

async function fillLogin(user: User, email = 'marina@arco.demo', password = 'demo1234') {
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
}

async function fillRegister(
  user: User,
  values: { firstName?: string; lastName?: string; email?: string; document?: string; password?: string } = {},
) {
  const { firstName = 'Marina', lastName = 'Alves', email = 'marina@arco.demo', document = '52998224725', password = 'demo1234' } = values;
  await user.type(screen.getByLabelText('Nome'), firstName);
  await user.type(screen.getByLabelText('Sobrenome'), lastName);
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText(/^(CPF|CNPJ)$/), document);
  await user.type(screen.getByLabelText('Senha'), password);
}

const submitLogin = (user: User) => user.click(screen.getByRole('button', { name: 'Entrar na carteira' }));
const submitRegister = (user: User) => user.click(screen.getByRole('button', { name: 'Criar minha carteira' }));

describe('login', () => {
  // Quebra se: o destino pedido se perder, ou o corpo do login sair diferente do contrato.
  it('ok vai para o next seguro e envia e-mail (aparado) e senha', async () => {
    let sent: unknown;
    server.use(
      http.post('*/auth/login', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(marina);
      }),
    );
    const { router } = await openLogin('/entrar?next=%2Ftransferir');
    const user = userEvent.setup();

    await fillLogin(user, '  marina@arco.demo  '); // colado com espaços nas pontas
    await submitLogin(user);

    await waitFor(() => expect(currentUrl(router)).toBe('/transferir'));
    expect(sent).toEqual({ email: 'marina@arco.demo', password: 'demo1234' });
  });

  // Quebra se: o login seguir um next externo (RF3): a pessoa autentica e cai no site de outra pessoa.
  it('ignora um next externo e vai para a carteira', async () => {
    server.use(http.post('*/auth/login', () => HttpResponse.json(marina)));
    const { router } = await openLogin('/entrar?next=https%3A%2F%2Fevil.com');
    const user = userEvent.setup();

    await fillLogin(user);
    await submitLogin(user);

    await waitFor(() => expect(currentUrl(router)).toBe('/carteira'));
  });

  // Quebra se: o erro não for anunciado, a pessoa perder o e-mail que digitou, ou a senha errada ficar no campo.
  it('com senha errada mostra o alerta, mantém o e-mail, limpa a senha e foca nela', async () => {
    server.use(http.post('*/auth/login', () => errorResponse(401, 'INVALID_CREDENTIALS')));
    const { router } = await openLogin();
    const user = userEvent.setup();

    await fillLogin(user, 'marina@arco.demo', 'errada123');
    await submitLogin(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(screen.getByLabelText('E-mail')).toHaveValue('marina@arco.demo');
    expect(screen.getByLabelText('Senha')).toHaveValue('');
    expect(screen.getByLabelText('Senha')).toHaveFocus();
    expect(currentUrl(router)).toBe('/entrar');
  });

  // Quebra se: um duplo clique enviar o login duas vezes.
  it('duplo clique envia uma vez só', async () => {
    let calls = 0;
    server.use(
      http.post('*/auth/login', async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(marina);
      }),
    );
    await openLogin();
    const user = userEvent.setup();
    await fillLogin(user);

    await user.dblClick(screen.getByRole('button', { name: 'Entrar na carteira' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Entrar na carteira' })).toBeNull());
    expect(calls).toBe(1);
  });

  // Quebra se: a guarda contra envio duplo sumir. O botão desabilitado não segura um Enter repetido nem um submit
  // que não vem do botão; só a guarda síncrona do formulário segura.
  it('dois submits seguidos no formulário enviam uma vez só', async () => {
    let calls = 0;
    server.use(
      http.post('*/auth/login', async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(marina);
      }),
    );
    await openLogin();
    const user = userEvent.setup();
    await fillLogin(user);
    const form = screen.getByRole('button', { name: 'Entrar na carteira' }).closest('form') as HTMLFormElement;

    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Entrar na carteira' })).toBeNull());
    expect(calls).toBe(1);
  });

  // Quebra se: o formulário vazio for ao servidor, ou o erro não aparecer junto de cada campo.
  it('campos vazios não chamam o servidor, avisam em cada campo e focam o primeiro', async () => {
    let calls = 0;
    server.use(
      http.post('*/auth/login', () => {
        calls += 1;
        return HttpResponse.json(marina);
      }),
    );
    await openLogin();
    const user = userEvent.setup();

    await submitLogin(user);

    expect(await screen.findAllByText('Preencha este campo.')).toHaveLength(2);
    expect(screen.getByLabelText('E-mail')).toHaveFocus();
    expect(screen.getByLabelText('E-mail')).toBeInvalid();
    expect(calls).toBe(0);
  });

  it('mostra o motivo da falha de rede e mantém o que foi digitado', async () => {
    server.use(http.post('*/auth/login', () => HttpResponse.error()));
    await openLogin();
    const user = userEvent.setup();

    await fillLogin(user);
    await submitLogin(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');
    expect(screen.getByLabelText('E-mail')).toHaveValue('marina@arco.demo');
    expect(screen.getByLabelText('Senha')).toHaveValue('demo1234');
    expect(screen.getByRole('button', { name: 'Entrar na carteira' })).toBeEnabled();
  });

  // Quebra se: o botão não disser o que acontece, ou não avisar que está ocupado enquanto espera.
  it('o botão diz "Entrando…" e fica desabilitado enquanto espera', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('*/auth/login', async () => {
        await gate;
        return HttpResponse.json(marina);
      }),
    );
    await openLogin();
    const user = userEvent.setup();
    await fillLogin(user);

    await submitLogin(user);

    const busy = await screen.findByRole('button', { name: 'Entrando…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    release();
  });

  it('o link Criar minha carteira leva ao cadastro e leva o next junto', async () => {
    const { router } = await openLogin('/entrar?next=%2Ftransferir');
    const user = userEvent.setup();

    await user.click(screen.getByRole('link', { name: 'Criar minha carteira' }));

    await screen.findByRole('heading', { name: 'Criar minha carteira' });
    expect(currentUrl(router)).toBe('/criar-conta?next=%2Ftransferir');
  });
});

describe('cadastro', () => {
  // Quebra se: o rótulo ou a máscara ficarem presos no tipo anterior (pedir CPF a uma loja, pontuar CNPJ como CPF).
  it('o rótulo e a máscara do documento seguem o tipo', async () => {
    await openRegister();
    const user = userEvent.setup();

    const cpf = screen.getByLabelText('CPF');
    expect(cpf).toHaveAttribute('placeholder', '000.000.000-00');
    await user.type(cpf, '52998224725');
    expect(cpf).toHaveValue('529.982.247-25');

    await user.click(screen.getByRole('radio', { name: 'Loja' }));

    expect(screen.queryByLabelText('CPF')).toBeNull();
    const cnpj = screen.getByLabelText('CNPJ');
    expect(cnpj).toHaveAttribute('placeholder', '00.000.000/0000-00');
    expect(cnpj).toHaveValue('52.998.224/725'); // os mesmos 11 dígitos, agora com a máscara de CNPJ
    await user.clear(cnpj);
    await user.type(cnpj, '11222333000181');
    expect(cnpj).toHaveValue('11.222.333/0001-81');
  });

  // Quebra se: o campo do CNPJ voltar a recusar letras (a loja com CNPJ alfanumérico, que a Receita emite desde julho de 2026, não
  // conseguiria se cadastrar), a máscara deixar as letras em minúsculas, ou o teclado do celular continuar só numérico (sem como digitar
  // uma letra). O CPF segue com o teclado numérico.
  it('o CNPJ aceita letras (em maiúsculas) e o teclado da loja deixa de ser numérico', async () => {
    await openRegister();
    const user = userEvent.setup();

    expect(screen.getByLabelText('CPF')).toHaveAttribute('inputmode', 'numeric');
    await user.click(screen.getByRole('radio', { name: 'Loja' }));
    const cnpj = screen.getByLabelText('CNPJ');
    expect(cnpj).toHaveAttribute('inputmode', 'text');
    expect(cnpj).toHaveAttribute('autocapitalize', 'characters');
    expect(cnpj).toHaveAttribute('spellcheck', 'false');

    await user.type(cnpj, '12abc34501de35');
    expect(cnpj).toHaveValue('12.ABC.345/01DE-35');
  });

  // Quebra se: trocar de Loja para Pessoa deixar as letras do CNPJ no campo do CPF (que nunca as aceita).
  it('de Loja para Pessoa, as letras do documento saem', async () => {
    await openRegister();
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'Loja' }));
    await user.type(screen.getByLabelText('CNPJ'), '12abc34501de35');
    await user.click(screen.getByRole('radio', { name: 'Pessoa' }));

    expect(screen.getByLabelText('CPF')).toHaveValue('123.450.135');
    expect(screen.getByLabelText('CPF')).toHaveAttribute('inputmode', 'numeric');
  });

  it('começa como Pessoa e oferece Pessoa e Loja num grupo "Eu sou"', async () => {
    await openRegister();

    const group = screen.getByRole('group', { name: 'Eu sou' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Pessoa' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Loja' })).not.toBeChecked();
  });

  // Quebra se: um CPF inválido for ao servidor, ou o aviso não aparecer junto do campo e levar o foco até ele.
  it('CPF inválido bloqueia o envio sem chamar o servidor', async () => {
    let calls = 0;
    server.use(
      http.post('*/auth/register', () => {
        calls += 1;
        return HttpResponse.json(marina, { status: 201 });
      }),
    );
    await openRegister();
    const user = userEvent.setup();

    await fillRegister(user, { document: '52998224724' });
    await submitRegister(user);

    expect(await screen.findByText('Documento inválido.')).toBeInTheDocument();
    expect(screen.getByLabelText('CPF')).toHaveFocus();
    expect(screen.getByLabelText('CPF')).toBeInvalid();
    expect(calls).toBe(0);
  });

  it('vários campos inválidos: avisa em cada um e foca o primeiro, na ordem da tela', async () => {
    let calls = 0;
    server.use(
      http.post('*/auth/register', () => {
        calls += 1;
        return HttpResponse.json(marina, { status: 201 });
      }),
    );
    await openRegister();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Sobrenome'), 'Alves');
    await user.type(screen.getByLabelText('E-mail'), 'sem-arroba');
    await user.type(screen.getByLabelText('Senha'), 'curta');
    await submitRegister(user);

    expect(await screen.findByText('E-mail inválido.')).toBeInTheDocument();
    expect(screen.getByText('A senha precisa ter pelo menos 8 caracteres e no máximo 72 bytes (acentos e emojis ocupam mais de um).')).toBeInTheDocument();
    expect(screen.getAllByText('Preencha este campo.')).toHaveLength(2); // nome e documento
    expect(screen.getByLabelText('Nome')).toHaveFocus();
    expect(calls).toBe(0);
  });

  // Quebra se: a dica e o erro da senha aparecerem juntos dizendo a mesma coisa duas vezes.
  it('a dica da senha dá lugar ao erro quando ele aparece', async () => {
    await openRegister();
    const user = userEvent.setup();
    expect(screen.getByText('Pelo menos 8 caracteres.')).toBeInTheDocument();

    await fillRegister(user, { password: 'curta' });
    await submitRegister(user);

    expect(await screen.findByText('A senha precisa ter pelo menos 8 caracteres e no máximo 72 bytes (acentos e emojis ocupam mais de um).')).toBeInTheDocument();
    expect(screen.queryByText('Pelo menos 8 caracteres.')).toBeNull();
  });

  // Quebra se: o documento for com a máscara (o back-end só normaliza, mas o contrato é dígitos), ou os textos sem aparar.
  it('envia o documento só com dígitos, os textos e o e-mail aparados e o tipo', async () => {
    let sent: unknown;
    server.use(
      http.post('*/auth/register', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(marina, { status: 201 });
      }),
    );
    await openRegister();
    const user = userEvent.setup();

    await fillRegister(user, { firstName: '  Marina ', lastName: ' Alves  ', email: '  marina@arco.demo  ' });
    await submitRegister(user);

    await waitFor(() => expect(sent).toBeDefined());
    expect(sent).toEqual({
      firstName: 'Marina',
      lastName: 'Alves',
      document: '52998224725',
      email: 'marina@arco.demo',
      password: 'demo1234',
      userType: 'COMMON',
    });
  });

  it('loja envia userType MERCHANT com o CNPJ só em dígitos', async () => {
    let sent: Record<string, unknown> = {};
    server.use(
      http.post('*/auth/register', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...marina, userType: 'MERCHANT' }, { status: 201 });
      }),
    );
    await openRegister();
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'Loja' }));
    await fillRegister(user, { firstName: 'Loja', lastName: 'Arco', document: '11222333000181' });
    await submitRegister(user);

    await waitFor(() => expect(sent['userType']).toBe('MERCHANT'));
    expect(sent['document']).toBe('11222333000181');
  });

  // Quebra se: a loja com CNPJ alfanumérico for ao servidor com a máscara ou em minúsculas (o servidor compara o texto exato), ou o cadastro
  // dela for recusado na tela.
  it('loja com CNPJ alfanumérico envia o documento em maiúsculas e sem pontuação', async () => {
    let sent: Record<string, unknown> = {};
    server.use(
      http.post('*/auth/register', async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...marina, userType: 'MERCHANT' }, { status: 201 });
      }),
    );
    await openRegister();
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'Loja' }));
    await fillRegister(user, { firstName: 'Loja', lastName: 'Arco', document: '12.abc.345/01de-35' });
    await submitRegister(user);

    await waitFor(() => expect(sent['userType']).toBe('MERCHANT'));
    expect(sent['document']).toBe('12ABC34501DE35');
  });

  // Quebra se: um CNPJ alfanumérico com o dígito verificador errado for ao servidor.
  it('CNPJ alfanumérico com dígito errado bloqueia o envio sem chamar o servidor', async () => {
    let calls = 0;
    server.use(
      http.post('*/auth/register', () => {
        calls += 1;
        return HttpResponse.json(marina, { status: 201 });
      }),
    );
    await openRegister();
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: 'Loja' }));
    await fillRegister(user, { document: '12abc34501de36' });
    await submitRegister(user);

    expect(await screen.findByText('Documento inválido.')).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveFocus();
    expect(calls).toBe(0);
  });

  // Quebra se: o 409 aparecer só como alerta genérico, longe do campo que a pessoa precisa trocar.
  it('mapeia 409 DUPLICATE_EMAIL para o campo e-mail e foca nele', async () => {
    server.use(http.post('*/auth/register', () => errorResponse(409, 'DUPLICATE_EMAIL')));
    const { router } = await openRegister();
    const user = userEvent.setup();

    await fillRegister(user);
    await submitRegister(user);

    expect(await screen.findByText('Já existe uma carteira com esse e-mail.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription('Já existe uma carteira com esse e-mail.');
    expect(screen.getByLabelText('E-mail')).toHaveFocus();
    expect(currentUrl(router)).toBe('/criar-conta');
  });

  it('mapeia 409 DUPLICATE_DOCUMENT para o campo do documento', async () => {
    server.use(http.post('*/auth/register', () => errorResponse(409, 'DUPLICATE_DOCUMENT')));
    await openRegister();
    const user = userEvent.setup();

    await fillRegister(user);
    await submitRegister(user);

    expect(await screen.findByText('Já existe uma carteira com esse documento.')).toBeInTheDocument();
    expect(screen.getByLabelText('CPF')).toHaveFocus();
  });

  // Quebra se: os erros por campo do servidor (a validação dele é a autoridade) deixarem de chegar ao campo certo.
  it('fieldErrors de um 400 do servidor aparecem sob o campo certo', async () => {
    server.use(
      http.post('*/auth/register', () =>
        errorResponse(400, 'VALIDATION_ERROR', [
          { field: 'password', code: 'PASSWORD_LENGTH' },
          { field: 'firstName', code: 'TOO_LONG' },
        ]),
      ),
    );
    await openRegister();
    const user = userEvent.setup();

    await fillRegister(user);
    await submitRegister(user);

    expect(await screen.findByText('Texto longo demais.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription(/A senha precisa ter pelo menos 8 caracteres e no máximo 72 bytes/);
    expect(screen.getByLabelText('Nome')).toHaveFocus(); // o primeiro, na ordem da tela
  });

  it('um erro que não é de campo (500) aparece como alerta geral', async () => {
    server.use(http.post('*/auth/register', () => errorResponse(500, 'INTERNAL_ERROR')));
    await openRegister();
    const user = userEvent.setup();

    await fillRegister(user);
    await submitRegister(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado do nosso lado. Tente de novo.');
    expect(screen.getByLabelText('Nome')).toHaveValue('Marina');
  });

  it('ok vai para /carteira', async () => {
    server.use(http.post('*/auth/register', () => HttpResponse.json(marina, { status: 201 })));
    const { router } = await openRegister();
    const user = userEvent.setup();

    await fillRegister(user);
    await submitRegister(user);

    await waitFor(() => expect(currentUrl(router)).toBe('/carteira'));
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
  });

  // Quebra se: criar a conta no meio de um fluxo (login → cadastro) perder o destino que a pessoa tentou abrir.
  it('o next atravessa login → cadastro e leva ao destino pedido', async () => {
    server.use(http.post('*/auth/register', () => HttpResponse.json(marina, { status: 201 })));
    const { router } = await openLogin('/entrar?next=%2Ftransferir');
    const user = userEvent.setup();

    await user.click(screen.getByRole('link', { name: 'Criar minha carteira' }));
    await screen.findByRole('heading', { name: 'Criar minha carteira' });
    await fillRegister(user);
    await submitRegister(user);

    await waitFor(() => expect(currentUrl(router)).toBe('/transferir'));
  });

  it('a dica do saldo de demonstração e o link para quem já tem conta aparecem', async () => {
    await openRegister('/criar-conta?next=%2Ftransferir');

    expect(screen.getByText('Você começa com um saldo de demonstração.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/entrar?next=%2Ftransferir');
  });

  it('dois submits seguidos no formulário enviam uma vez só', async () => {
    let calls = 0;
    server.use(
      http.post('*/auth/register', async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(marina, { status: 201 });
      }),
    );
    await openRegister();
    const user = userEvent.setup();
    await fillRegister(user);
    const form = screen.getByRole('button', { name: 'Criar minha carteira' }).closest('form') as HTMLFormElement;

    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Criar minha carteira' })).toBeNull());
    expect(calls).toBe(1);
  });

  it('duplo clique envia uma vez só', async () => {
    let calls = 0;
    server.use(
      http.post('*/auth/register', async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(marina, { status: 201 });
      }),
    );
    await openRegister();
    const user = userEvent.setup();
    await fillRegister(user);

    await user.dblClick(screen.getByRole('button', { name: 'Criar minha carteira' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Criar minha carteira' })).toBeNull());
    expect(calls).toBe(1);
  });
});
