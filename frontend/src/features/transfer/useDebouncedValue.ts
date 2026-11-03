import { useEffect, useState } from 'react';

/** O valor, mas só depois de `delayMs` sem mudar: cada mudança reinicia a espera, e o primeiro valor vale de imediato. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
