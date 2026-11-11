import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, maskDocumentInput, normalizeDocument } from './document';

// As mesmas fixtures do back-end (DocumentValidatorTest): o front e o servidor precisam concordar sobre o que é válido.
// Os CNPJs alfanuméricos: o primeiro é o exemplo oficial da Receita (IN RFB 2.229/2024), e o resto vem de um cálculo independente,
// feito por fora do código. Cada caractere vale o código ASCII menos 48: "A" vale 17, e não 10 como em base 36.
const ALPHANUMERIC_CNPJS = [
  '12ABC34501DE35',
  'AB1CD2EF3GH490',
  'ZZZZZZZZ000191',
  'A0B1C2D3E4F508',
  '0000000000AA37',
  '98765432ABCD09',
  '1234567890AB04',
];
// Resto 0 e resto 1 do módulo 11 dão dígito 0, no primeiro e no segundo dígito.
const REMAINDER_ZERO_OR_ONE_CNPJS = ['7KWW6EZQZVSF04', '83X6RU9UE7TU08', 'YGZPJZWUPRCI30', 'KT2PKDTR7NWG30'];

describe('normalizeDocument', () => {
  // Quebra se: a pontuação da máscara deixar de sair, ou as letras deixarem de ir para maiúsculas: o servidor grava e compara o texto exato.
  it('tira a pontuação da máscara e põe as letras em maiúsculas', () => {
    expect(normalizeDocument('529.982.247-25')).toBe('52998224725');
    expect(normalizeDocument('11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizeDocument('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(normalizeDocument(' 12 ABC 345 / 01DE - 35\t')).toBe('12ABC34501DE35');
    expect(normalizeDocument('')).toBe('');
  });

  // Quebra se: algum espaço em branco ASCII (tabulação, quebras de linha, tabulação vertical, avanço de página) deixar de sair, ou o intervalo
  // de a até z deixar de ir inteiro para maiúsculas (as bordas "a" e "z"), ou os vizinhos de A, Z, a e z na tabela ASCII virarem letras.
  it('tira todo espaço em branco ASCII e converte de a até z, nem um caractere a mais', () => {
    expect(normalizeDocument('12\n.ABC\r\f\v\t345')).toBe('12ABC345');
    expect(normalizeDocument('az')).toBe('AZ');
    expect(normalizeDocument('AZ')).toBe('AZ');
    expect(normalizeDocument('@[`{')).toBe('@[`{');
  });

  // Quebra se: a conversão passar a ser a "do Unicode": "ß" vira "SS", "ı" (i sem ponto) vira "I", "ſ" (s longo) vira "S" e "ﬁ" vira "FI",
  // e um texto com esses caracteres viraria um documento válido. O servidor só converte de a a z, e o front tem de dizer o mesmo.
  it('só mexe nas letras de a a z: as de outros alfabetos ficam como estão', () => {
    for (const text of ['ß', 'ı', 'ſ', 'ﬁ', 'ÇÃ', '１２']) expect(normalizeDocument(text)).toBe(text);
  });

  // Quebra se: o "\s" do JavaScript (que inclui o espaço sem quebra, comum em texto colado) voltar a ser usado: o servidor só tira o
  // espaço, a tabulação e as quebras de linha, e o front não pode achar válido o que ele recusa.
  it('não tira o espaço sem quebra, como o servidor', () => {
    expect(normalizeDocument('12 ABC')).toBe('12 ABC');
  });
});

describe('isValidCpf', () => {
  // Quebra se: um dígito verificador for calculado errado e um CPF real for recusado.
  it.each(['52998224725', '11144477735'])('aceita %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  // Quebra se: faltar um critério: dígito verificador errado, sequência repetida, tamanho, letra. O CPF nunca tem letras.
  it.each(['52998224724', '11111111111', '123', '', '529982247250', '5299822472a', '5299822472A', 'ABCDEFGHIJK'])('recusa "%s"', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });

  // Estes fecham na conta dos dígitos verificadores do CPF (valor = código menos 48, calculado por fora do código), mas têm letras.
  // Quebra se: o CPF passar a aceitar letras (só o CNPJ pode tê-las): a conferência de "só dígitos" é que os derruba.
  it.each(['ABCDEFGHI45', 'A1234567849', '12345678Z09', 'abcdefghi34'])('recusa "%s", que fecha na conta mas tem letras', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });
});

describe('isValidCnpj', () => {
  it('aceita um CNPJ numérico válido', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });

  // Quebra se: o valor da letra, os pesos ou o módulo mudarem: o exemplo oficial só fecha com "A" = 17.
  it.each(ALPHANUMERIC_CNPJS)('aceita o CNPJ alfanumérico %s', (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(true);
  });

  // Quebra se: a regra "resto menor que 2 vale 0" voltar a valer só para um dos dois dígitos.
  it.each(REMAINDER_ZERO_OR_ONE_CNPJS)('aceita %s (resto 0 ou 1 dá dígito 0)', (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(true);
  });

  // Quebra se: faltar um critério: dígito verificador errado, letra no lugar de um dígito verificador, minúscula (quem chama normaliza
  // antes), tamanho, caractere fora de A-Z e 0-9, e as letras e algarismos de outros alfabetos que parecem os nossos.
  it.each([
    '11222333000182',
    '00000000000000',
    '1122233300018',
    '',
    '12ABC34501DE36',
    '12ABC34501DE53',
    '12ABC34501DEA5',
    '12ABC34501DE3A',
    '12abc34501de35',
    '12ABC34501DE350',
    '12ABC34501DE3',
    '12ABC3450-DE35',
    '12ABÇ34501DE35',
    '１２ABC34501DE35',
    '12ABC34501DE3５',
    '12ABC34501Dß35',
  ])('recusa "%s"', (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(false);
  });

  // Estes fecham na conta dos dígitos verificadores (valor = código menos 48, calculado por fora do código), mas têm um caractere que não
  // pode estar num CNPJ normalizado: minúscula, "Ç" (fecha porque 151 e 19 dão o mesmo resto por 11), algarismos de largura total, "@", "_" e
  // letras gregas. Só a conferência do alfabeto (A-Z maiúsculas e 0-9) os derruba.
  // Quebra se: a conferência do alfabeto sumir, ou virar "é letra" / "é algarismo" do Unicode.
  it.each([
    'abcdefgh000195',
    '12ABÇ34501DE35',
    '１２３４５６７８000195',
    '@@@@@@@@000191',
    'AB______000103',
    'ΑΒΓΔ1234000116',
  ])('recusa "%s", que fecha na conta mas tem caractere fora do alfabeto', (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(false);
  });

  it('um CNPJ não é um CPF, e o contrário também', () => {
    expect(isValidCpf('12ABC34501DE35')).toBe(false);
    expect(isValidCnpj('52998224725')).toBe(false);
  });
});

