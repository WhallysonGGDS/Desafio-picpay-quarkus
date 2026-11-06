package dev.whallyson.validation;

// Máscara de documento para exibir a outras pessoas sem revelar o número inteiro.
public final class DocumentMask {

    private DocumentMask() {}

    // CPF (11 dígitos) -> ***.982.247-**; CNPJ (14 dígitos) -> **.222.333/****-**; qualquer outro tamanho -> ***
    public static String mask(String digits) {
        if (digits != null && digits.length() == 11) {
            return "***." + digits.substring(3, 6) + "." + digits.substring(6, 9) + "-**";
        }
        if (digits != null && digits.length() == 14) {
            return "**." + digits.substring(2, 5) + "." + digits.substring(5, 8) + "/****-**";
        }
        return "***";
    }
}
