import { describe, expect, it } from 'vitest';
import { ApiError, type ApiErrorCode } from '../../api/ApiError';
import { rafael, summary, tx } from '../../test/fixtures';
import {
  canGoNext,
  canSend,
  classifyFailure,
  initialTransferState,
  transferReducer as reduce,
  type TransferAction,
  type TransferState,
} from './transferFlow';

const BALANCE = 100000n; // R$ 1.000,00

const failed = (code: ApiErrorCode): TransferAction => ({
  type: 'failed',
  error: new ApiError(code === 'NETWORK' ? 0 : 500, code, []),
});

const run = (state: TransferState, ...actions: TransferAction[]) => actions.reduce(reduce, state);

// Os estados em que um teste costuma começar.
const atAmount = () => run(initialTransferState, { type: 'selectRecipient', recipient: summary(rafael) });
const confirmed = () => run(atAmount(), { type: 'setAmount', text: '250,00' }, { type: 'next', balanceCents: BALANCE });
const submitting = () => reduce(confirmed(), { type: 'submit' });

describe('fluxo feliz', () => {
  it('começa pedindo o destinatário, sem nada escolhido', () => {
    expect(initialTransferState).toEqual({ step: 'recipient', recipient: null, amountText: '', outcome: 'idle' });
  });

  it('escolher o destinatário vai ao valor; o valor vai à confirmação; enviar e concluir grava o resultado', () => {
    const state = run(
      initialTransferState,
      { type: 'selectRecipient', recipient: summary(rafael) },
      { type: 'setAmount', text: '250,00' },
      { type: 'next', balanceCents: BALANCE },
      { type: 'submit' },
      { type: 'succeeded', result: tx() },
    );

    expect(state).toMatchObject({ step: 'confirm', recipient: summary(rafael), amountText: '250,00', outcome: 'success', result: tx() });
  });
});

describe('canGoNext', () => {
  // Quebra se: o passo do valor deixar passar um valor que não cabe no saldo (o servidor recusaria depois de
  // a pessoa já ter confirmado) ou recusar o que cabe.
  it.each([
    ['250,00', true],
    ['1.000,00', true], // exatamente o saldo
    ['0,01', true],
    ['1.001,00', false],
    ['1000,01', false],
    ['0', false],
    ['0,00', false],
    ['', false],
    ['abc', false],
    ['1,234', false],
  ])('no passo do valor, "%s" com saldo de R$ 1.000,00: %s', (text, expected) => {
    const state = { ...atAmount(), amountText: text };

    expect(canGoNext(state, BALANCE)).toBe(expected);
  });

  it('no passo do destinatário, só com um destinatário escolhido', () => {
    expect(canGoNext(initialTransferState, BALANCE)).toBe(false);
    expect(canGoNext({ ...initialTransferState, recipient: summary(rafael) }, BALANCE)).toBe(true);
  });

  it('na confirmação não há próximo passo', () => {
    expect(canGoNext(confirmed(), BALANCE)).toBe(false);
  });
});

describe('canSend', () => {
  // RF2, última linha. Quebra se: enviar for permitido depois de um resultado desconhecido (a primeira tentativa pode
  // ter chegado: o dinheiro sairia duas vezes), durante um envio (duplo clique) ou depois do sucesso.
  it.each([
    ['idle', true],
    ['denied', true], // o autorizador recusou: nada foi gravado, tentar de novo é seguro
    ['submitting', false],
    ['success', false],
    ['unknown', false],
    ['rejected', false],
  ] as const)('na confirmação, com destinatário, e desfecho %s: %s', (outcome, expected) => {
    expect(canSend({ ...confirmed(), outcome })).toBe(expected);
  });

  // Quebra se: o envio for permitido fora da confirmação ou sem destinatário.
  it('só na confirmação e com destinatário', () => {
    expect(canSend(initialTransferState)).toBe(false);
    expect(canSend(atAmount())).toBe(false);
    expect(canSend({ ...confirmed(), recipient: null })).toBe(false);
  });
});

