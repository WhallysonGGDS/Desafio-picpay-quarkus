// Dinheiro é string na API ("1250.00") e centavos inteiros (bigint) aqui dentro.
// Nenhuma conta passa por número de ponto flutuante.

const API_AMOUNT = /^(-)?(\d{1,15})(?:\.(\d{1,2}))?$/;
const MAX_WHOLE_DIGITS = 15;

/** "1250.00" → 125000n. Aceita de 0 a 2 casas e um "-" à frente; qualquer outra forma lança. */
export function apiToCents(value: string): bigint {
  const match = API_AMOUNT.exec(value);
  if (!match) {
    throw new Error(`Valor monetário inválido: "${value}"`);
  }
  const [, sign, whole, fraction = ''] = match;
  const cents = BigInt(whole as string) * 100n + BigInt(fraction.padEnd(2, '0'));
  return sign ? -cents : cents;
}

/** 125000n → "1250.00": o formato que a API aceita. */
export function centsToApi(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

/** 125000n → "R$ 1.250,00". O milhar é posto à mão: não depende dos dados de locale do motor. */
export function formatBRL(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = String(abs / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}R$ ${whole},${String(abs % 100n).padStart(2, '0')}`;
}

/** "1234567.89" → "R$ 1.234.567,89", sem passar por número. */
export function formatBRLFromApi(value: string): string {
  return formatBRL(apiToCents(value));
}

// "1.250" → "1250" e "250" → "250". Ponto só como milhar: grupos de 3, e o primeiro sem zero à esquerda.
function wholeFromThousands(text: string): string | null {
  if (/^\d+$/.test(text)) return text;
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(text)) return text.replaceAll('.', '');
  return null;
}

/**
 * Texto digitado em pt-BR → centavos, ou null se for inválido, ambíguo ou menor ou igual a zero.
 *
 * Com vírgula, ela é o decimal (1 ou 2 dígitos) e os pontos são milhar. Sem vírgula, um único ponto seguido de
 * 1 ou 2 dígitos é decimal ("12.5") e pontos seguidos de exatamente 3 dígitos são milhar ("1.000").
 * Na dúvida recusa: "1,234" virar R$ 1,23 ou "0.500" virar R$ 500 seria pior do que pedir para digitar de novo.
 */
export function parseAmountInput(text: string): bigint | null {
  const cleaned = text.replace(/R\$/g, '').replace(/\s/g, '');
  if (!/^[0-9.,]+$/.test(cleaned)) return null;

  const parts = cleaned.split(',');
  if (parts.length > 2) return null;
  const [integerText, decimalText] = parts as [string, string | undefined];

  let whole: string | null;
  let decimals = '';

  if (decimalText !== undefined) {
    if (!/^\d{1,2}$/.test(decimalText)) return null;
    whole = wholeFromThousands(integerText);
    decimals = decimalText;
  } else if (/^\d+\.\d{1,2}$/.test(integerText)) {
    [whole, decimals] = integerText.split('.') as [string, string];
  } else {
    whole = wholeFromThousands(integerText);
  }

  if (whole === null || whole.length > MAX_WHOLE_DIGITS) return null;
  const cents = BigInt(whole) * 100n + BigInt(decimals.padEnd(2, '0'));
  return cents > 0n ? cents : null;
}
