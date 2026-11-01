package dev.whallyson.infra.security;

import dev.whallyson.exceptions.ApiException;
import dev.whallyson.exceptions.ErrorCode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.jwt.JsonWebToken;

// Id do usuário autenticado, lido do token da requisição. Nunca confie em um id vindo do corpo.
@ApplicationScoped
public class CurrentUser {

    @Inject
    JsonWebToken jwt;

    public Long id() {
        String subject = jwt.getSubject();
        if (subject != null) {
            try {
                return Long.valueOf(subject);
            } catch (NumberFormatException ignored) {
                // cai no erro abaixo
            }
        }
        throw new ApiException(ErrorCode.UNAUTHENTICATED);
    }
}