describe('navegação', () => {
  // Quebra se: voltar apagar o que a pessoa já preencheu.
  it('voltar da confirmação mantém destinatário e valor; voltar do valor mantém o destinatário', () => {
    const atConfirm = confirmed();

    const atAmountAgain = reduce(atConfirm, { type: 'back' });
    expect(atAmountAgain).toMatchObject({ step: 'amount', recipient: summary(rafael), amountText: '250,00', outcome: 'idle' });

    const atRecipient = reduce(atAmountAgain, { type: 'back' });
    expect(atRecipient).toMatchObject({ step: 'recipient', recipient: summary(rafael), amountText: '250,00' });
  });

  it('voltar no primeiro passo não faz nada', () => {
    expect(reduce(initialTransferState, { type: 'back' })).toBe(initialTransferState);
  });

  // Quebra se: dar o próximo passo sem valor válido deixar a pessoa chegar à confirmação com nada (ou com mais do que tem).
  it('next sem valor válido, ou acima do saldo, é ignorado', () => {
    const empty = atAmount();
    expect(reduce(empty, { type: 'next', balanceCents: BALANCE })).toBe(empty);

    const tooMuch = { ...atAmount(), amountText: '1.001,00' };
    expect(reduce(tooMuch, { type: 'next', balanceCents: BALANCE })).toBe(tooMuch);
  });

  it('next no primeiro passo só avança com destinatário', () => {
    expect(reduce(initialTransferState, { type: 'next', balanceCents: BALANCE })).toBe(initialTransferState);
    expect(reduce({ ...initialTransferState, recipient: summary(rafael) }, { type: 'next', balanceCents: BALANCE }).step).toBe('amount');
  });

  it('clearRecipient volta a pedir o destinatário', () => {
    expect(reduce(atAmount(), { type: 'clearRecipient' })).toMatchObject({ step: 'recipient', recipient: null });
  });
});

describe('envio e duplo clique (RF2)', () => {
  // Quebra se: um segundo submit durante o envio passar. Duas transferências sairiam de um duplo clique.
  it('submit enquanto já está enviando é ignorado: devolve o mesmo estado', () => {
    const sending = submitting();

    expect(sending.outcome).toBe('submitting');
    expect(reduce(sending, { type: 'submit' })).toBe(sending);
  });

  // Quebra se: depois de um resultado desconhecido o reducer deixar reenviar. Se a primeira tentativa tivesse
  // chegado, o dinheiro sairia duas vezes.
  it('submit depois de resultado desconhecido é ignorado: sem reenvio cego', () => {
    const unknown = reduce(submitting(), failed('NETWORK'));

    expect(unknown.outcome).toBe('unknown');
    expect(reduce(unknown, { type: 'submit' })).toBe(unknown);
  });

  // Quebra se: um submit fora da confirmação (ou sem destinatário) mudar o estado.
  it('submit só vale na confirmação, com destinatário', () => {
    const early = atAmount();
    expect(reduce(early, { type: 'submit' })).toBe(early);
    expect(reduce(initialTransferState, { type: 'submit' })).toBe(initialTransferState);
    expect(reduce({ ...confirmed(), recipient: null }, { type: 'submit' }).outcome).toBe('idle');
  });

  // Quebra se: depois de uma recusa do autorizador (nada foi gravado) a pessoa não puder tentar de novo.
  it('depois de denied, o submit é permitido de novo', () => {
    const denied = reduce(submitting(), failed('AUTHORIZATION_DENIED'));
    expect(denied).toMatchObject({ step: 'confirm', outcome: 'denied', errorCode: 'AUTHORIZATION_DENIED' });

    const again = reduce(denied, { type: 'submit' });

    expect(again.outcome).toBe('submitting');
    expect(again.errorCode).toBeUndefined();
  });

  // Quebra se: algo além do reset tirar a tela do "não deu para confirmar" (RF2): voltar, trocar o valor ou o
  // destinatário reabririam o reenvio sem a pessoa ter conferido o extrato.
  it.each([
    ['setAmount', { type: 'setAmount', text: '1,00' }],
    ['back', { type: 'back' }],
    ['clearRecipient', { type: 'clearRecipient' }],
    ['selectRecipient', { type: 'selectRecipient', recipient: summary(rafael) }],
    ['next', { type: 'next', balanceCents: BALANCE }],
    ['submit', { type: 'submit' }],
  ] as [string, TransferAction][])('depois de resultado desconhecido, %s é ignorado; só reset sai', (_name, action) => {
    const unknown = reduce(submitting(), failed('INTERNAL_ERROR'));

    expect(reduce(unknown, action)).toBe(unknown);
    expect(reduce(unknown, { type: 'reset' })).toBe(initialTransferState);
  });

  it('durante o envio e depois do sucesso, nada muda o estado senão o resultado (ou o reset)', () => {
    const sending = submitting();
    expect(reduce(sending, { type: 'setAmount', text: '1,00' })).toBe(sending);
    expect(reduce(sending, { type: 'back' })).toBe(sending);

    const done = reduce(sending, { type: 'succeeded', result: tx() });
    expect(reduce(done, { type: 'back' })).toBe(done);
    expect(reduce(done, { type: 'setAmount', text: '1,00' })).toBe(done);
    expect(reduce(done, { type: 'submit' })).toBe(done);
  });

  // Quebra se: uma resposta atrasada (de uma tentativa antiga) for aplicada ao estado de uma transferência nova.
  it('succeeded e failed só valem enquanto está enviando', () => {
    const idle = confirmed();
    expect(reduce(idle, { type: 'succeeded', result: tx() })).toBe(idle);
    expect(reduce(idle, failed('NETWORK'))).toBe(idle);

    const reset = reduce(submitting(), { type: 'reset' });
    expect(reduce(reset, { type: 'succeeded', result: tx() })).toBe(reset);
    expect(reduce(reset, failed('INSUFFICIENT_BALANCE'))).toBe(reset);
  });
});

