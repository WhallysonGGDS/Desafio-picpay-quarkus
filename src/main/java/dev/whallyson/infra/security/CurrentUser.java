package dev.whallyson.infra.security;

import dev.whallyson.exceptions.ApiException;
import dev.whallyson.exceptions.ErrorCode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.jwt.JsonWebToken;

// Id do usuário autenticado, lido do token da requisição. Nunca confie em um id vindo do corpo.
// O token também precisa ser desta execução do app (SessionEpoch): o banco é recriado a cada início e os ids recomeçam em 1,
// então um token antigo, mesmo com assinatura e validade corretas, apontaria para outra pessoa.
@ApplicationScoped
public class CurrentUser {

    @Inject
    JsonWebToken jwt;

    @Inject
    SessionEpoch epoch;

    public Long id() {
        String subject = jwt.getSubject();
        if (subject != null && epoch.value().equals(jwt.getClaim(TokenService.EPOCH_CLAIM))) {
            try {
                return Long.valueOf(subject);
            } catch (NumberFormatException ignored) {
                // cai no erro abaixo
            }
        }
        throw new ApiException(ErrorCode.UNAUTHENTICATED);
    }
}
