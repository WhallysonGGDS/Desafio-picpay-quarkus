import type { Transaction } from '../../api/types';
import { Button, ButtonLink } from '../../design/Button';
import { formatBRLFromApi } from '../../lib/money';
import { ROUTES } from '../../routes';
import styles from './ConfirmStep.module.css';
import shared from './steps.module.css';

export type ResultViewProps =
  | { kind: 'success'; result: Transaction; onNew: () => void }
  | { kind: 'unknown'; onNew: () => void };

/**
 * Como a transferência termina. `success`: o servidor confirmou, e o valor e o nome vêm da resposta dele (o que de fato
 * aconteceu). `unknown`: não dá para saber se o dinheiro saiu, então NÃO há botão de reenvio: só o extrato, para
 * conferir, e começar uma transferência nova (RF2).
 */
export function ResultView(props: ResultViewProps) {
  if (props.kind === 'success') {
    return (
      <div className={styles.result}>
        <p className={shared.sentence}>
          {formatBRLFromApi(props.result.amount)} para {props.result.receiver.name}.
        </p>
        <div className={shared.actions}>
          <ButtonLink to={ROUTES.statement} arrow>
            Ver extrato
          </ButtonLink>
          <Button variant="quiet" onClick={props.onNew}>
            Nova transferência
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.result}>
      <p role="alert" className={shared.notice}>
        Não deu para confirmar se o envio aconteceu. Confira o extrato antes de tentar de novo.
      </p>
      <div className={shared.actions}>
        <ButtonLink to={ROUTES.statement} arrow>
          Conferir extrato
        </ButtonLink>
        <Button variant="quiet" onClick={props.onNew}>
          Nova transferência
        </Button>
      </div>
    </div>
  );
}
