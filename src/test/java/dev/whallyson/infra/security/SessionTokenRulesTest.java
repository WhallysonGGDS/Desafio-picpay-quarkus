package dev.whallyson.infra.security;

import dev.whallyson.entitys.user.UserType;
import dev.whallyson.support.TestUsers;
import io.quarkus.test.junit.QuarkusTest;
import io.smallrye.jwt.build.Jwt;
import io.smallrye.jwt.build.JwtClaimsBuilder;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static io.restassured.http.ContentType.JSON;
import static org.hamcrest.Matchers.is;

/**
 * Quais tokens abrem uma sessão. Cada caso monta um token que seria válido em tudo MENOS num ponto (a execução que o emitiu,
 * a validade, o emissor, a chave ou a assinatura) e confere que TODA rota protegida o recusa com 401.
 */
@QuarkusTest
class SessionTokenRulesTest {

    @Inject
    SessionEpoch epoch;

    /** Um token que seria válido em tudo: cada caso muda UMA coisa nele. */
    private JwtClaimsBuilder valid(long userId) {
        return Jwt.issuer("arco").subject(String.valueOf(userId)).claim("epoch", epoch.value()).expiresIn(Duration.ofHours(1));
    }

    private void assertRejectedEverywhere(String token, long userId) {
        given().cookie("arco_session", token).get("/users/me").then().statusCode(401).body("code", is("UNAUTHENTICATED"));
        given().cookie("arco_session", token).queryParam("q", "abc@def.com").get("/users/search").then().statusCode(401)
                .body("code", is("UNAUTHENTICATED"));
        given().cookie("arco_session", token).get("/transaction").then().statusCode(401).body("code", is("UNAUTHENTICATED"));
        given().cookie("arco_session", token).contentType(JSON).body(Map.of("receiverId", userId + 1, "amount", "1.00"))
                .post("/transaction").then().statusCode(401).body("code", is("UNAUTHENTICATED"));
    }

    // Controle: o mesmo molde dos casos abaixo, sem o defeito, abre a sessão. Sem isto, os 401 abaixo poderiam vir de qualquer outra coisa.
    @Test
    void controlToken_opensTheSession() {
        var user = TestUsers.register(UserType.COMMON);
        given().cookie("arco_session", valid(user.id()).sign()).get("/users/me").then().statusCode(200).body("email", is(user.email()));
    }

    // Quebra se: um token de OUTRA execução do app (outro banco, onde o mesmo id é de outra pessoa) voltar a valer.
    @Test
    void tokenFromAnotherRun_isRejected() {
        var user = TestUsers.register(UserType.COMMON);
        String token = Jwt.issuer("arco").subject(String.valueOf(user.id())).claim("epoch", "outra-execucao")
                .expiresIn(Duration.ofHours(1)).sign();
        assertRejectedEverywhere(token, user.id());
    }

    // Quebra se: um token no formato antigo (só o id, sem a execução) voltar a valer.
    @Test
    void tokenWithoutTheRun_isRejected() {
        var user = TestUsers.register(UserType.COMMON);
        String token = Jwt.issuer("arco").subject(String.valueOf(user.id())).expiresIn(Duration.ofHours(1)).sign();
        assertRejectedEverywhere(token, user.id());
    }

    @Test
    void expiredToken_isRejected() {
        var user = TestUsers.register(UserType.COMMON);
        String token = valid(user.id()).expiresAt(Instant.now().minusSeconds(60)).sign();
        assertRejectedEverywhere(token, user.id());
    }

    @Test
    void tokenFromAnotherIssuer_isRejected() {
        var user = TestUsers.register(UserType.COMMON);
        String token = valid(user.id()).issuer("outro-emissor").sign();
        assertRejectedEverywhere(token, user.id());
    }

    @Test
    void tokenSignedWithAnotherKey_isRejected() throws Exception {
        var user = TestUsers.register(UserType.COMMON);
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        PrivateKey other = generator.generateKeyPair().getPrivate();
        assertRejectedEverywhere(valid(user.id()).sign(other), user.id());
    }

    // Quebra se: um token sem assinatura ("alg":"none") voltar a valer.
    @Test
    void unsignedToken_isRejected() {
        var user = TestUsers.register(UserType.COMMON);
        Base64.Encoder base64 = Base64.getUrlEncoder().withoutPadding();
        String header = base64.encodeToString("{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        long exp = Instant.now().plusSeconds(3600).getEpochSecond();
        String payload = base64.encodeToString(("{\"iss\":\"arco\",\"sub\":\"" + user.id() + "\",\"epoch\":\"" + epoch.value()
                + "\",\"exp\":" + exp + "}").getBytes(StandardCharsets.UTF_8));
        assertRejectedEverywhere(header + "." + payload + ".", user.id());
        assertRejectedEverywhere(header + "." + payload, user.id());
    }
}
