import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { messageFor } from '../../api/errorMessages';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { Button } from '../../design/Button';
import { EmptyMovements, LoadFailure, MovementsSkeleton } from './ListStates';
import { MovementList, MovementRow } from './MovementRow';
import styles from './StatementPage.module.css';
import { useStatement, type StatementDirection } from './useStatement';

const TABS: { direction: StatementDirection; label: string }[] = [
  { direction: 'all', label: 'Tudo' },
  { direction: 'sent', label: 'Enviadas' },
  { direction: 'received', label: 'Recebidas' },
];

export function StatementPage() {
  useDocumentTitle('Extrato');
  const [direction, setDirection] = useState<StatementDirection>('all');
  const statement = useStatement(direction);
  const tabs = useRef<Partial<Record<StatementDirection, HTMLButtonElement | null>>>({});
  const id = useId();
  const tabId = (value: StatementDirection) => `${id}-tab-${value}`;
  const panelId = `${id}-panel`;
  const selected = TABS.find((tab) => tab.direction === direction) ?? TABS[0]!;

  function select(value: StatementDirection) {
    setDirection(value);
    tabs.current[value]?.focus();
  }

  // Padrão ARIA de abas, com ativação automática: as setas trocam de aba (dando a volta nas pontas), Home e End vão às pontas.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Alt+seta (voltar), Ctrl+seta e afins são do navegador ou do sistema: não são da aba.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = TABS.findIndex((tab) => tab.direction === direction);
    const last = TABS.length - 1;
    const target =
      event.key === 'ArrowRight' ? (index + 1) % TABS.length
      : event.key === 'ArrowLeft' ? (index - 1 + TABS.length) % TABS.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    select((TABS[target] as (typeof TABS)[number]).direction);
  }

  const { items, total, isLoading, error } = statement;
  const empty = !isLoading && !error && items.length === 0;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Extrato</h1>
      <div role="tablist" aria-label="Tipo de movimentação" className={styles.tabs} onKeyDown={onKeyDown}>
        {TABS.map((tab) => (
          <button
            key={tab.direction}
            ref={(element) => {
              tabs.current[tab.direction] = element;
            }}
            type="button"
            role="tab"
            id={tabId(tab.direction)}
            aria-selected={tab.direction === direction}
            aria-controls={panelId}
            tabIndex={tab.direction === direction ? 0 : -1}
            className={styles.tab}
            onClick={() => select(tab.direction)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={tabId(selected.direction)} aria-busy={isLoading || undefined}>
        {isLoading && <MovementsSkeleton rows={5} />}
        {error && <LoadFailure error={error} onRetry={statement.retry} />}
        {empty && <EmptyMovements />}
        {items.length > 0 && (
          <>
            <p className={styles.count}>{`${total} ${total === 1 ? 'movimentação' : 'movimentações'}`}</p>
            <MovementList label={selected.label}>
              {items.map((tx) => (
                <MovementRow key={tx.id} tx={tx} />
              ))}
            </MovementList>
            {statement.loadMoreError && (
              <p role="alert" className={styles.moreError}>
                {messageFor(statement.loadMoreError)}
              </p>
            )}
            {statement.hasMore && (
              <div className={styles.more}>
                <Button variant="quiet" loading={statement.isLoadingMore} onClick={statement.loadMore}>
                  {statement.isLoadingMore ? 'Carregando…' : 'Carregar mais'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
