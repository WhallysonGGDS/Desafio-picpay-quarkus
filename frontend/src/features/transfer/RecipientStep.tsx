import { useQuery } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import type { ApiError } from '../../api/ApiError';
import { api } from '../../api/client';
import { messageFor } from '../../api/errorMessages';
import type { UserSummary } from '../../api/types';
import { Button } from '../../design/Button';
import { Field } from '../../design/Field';
import styles from './RecipientStep.module.css';
import shared from './steps.module.css';
import { useDebouncedValue } from './useDebouncedValue';

// Dois limites que o servidor também impõe (QUERY_TOO_SHORT): 3 caracteres, e uma pausa na digitação antes de buscar.
const MIN_CHARS = 3;
const PAUSE_MS = 350;

export interface RecipientStepProps {
  /** O que está digitado. Mora na página: voltar a este passo devolve a busca como estava. */
  term: string;
  onTermChange: (text: string) => void;
  /** O destinatário já escolhido, quando se volta a este passo. */
  selected: UserSummary | null;
  onSelect: (recipient: UserSummary) => void;
  /** Seguir com o destinatário já escolhido, sem buscar de novo. */
  onContinue: () => void;
  /** Por que o envio foi recusado (destinatário inexistente, a si mesmo...): fica sob o campo até a próxima digitação. */
  message?: string;
}

const fullName = (person: UserSummary) => `${person.firstName} ${person.lastName}`;
const kindOf = (person: UserSummary) => (person.userType === 'MERCHANT' ? 'Loja' : 'Pessoa');

export function RecipientStep({ term, onTermChange, selected, onSelect, onContinue, message }: RecipientStepProps) {
  const trimmed = term.trim();
  const debounced = useDebouncedValue(trimmed, PAUSE_MS);
  // A busca só vale quando o que está digitado já é o que passou pela pausa: antes disso o resultado seria de um
  // pedaço do termo, e escolher nele seria escolher às cegas.
  const settled = trimmed.length >= MIN_CHARS && trimmed === debounced;

  const search = useQuery<UserSummary[], ApiError>({
    queryKey: ['recipients', debounced],
    queryFn: () => api.searchUsers(debounced),
    enabled: settled,
    // Quem decide tentar de novo é a pessoa: digitar mais uma letra faz outra busca.
    retry: false,
  });

  const failure = settled && search.isError ? search.error : null;
  const results = settled && !search.isError ? search.data : undefined;
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_CHARS;
  const busy = trimmed.length >= MIN_CHARS && !failure && results === undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    // Enter: com um único resultado, é esse; senão, segue com quem já estava escolhido.
    if (results?.length === 1 && results[0]) return onSelect(results[0]);
    if (selected) onContinue();
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Field
        label="E-mail ou CPF/CNPJ"
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        value={term}
        error={failure ? messageFor(failure) : message}
        onChange={(event) => onTermChange(event.target.value)}
      />
      <div className={styles.results} aria-busy={busy || undefined}>
        <div role="status" className={styles.status}>
          {tooShort && 'Digite ao menos 3 caracteres.'}
          {results?.length === 0 && 'Ninguém encontrado com esse e-mail ou documento.'}
          {results && results.length > 0 && (
            <span className="sr-only">
              {results.length === 1 ? '1 resultado encontrado.' : `${results.length} resultados encontrados.`}
            </span>
          )}
          {busy && <span className="sr-only">Buscando…</span>}
        </div>
        {busy && <div className={styles.skeleton} aria-hidden="true" />}
        {results && results.length > 0 && (
          <ul className={styles.list} aria-label="Resultados da busca">
            {results.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className={styles.row}
                  aria-current={selected?.id === person.id ? 'true' : undefined}
                  aria-label={`${fullName(person)}, ${kindOf(person)}, documento ${person.maskedDocument}`}
                  onClick={() => onSelect(person)}
                >
                  <span className={styles.name}>{fullName(person)}</span>
                  <span className={styles.kind}>{kindOf(person)}</span>
                  <span className={styles.doc}>{person.maskedDocument}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && (
        <div className={shared.actions}>
          <Button type="submit" arrow>
            Seguir com {selected.firstName}
          </Button>
        </div>
      )}
    </form>
  );
}
