import type { FormEvent } from 'react';
import type { ApiErrorCode } from '../../api/ApiError';
import { messageForCode } from '../../api/errorMessages';
import type { Transaction, UserSummary } from '../../api/types';
import { Button } from '../../design/Button';
import { Money } from '../../design/Money';
import { formatBRL } from '../../lib/money';
import { Arc, type ArcState } from './Arc';
import styles from './ConfirmStep.module.css';
import { ResultView } from './ResultView';
import shared from './steps.module.css';
import type { Outcome } from './transferFlow';

// O arco acompanha o desfecho. `unknown` fica em repouso ("sem confirmação"): ali o arco não afirma nada.
const ARC: Record<Outcome, ArcState> = {
  idle: 'idle',
  submitting: 'authorizing',
  success: 'landed',
  denied: 'retracted',
  rejected: 'retracted',
  unknown: 'unconfirmed',
};

export interface ConfirmStepProps {
  recipient: UserSummary;
  cents: bigint;
  balanceCents: bigint;
  outcome: Outcome;
  /** O código do último erro (só importa em `denied`). */
  errorCode?: ApiErrorCode;
  /** A transação que o servidor confirmou (só em `success`). */
  result?: Transaction;
  onSend: () => void;
  onBack: () => void;
  onNew: () => void;
}

export function ConfirmStep({
  recipient,
  cents,
  balanceCents,
  outcome,
  errorCode,
  result,
  onSend,
  onBack,
  onNew,
}: ConfirmStepProps) {
  const name = `${recipient.firstName} ${recipient.lastName}`;
  const submitting = outcome === 'submitting';

  function submit(event: FormEvent) {
    event.preventDefault();
    onSend();
  }

  // O arco é sempre o primeiro filho e nunca sai da tela entre o envio e o desfecho: o anúncio de leitor de tela
  // ("Autorizando…", "Enviado") só acontece se a mesma região viva muda de texto, não se uma nova é criada.
  return (
    <div className={styles.confirm}>
      <Arc state={ARC[outcome]} from="Você" to={recipient.firstName} />
      {outcome === 'success' && result ? (
        <ResultView kind="success" result={result} onNew={onNew} />
      ) : outcome === 'unknown' ? (
        <ResultView kind="unknown" onNew={onNew} />
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <dl className={styles.summary}>
            <div className={styles.line}>
              <dt>Para</dt>
              <dd>{name}</dd>
            </div>
            <div className={styles.line}>
              <dt>Valor</dt>
              <dd>
                <Money value={cents} variant="row" />
              </dd>
            </div>
            <div className={styles.line}>
              <dt>Saldo depois</dt>
              <dd>
                <Money value={balanceCents - cents} variant="row" />
              </dd>
            </div>
          </dl>
          {outcome === 'denied' && errorCode && (
            <p role="alert" className={shared.alert}>
              {messageForCode(errorCode)}
            </p>
          )}
          <div className={shared.actions}>
            {outcome === 'denied' ? (
              // A recusa do autorizador não gravou nada: tentar de novo é seguro. O foco já nasce no botão.
              <Button key="retry" type="submit" arrow autoFocus>
                Tentar de novo
              </Button>
            ) : (
              <Button key="send" type="submit" arrow={!submitting} loading={submitting}>
                {submitting ? 'Autorizando…' : `Enviar ${formatBRL(cents)} para ${name}`}
              </Button>
            )}
            <Button variant="quiet" disabled={submitting} onClick={onBack}>
              Voltar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
