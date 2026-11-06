import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  // Quebra se: o padrão voltar a ser type="submit" do HTML: qualquer botão dentro de um formulário o enviaria sem querer.
  it('não envia o formulário por padrão, só com type="submit"', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Voltar</Button>
        <Button type="submit">Enviar</Button>
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // Quebra se: o clique normal deixar de chegar ao onClick (por exemplo, botão sempre desabilitado).
  it('dispara onClick e não se declara ocupado quando está livre', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Entrar</Button>);

    const button = screen.getByRole('button', { name: 'Entrar' });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy');
  });

  // Quebra se: loading deixar de desabilitar. Um duplo clique no envio de dinheiro mandaria a transferência duas vezes.
  it('em loading fica desabilitado, aria-busy=true e não dispara onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Autorizando…
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Autorizando…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  // Quebra se: a seta entrar no nome acessível (o leitor de tela leria "seta") ou aparecer sem o arrow.
  it('com arrow acrescenta a seta aria-hidden, sem mudar o nome do botão', () => {
    const { rerender } = render(<Button arrow>Abrir minha carteira</Button>);

    const button = screen.getByRole('button', { name: 'Abrir minha carteira' });
    const arrow = button.querySelector('svg');
    expect(arrow).not.toBeNull();
    expect(arrow).toHaveAttribute('aria-hidden', 'true');

    rerender(<Button>Abrir minha carteira</Button>);
    expect(screen.getByRole('button', { name: 'Abrir minha carteira' }).querySelector('svg')).toBeNull();
  });
});
