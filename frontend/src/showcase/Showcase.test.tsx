import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { marina } from '../test/fixtures';
import { renderApp } from '../test/render';
import { SCENE_PROGRESS_EVENT } from './motion';

// O motor liga o Lenis e o ScrollTrigger, que precisam de layout: o jsdom não tem. Aqui a vitrine é montada sem ele, e o
// "scroll" é feito à mão, escrevendo o progresso na cena e avisando-a, que é exatamente o que o motor faz. O motor tem teste
// próprio (useScrollScenes.test) e roda num navegador de verdade (e2e/showcase.spec).
const useScrollScenes = vi.hoisted(() => vi.fn());
vi.mock('./useScrollScenes', () => ({ useScrollScenes }));

afterEach(() => {
  vi.restoreAllMocks();
});

// O jsdom não faz layout: a caixa que a cena dá ao arco entra como dublê de getBoundingClientRect.
function measuredBox(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  );
}

const scene = (id: number) => document.querySelector(`[data-scene="${id}"]`) as HTMLElement;

/** O que o motor faz a cada passo do scroll: escreve o progresso da cena e a avisa. */
function scrollTo(id: number, progress: string) {
  act(() => {
    scene(id).dataset['progress'] = progress;
    scene(id).dispatchEvent(new Event(SCENE_PROGRESS_EVENT));
  });
}

const balanceCents = () => {
  const text = within(scene(3)).getByTestId('wallet-balance').textContent ?? '';
  return BigInt(text.replace(/\D/g, ''));
};

describe('as seis cenas', () => {
  // Quebra se: faltar uma cena, ou elas saírem de ordem (a história é uma sequência: impacto, contexto, proposta, detalhes,
  // clímax, conversão).
  it('existem em ordem, e a primeira tem o título da página', async () => {
    renderApp('/', { user: null });

    const title = await screen.findByRole('heading', { level: 1, name: 'Entre duas pessoas, um instante.' });
    // O texto corrido leva o espaço entre as linhas (rastreadores, cópia): no jsdom o `display: block` das linhas já separaria o
    // nome acessível, mas não o textContent.
    expect(title.textContent).toBe('Entre duas pessoas, um instante.');
    expect(within(scene(1)).getByText('Role')).toBeInTheDocument();
    const ids = Array.from(document.querySelectorAll('[data-scene]')).map((element) => element.getAttribute('data-scene'));
    expect(ids).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  // Quebra se: o motor deixar de ser ligado à vitrine (as cenas ficariam paradas em 0) ou for ligado a outro elemento que não
  // a raiz delas (o motor procura `[data-scene]` a partir dela).
  it('liga o motor à raiz das cenas', async () => {
    useScrollScenes.mockClear();
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    const root = useScrollScenes.mock.calls.at(-1)?.[0] as { current: Element | null };
    expect(root.current).toBe(scene(1).parentElement);
    expect(root.current?.tagName).toBe('MAIN');
  });

  // Quebra se: uma das cenas que o motor tem de prender (a 2 e a 3) perder o data-pinned, ou outra passar a ser presa.
  it('só as cenas 2 e 3 são fixadas', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    const pinned = Array.from(document.querySelectorAll('[data-scene]'))
      .filter((element) => element.hasAttribute('data-pinned'))
      .map((element) => element.getAttribute('data-scene'));
    expect(pinned).toEqual(['2', '3']);
  });

  // Quebra se: um título mudar de palavra sem querer: é o texto da spec.
  it('cada uma tem o seu título', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    expect(within(scene(2)).getByRole('heading', { level: 2, name: 'Cada transferência passa por quatro decisões.' })).toBeInTheDocument();
    expect(
      within(scene(3)).getByRole('heading', { level: 2, name: 'Débito, crédito e registro acontecem juntos, ou não acontecem.' }),
    ).toBeInTheDocument();
    expect(within(scene(5)).getByRole('heading', { level: 2, name: 'Enviado.' })).toBeInTheDocument();
    expect(within(scene(5)).getByText('De uma mão para outra.')).toBeInTheDocument();
    expect(within(scene(6)).getByRole('heading', { level: 2, name: 'Sua vez.' })).toBeInTheDocument();
  });

  // Quebra se: uma das quatro decisões perder o texto da spec, trocar de ordem ou sair da lista ordenada (é uma sequência).
  it('a cena 2 tem as quatro decisões, em lista ordenada, com o texto da spec', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    const items = within(within(scene(2)).getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    const expected = [
      ['Quem envia?', 'Pessoas enviam. Lojas recebem.'],
      ['Há saldo?', 'Sem saldo, nada acontece.'],
      ['Alguém autoriza?', 'Um serviço externo decide.'],
      ['Os dois sabem?', 'Quem envia e quem recebe são avisados.'],
    ];
    items.forEach((item, index) => {
      expect(within(item).getByRole('heading', { level: 3 })).toHaveTextContent(expected[index]![0]!);
      expect(item).toHaveTextContent(expected[index]![1]!);
    });
    // O título da cena é uma frase só, com o espaço entre as linhas no texto.
    expect(within(scene(2)).getByRole('heading', { level: 2 }).textContent).toBe('Cada transferência passa por quatro decisões.');
  });

  // Quebra se: a numeração das decisões sumir, sair de ordem ou for lida em voz alta (a lista ordenada já diz a ordem).
  it('as decisões levam o número 01 a 04, só para os olhos', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    const numbers = within(scene(2)).getAllByText(/^0[1-4]$/);
    expect(numbers.map((number) => number.textContent)).toEqual(['01', '02', '03', '04']);
    for (const number of numbers) expect(number).toHaveAttribute('aria-hidden', 'true');
  });

  // Quebra se: a cena 4 perder uma das três linhas, o texto dela, o nível do título de cada uma (h3, sob o h2 da cena 3) ou o
  // índice que o CSS usa para escalonar a entrada (`--i`: 0, 1, 2).
  it('a cena 4 tem as três linhas', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    const rows = within(scene(4)).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Uma transação.Débito, crédito e registro juntos.',
      'Dois avisos.Para quem envia e para quem recebe.',
      'Uma regra.Lojistas recebem. Não enviam.',
    ]);
    expect(within(scene(4)).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Uma transação.',
      'Dois avisos.',
      'Uma regra.',
    ]);
    expect(rows.map((row) => (row as HTMLElement).style.getPropertyValue('--i'))).toEqual(['0', '1', '2']);
  });
});

