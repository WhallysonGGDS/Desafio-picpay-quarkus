package dev.whallyson.validation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentValidatorTest {

    // Quebra se: a pontuação da máscara deixar de sair, ou as letras deixarem de ir para maiúsculas. O cadastro grava e a busca
    // compara o texto exato, então "12.abc.345/01de-35" e "12ABC34501DE35" precisam virar a mesma coisa.
    @Test
    void normalize_stripsMaskPunctuation_upperCasesAsciiLetters_andHandlesNull() {
        assertEquals("52998224725", DocumentValidator.normalize("529.982.247-25"));
        assertEquals("11222333000181", DocumentValidator.normalize("11.222.333/0001-81"));
        assertEquals("12ABC34501DE35", DocumentValidator.normalize("12.abc.345/01de-35"));
        assertEquals("12ABC34501DE35", DocumentValidator.normalize(" 12 ABC 345 / 01DE - 35\t"));
        assertEquals("", DocumentValidator.normalize(null));
    }

    // Quebra se: algum espaço em branco do "\s" (tabulação, quebras de linha, tabulação vertical, avanço de página) deixar de sair, ou o
    // intervalo de a até z deixar de ir inteiro para maiúsculas (as bordas "a" e "z").
    @Test
    void normalize_stripsEveryAsciiWhitespace_andUpperCasesFromAToZ() {
        assertEquals("12ABC345", DocumentValidator.normalize("12\n.ABC\r\f\u000b\t345"));
        assertEquals("AZ", DocumentValidator.normalize("az"));
        assertEquals("AZ", DocumentValidator.normalize("AZ"));
        assertEquals("@[`{", DocumentValidator.normalize("@[`{")); // vizinhos de A, Z, a e z na tabela ASCII: não são letras
    }

    // Quebra se: a conversão para maiúsculas passar a ser a "do Unicode". Nela "ß" vira "SS", "ı" (i sem ponto) vira "I" e "ﬁ" (ligadura)
    // vira "FI": um texto com esses caracteres viraria um documento ASCII válido, e dois textos diferentes seriam o mesmo documento.
    @Test
    void normalize_leavesNonAsciiCharactersAlone() {
        assertEquals("ß", DocumentValidator.normalize("ß")); // ß
        assertEquals("ı", DocumentValidator.normalize("ı")); // ı
        assertEquals("ﬁ", DocumentValidator.normalize("ﬁ")); // ﬁ
        assertEquals("１２", DocumentValidator.normalize("１２")); // 1 e 2 de largura total
    }

    @ParameterizedTest
    @ValueSource(strings = {"52998224725", "11144477735"})
    void validCpf(String cpf) {
        assertTrue(DocumentValidator.isValidCpf(cpf));
    }

    // "11111111111" passa na conta dos dígitos verificadores; só a regra de dígitos repetidos o rejeita.
    // Quebra se: o CPF passar a aceitar letras (só o CNPJ pode tê-las).
    @ParameterizedTest
    @ValueSource(strings = {"52998224724", "11111111111", "123", "", "529982247250", "5299822472a", "5299822472A", "abcdefghijk", "ABCDEFGHIJK"})
    void invalidCpf(String cpf) {
        assertFalse(DocumentValidator.isValidCpf(cpf));
    }

    // Estes fecham na conta dos dígitos verificadores do CPF (valor = código menos 48, calculado por fora do código), mas têm letras.
    // Quebra se: o CPF passar a aceitar letras (só o CNPJ pode tê-las): a conferência de "só dígitos" é que os derruba.
    @ParameterizedTest
    @ValueSource(strings = {"ABCDEFGHI45", "A1234567849", "12345678Z09", "abcdefghi34"})
    void invalidCpf_whenOnlyTheAlphabetGivesItAway(String cpf) {
        assertFalse(DocumentValidator.isValidCpf(cpf));
    }

    // O primeiro é o CNPJ numérico de sempre. O segundo é o exemplo oficial da Receita (IN RFB 2.229/2024), e os outros vêm de um cálculo
    // independente, feito por fora do código. Cada caractere vale o código ASCII menos 48 ("A" vale 17, não 10 como em base 36).
    // Quebra se: o valor da letra, os pesos ou o módulo mudarem: o exemplo oficial só fecha com "A" = 17.
    @ParameterizedTest
    @ValueSource(strings = {
        "11222333000181",
        "12ABC34501DE35",
        "AB1CD2EF3GH490",
        "ZZZZZZZZ000191",
        "A0B1C2D3E4F508",
        "0000000000AA37",
        "98765432ABCD09",
        "1234567890AB04"})
    void validCnpj(String cnpj) {
        assertTrue(DocumentValidator.isValidCnpj(cnpj));
    }

    // Resto 0 e resto 1 do módulo 11 dão dígito 0 (e não 11 nem 10), no primeiro e no segundo dígito.
    // Quebra se: a regra "resto menor que 2 vale 0" voltar a valer só para um dos dois dígitos.
    @ParameterizedTest
    @ValueSource(strings = {"7KWW6EZQZVSF04", "83X6RU9UE7TU08", "YGZPJZWUPRCI30", "KT2PKDTR7NWG30"})
    void validCnpj_whenTheRemainderIsZeroOrOne(String cnpj) {
        assertTrue(DocumentValidator.isValidCnpj(cnpj));
    }

    // "00000000000000" também passa na conta dos dígitos verificadores.
    // Quebra se: faltar um critério: dígito verificador errado, letra no lugar de um dígito verificador, minúscula (quem chama normaliza
    // antes), tamanho, caractere fora de A-Z e 0-9, e as letras e algarismos de outros alfabetos que parecem os nossos.
    @ParameterizedTest
    @ValueSource(strings = {
        "11222333000182", "00000000000000", "1122233300018", "", "1122233300018a",
        "12ABC34501DE36",
        "12ABC34501DE53",
        "12ABC34501DEA5",
        "12ABC34501DE3A",
        "12abc34501de35",
        "12ABC34501DE350",
        "12ABC34501DE3",
        "12ABC3450-DE35",
        "12ABÇ34501DE35",
        "１２ABC34501DE35",
        "12ABC34501DE3５",
        "12ABC34501Dß35"})
    void invalidCnpj(String cnpj) {
        assertFalse(DocumentValidator.isValidCnpj(cnpj));
    }

    // Estes fecham na conta dos dígitos verificadores (valor = código menos 48, calculado por fora do código), mas têm um caractere que não
    // pode estar num CNPJ normalizado: letra minúscula, "Ç" (o "12ABÇ..." fecha porque 151 e 19 dão o mesmo resto por 11), algarismos
    // de largura total, "@", "_" e letras gregas. Só a conferência do alfabeto (A-Z maiúsculas e 0-9) os derruba.
    // Quebra se: a conferência do alfabeto sumir, ou virar "é letra" / "é algarismo" do Unicode.
    @ParameterizedTest
    @ValueSource(strings = {
        "abcdefgh000195",
        "12ABÇ34501DE35",
        "１２３４５６７８000195",
        "@@@@@@@@000191",
        "AB______000103",
        "ΑΒΓΔ1234000116"})
    void invalidCnpj_whenOnlyTheAlphabetGivesItAway(String cnpj) {
        assertFalse(DocumentValidator.isValidCnpj(cnpj));
    }

    // Quebra se: a busca deixar de separar documento de e-mail. Um "@" tem de tirar o texto da busca por documento, e acento, letras de
    // outros alfabetos, algarismos de largura total e outra pontuação também. (Um nome sem arroba só tem caracteres de documento: a busca
    // por documento não acha ninguém, como a de e-mail.)
    @ParameterizedTest
    @ValueSource(strings = {"529.982.247-25", "52998224725", "12.abc.345/01de-35", "12 ABC 345", "marina"})
    void usesOnlyDocumentCharacters_forLettersDigitsAndMaskPunctuation(String text) {
        assertTrue(DocumentValidator.usesOnlyDocumentCharacters(text));
    }

    @ParameterizedTest
    @ValueSource(strings = {"marina@arco.demo", "a@b", "CPF: 529.982.247-25", "12.ABÇ.345", "１２３", "", "x_y", "12ABC#"})
    void usesOnlyDocumentCharacters_isFalseForAnythingElse(String text) {
        assertFalse(DocumentValidator.usesOnlyDocumentCharacters(text));
    }

    @Test
    void aCnpjIsNotACpf_andViceVersa() {
        assertFalse(DocumentValidator.isValidCpf("12ABC34501DE35"));
        assertFalse(DocumentValidator.isValidCnpj("52998224725"));
    }
}
