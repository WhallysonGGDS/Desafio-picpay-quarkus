package dev.whallyson.support;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Gera documentos e e-mails únicos e válidos para os testes. Os dígitos verificadores são calculados
 * aqui de forma independente do DocumentValidator, para que os testes não validem o código com ele mesmo.
 */
public final class TestDocuments {

    private static final AtomicLong CPF_SEQ = new AtomicLong(100_000_000L);
    private static final AtomicLong CNPJ_SEQ = new AtomicLong(10_000_000L);
    private static final AtomicLong EMAIL_SEQ = new AtomicLong();

    private static final int[] CNPJ_WEIGHTS_FIRST = {5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
    private static final int[] CNPJ_WEIGHTS_SECOND = {6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};

    private TestDocuments() {}

    /** CPF válido, só dígitos. */
    public static String cpf() {
        String base = String.valueOf(CPF_SEQ.incrementAndGet());
        String withFirst = base + cpfDigit(base);
        return withFirst + cpfDigit(withFirst);
    }

    /** CNPJ válido, só dígitos. */
    public static String cnpj() {
        String base = String.format("%08d", CNPJ_SEQ.incrementAndGet()) + "0001";
        String withFirst = base + cnpjDigit(base, CNPJ_WEIGHTS_FIRST);
        return withFirst + cnpjDigit(withFirst, CNPJ_WEIGHTS_SECOND);
    }

    public static String email() {
        return "user" + EMAIL_SEQ.incrementAndGet() + "@teste.com";
    }

    /** 52998224725 vira 529.982.247-25. */
    public static String formatCpf(String digits) {
        return digits.substring(0, 3) + "." + digits.substring(3, 6) + "." + digits.substring(6, 9) + "-" + digits.substring(9);
    }

    private static int cpfDigit(String digits) {
        int sum = 0;
        int weight = digits.length() + 1;
        for (char c : digits.toCharArray()) {
            sum += (c - '0') * weight--;
        }
        int remainder = (sum * 10) % 11;
        return remainder == 10 ? 0 : remainder;
    }

    private static int cnpjDigit(String digits, int[] weights) {
        int sum = 0;
        for (int i = 0; i < weights.length; i++) {
            sum += (digits.charAt(i) - '0') * weights[i];
        }
        int remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    }
}
