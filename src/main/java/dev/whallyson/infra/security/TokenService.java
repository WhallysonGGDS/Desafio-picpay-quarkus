package dev.whallyson.infra.security;

import dev.whallyson.entitys.user.User;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.time.Duration;

// Emite o JWT da sessão. O token só carrega o id do usuário (sub) e a execução do app que o emitiu (epoch, ver SessionEpoch);
// o perfil sempre vem do banco.
@ApplicationScoped
public class TokenService {

    static final String EPOCH_CLAIM = "epoch";

    @ConfigProperty(name = "mp.jwt.verify.issuer")
    String issuer;

    @ConfigProperty(name = "app.jwt.lifetime")
    Duration lifetime;

    @Inject
    SessionEpoch epoch;

    public String issue(User user) {
        return Jwt.issuer(issuer)
                .subject(String.valueOf(user.id))
                .claim(EPOCH_CLAIM, epoch.value())
                .expiresIn(lifetime)
                .sign();
    }
}
