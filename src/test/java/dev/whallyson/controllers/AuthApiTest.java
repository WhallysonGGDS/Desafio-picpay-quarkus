package dev.whallyson.controllers;

import dev.whallyson.entitys.user.User;
import dev.whallyson.entitys.user.UserType;
import dev.whallyson.infra.security.TokenService;
import dev.whallyson.support.TestDocuments;
import dev.whallyson.support.TestUsers;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.stream.Stream;

import static io.restassured.RestAssured.given;
import static io.restassured.http.ContentType.JSON;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class AuthApiTest {

    @Inject
    TokenService tokens;

    static Map<String, Object> registerBody(String email, String doc, String type) {
        return Map.of("firstName", "Ana", "lastName", "Souza", "document", doc, "email", email,
                "password", "segredo123", "userType", type);
    }

    // Quebra se: o cookie perder HttpOnly/SameSite/Path/Max-Age, a senha voltar na resposta ou o saldo inicial mudar.
    @Test
    void register_is201_setsHardenedCookie_andHidesPassword() {
        var r = given().contentType(JSON).body(registerBody(TestDocuments.email(), TestDocuments.cpf(), "COMMON")).post("/auth/register");
        r.then().statusCode(201).body("balance", is("1000.00")).body("userType", is("COMMON"))
                .body("keySet()", not(hasItem("password"))).body("keySet()", not(hasItem("passwordHash")));
        String c = r.header("Set-Cookie");
        assertAll(
                () -> assertTrue(c.startsWith("arco_session=")),
                () -> assertTrue(c.contains("HttpOnly")),
                () -> assertTrue(c.contains("SameSite=Strict")),
                () -> assertTrue(c.contains("Path=/")),
                () -> assertTrue(c.contains("Max-Age=3600")));
    }

    @Test
    void register_emptyBody_listsRequiredFields() {
        given().contentType(JSON).body("{}").post("/auth/register").then().statusCode(400)
                .body("code", is("VALIDATION_ERROR"))
                .body("fieldErrors.field", hasItems("firstName", "lastName", "document", "email", "password", "userType"));
    }

    @Test
    void register_duplicates_are409() {
        var s = TestUsers.register(UserType.COMMON);
        String cpf = TestDocuments.cpf();
        given().contentType(JSON).body(registerBody(s.email(), cpf, "COMMON")).post("/auth/register")
                .then().statusCode(409).body("code", is("DUPLICATE_EMAIL"));
        given().contentType(JSON).body(registerBody(TestDocuments.email(), cpf, "COMMON")).post("/auth/register")
                .then().statusCode(201);
        given().contentType(JSON).body(registerBody(TestDocuments.email(), cpf, "COMMON")).post("/auth/register")
                .then().statusCode(409).body("code", is("DUPLICATE_DOCUMENT"));
    }

    // RF3. Quebra se: a corrida entre dois cadastros do mesmo e-mail escapar como 500 em vez de 409.
    @Test
    void register_concurrentSameEmail_oneCreatedOneConflict() throws Exception {
        String email = TestDocuments.email();
        var pool = Executors.newFixedThreadPool(2);
        var gate = new CountDownLatch(1);
        Callable<Integer> call = () -> {
            gate.await();
            return given().contentType(JSON).body(registerBody(email, TestDocuments.cpf(), "COMMON")).post("/auth/register").statusCode();
        };
        var f1 = pool.submit(call);
        var f2 = pool.submit(call);
        gate.countDown();
        assertEquals(List.of(201, 409), Stream.of(f1.get(), f2.get()).sorted().toList());
        pool.shutdown();
    }

    // Quebra se: uma chave repetida no JSON voltar a cair num erro de definição do record e responder 500 com corpo vazio, fora do contrato
    // de erro (e, pior, a segunda "password" valer em silêncio no lugar da primeira). Achado do red team (r4).
    @Test
    void duplicateJsonKey_is400WithTheErrorBody() {
        given().contentType(JSON).body("{\"email\":\"a@b.com\",\"password\":\"x\",\"password\":\"segredo123\"}").post("/auth/login")
                .then().statusCode(400).body("code", is("VALIDATION_ERROR"));
    }

    // Quebra se: um "amount" repetido no corpo da transferência voltar a valer em silêncio (o último ganha) ou a cair em 500 sem corpo.
    // A validação falha antes do autorizador e do banco: nenhum saldo muda.
    @Test
    void duplicateJsonKeyInTheTransferBody_is400_andNothingMoves() {
        var from = TestUsers.registerWithBalance(UserType.COMMON, "500.00");
        var to = TestUsers.register(UserType.COMMON);
        given().cookie("arco_session", from.cookie()).contentType(JSON)
                .body("{\"receiverId\":" + to.id() + ",\"amount\":\"1.00\",\"amount\":\"400.00\"}")
                .post("/transaction").then().statusCode(400).body("code", is("VALIDATION_ERROR"));
        assertEquals("500.00", TestUsers.balanceOf(from));
        assertEquals("1000.00", TestUsers.balanceOf(to));
    }

    // Quebra se: o limite de 72 da senha voltar a contar CARACTERES. O BCrypt só lê os 72 primeiros BYTES: 40 letras "é" (80 bytes) e outra
    // senha igual nos 72 primeiros bytes abririam a mesma conta, e a diferença no fim seria ignorada em silêncio.
    @Test
    void register_passwordLongerThan72Bytes_is400() {
        var body = new java.util.HashMap<>(registerBody(TestDocuments.email(), TestDocuments.cpf(), "COMMON"));
        body.put("password", "é".repeat(40));
        given().contentType(JSON).body(body).post("/auth/register").then().statusCode(400)
                .body("fieldErrors.field", hasItem("password")).body("fieldErrors.code", hasItem("PASSWORD_LENGTH"));
        body.put("password", "é".repeat(36)); // 72 bytes exatos: vale
        given().contentType(JSON).body(body).post("/auth/register").then().statusCode(201);
    }

    // Quebra se: letras em volta do documento voltarem a passar (só os dígitos eram conferidos): "CPF: 529.982.247-25 ok" era gravado como se
    // fosse o CPF. A busca de destinatário já recusava o mesmo texto.
    @Test
    void register_documentWithLettersAround_is400() {
        var body = new java.util.HashMap<>(registerBody(TestDocuments.email(), TestDocuments.cpf(), "COMMON"));
        body.put("document", "CPF: 529.982.247-25 ok");
        given().contentType(JSON).body(body).post("/auth/register").then().statusCode(400).body("fieldErrors.field", hasItem("document"));
        body.put("document", "529.982.247-25"); // a máscara comum continua valendo
        body.put("email", TestDocuments.email());
        given().contentType(JSON).body(body).post("/auth/register").then().statusCode(201);
    }

    // Quebra se: a loja com CNPJ alfanumérico (os que a Receita emite desde julho de 2026) voltar a ser recusada, ou o mesmo documento escrito
    // com outra pontuação e outras maiúsculas passar como novo. Letras só valem no CNPJ: como CPF continuam sendo 400.
    @Test
    void register_alphanumericCnpj_isAcceptedForAShop_butNotAsACpf() {
        String cnpj = TestDocuments.alphanumericCnpj();
        given().contentType(JSON).body(registerBody(TestDocuments.email(), TestDocuments.formatCnpj(cnpj).toLowerCase(), "MERCHANT"))
                .post("/auth/register").then().statusCode(201).body("userType", is("MERCHANT"));
        given().contentType(JSON).body(registerBody(TestDocuments.email(), cnpj, "MERCHANT"))
                .post("/auth/register").then().statusCode(409).body("code", is("DUPLICATE_DOCUMENT"));
        given().contentType(JSON).body(registerBody(TestDocuments.email(), TestDocuments.alphanumericCnpj(), "COMMON"))
                .post("/auth/register").then().statusCode(400).body("fieldErrors.field", hasItem("document"));
    }

    @Test
    void login_is200_caseInsensitive_andSetsCookie() {
        var s = TestUsers.register(UserType.COMMON);
        var r = given().contentType(JSON).body(Map.of("email", "  " + s.email().toUpperCase(), "password", "segredo123")).post("/auth/login");
        r.then().statusCode(200).body("id", is((int) s.id()));
        assertTrue(r.header("Set-Cookie").startsWith("arco_session="));
    }

    // Quebra se: e-mail desconhecido e senha errada passarem a responder diferente (enumeração de contas).
    @Test
    void login_wrongPasswordAndUnknownEmail_are401WithSameMessage() {
        var s = TestUsers.register(UserType.COMMON);
        String m1 = given().contentType(JSON).body(Map.of("email", s.email(), "password", "errada123")).post("/auth/login")
                .then().statusCode(401).body("code", is("INVALID_CREDENTIALS")).extract().path("message");
        String m2 = given().contentType(JSON).body(Map.of("email", "nao@existe.com", "password", "errada123")).post("/auth/login")
                .then().statusCode(401).extract().path("message");
        assertEquals(m1, m2);
    }

    // Quebra se: a rota passar a aceitar formulário, abrindo caminho para CSRF por <form> de outro site.
    @Test
    void login_rejectsNonJsonContentType() {
        given().contentType("application/x-www-form-urlencoded").body("email=a&password=b").post("/auth/login")
                .then().statusCode(415).body("code", is("HTTP_415"));
    }

    @Test
    void me_withValidCookie_returnsProfileWithoutPassword() {
        var s = TestUsers.register(UserType.COMMON);
        given().cookie("arco_session", s.cookie()).get("/users/me").then().statusCode(200)
                .body("email", is(s.email())).body("balance", is("1000.00")).body("keySet()", not(hasItem("passwordHash")));
    }

    @Test
    void me_withoutOrGarbageCookie_is401Json() {
        given().get("/users/me").then().statusCode(401).body("code", is("UNAUTHENTICATED"));
        given().cookie("arco_session", "lixo").get("/users/me").then().statusCode(401).body("code", is("UNAUTHENTICATED"));
    }

    // RF2. Quebra se: um token válido de usuário inexistente (banco reiniciado com as mesmas chaves) virar 500.
    @Test
    void me_tokenOfNonexistentUser_is401() {
        User ghost = new User();
        ghost.id = 987654321L;
        given().cookie("arco_session", tokens.issue(ghost)).get("/users/me").then().statusCode(401).body("code", is("UNAUTHENTICATED"));
    }

    // RF1. Quebra se: a autenticação voltar a ser proativa — um cookie velho derrubaria até o login.
    @Test
    void publicRoutes_ignoreStaleCookie() {
        var s = TestUsers.register(UserType.COMMON);
        given().cookie("arco_session", "lixo.lixo.lixo").contentType(JSON).body(Map.of("email", s.email(), "password", "segredo123"))
                .post("/auth/login").then().statusCode(200);
        given().cookie("arco_session", "lixo").contentType(JSON).body(registerBody(TestDocuments.email(), TestDocuments.cpf(), "COMMON"))
                .post("/auth/register").then().statusCode(201);
        given().cookie("arco_session", "lixo").contentType(JSON).post("/auth/logout").then().statusCode(204);
    }

    @Test
    void logout_expiresCookie() {
        var s = TestUsers.register(UserType.COMMON);
        var r = given().cookie("arco_session", s.cookie()).contentType(JSON).post("/auth/logout");
        r.then().statusCode(204);
        assertTrue(r.header("Set-Cookie").contains("Max-Age=0"));
    }

    // Quebra se: o logout passar a aceitar qualquer Content-Type — um <form> de outro site conseguiria
    // deslogar a pessoa (CSRF). Mesmo sem corpo, o POST exige application/json.
    @Test
    void logout_rejectsNonJsonContentType() {
        given().contentType("application/x-www-form-urlencoded").post("/auth/logout")
                .then().statusCode(415).body("code", is("HTTP_415"));
    }
}
