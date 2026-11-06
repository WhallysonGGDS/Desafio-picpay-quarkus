import type { ReactNode } from 'react';
import type { Transaction } from '../../api/types';
import { Money } from '../../design/Money';
import { formatDateTime } from '../../lib/format';
import { formatBRLFromApi } from '../../lib/money';
import styles from './MovementRow.module.css';

/** A lista de movimentações. A linha se ajusta à largura desta lista (container query), não à da janela. */
export function MovementList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul role="list" aria-label={label} className={styles.list}>
      {children}
    </ul>
  );
}

/**
 * Uma movimentação, vista por quem consulta: quem enviou vê o destinatário e o valor negativo, quem recebeu vê o
 * remetente e o positivo. As três colunas são visuais (aria-hidden); o leitor de tela lê uma frase só.
 */
export function MovementRow({ tx }: { tx: Transaction }) {
  const sent = tx.direction === 'SENT';
  const counterpart = sent ? tx.receiver.name : tx.sender.name;
  const when = formatDateTime(tx.timestamp);
  const spoken = `${sent ? 'Enviado para' : 'Recebido de'} ${counterpart} em ${when}, ${formatBRLFromApi(tx.amount)}`;

  return (
    <li className={styles.row}>
      <span className="sr-only">{spoken}</span>
      <time className={styles.when} dateTime={tx.timestamp} aria-hidden="true">
        {when}
      </time>
      <span className={styles.who} title={counterpart} aria-hidden="true">
        {counterpart}
      </span>
      <Money className={styles.amount} variant="row" value={tx.amount} sign={sent ? '−' : '+'} aria-hidden="true" />
    </li>
  );
}
