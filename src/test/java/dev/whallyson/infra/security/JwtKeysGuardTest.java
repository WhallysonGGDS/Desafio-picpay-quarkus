package dev.whallyson.infra.security;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * As chaves do JWT. Sem nenhuma configurada, o app usa um par efêmero; configuradas as duas pelo CONTEÚDO (SMALLRYE_JWT_SIGN_KEY e
 * MP_JWT_VERIFY_PUBLICKEY), vale o configurado. Qualquer mistura quebraria TODAS as sessões sem nenhum erro (o login devolvia 200
 * e toda rota protegida 401), então o app se recusa a subir e diz o que corrigir.
 */
class JwtKeysGuardTest {

    @Test
    void neitherConfigured_theEphemeralPairIsFine() {
        assertNull(JwtKeysGuard.problem(true, true, List.of()));
    }

    @Test
    void bothConfiguredByContent_isFine() {
        assertNull(JwtKeysGuard.problem(false, false, List.of()));
    }

    // Quebra se: só uma das chaves for configurada: o app assinaria com uma e verificaria com a outra (a efêmera).
    @Test
    void onlyTheSigningKeyConfigured_isRefused() {
        String problem = JwtKeysGuard.problem(false, true, List.of());
        assertNotNull(problem);
        assertTrue(problem.contains("SMALLRYE_JWT_SIGN_KEY") && problem.contains("MP_JWT_VERIFY_PUBLICKEY"), problem);
    }

    @Test
    void onlyTheVerificationKeyConfigured_isRefused() {
        assertNotNull(JwtKeysGuard.problem(true, false, List.of()));
    }

    // Quebra se: chaves por CAMINHO (o jeito que o guia do Quarkus ensina) passarem sem aviso: a assinatura usa o arquivo, a
    // verificação usa o par efêmero que a fonte de configuração sempre publica, e nenhum cookie valeria.
    @Test
    void keysByFilePath_areRefusedWithTheNamesOfThePropertiesInvolved() {
        String problem = JwtKeysGuard.problem(true, true, List.of("smallrye.jwt.sign.key.location", "mp.jwt.verify.publickey.location"));
        assertNotNull(problem);
        assertTrue(problem.contains("smallrye.jwt.sign.key.location") && problem.contains("mp.jwt.verify.publickey.location"), problem);
        assertTrue(problem.contains("conteúdo"), problem);
    }

    // Quebra se: um caminho configurado ao lado do conteúdo passar: a assinatura prefere o caminho e a verificação, o conteúdo.
    @Test
    void contentAndFilePathTogether_areRefused() {
        assertNotNull(JwtKeysGuard.problem(false, false, List.of("smallrye.jwt.sign.key.location")));
    }
}
