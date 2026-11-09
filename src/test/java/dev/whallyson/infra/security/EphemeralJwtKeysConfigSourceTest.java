package dev.whallyson.infra.security;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EphemeralJwtKeysConfigSourceTest {

    private static byte[] der(String pem) {
        String body = pem.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
        return Base64.getDecoder().decode(body);
    }

    // Quebra se: a prioridade subir (e a chave efêmera passar por cima da configurada em produção)
    // ou se cada instância gerar um par diferente (assinatura e verificação deixariam de combinar).
    @Test
    void lowestPriority_andSamePairAcrossInstances() {
        var a = new EphemeralJwtKeysConfigSource();
        var b = new EphemeralJwtKeysConfigSource();
        assertEquals(100, a.getOrdinal());
        assertEquals(a.getValue("smallrye.jwt.sign.key"), b.getValue("smallrye.jwt.sign.key"));
        assertEquals(a.getValue("mp.jwt.verify.publickey"), b.getValue("mp.jwt.verify.publickey"));
    }

    // Quebra se: o par publicado não for um par RSA coerente — o que o JWT assinar precisa ser verificável.
    @Test
    void publishedKeysAreAMatchingRsaPair() throws Exception {
        var source = new EphemeralJwtKeysConfigSource();
        String privatePem = source.getValue("smallrye.jwt.sign.key");
        String publicPem = source.getValue("mp.jwt.verify.publickey");
        assertTrue(privatePem.startsWith("-----BEGIN PRIVATE KEY-----"));
        assertTrue(publicPem.startsWith("-----BEGIN PUBLIC KEY-----"));

        KeyFactory rsa = KeyFactory.getInstance("RSA");
        PrivateKey priv = rsa.generatePrivate(new PKCS8EncodedKeySpec(der(privatePem)));
        PublicKey pub = rsa.generatePublic(new X509EncodedKeySpec(der(publicPem)));
        byte[] message = "arco".getBytes(StandardCharsets.UTF_8);

        Signature signer = Signature.getInstance("SHA256withRSA");
        signer.initSign(priv);
        signer.update(message);
        byte[] signature = signer.sign();

        Signature verifier = Signature.getInstance("SHA256withRSA");
        verifier.initVerify(pub);
        verifier.update(message);
        assertTrue(verifier.verify(signature));
    }
}
