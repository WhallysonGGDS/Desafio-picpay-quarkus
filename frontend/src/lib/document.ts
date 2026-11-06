// CPF (pessoa) e CNPJ (loja): o mesmo critério do back-end (dígito verificador, sem sequência repetida).

export type DocumentKind = 'COMMON' | 'MERCHANT';

const MASKS: Record<DocumentKind, { pattern: string; length: number }> = {
  COMMON: { pattern: '###.###.###-##', length: 11 },
  MERCHANT: { pattern: '##.###.###/####-##', length: 14 },
};

const CPF_WEIGHTS = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

// Dígito verificador: soma ponderada módulo 11 (resto menor que 2 vale 0).
function verifier(digits: number[], weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + (digits[index] as number) * weight, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValid(digits: string, length: number, weights: number[]): boolean {
  if (digits.length !== length || !/^\d+$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  const numbers = [...digits].map(Number);
  const first = verifier(numbers, weights);
  const second = verifier(numbers, [weights[0] as number + 1, ...weights]);
  return first === numbers[length - 2] && second === numbers[length - 1];
}

export function isValidCpf(digits: string): boolean {
  return isValid(digits, 11, CPF_WEIGHTS);
}

export function isValidCnpj(digits: string): boolean {
  return isValid(digits, 14, CNPJ_WEIGHTS);
}

/** Máscara progressiva: pontua só até onde há dígitos (sem ponto sobrando no fim) e corta no limite do tipo. */
export function maskDocumentInput(text: string, type: DocumentKind): string {
  const { pattern, length } = MASKS[type];
  const digits = digitsOnly(text).slice(0, length);
  let masked = '';
  let next = 0;
  for (const char of pattern) {
    if (next >= digits.length) break;
    masked += char === '#' ? digits[next++] : char;
  }
  return masked;
}
