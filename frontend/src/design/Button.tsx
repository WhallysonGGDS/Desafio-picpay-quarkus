import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import styles from './Button.module.css';

type Variant = 'primary' | 'quiet';

interface Look {
  /** `primary`: texto com borda de 1 px que acende em acento. `quiet`: só texto, com um traço no hover. */
  variant?: Variant;
  /** Acrescenta a seta desenhada (aria-hidden). Reserve para a ação principal da tela. */
  arrow?: boolean;
}

export type ButtonProps = Look & {
  /** Desabilita o botão e o marca como ocupado. O rótulo do estado (por exemplo "Entrando…") é de quem usa. */
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export type ButtonLinkProps = Look & Omit<LinkProps, 'className'> & { className?: string };

function classes(variant: Variant, extra?: string): string {
  return [styles.button, styles[variant], extra].filter(Boolean).join(' ');
}

// A seta é um traço, não um glifo: a haste cresce no hover, só com transform.
function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 28 8" aria-hidden="true" focusable="false">
      <path className={styles.shaft} d="M0 4H26" />
      <path className={styles.head} d="M22 1l4 3-4 3" />
    </svg>
  );
}

function Content({ arrow, children }: { arrow: boolean; children: ReactNode }) {
  return (
    <>
      {children}
      {arrow && <Arrow />}
    </>
  );
}

export function Button({
  variant = 'primary',
  arrow = false,
  loading = false,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={classes(variant, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      <Content arrow={arrow}>{children}</Content>
    </button>
  );
}

export function ButtonLink({ variant = 'primary', arrow = false, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link {...rest} className={classes(variant, className)}>
      <Content arrow={arrow}>{children}</Content>
    </Link>
  );
}