describe('maskDocumentInput', () => {
  // Quebra se: a máscara pontuar à frente de quem digita (ponto sobrando no fim) ou deixar passar dígito além do limite.
  it('aplica a máscara de CPF aos poucos e limita a 11 dígitos', () => {
    expect(maskDocumentInput('5299', 'COMMON')).toBe('529.9');
    expect(maskDocumentInput('529', 'COMMON')).toBe('529');
    expect(maskDocumentInput('529982247', 'COMMON')).toBe('529.982.247');
    expect(maskDocumentInput('5299822472', 'COMMON')).toBe('529.982.247-2');
    expect(maskDocumentInput('52998224725999', 'COMMON')).toBe('529.982.247-25');
  });

  it('aplica a máscara de CNPJ aos poucos e limita a 14 caracteres', () => {
    expect(maskDocumentInput('112', 'MERCHANT')).toBe('11.2');
    expect(maskDocumentInput('11222333', 'MERCHANT')).toBe('11.222.333');
    expect(maskDocumentInput('112223330001', 'MERCHANT')).toBe('11.222.333/0001');
    expect(maskDocumentInput('11222333000181999', 'MERCHANT')).toBe('11.222.333/0001-81');
  });

  // Quebra se: colar um documento já pontuado, ou com letras, passar a bagunçar o campo; ou as letras do CPF voltarem a ser aceitas.
  it('reaproveita o que já está pontuado e ignora, no CPF, o que não é dígito', () => {
    expect(normalizeDocument('529.982.247-25')).toBe('52998224725');
    expect(maskDocumentInput('529.982.247-25', 'COMMON')).toBe('529.982.247-25');
    expect(maskDocumentInput('a5b2c9', 'COMMON')).toBe('529');
    expect(maskDocumentInput('', 'COMMON')).toBe('');
  });

  // Quebra se: a máscara da loja recusar letras (o CNPJ alfanumérico não poderia ser digitado) ou deixá-las em minúsculas.
  it('o CNPJ aceita letras nas 12 primeiras posições e as põe em maiúsculas', () => {
    expect(maskDocumentInput('ab1', 'MERCHANT')).toBe('AB.1');
    expect(maskDocumentInput('12abc345', 'MERCHANT')).toBe('12.ABC.345');
    expect(maskDocumentInput('12abc34501de', 'MERCHANT')).toBe('12.ABC.345/01DE');
    expect(maskDocumentInput('12abc34501de35', 'MERCHANT')).toBe('12.ABC.345/01DE-35');
    expect(maskDocumentInput('12abc34501de3599', 'MERCHANT')).toBe('12.ABC.345/01DE-35');
    expect(maskDocumentInput('12.abc.345/01de-35', 'MERCHANT')).toBe('12.ABC.345/01DE-35'); // colado já pontuado
  });

  // Quebra se: os dois últimos caracteres (dígitos verificadores) passarem a aceitar letras, ou uma letra ali travar a digitação.
  it('os dois últimos caracteres do CNPJ só aceitam dígitos, e a letra no lugar deles é descartada', () => {
    expect(maskDocumentInput('12abc34501deX3Y5', 'MERCHANT')).toBe('12.ABC.345/01DE-35');
    expect(maskDocumentInput('12abc34501deX', 'MERCHANT')).toBe('12.ABC.345/01DE');
  });

  // Quebra se: letras de outros alfabetos, acentuadas ou convertidas pela maiúscula do Unicode ("ß" vira "SS") entrarem no campo.
  it('descarta tudo que não é A-Z, a-z ou algarismo', () => {
    expect(maskDocumentInput('12ß', 'MERCHANT')).toBe('12');
    expect(maskDocumentInput('1ıÇ2', 'MERCHANT')).toBe('12');
    expect(maskDocumentInput('１２3', 'MERCHANT')).toBe('3');
  });

  // Quebra se: trocar de Loja para Pessoa deixar as letras do CNPJ no campo do CPF.
  it('ao passar para CPF, as letras do CNPJ saem', () => {
    expect(maskDocumentInput('12.ABC.345/01DE-35', 'COMMON')).toBe('123.450.135');
  });
});