describe('o arco de cada cena', () => {
  const arcOf = (id: number) => scene(id).querySelector('[data-orientation]') as HTMLElement | null;

  // Quebra se: a abertura deixar de se desenhar por tempo (ficaria vazia até a primeira rolagem) ou outra cena passar a se
  // desenhar sozinha, sem o scroll. As cenas 4 e 6 não têm arco.
  it('só a abertura se desenha por tempo', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    expect([1, 2, 3, 4, 5, 6].map((id) => arcOf(id)?.hasAttribute('data-timed') ?? null)).toEqual([true, false, false, null, false, null]);
  });

  // Quebra se: a abertura, a proposta ou o clímax perderem as pontas (a partida e a chegada que a luz percorre), ou o contexto
  // ganhar pontas (ali o arco tem nós, quatro).
  it('a abertura, a proposta e o clímax marcam as pontas; o contexto tem quatro nós', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    for (const id of [1, 3, 5]) {
      const ends = Array.from(arcOf(id)!.querySelectorAll('[data-end]')).map((end) => end.getAttribute('data-end'));
      expect(ends, `cena ${id}`).toEqual(['origin', 'target']);
    }
    expect(arcOf(2)!.querySelectorAll('[data-end]')).toHaveLength(0);
    expect(arcOf(2)!.querySelectorAll('ol > li')).toHaveLength(4);
    expect(arcOf(3)!.querySelectorAll('ol > li')).toHaveLength(0);
  });

  // Quebra se: a proposta deixar de dizer quem envia e quem recebe nas pontas do arco (o mesmo par da carteira abaixo).
  it('na proposta, as pontas se chamam Marina e Rafael', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    expect(within(arcOf(3)!).getByText('Marina')).toBeInTheDocument();
    expect(within(arcOf(3)!).getByText('Rafael')).toBeInTheDocument();
  });

  // Quebra se: a abertura, a proposta ou o clímax passarem a seguir a proporção da caixa: a luz vai sempre da esquerda para a
  // direita (de Marina a Rafael); só o contexto, com texto ao lado dos nós, vira vertical quando a caixa fica em pé.
  it('numa caixa em pé só o arco do contexto fica vertical', async () => {
    measuredBox(358, 700);
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    expect([1, 2, 3, 5].map((id) => arcOf(id)!.getAttribute('data-orientation'))).toEqual(['horizontal', 'vertical', 'horizontal', 'horizontal']);
  });

  // Quebra se: o contexto ficar vertical também em caixa larga (o texto dos nós se espalha ao longo do arco horizontal).
  it('numa caixa larga todos os arcos são horizontais', async () => {
    measuredBox(1340, 540);
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    expect([1, 2, 3, 5].map((id) => arcOf(id)!.getAttribute('data-orientation'))).toEqual(['horizontal', 'horizontal', 'horizontal', 'horizontal']);
  });
});

