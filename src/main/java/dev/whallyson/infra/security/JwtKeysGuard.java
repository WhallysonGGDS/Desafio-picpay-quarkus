package dev.whallyson.infra.security;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import org.eclipse.microprofile.config.Config;
import org.eclipse.microprofile.config.ConfigProvider;
import org.jboss.logging.Logger;

import java.util.List;

/**
 * Confere, ao subir, que as chaves do JWT formam um par que funciona. A fonte {@link EphemeralJwtKeysConfigSource} sempre publica
 * o CONTEÚDO de um par efêmero, e o SmallRye JWT consulta as propriedades em ordens diferentes na assinatura (prefere o caminho
 * {@code *.location}) e na verificação (prefere o conteúdo). Qualquer mistura de chaves configuradas com o par efêmero, ou de
 * caminho com conteúdo, faz o app assinar com uma chave e verificar com outra: o login devolve 200 e toda rota protegida 401,
 * sem nenhum erro no log. Aqui isso vira uma falha de inicialização que diz o que corrigir.
 */
@ApplicationScoped
public class JwtKeysGuard {

    private static final Logger LOG = Logger.getLogger(JwtKeysGuard.class);

    private static final List<String> LOCATION_PROPERTIES =
            List.of("smallrye.jwt.sign.key.location", "mp.jwt.verify.publickey.location", "smallrye.jwt.verify.key.location");

    void onStart(@Observes StartupEvent event) {
        Config config = ConfigProvider.getConfig();
        boolean signIsEphemeral = isEphemeral(config, EphemeralJwtKeysConfigSource.SIGN_KEY);
        boolean verifyIsEphemeral = isEphemeral(config, EphemeralJwtKeysConfigSource.VERIFY_KEY);
        List<String> locations = LOCATION_PROPERTIES.stream()
                .filter(name -> config.getOptionalValue(name, String.class).filter(value -> !value.isBlank()).isPresent())
                .toList();

        String problem = problem(signIsEphemeral, verifyIsEphemeral, locations);
        if (problem != null) {
            throw new IllegalStateException(problem);
        }
        if (signIsEphemeral) {
            LOG.warn("Chaves JWT efêmeras em uso: as sessões não sobrevivem a um reinício. Em produção defina SMALLRYE_JWT_SIGN_KEY "
                    + "e MP_JWT_VERIFY_PUBLICKEY (o conteúdo do PEM, não o caminho).");
        }
    }

    private static boolean isEphemeral(Config config, String name) {
        return EphemeralJwtKeysConfigSource.publishes(name, config.getOptionalValue(name, String.class).orElse(null));
    }

    /** O que está errado nas chaves (texto para quem opera o app), ou {@code null} quando elas formam um par que funciona. */
    static String problem(boolean signIsEphemeral, boolean verifyIsEphemeral, List<String> locationsConfigured) {
        if (!locationsConfigured.isEmpty()) {
            return "Chaves do JWT por caminho de arquivo (" + String.join(", ", locationsConfigured) + ") não funcionam neste app: a "
                    + "assinatura usa o arquivo e a verificação usa o par efêmero (ou o conteúdo configurado), e nenhuma sessão valeria. "
                    + "Defina as DUAS chaves pelo conteúdo do PEM (não pelo caminho): SMALLRYE_JWT_SIGN_KEY e MP_JWT_VERIFY_PUBLICKEY.";
        }
        if (signIsEphemeral != verifyIsEphemeral) {
            return "Só uma das chaves do JWT foi configurada: o app assinaria com uma e verificaria com a outra, e nenhuma sessão "
                    + "valeria. Defina as DUAS (SMALLRYE_JWT_SIGN_KEY e MP_JWT_VERIFY_PUBLICKEY, com o conteúdo do PEM) ou nenhuma.";
        }
        return null;
    }
}
