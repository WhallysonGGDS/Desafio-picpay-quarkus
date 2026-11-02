import type { ApiError, ApiErrorCode } from '../../api/ApiError';
import type { Transaction, UserSummary } from '../../api/types';
import { parseAmountInput } from '../../lib/money';

// A máquina de estados de uma transferência: pura, sem React. Quem decide o que a pessoa pode fazer em cada
// momento mora aqui, e a tela só desenha o estado.
//
// A regra que mais importa: se não se sabe se o dinheiro saiu (a rede caiu depois do envio, o servidor respondeu
// 500), NUNCA se reenvia sozinho nem se oferece reenvio: a primeira tentativa pode ter chegado, e o dinheiro sairia
// duas vezes. Dali só se sai começando uma transferência nova (reset), depois de conferir o extrato.

export type Step = 'recipient' | 'amount' | 'confirm';

/**
 * - `submitting`: a requisição está a caminho.
 * - `success`: o servidor confirmou.
 * - `denied`: o autorizador recusou ou está fora do ar. O servidor garante que nada foi gravado: pode tentar de novo.
 * - `rejected`: recusada antes de gravar por algo que a pessoa corrige (saldo, destinatário...).
 * - `unknown`: não dá para saber se saiu.
 */
export type Outcome = 'idle' | 'submitting' | 'success' | 'denied' | 'rejected' | 'unknown';

export interface TransferState {
  step: Step;
  recipient: UserSummary | null;
  /** O valor como a pessoa digitou ("250,00"). */
  amountText: string;
  outcome: Outcome;
  errorCode?: ApiErrorCode;
  result?: Transaction;
}

export type TransferAction =
  | { type: 'selectRecipient'; recipient: UserSummary }
  | { type: 'clearRecipient' }
  | { type: 'setAmount'; text: string }
  | { type: 'next'; balanceCents: bigint }
  | { type: 'back' }
  | { type: 'submit' }
  | { type: 'succeeded'; result: Transaction }
  | { type: 'failed'; error: ApiError }
  | { type: 'reset' };

export const initialTransferState: TransferState = { step: 'recipient', recipient: null, amountText: '', outcome: 'idle' };

export type FailureKind = 'denied' | 'rejected' | 'unknown';

/**
 * Para onde uma falha leva. `denied` (autorizador): nada foi gravado, pode tentar de novo. `unknown`: rede, 500 e
 * qualquer coisa que o front não reconheça: não dá para saber. `rejected`: todo o resto (inclusive 4xx sem código
 * nosso): foi recusada antes de gravar.
 */
export function classifyFailure(error: ApiError): FailureKind {
  const { code } = error;
  if (code === 'AUTHORIZATION_DENIED' || code === 'AUTHORIZER_UNAVAILABLE') return 'denied';
  if (code === 'NETWORK' || code === 'INTERNAL_ERROR' || code === 'UNKNOWN' || /^HTTP_5\d\d$/.test(code)) return 'unknown';
  return 'rejected';
}

/** Se o passo atual está completo: destinatário escolhido, ou valor válido e dentro do saldo. */
export function canGoNext(state: TransferState, balanceCents: bigint): boolean {
  switch (state.step) {
    case 'recipient':
      return state.recipient !== null;
    case 'amount': {
      const cents = parseAmountInput(state.amountText);
      return cents !== null && cents <= balanceCents;
    }
    case 'confirm':
      return false;
  }
}

// Há (ou pode ter havido) uma transferência a caminho: só o reset tira o estado daqui.
const FROZEN: ReadonlySet<Outcome> = new Set<Outcome>(['submitting', 'success', 'unknown']);

const settled = (state: TransferState): TransferState => ({ ...state, outcome: 'idle', errorCode: undefined });

function failure(state: TransferState, error: ApiError): TransferState {
  const kind = classifyFailure(error);
  if (kind !== 'rejected') {
    return { ...state, outcome: kind, errorCode: error.code };
  }
  // Recusada antes de gravar: volta ao passo que a pessoa precisa corrigir. Saldo e validação, ao valor; o resto
  // (destinatário inexistente, a si mesmo, lojista...), ao destinatário, que deixa de estar escolhido.
  const toAmount = error.code === 'INSUFFICIENT_BALANCE' || error.code === 'VALIDATION_ERROR';
  return {
    ...state,
    outcome: 'rejected',
    errorCode: error.code,
    step: toAmount ? 'amount' : 'recipient',
    recipient: toAmount ? state.recipient : null,
  };
}

export function transferReducer(state: TransferState, action: TransferAction): TransferState {
  if (action.type === 'reset') return initialTransferState;

  // A resposta de uma tentativa só vale enquanto ela é a que está a caminho: uma resposta atrasada, de antes de um
  // reset, não pode corromper a transferência seguinte.
  if (action.type === 'succeeded') {
    return state.outcome === 'submitting' ? { ...state, outcome: 'success', result: action.result, errorCode: undefined } : state;
  }
  if (action.type === 'failed') {
    return state.outcome === 'submitting' ? failure(state, action.error) : state;
  }

  if (FROZEN.has(state.outcome)) return state;

  switch (action.type) {
    case 'selectRecipient':
      return { ...settled(state), recipient: action.recipient, step: 'amount' };
    case 'clearRecipient':
      return { ...settled(state), recipient: null, step: 'recipient' };
    case 'setAmount':
      return { ...settled(state), amountText: action.text };
    case 'next':
      if (!canGoNext(state, action.balanceCents)) return state;
      return { ...settled(state), step: state.step === 'recipient' ? 'amount' : 'confirm' };
    case 'back':
      if (state.step === 'recipient') return state;
      return { ...settled(state), step: state.step === 'confirm' ? 'amount' : 'recipient' };
    case 'submit':
      // Chegando aqui o desfecho é idle, denied ou rejected: em todos nada foi gravado, então enviar é seguro.
      if (state.step !== 'confirm' || state.recipient === null) return state;
      return { ...state, outcome: 'submitting', errorCode: undefined };
  }
}
