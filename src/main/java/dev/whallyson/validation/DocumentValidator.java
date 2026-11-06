package dev.whallyson.validation;

// Validação de CPF e CNPJ pelo algoritmo oficial dos dígitos verificadores.
// Os métodos isValid* recebem só dígitos (use digitsOnly antes) e nunca lançam exceção para entrada malformada.
public final class DocumentValidator {

    private static final int[] CNPJ_WEIGHTS_FIRST = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
    private static final int[] CNPJ_WEIGHTS_SECOND = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};

    private DocumentValidator() {}

    public static String digitsOnly(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    public static boolean isValidCpf(String digits) {
        if (!hasExactlyDigits(digits, 11) || allSameDigit(digits)) {
            return false;
        }
        return digitAt(digits, 9) == cpfCheckDigit(digits, 9) && digitAt(digits, 10) == cpfCheckDigit(digits, 10);
    }

    public static boolean isValidCnpj(String digits) {
        if (!hasExactlyDigits(digits, 14) || allSameDigit(digits)) {
            return false;
        }
        return digitAt(digits, 12) == cnpjCheckDigit(digits, CNPJ_WEIGHTS_FIRST)
                && digitAt(digits, 13) == cnpjCheckDigit(digits, CNPJ_WEIGHTS_SECOND);
    }

    // Soma os `length` primeiros dígitos com pesos decrescentes de (length + 1) até 2.
    private static int cpfCheckDigit(String digits, int length) {
        int sum = 0;
        for (int i = 0; i < length; i++) {
            sum += digitAt(digits, i) * (length + 1 - i);
        }
        int remainder = (sum * 10) % 11;
        return remainder == 10 ? 0 : remainder;
    }

    private static int cnpjCheckDigit(String digits, int[] weights) {
        int sum = 0;
        for (int i = 0; i < weights.length; i++) {
            sum += digitAt(digits, i) * weights[i];
        }
        int remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    }

    private static int digitAt(String digits, int index) {
        return digits.charAt(index) - '0';
    }

    private static boolean hasExactlyDigits(String value, int length) {
        return value != null && value.length() == length && value.chars().allMatch(c -> c >= '0' && c <= '9');
    }

    private static boolean allSameDigit(String digits) {
        return digits.chars().distinct().count() == 1;
    }
}
