package dev.whallyson.dtos.requests;

import jakarta.validation.constraints.NotBlank;

// Objeto request (o corpo/body) do login.
// O formato do e-mail não é validado aqui de propósito: login errado responde sempre INVALID_CREDENTIALS.
public record RequestLogin(
        @NotBlank(message = "REQUIRED") String email,
        @NotBlank(message = "REQUIRED") String password) {}
