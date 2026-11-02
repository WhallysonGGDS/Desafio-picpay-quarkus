import { setupServer } from 'msw/node';

// Servidor de mentira da API para os testes de componente: começa sem nenhuma rota, e cada teste registra as suas
// com server.use(...). Pedido sem rota falha o teste (ver setup.ts), em vez de seguir para a rede de verdade.
export const server = setupServer();
