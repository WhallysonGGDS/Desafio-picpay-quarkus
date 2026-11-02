import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Servidor de mentira da API para os testes de componente. Pedido sem rota falha o teste (ver setup.ts), em vez de
// seguir para a rede de verdade; cada teste registra as suas rotas com server.use(...), que prevalecem.
//
// Único padrão: o extrato vazio. Toda tela que mostra a carteira o consulta, e os testes que só querem passar por
// ela (de rotas, de login) não precisam saber disso. Quem testa o extrato registra o seu próprio.
export const server = setupServer(
  http.get('*/transaction', () => HttpResponse.json({ items: [], page: 0, size: 20, total: 0 })),
);
