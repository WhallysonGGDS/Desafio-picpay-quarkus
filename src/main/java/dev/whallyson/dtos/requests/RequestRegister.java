package dev.whallyson.dtos.requests;

import dev.whallyson.entitys.user.UserType;
import dev.whallyson.validation.MaxUtf8Bytes;
import dev.whallyson.validation.ValidDocument;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// Objeto request (o corpo/body) do cadastro de usuário.
// Os textos são aparados aqui, antes da validação: um espaço sobrando ao colar o e-mail não pode reprová-lo.
// A senha nunca é alterada. Cada "message" é o código de erro devolvido ao front-end.
@ValidDocument
public record RequestRegister(
        @NotBlank(message = "REQUIRED") @Size(max = 80, message = "TOO_LONG") String firstName,
        @NotBlank(message = "REQUIRED") @Size(max = 80, message = "TOO_LONG") String lastName,
        @NotBlank(message = "REQUIRED") String document,
        @NotBlank(message = "REQUIRED") @Email(message = "INVALID_EMAIL") @Size(max = 160, message = "TOO_LONG") String email,
        @NotBlank(message = "REQUIRED") @Size(min = 8, max = 72, message = "PASSWORD_LENGTH") @MaxUtf8Bytes(value = 72, message = "PASSWORD_LENGTH") String password,
        @NotNull(message = "REQUIRED") UserType userType) {

    public RequestRegister {
        firstName = trim(firstName);
        lastName = trim(lastName);
        document = trim(document);
        email = trim(email);
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
