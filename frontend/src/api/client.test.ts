import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { page, marina, rafael, summary, tx } from '../test/fixtures';
import { errorResponse as backendError } from '../test/api';
import { server } from '../test/server';
import { ApiError } from './ApiError';
import { createApi } from './client';
import type { RegisterBody } from './types';

// baseUrl padrão = a origem da página (no jsdom, http://localhost:3000): o app e a API são a mesma origem.
const api = createApi();

const registration: RegisterBody = {
  firstName: 'Marina',
  lastName: 'Alves',
  document: '52998224725',
  email: 'marina@arco.demo',
  password: 'demo1234',
  userType: 'COMMON',
};

describe('me()', () => {
  it('devolve o usuário no 200, com o dinheiro ainda como string', async () => {
    server.use(http.get('*/users/me', () => HttpResponse.json(marina)));

    const user = await api.me();

    expect(user).toEqual(marina);
    // Conferido pelo tsc: se o campo voltar a ser opcional no contrato, esta linha deixa de compilar.
    const balance: string = (user as NonNullable<typeof user>).balance;
    expect(balance).toBe('1000.00');
    expect(typeof balance).toBe('string');
  });

  // Quebra se: sessão ausente passar a ser erro (a guarda de rota receberia uma exceção em vez de "deslogado").
  it('devolve null no 401: estar deslogado é um estado normal, não uma falha', async () => {
    server.use(http.get('*/users/me', () => backendError(401, 'UNAUTHENTICATED')));

    await expect(api.me()).resolves.toBeNull();
  });

  // Quebra se: qualquer erro virar "deslogado". Um 500 ou a rede fora do ar não podem derrubar a sessão em silêncio.
  it('lança nos demais erros em vez de devolver null', async () => {
    server.use(http.get('*/users/me', () => backendError(500, 'INTERNAL_ERROR')));
    await expect(api.me()).rejects.toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });

    server.use(http.get('*/users/me', () => HttpResponse.error()));
    await expect(api.me()).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('erros', () => {
  // Quebra se: o corpo de erro do back-end deixar de chegar inteiro (status, código estável e erros por campo).
  it('erro JSON do back-end vira ApiError com statusCode, code e fieldErrors', async () => {
    server.use(
      http.post('*/auth/register', () =>
        backendError(409, 'DUPLICATE_EMAIL', [{ field: 'email', code: 'DUPLICATE_EMAIL' }]),
      ),
      http.post('*/transaction', () => backendError(422, 'INSUFFICIENT_BALANCE')),
    );

    const duplicate = await api.register(registration).catch((error: unknown) => error);
    expect(duplicate).toBeInstanceOf(ApiError);
    expect(duplicate).toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_EMAIL',
      fieldErrors: [{ field: 'email', code: 'DUPLICATE_EMAIL' }],
    });

    await expect(api.transfer({ receiverId: 2, amount: '5000.00' })).rejects.toMatchObject({
      statusCode: 422,
      code: 'INSUFFICIENT_BALANCE',
      fieldErrors: [],
    });
  });

  // Quebra se: a rede caída for confundida com erro do servidor, ou deixar vazar o TypeError cru do fetch.
  it('falha de rede vira ApiError NETWORK com statusCode 0', async () => {
    server.use(http.get('*/users/search', () => HttpResponse.error()));

    await expect(api.searchUsers('abc')).rejects.toMatchObject({ code: 'NETWORK', statusCode: 0, isNetwork: true });
  });

  // Quebra se: resposta que não é do nosso back-end (um proxy devolvendo HTML) virar NETWORK ou estourar no JSON.parse.
  it('corpo que não é JSON (502 em HTML) vira HTTP_502', async () => {
    server.use(
      http.get('*/users/me', () => new HttpResponse('<html>Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })),
    );

    await expect(api.me()).rejects.toMatchObject({ statusCode: 502, code: 'HTTP_502', isNetwork: false, fieldErrors: [] });
  });

  // Quebra se: erro sem corpo nenhum (um 500 vazio) estourar ou virar outra coisa que não HTTP_<status>.
  it('erro sem corpo vira HTTP_<status>', async () => {
    server.use(http.get('*/users/me', () => new HttpResponse(null, { status: 500 })));

    await expect(api.me()).rejects.toMatchObject({ statusCode: 500, code: 'HTTP_500', fieldErrors: [] });
  });

  // Quebra se: um 2xx sem o corpo que o contrato promete for aceito como resultado (a tela receberia undefined onde
  // espera uma lista) ou vier com o status errado no erro.
  it('2xx sem o corpo prometido é defeito do servidor: lança UNKNOWN com o status real', async () => {
    server.use(http.get('*/users/search', () => new HttpResponse(null, { status: 200 })));

    await expect(api.searchUsers('abc')).rejects.toMatchObject({ statusCode: 200, code: 'UNKNOWN' });
  });

  // Quebra se: um código novo do back-end (que este front ainda não conhece) for repassado como se fosse conhecido.
  it('código que o front não conhece vira UNKNOWN, mantendo o status', async () => {
    server.use(http.get('*/users/me', () => backendError(400, 'CODIGO_NOVO')));

    await expect(api.me()).rejects.toMatchObject({ statusCode: 400, code: 'UNKNOWN' });
  });

  // Quebra se: o servidor (ou algo no caminho) conseguir se passar por falha de rede mandando code NETWORK.
  it('NETWORK e UNKNOWN vindos do servidor não valem: viram UNKNOWN', async () => {
    server.use(http.get('*/users/me', () => backendError(500, 'NETWORK')));

    await expect(api.me()).rejects.toMatchObject({ statusCode: 500, code: 'UNKNOWN', isNetwork: false });
  });

  it('JSON sem código (resposta de um intermediário) vira HTTP_<status>', async () => {
    server.use(http.get('*/users/me', () => HttpResponse.json({ error: 'x' }, { status: 503 })));

    await expect(api.me()).rejects.toMatchObject({ statusCode: 503, code: 'HTTP_503' });
  });

  // Quebra se: só me() tratar 401 como "deslogado" deixar de valer: no login, 401 é senha errada e precisa lançar.
  it('login com credenciais erradas lança INVALID_CREDENTIALS', async () => {
    server.use(http.post('*/auth/login', () => backendError(401, 'INVALID_CREDENTIALS')));

    await expect(api.login({ email: 'marina@arco.demo', password: 'errada' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });
});

describe('POST', () => {
  // Quebra se: algum POST sair sem Content-Type JSON. O back-end só aceita JSON (defesa contra CSRF) e responderia 415,
  // inclusive no logout, que não tem corpo.
  it('todo POST envia content-type application/json, inclusive o logout sem corpo', async () => {
    const seen: Record<string, string> = {};
    const remember = (name: string) => (request: Request) => {
      seen[name] = request.headers.get('content-type') ?? '(nenhum)';
    };
    server.use(
      http.post('*/auth/logout', ({ request }) => {
        remember('logout')(request);
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('*/auth/login', ({ request }) => {
        remember('login')(request);
        return HttpResponse.json(marina);
      }),
      http.post('*/auth/register', ({ request }) => {
        remember('register')(request);
        return HttpResponse.json(marina, { status: 201 });
      }),
      http.post('*/transaction', ({ request }) => {
        remember('transfer')(request);
        return HttpResponse.json(tx(), { status: 201 });
      }),
    );

    await api.logout();
    await api.login({ email: 'marina@arco.demo', password: 'demo1234' });
    await api.register(registration);
    await api.transfer({ receiverId: 2, amount: '250.00' });

    expect(Object.keys(seen).sort()).toEqual(['login', 'logout', 'register', 'transfer']);
    for (const [name, contentType] of Object.entries(seen)) {
      expect(contentType, name).toContain('application/json');
    }
  });

  // Quebra se: o dinheiro sair como número no corpo, ou o id do destinatário como string.
  it('transfer envia receiverId numérico e amount em string, e devolve a transação', async () => {
    let sent: unknown;
    server.use(
      http.post('*/transaction', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(tx(), { status: 201 });
      }),
    );

    const result = await api.transfer({ receiverId: 2, amount: '250.00' });

    expect(sent).toEqual({ receiverId: 2, amount: '250.00' });
    expect(result).toEqual(tx());
    expect(typeof result.amount).toBe('string');
  });

  it('register envia os dados e devolve o perfil', async () => {
    let sent: unknown;
    server.use(
      http.post('*/auth/register', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(marina, { status: 201 });
      }),
    );

    await expect(api.register(registration)).resolves.toEqual(marina);
    expect(sent).toEqual(registration);
  });

  it('logout resolve no 204, sem corpo', async () => {
    server.use(http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })));

    await expect(api.logout()).resolves.toBeUndefined();
  });
});

describe('consultas', () => {
  // Quebra se: o termo da busca não chegar inteiro (e-mail com "@" mal codificado) ou o resultado perder o formato.
  it('searchUsers manda q e devolve a lista', async () => {
    let asked: string | null = null;
    server.use(
      http.get('*/users/search', ({ request }) => {
        asked = new URL(request.url).searchParams.get('q');
        return HttpResponse.json([summary(rafael)]);
      }),
    );

    const found = await api.searchUsers('rafael@arco.demo');

    expect(asked).toBe('rafael@arco.demo');
    expect(found).toEqual([summary(rafael)]);
  });

  // Quebra se: direction, page ou size não chegarem ao back-end com esses nomes.
  it('statement monta a query direction=sent&page=0&size=20 e devolve a página', async () => {
    let query = '';
    server.use(
      http.get('*/transaction', ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(page([tx()], 1));
      }),
    );

    const result = await api.statement({ direction: 'sent', page: 0, size: 20 });

    expect(new URLSearchParams(query).toString()).toBe('direction=sent&page=0&size=20');
    expect(result).toEqual(page([tx()], 1));
  });
});

describe('createApi', () => {
  // Quebra se: a baseUrl informada for ignorada (o cliente fixaria a origem da página).
  it('usa a baseUrl informada', async () => {
    server.use(http.get('http://api.exemplo.test/users/me', () => HttpResponse.json(rafael)));

    await expect(createApi('http://api.exemplo.test').me()).resolves.toEqual(rafael);
  });
});
