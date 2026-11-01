package dev.whallyson.infra.security;

import dev.whallyson.entitys.user.User;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Duration;

// Emite o JWT da sessão. O token só carrega o id do usuário (sub); o perfil sempre vem do banco.
@ApplicationScoped
public class TokenService {

    @ConfigProperty(name = "mp.jwt.verify.issuer")
    String issuer;

    @ConfigProperty(name = "app.jwt.lifetime")
    Duration lifetime;

    public String issue(User user) {
        return Jwt.issuer(issuer)
                .subject(String.valueOf(user.id))
                .expiresIn(lifetime)
                .sign();
    }
}
