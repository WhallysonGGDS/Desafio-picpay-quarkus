import { useId, type InputHTMLAttributes, type Ref } from 'react';
import styles from './Field.module.css';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Orientação que fica sempre visível sob o campo. */
  hint?: string;
  /** Mensagem de erro: anunciada, ligada ao campo e marcada com aria-invalid. */
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Field({ label, hint, error, id, className, ref, ...rest }: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [rest['aria-describedby'], hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          {...rest}
          ref={ref}
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        <span className={styles.rule} aria-hidden="true" />
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
