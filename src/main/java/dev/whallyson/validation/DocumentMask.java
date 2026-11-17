package dev.whallyson.validation;

// Máscara de documento para exibir a outras pessoas sem revelar o número inteiro.
public final class DocumentMask {

    private DocumentMask() {}

    // Recebe o documento normalizado (sem pontuação e em maiúsculas).
    // CPF (11 caracteres) -> ***.982.247-**; CNPJ (14) -> **.222.333/****-** (no alfanumérico, **.ABC.345/****-**: os seis do meio, sejam
    // letras ou algarismos); qualquer outro tamanho -> ***
    public static String mask(String document) {
        if (document != null && document.length() == 11) {
            return "***." + document.substring(3, 6) + "." + document.substring(6, 9) + "-**";
        }
        if (document != null && document.length() == 14) {
            return "**." + document.substring(2, 5) + "." + document.substring(5, 8) + "/****-**";
        }
        return "***";
    }
}
