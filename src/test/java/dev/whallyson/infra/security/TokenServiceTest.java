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
}
