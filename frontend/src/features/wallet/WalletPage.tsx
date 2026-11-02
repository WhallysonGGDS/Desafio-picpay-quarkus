import { useSession } from '../../app/session';
import { ButtonLink } from '../../design/Button';
import { ROUTES } from '../../routes';
import { EmptyMovements, LoadFailure, MovementsSkeleton } from '../statement/ListStates';
import { useStatement } from '../statement/useStatement';
import { WalletBalance } from './WalletBalance';
import styles from './WalletPage.module.css';

// O saldo é o dado principal: vem da sessão e aparece de imediato. As movimentações chegam depois, e a falha delas
// (rede ou servidor) não derruba a carteira: o saldo continua na tela, com o motivo e a chance de tentar de novo.
export function WalletPage() {
  const { user } = useSession();
  const statement = useStatement('all', 5);
  if (!user) return null;

  const merchant = user.userType === 'MERCHANT';
  const empty = !statement.isLoading && !statement.error && statement.items.length === 0;

  return (
    <>
      <h1 className="sr-only">Carteira</h1>
      <WalletBalance
        name={`${user.firstName} ${user.lastName}`}
        balance={user.balance}
        movements={statement.items}
        actions={
          merchant ? (
            <p className={styles.note}>Lojas recebem transferências.</p>
          ) : (
            <ButtonLink to={ROUTES.transfer} arrow>
              Enviar dinheiro
            </ButtonLink>
          )
        }
      >
        {statement.isLoading && <MovementsSkeleton rows={3} />}
        {statement.error && <LoadFailure error={statement.error} onRetry={statement.retry} />}
        {empty && <EmptyMovements />}
        <ButtonLink to={ROUTES.statement} variant="quiet" className={styles.statement}>
          Ver extrato
        </ButtonLink>
      </WalletBalance>
    </>
  );
}
