package dev.whallyson.dtos.requests;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

// Objeto request (o corpo/body) da requisição que solicita uma transferência.
// Não existe campo de remetente: quem envia é sempre o usuário autenticado (o do cookie de sessão).
// O valor aceita string ("250.00") ou número JSON, com no máximo 15 dígitos inteiros e 2 casas decimais.
public record RequestTransaction(
        @NotNull(message = "REQUIRED") Long receiverId,
        @NotNull(message = "REQUIRED")
        @Digits(integer = 15, fraction = 2, message = "INVALID_AMOUNT")
        @DecimalMin(value = "0.01", message = "INVALID_AMOUNT") BigDecimal amount) {}
