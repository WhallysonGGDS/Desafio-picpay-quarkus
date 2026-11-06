package dev.whallyson.services;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NotificationMessagesTest {

    // Quebra se: o formato sair no padrão americano (1,250.50), sem o "R$ " ou com espaço não separável.
    @Test
    void formatsBrazilianCurrency() {
        assertEquals("Você enviou R$ 1.250,50 para Rafa Teste.", NotificationMessages.sent(new BigDecimal("1250.5"), "Rafa Teste"));
        assertEquals("Você recebeu R$ 250,00 de Ana Teste.", NotificationMessages.received(new BigDecimal("250.00"), "Ana Teste"));
    }
}
