// O texto da vitrine mora aqui, não espalhado pelos componentes. Cada cena lê o seu pedaço.
export const COPY = {
  top: { signIn: 'Entrar', wallet: 'Carteira' },

  // 01 Impacto
  impact: { lines: ['Entre duas pessoas,', 'um instante.'], scroll: 'Role' },

  // 02 Contexto: o título é uma frase só, quebrada em duas linhas
  context: {
    lines: ['Cada transferência', 'passa por quatro decisões.'],
    decisions: [
      { question: 'Quem envia?', answer: 'Pessoas enviam. Lojas recebem.' },
      { question: 'Há saldo?', answer: 'Sem saldo, nada acontece.' },
      { question: 'Alguém autoriza?', answer: 'Um serviço externo decide.' },
      { question: 'Os dois sabem?', answer: 'Quem envia e quem recebe são avisados.' },
    ],
  },

  // 03 Proposta: a carteira de demonstração (dados fixos)
  proposal: {
    title: 'Débito, crédito e registro acontecem juntos, ou não acontecem.',
    owner: { name: 'Marina Alves', first: 'Marina' },
    receiver: { name: 'Rafael Costa', first: 'Rafael' },
    movements: 'Últimas movimentações',
  },

  // 04 Detalhes
  details: [
    { term: 'Uma transação.', detail: 'Débito, crédito e registro juntos.' },
    { term: 'Dois avisos.', detail: 'Para quem envia e para quem recebe.' },
    { term: 'Uma regra.', detail: 'Lojistas recebem. Não enviam.' },
  ],

  // 05 Clímax
  climax: { word: 'Enviado.', line: 'De uma mão para outra.' },

  // 06 Conversão
  conversion: {
    title: 'Sua vez.',
    cta: 'Abrir minha carteira',
    login: 'Já tenho conta',
    credit: 'Implementação do desafio PicPay Simplificado, com Quarkus e React',
  },
} as const;
