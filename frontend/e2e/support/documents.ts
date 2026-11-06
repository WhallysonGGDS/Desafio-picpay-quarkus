// CPF e CNPJ válidos e únicos para as contas que os testes ponta a ponta criam. O back-end só aceita documentos
// válidos (dígitos verificadores) e recusa repetidos: para sementes menores que 100 milhões, sementes diferentes dão
// sempre documentos diferentes (os oito dígitos da semente decidem o resto).

const toDigits = (value: number, length: number): number[] =>
  String(value % 10 ** length)
    .padStart(length, '0')
    .split('')
    .map(Number);

// O dígito verificador do CPF e do CNPJ: soma ponderada, resto por 11; resto menor que 2 vira 0.
function checkDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce((total, digit, index) => total + digit * (weights[index] as number), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * CPF válido (11 dígitos) da semente. O 9º dígito difere do 1º, então os nove nunca são todos iguais ("111.111.111-11"
 * é inválido) sem que duas sementes caiam na mesma base.
 */
export function cpfFrom(seed: number): string {
  const head = toDigits(seed, 8);
  const base = [...head, ((head[0] as number) + 1) % 10];
  const first = checkDigit(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit([...base, first], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, first, second].join('');
}

/** CNPJ válido (14 dígitos, filial 0001, que já impede a sequência repetida) da semente. */
export function cnpjFrom(seed: number): string {
  const base = [...toDigits(seed, 8), 0, 0, 0, 1];
  const first = checkDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit([...base, first], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, first, second].join('');
}
