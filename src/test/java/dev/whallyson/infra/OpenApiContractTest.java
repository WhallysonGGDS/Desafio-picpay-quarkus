package dev.whallyson.infra;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.is;

/**
 * O front-end gera seus tipos a partir deste documento. Estes testes protegem o contrato que ele precisa:
 * as rotas existem e o dinheiro é documentado como string (o JSON real nunca usa número para dinheiro).
 */
@QuarkusTest
class OpenApiContractTest {

    // Quebra se: uma rota que o front usa sumir do contrato.
    @Test
    void documentsEveryRouteTheFrontNeeds() {
        given().get("/q/openapi?format=json").then().statusCode(200)
                .body("paths.keySet()", hasItems("/auth/register", "/auth/login", "/auth/logout", "/users/me", "/users/search", "/transaction"));
    }

    // Quebra se: o dinheiro voltar a ser documentado como number — o cliente gerado trataria saldo como double.
    @Test
    void moneyIsDocumentedAsString() {
        given().get("/q/openapi?format=json").then().statusCode(200)
                .body("components.schemas.ResponseUser.properties.balance.type", is("string"))
                .body("components.schemas.ResponseTransaction.properties.amount.type", is("string"))
                .body("components.schemas.RequestTransaction.properties.amount.type", is("string"));
    }
}
