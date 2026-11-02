import { messageFor } from '../../api/errorMessages';
import { Button } from '../../design/Button';
import styles from './ListStates.module.css';

/** Carregando: linhas esqueléticas, sem spinner. O leitor de tela ouve o aviso. */
export function MovementsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className="sr-only">Carregando movimentações…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.skeletonRow} aria-hidden="true" />
      ))}
    </div>
  );
}

export function EmptyMovements() {
  return <p className={styles.empty}>Nenhuma movimentação por aqui.</p>;
}

/** A consulta falhou: diz o motivo (rede e servidor têm textos diferentes) e deixa tentar de novo. */
export function LoadFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className={styles.failure}>
      <p role="alert" className={styles.reason}>
        {messageFor(error)}
      </p>
      <Button variant="quiet" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