describe('cena 3: o saldo acompanha o scroll', () => {
  // Quebra se: o saldo não começar em R$ 1.000,00, ou não acabar em R$ 750,00 (a conta é de centavos inteiros).
  it('começa em R$ 1.000,00 e acaba em R$ 750,00', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    expect(balanceCents()).toBe(100000n);

    scrollTo(3, '1.000');

    expect(balanceCents()).toBe(75000n);
    expect(within(scene(3)).getByTestId('wallet-balance')).toHaveTextContent('R$ 750,00');
  });

  // Quebra se: o saldo começar a cair antes de 55% ou terminar de cair depois de 90% (a janela é o que casa a queda com a
  // chegada da luz), ou subir de novo enquanto o scroll avança.
  it('só cai entre 55% e 90% do progresso, sem nunca subir', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    scrollTo(3, '0.549');
    expect(balanceCents()).toBe(100000n);
    // O meio da janela (0,725 = 0,55 + metade de 0,35) é o meio do caminho: R$ 875,00 exatos. Um começo ou um fim fora de
    // 55% e 90% deslocaria este ponto.
    scrollTo(3, '0.725');
    expect(balanceCents()).toBe(87500n);
    scrollTo(3, '0.900');
    expect(balanceCents()).toBe(75000n);

    let previous = 100000n;
    for (let step = 0; step <= 1000; step += 25) {
      scrollTo(3, (step / 1000).toFixed(3));
      const now = balanceCents();
      expect(now <= previous, `progresso ${step / 1000}`).toBe(true);
      expect(now >= 75000n && now <= 100000n).toBe(true);
      previous = now;
    }
  });

  // Quebra se: a linha "Rafael Costa −R$ 250,00" aparecer antes de a luz chegar (a 90%), ou nunca aparecer. É um evento, não
  // uma rampa: a luz chega e a linha entra; o limite é um só (o do saldo), no React.
  it('a linha do crédito entra quando a luz chega, a 90%', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });
    const entry = () => within(scene(3)).getByText('Rafael Costa').closest('[data-credited]');

    scrollTo(3, '0.600');
    expect(entry()).toHaveAttribute('data-credited', 'false');

    scrollTo(3, '0.899');
    expect(entry()).toHaveAttribute('data-credited', 'false');

    scrollTo(3, '0.900');
    expect(entry()).toHaveAttribute('data-credited', 'true');
    expect(entry()).toHaveTextContent('−R$ 250,00');
  });

  // Quebra se: a carteira de demonstração for lida como se fosse a do visitante: ela muda com o scroll e não é de ninguém.
  it('a carteira de demonstração é decorativa para o leitor de tela', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    expect(within(scene(3)).getByTestId('wallet-balance').closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('visitante', () => {
  // Quebra se: um link da vitrine levar a outro lugar que o que diz.
  it('o topo leva a /entrar, o CTA a /criar-conta e "Já tenho conta" a /entrar', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    expect(await screen.findByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    expect(screen.getByRole('link', { name: 'Abrir minha carteira' })).toHaveAttribute('href', '/criar-conta');
    expect(screen.getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/entrar');
  });

  // Quebra se: a ação principal perder a seta (é a única da página: "a seta é da ação principal") ou o link discreto ganhar uma.
  it('só o CTA principal leva a seta, desenhada e escondida do leitor de tela', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByRole('link', { name: 'Abrir minha carteira' }).querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Já tenho conta' }).querySelector('svg')).toBeNull();
    expect(screen.getByRole('link', { name: 'Entrar' }).querySelector('svg')).toBeNull();
  });
});

describe('quem já está logado', () => {
  // Quebra se: quem já tem sessão for convidado a criar uma conta ou a entrar de novo.
  it('o topo mostra "Carteira", o CTA vai para /carteira e não há "Já tenho conta"', async () => {
    renderApp('/', { user: marina });
    await screen.findByRole('heading', { level: 1 });

    const top = await screen.findByRole('link', { name: 'Carteira' });
    expect(top).toHaveAttribute('href', '/carteira');
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Abrir minha carteira' })).toHaveAttribute('href', '/carteira');
    expect(screen.queryByRole('link', { name: 'Já tenho conta' })).toBeNull();
  });
});

describe('rodapé', () => {
  // Quebra se: o crédito do desafio mudar de texto: é o texto exato da spec.
  it('traz o crédito do desafio, com o texto exato', async () => {
    renderApp('/', { user: null });
    await screen.findByRole('heading', { level: 1 });

    expect(within(scene(6)).getByText('Implementação do desafio PicPay Simplificado, com Quarkus e React')).toBeInTheDocument();
    // É o rodapé da última cena, não um bloco qualquer.
    expect(scene(6).querySelector('footer')?.textContent).toBe('Implementação do desafio PicPay Simplificado, com Quarkus e React');
  });
});
