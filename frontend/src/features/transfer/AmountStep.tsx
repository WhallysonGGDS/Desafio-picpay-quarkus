import { useId, useState, type FormEvent } from 'react';
import { fieldMessage, messageForCode } from '../../api/errorMessages';
import { Button } from '../../design/Button';
import { Money } from '../../design/Money';
import { parseAmountInput } from '../../lib/money';
import styles from './AmountStep.module.css';
import shared from './steps.module.css';

export interface AmountStepProps {
  /** O valor como a pessoa digitou ("250,00"). */
  text: string;
  onChange: (text: string) => void;
  /** O saldo, em centavos: o limite do valor. */
  balanceCents: bigint;
  /** Por que o envio foi recusado (saldo, validação): fica sob o campo até a próxima digitação. */
  message?: string;
  onNext: () => void;
  onBack: () => void;
}

export function AmountStep({ text, onChange, balanceCents, message, onNext, onBack }: AmountStepProps) {
  const id = useId();
  const errorId = `${id}-error`;
  // O erro de formato só aparece depois de a pessoa sair do campo ou apertar Enter, nunca no meio da digitação:
  // "1," é um passo no caminho de "1,5", não um erro.
  const [asked, setAsked] = useState(false);

  const cents = parseAmountInput(text);
  const tooMuch = cents !== null && cents > balanceCents;
  const after = cents !== null && !tooMuch ? balanceCents - cents : null;
  const formatError =
    asked && cents === null ? fieldMessage(text.trim() === '' ? 'REQUIRED' : 'INVALID_AMOUNT') : undefined;
  const error = tooMuch ? messageForCode('INSUFFICIENT_BALANCE') : (formatError ?? message);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (after !== null) onNext();
    else setAsked(true);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.amount} data-invalid={error ? 'true' : undefined}>
        <label className="sr-only" htmlFor={id}>
          Valor em reais
        </label>
        <span className={styles.currency} aria-hidden="true">
          R$
        </span>
        <input
          id={id}
          className={styles.input}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setAsked(false);
            onChange(event.target.value);
          }}
          onBlur={() => setAsked(text.trim() !== '')}
          // Com o botão desabilitado o navegador não envia o formulário no Enter: sem isto o Enter seria mudo.
          onKeyDown={(event) => {
            if (event.key === 'Enter' && after === null) {
              event.preventDefault();
              setAsked(true);
            }
          }}
        />
        <span className={styles.rule} aria-hidden="true" />
      </div>
      <div className={styles.lines}>
        <p>
          Disponível <Money value={balanceCents} />
        </p>
        {after !== null && (
          <p>
            Saldo depois <Money value={after} />
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className={styles.alert}>
            {error}
          </p>
        )}
      </div>
      <div className={shared.actions}>
        <Button type="submit" arrow disabled={after === null}>
          Revisar envio
        </Button>
        <Button variant="quiet" onClick={onBack}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
