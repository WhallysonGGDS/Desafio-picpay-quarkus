import type { Transaction } from '../../api/types';
import { MovementList, MovementRow } from '../../features/statement/MovementRow';
import { WalletBalance } from '../../features/wallet/WalletBalance';
import { centsToApi } from '../../lib/money';
import { COPY } from '../copy';
import { interpolateCents, windowed } from '../motion';
import { Scene, useSceneProgress } from '../Scene';
import { ScrollArc } from '../ScrollArc';
import styles from './Proposal.module.css';

// A demonstração: R$ 1.000,00, dos quais R$ 250,00 vão de Marina para Rafael. Dados fixos; o saldo cai enquanto a luz percorre
// o final do arco (de 55% a 90% do scroll da cena), e a linha do crédito entra quando ela chega (a 90%).
const BEFORE = 100000n;
const AFTER = 75000n;
const DEBIT_FROM = 0.55;
const CREDIT_AT = 0.9;

const TRANSFER: Transaction = {
  id: 1,
  amount: '250.00',
  sender: { id: 1, name: COPY.proposal.owner.name },
  receiver: { id: 2, name: COPY.proposal.receiver.name },
  notifySender: 'SENT',
  notifyReceiver: 'SENT',
  timestamp: '2026-11-01T15:58:00Z',
  direction: 'SENT',
};

/**
 * A carteira real (o mesmo componente do app), com dados fixos. O saldo é texto, então não dá para desenhá-lo só com CSS:
 * ele acompanha o progresso da cena, em centavos inteiros (bigint).
 */
function Demonstration() {
  const progress = useSceneProgress();
  const cents = interpolateCents(BEFORE, AFTER, windowed(progress, DEBIT_FROM, CREDIT_AT));
  const credited = progress >= CREDIT_AT;

  return (
    <div className={styles.wallet} aria-hidden="true">
      <WalletBalance name={COPY.proposal.owner.name} balance={centsToApi(cents)} movements={[]}>
        <div className={styles.entry} data-credited={credited}>
          <MovementList label={COPY.proposal.movements}>
            <MovementRow tx={TRANSFER} />
          </MovementList>
        </div>
      </WalletBalance>
    </div>
  );
}

/** 03 Proposta (fixa): a carteira real, e o arco leva a luz de Marina a Rafael enquanto o saldo cai. */
export function Proposal() {
  return (
    <Scene id={3} pinned className={styles.proposal}>
      <h2 className={styles.title}>{COPY.proposal.title}</h2>
      <div className={styles.stage}>
        <div className={styles.flow}>
          <ScrollArc orientation="horizontal" ends={[COPY.proposal.owner.first, COPY.proposal.receiver.first]} />
        </div>
        <Demonstration />
      </div>
    </Scene>
  );
}