describe('falhas', () => {
  // Quebra se: um código de erro cair na categoria errada. É ela que decide se a pessoa pode tentar de novo
  // (nada foi gravado), precisa corrigir algo, ou não tem como saber se o dinheiro saiu.
  it.each([
    ['NETWORK', 'unknown'],
    ['INTERNAL_ERROR', 'unknown'],
    ['HTTP_502', 'unknown'],
    ['HTTP_504', 'unknown'],
    ['HTTP_500', 'unknown'],
    ['HTTP_522', 'unknown'], // faixa inteira de 5xx, não só 50x
    ['HTTP_599', 'unknown'],
    ['UNKNOWN', 'unknown'],
    ['AUTHORIZER_UNAVAILABLE', 'denied'],
    ['AUTHORIZATION_DENIED', 'denied'],
    ['INSUFFICIENT_BALANCE', 'rejected'],
    ['USER_NOT_FOUND', 'rejected'],
    ['MERCHANT_CANNOT_SEND', 'rejected'],
    ['SELF_TRANSFER', 'rejected'],
    ['VALIDATION_ERROR', 'rejected'],
    ['HTTP_415', 'rejected'],
    ['HTTP_400', 'rejected'],
  ] as [ApiErrorCode, string][])('classifyFailure(%s) = %s', (code, kind) => {
    expect(classifyFailure(new ApiError(code === 'NETWORK' ? 0 : 500, code, []))).toBe(kind);
  });

  // Quebra se: a recusa por saldo levar ao passo errado, ou o destinatário inexistente continuar escolhido.
  it('rejected por saldo volta ao passo do valor, mantendo o destinatário e o valor', () => {
    const state = reduce(submitting(), failed('INSUFFICIENT_BALANCE'));

    expect(state).toMatchObject({
      step: 'amount',
      outcome: 'rejected',
      errorCode: 'INSUFFICIENT_BALANCE',
      recipient: summary(rafael),
      amountText: '250,00',
    });
  });

  it('VALIDATION_ERROR também volta ao passo do valor', () => {
    expect(reduce(submitting(), failed('VALIDATION_ERROR'))).toMatchObject({ step: 'amount', outcome: 'rejected' });
  });

  it.each(['USER_NOT_FOUND', 'SELF_TRANSFER', 'MERCHANT_CANNOT_SEND', 'HTTP_415'] as ApiErrorCode[])(
    'rejected por %s limpa o destinatário e volta ao primeiro passo',
    (code) => {
      const state = reduce(submitting(), failed(code));

      expect(state).toMatchObject({ step: 'recipient', recipient: null, outcome: 'rejected', errorCode: code });
      expect(state.amountText).toBe('250,00');
    },
  );

  // Quebra se: a mensagem do erro anterior ficar presa depois de a pessoa corrigir o valor.
  it('setAmount depois de uma falha limpa a mensagem', () => {
    const rejected = reduce(submitting(), failed('INSUFFICIENT_BALANCE'));

    const edited = reduce(rejected, { type: 'setAmount', text: '100,00' });

    expect(edited).toMatchObject({ outcome: 'idle', amountText: '100,00' });
    expect(edited.errorCode).toBeUndefined();
  });

  it('escolher outro destinatário depois de um USER_NOT_FOUND limpa o erro e segue ao valor', () => {
    const rejected = reduce(submitting(), failed('USER_NOT_FOUND'));

    const next = reduce(rejected, { type: 'selectRecipient', recipient: summary(rafael) });

    expect(next).toMatchObject({ step: 'amount', outcome: 'idle', recipient: summary(rafael) });
    expect(next.errorCode).toBeUndefined();
  });

  it('o resultado desconhecido e a recusa ficam no passo da confirmação, com o código', () => {
    expect(reduce(submitting(), failed('NETWORK'))).toMatchObject({ step: 'confirm', outcome: 'unknown', errorCode: 'NETWORK' });
    expect(reduce(submitting(), failed('AUTHORIZER_UNAVAILABLE'))).toMatchObject({ step: 'confirm', outcome: 'denied' });
  });
});

describe('reset', () => {
  it('limpa tudo, inclusive o resultado', () => {
    const done = run(confirmed(), { type: 'submit' }, { type: 'succeeded', result: tx() });
    expect(done.result).toBeDefined();

    expect(reduce(done, { type: 'reset' })).toEqual(initialTransferState);
  });
});
