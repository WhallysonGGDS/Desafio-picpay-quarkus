import type { ReactNode } from 'react';
import type { Transaction } from '../../api/types';
import { Money } from '../../design/Money';
import { MovementList, MovementRow } from '../statement/MovementRow';
import styles from './WalletBalance.module.css';

export interface WalletBalanceProps {
  name: string;
  /** O saldo, no formato da API ("1000.00"). */
  balance: string;
  movements: Transaction[];
  /** Sob o saldo (a ação principal da carteira). */
  actions?: ReactNode;
  /** Na coluna das movimentações, depois das linhas: estados de carregando, vazio e erro, e o link do extrato. */
  children?: ReactNode;
}

// O saldo grande e as últimas movimentações. Só apresentação: a página decide o que vai em `actions` e `children`,
// e a vitrine usa o componente puro, com dados de demonstração.
export function WalletBalance({ name, balance, movements, actions, children }: WalletBalanceProps) {
  return (
    <section className={styles.wallet} aria-label={`Carteira de ${name}`}>
      <div className={styles.balance}>
        <p className={styles.label}>Saldo</p>
        <Money value={balance} variant="display" data-testid="wallet-balance" />
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <div className={styles.movements}>
        {movements.length > 0 && (
          <MovementList label="Últimas movimentações">
            {movements.map((tx) => (
              <MovementRow key={tx.id} tx={tx} />
            ))}
          </MovementList>
        )}
        {children}
      </div>
    </section>
  );
}
