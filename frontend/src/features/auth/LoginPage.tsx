import { useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { messageFor } from '../../api/errorMessages';
import { Button, ButtonLink } from '../../design/Button';
import { Field } from '../../design/Field';
import { useDocumentTitle } from '../../app/useDocumentTitle';
import { useLogin } from '../../app/session';
import { ROUTES } from '../../routes';
import styles from './auth.module.css';
import { messagesOf, validateLogin, type LoginField } from './validation';

// Depois de entrar, quem leva a pessoa ao destino (?next=, só se for interno) é a guarda RedirectIfSignedIn:
// a sessão gravada pelo login a dispara.
export function LoginPage() {
  useDocumentTitle('Entrar na carteira');
  const [params] = useSearchParams();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<LoginField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  // Guarda síncrona contra envio duplo: o isPending do TanStack só chega depois do próximo ciclo.
  const sending = useRef(false);

  const next = params.get('next');
  const registerTo = `${ROUTES.register}${next ? `?next=${encodeURIComponent(next)}` : ''}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;

    const found = validateLogin(email, password);
    setErrors(messagesOf(found));
    setFormError(null);
    if (found.email) return emailInput.current?.focus();
    if (found.password) return passwordInput.current?.focus();

    sending.current = true;
    login.mutate(
      { email: email.trim(), password },
      {
        onError: (error) => {
          setFormError(messageFor(error));
          if (error.code === 'INVALID_CREDENTIALS') {
            setPassword('');
            passwordInput.current?.focus();
          }
        },
        onSettled: () => {
          sending.current = false;
        },
      },
    );
  }

  return (
    <>
      <h1 className={styles.title}>Entrar na carteira</h1>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field
          ref={emailInput}
          label="E-mail"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
        />
        <Field
          ref={passwordInput}
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
        />
        {formError && (
          <p role="alert" className={styles.alert}>
            {formError}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" arrow loading={login.isPending}>
            {login.isPending ? 'Entrando…' : 'Entrar na carteira'}
          </Button>
        </div>
      </form>
      <div className={styles.switch}>
        <ButtonLink to={registerTo} variant="quiet">
          Criar minha carteira
        </ButtonLink>
      </div>
    </>
  );
}
