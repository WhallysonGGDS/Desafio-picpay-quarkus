import type { HTMLAttributes, ReactNode } from 'react';
import { formatBRL, formatBRLFromApi } from '../lib/money';
import styles from './Money.module.css';

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement> {
  /** `string` é o formato da API ("1250.00"); `bigint` são centavos. */
  value: string | bigint;
  variant?: 'display' | 'row' | 'inline';
  /** Sinal à frente do valor, no mesmo texto ("−R$ 250,00"). O menos é o tipográfico, U+2212, não o hífen. */
  sign?: '+' | '−';
}

// Em mono cada sinal ocupa uma célula inteira, e no tamanho grande a vírgula fica solta ("750 ,00"): cada ponto e vírgula do
// número vai no seu span, que o CSS aproxima dos algarismos. O texto não muda (leitor de tela, cópia e busca leem o mesmo).
function withSeparators(number: string): ReactNode[] {
  return number.split(/([.,])/).map((part, index) =>
    part === '.' || part === ',' ? (
      <span key={index} className={styles.separator} data-separator="">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

// Dinheiro sempre em mono tabular: os algarismos têm a mesma largura e as colunas se alinham.
export function Money({ value, variant = 'inline', sign = undefined, className, ...rest }: MoneyProps) {
  const formatted = typeof value === 'bigint' ? formatBRL(value) : formatBRLFromApi(value);
  const text = `${sign ?? ''}${formatted}`;
  // Saldos muito grandes não cabem no tamanho de exibição: descem uma escala em vez de estourar a coluna.
  const long = variant === 'display' && text.length > 14;
  const classes = [styles.money, styles[variant], long ? styles.long : '', className].filter(Boolean).join(' ');

  // No tamanho de exibição o "R$" desce de escala e fica mais apagado: o número é o que importa. O texto continua
  // contínuo ("R$ 1.000,00"), com o espaço dentro do símbolo, para leitor de tela, cópia e busca.
  const split = variant === 'display' ? /^([+−-]?R\$ )(.+)$/.exec(text) : null;
  return (
    <span {...rest} className={classes}>
      {split ? (
        <>
          <span className={styles.currency}>{split[1]}</span>
          {withSeparators(split[2] ?? '')}
        </>
      ) : (
        text
      )}
    </span>
  );
}
