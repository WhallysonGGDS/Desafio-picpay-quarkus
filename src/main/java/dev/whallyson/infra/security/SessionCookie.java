package dev.whallyson.infra.security;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.NewCookie;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Duration;

// Cookie da sessão: HttpOnly (o JavaScript nunca vê o token), SameSite=Strict (não viaja em requisições
// de outros sites) e Secure fora de dev/teste. O nome precisa ser o mesmo de mp.jwt.token.cookie.
@ApplicationScoped
public class SessionCookie {

    public static final String NAME = "arco_session";

    private final boolean secure;
    private final Duration lifetime;

    @Inject
    public SessionCookie(@ConfigProperty(name = "app.jwt.cookie-secure") boolean secure,
                         @ConfigProperty(name = "app.jwt.lifetime") Duration lifetime) {
        this.secure = secure;
        this.lifetime = lifetime;
    }

    public NewCookie create(String token) {
        return builder(token).maxAge((int) lifetime.toSeconds()).build();
    }

    public NewCookie expire() {
        return builder("").maxAge(0).build();
    }

    private NewCookie.Builder builder(String value) {
        return new NewCookie.Builder(NAME)
                .value(value)
                .path("/")
                .httpOnly(true)
                .secure(secure)
                .sameSite(NewCookie.SameSite.STRICT);
    }
}
