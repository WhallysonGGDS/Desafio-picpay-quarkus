package dev.whallyson.services;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

// Texto dos avisos enviados às duas pontas de uma transferência, com o valor no formato brasileiro (R$ 1.250,50).
// O espaço depois de "R$" é um espaço comum, de propósito, para o texto ser previsível em qualquer cliente de e-mail.
public final class NotificationMessages {

    private static final DecimalFormatSymbols BRAZIL = new DecimalFormatSymbols(Locale.of("pt", "BR"));

    private NotificationMessages() {}

    public static String sent(BigDecimal amount, String receiverName) {
        return "Você enviou R$ " + money(amount) + " para " + receiverName + ".";
    }

    public static String received(BigDecimal amount, String senderName) {
        return "Você recebeu R$ " + money(amount) + " de " + senderName + ".";
    }

    // DecimalFormat não é thread-safe: uma instância por chamada.
    private static String money(BigDecimal amount) {
        return new DecimalFormat("#,##0.00", BRAZIL).format(amount);
    }
}
