import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useReducer, useRef, useState } from 'react';
import type { ApiError } from '../../api/ApiError';
import { api } from '../../api/client';
import { messageForCode } from '../../api/errorMessages';
import type { Transaction, TransferBody } from '../../api/types';
import { sessionKey, useSession } from '../../app/session';
import { ButtonLink } from '../../design/Button';
import { apiToCents, centsToApi, parseAmountInput } from '../../lib/money';
import { ROUTES } from '../../routes';
import { statementKey } from '../statement/useStatement';
import { AmountStep } from './AmountStep';
import { ConfirmStep } from './ConfirmStep';
import { RecipientStep } from './RecipientStep';
import { canSend, initialTransferState, transferReducer, type Step, type TransferState } from './transferFlow';
import styles from './TransferPage.module.css';

const ORDER: Record<Step, number> = { recipient: 0, amount: 1, confirm: 2 };

type Direction = 'initial' | 'forward' | 'back';
type View = Step | 'success' | 'unknown';

// O título de cada tela é a pergunta que ela faz, ou o que aconteceu.
const TITLES: Record<View, string> = {
  recipient: 'Para quem?',
  amount: 'Quanto?',
  confirm: 'Confirmar.',
  success: 'Enviado.',
  unknown: 'Sem confirmação.',
};

function viewOf(state: TransferState): View {
  if (state.outcome === 'success') return 'success';
  if (state.outcome === 'unknown') return 'unknown';
  return state.step;
}

export function TransferPage() {
  const { user } = useSession();
  if (!user) return null;
  if (user.userType === 'MERCHANT') return <MerchantNotice />;
  return <TransferFlow balance={user.balance} />;
}

// Lojas recebem; o back-end recusaria o envio de uma loja. Em vez do formulário, o motivo.
function MerchantNotice() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Lojas recebem, não enviam.</h1>
      <ButtonLink to={ROUTES.wallet} variant="quiet" className={styles.quiet}>
        Ver carteira
      </ButtonLink>
    </div>
  );
}

function TransferFlow({ balance }: { balance: string }) {
  const queryClient = useQueryClient();
  const balanceCents = apiToCents(balance);
  const [state, dispatch] = useReducer(transferReducer, initialTransferState);
  // O termo buscado mora aqui, não no passo: voltar ao primeiro passo devolve a busca como estava.
  const [term, setTerm] = useState('');
  // Guarda síncrona contra envio duplo: o estado só muda no próximo ciclo, e dois envios do formulário (clique e Enter)
  // podem chegar antes dele.
  const sending = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);

  // A direção da troca de passo é decidida quando o passo muda e fica fixa enquanto ele dura: se mudasse com o passo
  // estável, o elemento reiniciaria a animação de entrada a cada tecla.
  const [stage, setStage] = useState<{ step: Step; direction: Direction }>({ step: state.step, direction: 'initial' });
  if (stage.step !== state.step) {
    setStage({ step: state.step, direction: ORDER[state.step] > ORDER[stage.step] ? 'forward' : 'back' });
  }

  const transfer = useMutation<Transaction, ApiError, TransferBody>({
    mutationFn: (body) => api.transfer(body),
    // Estes dois rodam mesmo que a pessoa saia da tela com o envio a caminho: o saldo e o extrato têm de se atualizar.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionKey });
      void queryClient.invalidateQueries({ queryKey: statementKey });
    },
    // O 401 (a sessão acabou) o cliente do app trata para qualquer chamada (providers.tsx): a guarda de rotas leva a
    // /entrar?next=…
    onError: (error) => {
      if (error.code === 'INSUFFICIENT_BALANCE') {
        // O saldo que a tela conhece está velho. Buscar o de verdade, senão a pessoa insiste num valor que não cabe.
        void queryClient.invalidateQueries({ queryKey: sessionKey });
      }
    },
  });

  // O foco vai ao título a cada tela nova (e na primeira vez): quem usa teclado ou leitor de tela começa pela pergunta.
  // Em `denied` a tela é a mesma e o foco vai ao botão de tentar de novo, que já nasce com ele.
  const view = viewOf(state);
  useEffect(() => {
    title.current?.focus();
  }, [view]);

  function changeTerm(text: string) {
    setTerm(text);
    // Digitar de novo apaga a recusa do passo (é só o erro: o destinatário já não estava escolhido).
    if (state.errorCode !== undefined) dispatch({ type: 'clearRecipient' });
  }

  function startOver() {
    dispatch({ type: 'reset' });
    setTerm('');
  }

  function send() {
    const { recipient, amountText } = state;
    if (sending.current || !canSend(state) || recipient === null) return;
    const cents = parseAmountInput(amountText);
    if (cents === null) return;

    sending.current = true;
    dispatch({ type: 'submit' });
    transfer.mutate(
      { receiverId: recipient.id, amount: centsToApi(cents) },
      {
        onSuccess: (result) => dispatch({ type: 'succeeded', result }),
        onError: (error) => dispatch({ type: 'failed', error }),
        onSettled: () => {
          sending.current = false;
        },
      },
    );
  }

  const cents = parseAmountInput(state.amountText);
  const finished = state.outcome === 'success' || state.outcome === 'unknown';
  const position = ORDER[state.step] + 1;
  const message = state.errorCode ? messageForCode(state.errorCode) : undefined;

  return (
    <div className={styles.page}>
      <p className={styles.position}>
        {!finished && (
          <>
            <span className="sr-only">
              Passo {position} de 3
            </span>
            <span aria-hidden="true">{position} / 3</span>
          </>
        )}
      </p>
      <div key={state.step} className={styles.stage} data-direction={stage.direction}>
        <h1 ref={title} tabIndex={-1} className={styles.title}>
          {TITLES[view]}
        </h1>
        {state.step === 'recipient' && (
          <RecipientStep
            term={term}
            onTermChange={changeTerm}
            selected={state.recipient}
            onSelect={(recipient) => dispatch({ type: 'selectRecipient', recipient })}
            onContinue={() => dispatch({ type: 'next', balanceCents })}
            message={message}
          />
        )}
        {state.step === 'amount' && (
          <AmountStep
            text={state.amountText}
            onChange={(text) => dispatch({ type: 'setAmount', text })}
            balanceCents={balanceCents}
            message={message}
            onNext={() => dispatch({ type: 'next', balanceCents })}
            onBack={() => dispatch({ type: 'back' })}
          />
        )}
        {state.step === 'confirm' && state.recipient && cents !== null && (
          <ConfirmStep
            recipient={state.recipient}
            cents={cents}
            balanceCents={balanceCents}
            outcome={state.outcome}
            errorCode={state.errorCode}
            result={state.result}
            onSend={send}
            onBack={() => dispatch({ type: 'back' })}
            onNew={startOver}
          />
        )}
      </div>
    </div>
  );
}
