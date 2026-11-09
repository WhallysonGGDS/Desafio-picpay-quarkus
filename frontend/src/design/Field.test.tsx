import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';

describe('Field', () => {
  // Quebra se: o label deixar de apontar para o input, ou dois campos na mesma tela dividirem o mesmo id.
  it('liga cada label ao seu input', () => {
    render(
      <>
        <Field label="E-mail" />
        <Field label="Senha" />
      </>,
    );

    const email = screen.getByLabelText('E-mail');
    const password = screen.getByLabelText('Senha');
    expect(email).toBeInstanceOf(HTMLInputElement);
    expect(password).toBeInstanceOf(HTMLInputElement);
    expect(email).not.toBe(password);
  });

  // Quebra se: os atributos nativos (type, autoComplete, inputMode) ou o ref deixarem de chegar ao input.
  it('repassa atributos e ref ao input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Field label="Senha" type="password" autoComplete="current-password" inputMode="text" ref={ref} />);

    const input = screen.getByLabelText('Senha');
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'current-password');
  });

  // Quebra se: o erro aparecer só visualmente. Quem usa leitor de tela precisa ouvi-lo e saber qual campo é.
  it('anuncia o erro (role=alert), descreve o input por ele e marca aria-invalid', () => {
    render(<Field label="E-mail" error="E-mail inválido." />);

    const input = screen.getByLabelText('E-mail');
    expect(screen.getByRole('alert')).toHaveTextContent('E-mail inválido.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('E-mail inválido.');
  });

  // Quebra se: o estado de erro vazar para um campo sem erro (alerta fantasma, aria-invalid sempre ligado).
  it('sem erro não tem alerta nem aria-invalid; a dica descreve o input', () => {
    render(<Field label="Senha" hint="De 8 a 72 caracteres." />);

    const input = screen.getByLabelText('Senha');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAccessibleDescription('De 8 a 72 caracteres.');
  });

  // Quebra se: com dica e erro ao mesmo tempo, um dos dois deixar de descrever o input.
  it('dica e erro descrevem o input juntos', () => {
    render(<Field label="Senha" hint="De 8 a 72 caracteres." error="A senha é curta." />);

    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription('De 8 a 72 caracteres. A senha é curta.');
  });
});
