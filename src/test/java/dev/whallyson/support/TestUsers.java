package dev.whallyson.support;

import dev.whallyson.entitys.user.User;
import dev.whallyson.entitys.user.UserType;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.restassured.response.Response;

import java.math.BigDecimal;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static io.restassured.http.ContentType.JSON;

/**
 * Cria usuários reais pela API (cadastro por HTTP) e ajusta saldos direto no banco, para que cada
 * teste monte o cenário sem depender de outro teste. Todos usam a senha {@code segredo123}.
 */
public final class TestUsers {

    /** {@code document} são os dígitos do CPF, ou do CNPJ quando o usuário é lojista. */
    public record Session(long id, String email, String firstName, String document, String cookie) {}

    private TestUsers() {}

    public static Session register(UserType type) {
        return register(type, "Ana");
    }

    public static Session register(UserType type, String firstName) {
        String email = TestDocuments.email();
        String document = type == UserType.MERCHANT ? TestDocuments.cnpj() : TestDocuments.cpf();
        Response response = given().contentType(JSON)
                .body(Map.of("firstName", firstName, "lastName", "Teste", "document", document,
                        "email", email, "password", "segredo123", "userType", type.name()))
                .post("/auth/register");
        response.then().statusCode(201);
        return new Session(response.jsonPath().getLong("id"), email, firstName, document, response.getCookie("arco_session"));
    }

    public static Session registerWithBalance(UserType type, String balance) {
        Session session = register(type);
        setBalance(session.id(), balance);
        return session;
    }

    public static void setBalance(long userId, String balance) {
        QuarkusTransaction.requiringNew().run(() ->
                User.update("balance = ?1 where id = ?2", new BigDecimal(balance), userId));
    }

    /** Saldo como a própria API o mostra ao dono da conta. */
    public static String balanceOf(Session session) {
        return given().cookie("arco_session", session.cookie())
                .get("/users/me").then().statusCode(200).extract().path("balance");
    }
}
