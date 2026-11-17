// CPF (pessoa) e CNPJ (loja): o mesmo critério do back-end (dígito verificador, sem sequência repetida).
//
// O CPF tem 11 dígitos. O CNPJ tem 14 caracteres: desde julho de 2026 a Receita emite CNPJs alfanuméricos (IN RFB 2.229/2024), com
// algarismos e letras de A a Z nas 12 primeiras posições e dois dígitos verificadores, sempre numéricos. O cálculo é o módulo 11 de sempre
// e cada caractere vale o seu código ASCII menos 48 ("0" a "9" valem 0 a 9 e "A" vale 17), então os CNPJs numéricos que já existem
// continuam valendo, sem tratamento à parte.

export type DocumentKind = 'COMMON' | 'MERCHANT';

const isDigit = (char: string) => char >= '0' && char <= '9';
const isUpperAsciiLetter = (char: string) => char >= 'A' && char <= 'Z';

interface DocumentRules {
  /** `#` é um caractere do documento; o resto é a pontuação da máscara. */
  pattern: string;
  /** O que a posição `position` (contada só nos caracteres do documento) aceita. Letras já chegam em maiúsculas. */
  accepts: (char: string, position: number) => boolean;
}

const RULES: Record<DocumentKind, DocumentRules> = {
  COMMON: { pattern: '###.###.###-##', accepts: isDigit },
  // As 12 primeiras posições aceitam algarismo ou letra; os dois dígitos verificadores, só algarismo.
  MERCHANT: {
    pattern: '##.###.###/####-##',
    accepts: (char, position) => (position < 12 ? isDigit(char) || isUpperAsciiLetter(char) : isDigit(char)),
  },
};

const CPF_WEIGHTS = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CPF_SHAPE = /^\d{11}$/;
const CNPJ_SHAPE = /^[0-9A-Z]{12}\d{2}$/;

// A pontuação da máscara: ponto, traço, barra, espaço, tabulação e quebras de linha. É o "\s" do servidor (só ASCII); o "\s" do
// JavaScript também tiraria o espaço sem quebra e outros, e o front acharia válido o que o servidor recusa.
const MASK_PUNCTUATION = /[.\-/\t-\r ]/g;

// Maiúsculas só de a a z. O toUpperCase() do JavaScript é o do Unicode: "ß" vira "SS", "ı" (i sem ponto) vira "I" e "ſ" (s longo) vira "S",
// e um texto com esses caracteres viraria um documento válido. O servidor também converte só de a a z.
const upperAscii = (text: string) => text.replace(/[a-z]/g, (letter) => letter.toUpperCase());

/** A forma em que o servidor grava e compara o documento: sem a pontuação da máscara e com as letras em maiúsculas. */
export function normalizeDocument(text: string): string {
  return upperAscii(text.replace(MASK_PUNCTUATION, ''));
}

// Dígito verificador: soma ponderada módulo 11 (resto menor que 2 vale 0).
function verifier(values: number[], weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + (values[index] as number) * weight, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

// `document` já normalizado. O valor de cada caractere é o código ASCII menos 48; para um algarismo, o próprio algarismo.
function isValid(document: string, shape: RegExp, weights: number[]): boolean {
  if (!shape.test(document) || /^(.)\1+$/.test(document)) return false;
  const values = [...document].map((char) => char.charCodeAt(0) - 48);
  const first = verifier(values, weights);
  const second = verifier(values, [(weights[0] as number) + 1, ...weights]);
  return first === values[document.length - 2] && second === values[document.length - 1];
}

export function isValidCpf(document: string): boolean {
  return isValid(document, CPF_SHAPE, CPF_WEIGHTS);
}

export function isValidCnpj(document: string): boolean {
  return isValid(document, CNPJ_SHAPE, CNPJ_WEIGHTS);
}

/**
 * Máscara progressiva: pontua só até onde há caracteres (sem ponto sobrando no fim) e corta no limite do tipo. O CPF só aceita
 * dígitos; o CNPJ aceita letras (em maiúsculas) nas 12 primeiras posições. O que a posição não aceita é descartado, sem travar a digitação.
 */
export function maskDocumentInput(text: string, type: DocumentKind): string {
  const { pattern, accepts } = RULES[type];
  const length = [...pattern].filter((char) => char === '#').length;
  let kept = '';
  for (const char of upperAscii(text)) {
    if (kept.length === length) break;
    if (accepts(char, kept.length)) kept += char;
  }
  let masked = '';
  let next = 0;
  for (const char of pattern) {
    if (next >= kept.length) break;
    masked += char === '#' ? kept[next++] : char;
  }
  return masked;
}
