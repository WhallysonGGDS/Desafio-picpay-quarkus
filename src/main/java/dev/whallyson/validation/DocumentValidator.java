package dev.whallyson.validation;

import java.util.regex.Pattern;

// Validação de CPF e CNPJ pelo algoritmo oficial dos dígitos verificadores.
//
// O CPF tem 11 dígitos. O CNPJ tem 14 caracteres: desde julho de 2026 a Receita emite CNPJs alfanuméricos (IN RFB 2.229/2024), com
// algarismos e letras de A a Z nas 12 primeiras posições (a raiz e a ordem) e dois dígitos verificadores, sempre numéricos. O cálculo
// continua sendo o módulo 11 de sempre; a única diferença é que cada caractere vale o seu código ASCII menos 48 ("0" a "9" valem 0 a 9
// e "A" vale 17). Por isso os CNPJs numéricos que já existem continuam valendo, sem tratamento à parte.
//
// Os métodos isValid* recebem o documento já normalizado (use normalize antes) e nunca lançam exceção para entrada malformada.
public final class DocumentValidator {

    private static final int[] CNPJ_WEIGHTS_FIRST = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
    private static final int[] CNPJ_WEIGHTS_SECOND = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};

    // O que um documento digitado pode ter: algarismos, letras de A a Z (sem acento) e a pontuação da máscara. ASCII de propósito:
    // "\p{L}" ou "\w" aceitariam letras e algarismos de outros alfabetos.
    private static final Pattern DOCUMENT_CHARACTERS = Pattern.compile("[0-9A-Za-z.\\-/\\s]+");

    private DocumentValidator() {}

    // A forma em que o documento é gravado e comparado: sem a pontuação da máscara (ponto, traço, barra, espaço) e com as letras de a a z
    // em maiúsculas. Qualquer outro caractere fica como está e reprova na validação. A conversão é só ASCII de propósito: a do Unicode
    // transforma "ß" em "SS", "ı" (i sem ponto) em "I" e "ſ" (s longo) em "S", e um texto com esses caracteres viraria um documento válido.
    public static String normalize(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder normalized = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '.' || c == '-' || c == '/' || isWhitespace(c)) {
                continue;
            }
            normalized.append(c >= 'a' && c <= 'z' ? (char) (c - 'a' + 'A') : c);
        }
        return normalized.toString();
    }

    // O texto só tem caracteres de documento (algarismos, letras de A a Z e a pontuação da máscara)? É o que separa, na busca de
    // destinatário, o documento do e-mail: um "@", um acento ou qualquer outra pontuação já tiram o texto daqui.
    public static boolean usesOnlyDocumentCharacters(String text) {
        return text != null && DOCUMENT_CHARACTERS.matcher(text).matches();
    }

    public static boolean isValidCpf(String digits) {
        if (!hasExactlyDigits(digits, 11) || allSameCharacter(digits)) {
            return false;
        }
        return valueAt(digits, 9) == cpfCheckDigit(digits, 9) && valueAt(digits, 10) == cpfCheckDigit(digits, 10);
    }

    public static boolean isValidCnpj(String cnpj) {
        if (cnpj == null || cnpj.length() != 14 || allSameCharacter(cnpj)) {
            return false;
        }
        for (int i = 0; i < cnpj.length(); i++) {
            char c = cnpj.charAt(i);
            // As 12 primeiras posições aceitam algarismo ou letra maiúscula; os dois dígitos verificadores, só algarismo.
            if (!isDigit(c) && !(i < 12 && c >= 'A' && c <= 'Z')) {
                return false;
            }
        }
        return valueAt(cnpj, 12) == cnpjCheckDigit(cnpj, CNPJ_WEIGHTS_FIRST)
                && valueAt(cnpj, 13) == cnpjCheckDigit(cnpj, CNPJ_WEIGHTS_SECOND);
    }

    // Soma os `length` primeiros dígitos com pesos decrescentes de (length + 1) até 2.
    private static int cpfCheckDigit(String digits, int length) {
        int sum = 0;
        for (int i = 0; i < length; i++) {
            sum += valueAt(digits, i) * (length + 1 - i);
        }
        int remainder = (sum * 10) % 11;
        return remainder == 10 ? 0 : remainder;
    }

    private static int cnpjCheckDigit(String cnpj, int[] weights) {
        int sum = 0;
        for (int i = 0; i < weights.length; i++) {
            sum += valueAt(cnpj, i) * weights[i];
        }
        int remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    }

    // O valor do caractere no cálculo: código ASCII menos 48. Para um algarismo é o próprio algarismo.
    private static int valueAt(String document, int index) {
        return document.charAt(index) - '0';
    }

    private static boolean hasExactlyDigits(String value, int length) {
        return value != null && value.length() == length && value.chars().allMatch(c -> c >= '0' && c <= '9');
    }

    private static boolean allSameCharacter(String document) {
        return document.chars().distinct().count() == 1;
    }

    private static boolean isDigit(char c) {
        return c >= '0' && c <= '9';
    }

    // O mesmo conjunto do "\s" das expressões regulares do Java: espaço, tabulação, quebras de linha, tabulação vertical e avanço de página.
    private static boolean isWhitespace(char c) {
        return c == ' ' || (c >= '\t' && c <= '\r');
    }
}
