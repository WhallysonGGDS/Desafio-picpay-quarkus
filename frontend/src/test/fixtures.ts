import type { Page, Transaction, User, UserSummary } from '../api/types';

// Dados no formato exato do back-end: dinheiro como string de duas casas, horário em UTC, ids numéricos.
// São as três contas de demonstração do seed (SeedData).
export const marina: User = {
  id: 1,
  firstName: 'Marina',
  lastName: 'Alves',
  document: '52998224725',
  email: 'marina@arco.demo',
  balance: '1000.00',
  userType: 'COMMON',
};

export const rafael: User = {
  id: 2,
  firstName: 'Rafael',
  lastName: 'Costa',
  document: '11144477735',
  email: 'rafael@arco.demo',
  balance: '500.00',
  userType: 'COMMON',
};

export const loja: User = {
  id: 3,
  firstName: 'Loja',
  lastName: 'Arco',
  document: '11222333000181',
  email: 'loja@arco.demo',
  balance: '0.00',
  userType: 'MERCHANT',
};

// O que a busca de destinatário devolve de outra pessoa: sem saldo, sem e-mail e com o documento mascarado como o
// back-end faz (DocumentMask): CPF "***.444.777-**", CNPJ "**.222.333/****-**".
export function summary(user: User): UserSummary {
  const d = user.document;
  const maskedDocument =
    d.length === 11
      ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
      : d.length === 14
        ? `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`
        : '***';
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, userType: user.userType, maskedDocument };
}

// Uma transferência de Marina para Rafael, vista por quem enviou. 15h58 UTC são 12h58 em São Paulo.
export function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 10,
    amount: '250.00',
    sender: { id: marina.id, name: 'Marina Alves' },
    receiver: { id: rafael.id, name: 'Rafael Costa' },
    notifySender: 'SENT',
    notifyReceiver: 'SENT',
    timestamp: '2026-11-01T15:58:00Z',
    direction: 'SENT',
    ...overrides,
  };
}

export function page<T>(items: T[], total: number = items.length, pageNumber = 0, size = 20): Page<T> {
  return { items, page: pageNumber, size, total };
}
