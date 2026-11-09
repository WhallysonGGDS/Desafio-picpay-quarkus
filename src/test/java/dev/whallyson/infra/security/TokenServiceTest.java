package dev.whallyson.infra.security;

import dev.whallyson.entitys.user.User;
import io.quarkus.test.junit.QuarkusTest;
import io.smallrye.jwt.auth.principal.JWTParser;
import jakarta.inject.Inject;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
class TokenServiceTest {

    @Inject
    TokenService tokens;

    @Inject
    JWTParser parser;

    @Inject
    SessionEpoch epoch;

    // Quebra se: o token perder o id do usuário (sub), mudar de emissor ou deixar de expirar em 1 hora.
    @Test
    void issue_hasSubjectIssuerAndOneHourLifetime() throws Exception {
        User u = new User();
        u.id = 42L;
        JsonWebToken jwt = parser.parse(tokens.issue(u));
        assertEquals("42", jwt.getSubject());
        assertEquals("arco", jwt.getIssuer());
        assertEquals(3600L, jwt.getExpirationTime() - jwt.getIssuedAtTime());
    }

    // Quebra se: o token deixar de levar a execução do app que o emitiu (SessionEpoch): um cookie antigo voltaria a valer depois de
    // um reinício com as mesmas chaves, na conta de quem recebeu o mesmo id.
    @Test
    void issue_carriesTheEpochOfThisRun() throws Exception {
        User u = new User();
        u.id = 42L;
        JsonWebToken jwt = parser.parse(tokens.issue(u));
        assertEquals(epoch.value(), jwt.getClaim("epoch"));
    }
}
