import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('useDebouncedValue', () => {
  // Quebra se: o primeiro valor esperar o atraso (a busca de um campo já preenchido demoraria à toa para começar).
  it('começa no valor inicial, sem esperar', () => {
    const { result } = renderHook(() => useDebouncedValue('abc', 350));

    expect(result.current).toBe('abc');
  });

  // Quebra se: o novo valor passar antes do atraso, ou depois dele. O corte é exato: 349 ms ainda é o antigo.
  it('só adota o novo valor quando o atraso inteiro passa', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: 'abc' },
    });

    rerender({ value: 'abcd' });
    wait(349);
    expect(result.current).toBe('abc');

    wait(1);
    expect(result.current).toBe('abcd');
  });

  // Quebra se: cada tecla não reiniciar a espera: a busca sairia no meio da digitação, com um pedaço do que se digitava.
  it('cada mudança reinicia a espera, e só o último valor passa', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: 'raf' },
    });

    rerender({ value: 'rafa' });
    wait(300);
    rerender({ value: 'rafae' });
    wait(300);
    // 600 ms desde a primeira mudança, mas só 300 desde a última
    expect(result.current).toBe('raf');

    wait(50);
    expect(result.current).toBe('rafae');
  });

  // Quebra se: o atraso informado for ignorado (valor fixo no código).
  it('respeita o atraso informado', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    wait(100);

    expect(result.current).toBe('b');
  });

  // Quebra se: o temporizador sobreviver à desmontagem (atualizaria estado de quem já saiu da tela).
  it('limpa o temporizador ao desmontar', () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: 'abc' },
    });
    rerender({ value: 'abcd' });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
