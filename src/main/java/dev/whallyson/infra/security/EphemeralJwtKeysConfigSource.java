package dev.whallyson.infra.security;

import org.eclipse.microprofile.config.spi.ConfigSource;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Map;
import java.util.Set;

/**
 * Fonte de configuração de MENOR prioridade (ordinal 100) com um par de chaves RSA gerado a cada execução.
 * Sem nenhuma chave configurada, dev e testes funcionam sem preparo e nenhuma chave vai para o repositório.
 * Como qualquer fonte de configuração real tem ordinal maior, as chaves de produção definidas por variável
 * de ambiente (SMALLRYE_JWT_SIGN_KEY e MP_JWT_VERIFY_PUBLICKEY) sempre prevalecem sobre estas.
 */
public class EphemeralJwtKeysConfigSource implements ConfigSource {

    private static final Logger LOG = Logger.getLogger(EphemeralJwtKeysConfigSource.class);

    private static final String SIGN_KEY = "smallrye.jwt.sign.key";
    private static final String VERIFY_KEY = "mp.jwt.verify.publickey";

    // Um par por JVM: todas as instâncias da fonte devem publicar as mesmas chaves.
    private static final Map<String, String> PROPERTIES = generate();

    private static Map<String, String> generate() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            KeyPair pair = generator.generateKeyPair();
            LOG.warn("Par de chaves JWT efêmero gerado. Ele só vale se SMALLRYE_JWT_SIGN_KEY e "
                    + "MP_JWT_VERIFY_PUBLICKEY não estiverem definidas; nesse caso as sessões não sobrevivem a um reinício.");
            return Map.of(
                    SIGN_KEY, pem("PRIVATE KEY", pair.getPrivate().getEncoded()),
                    VERIFY_KEY, pem("PUBLIC KEY", pair.getPublic().getEncoded()));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("RSA indisponível nesta JVM", e);
        }
    }

    private static String pem(String type, byte[] der) {
        String body = Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(der);
        return "-----BEGIN " + type + "-----\n" + body + "\n-----END " + type + "-----";
    }

    @Override
    public Set<String> getPropertyNames() {
        return PROPERTIES.keySet();
    }

    @Override
    public Map<String, String> getProperties() {
        return PROPERTIES;
    }

    @Override
    public String getValue(String propertyName) {
        return PROPERTIES.get(propertyName);
    }

    @Override
    public String getName() {
        return "ephemeral-jwt-keys";
    }

    @Override
    public int getOrdinal() {
        return 100;
    }
}
