package dev.whallyson.infra;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * O front-end gera seus tipos a partir deste documento. Estes testes protegem o contrato que ele precisa:
 * as rotas existem, o dinheiro é documentado como string (o JSON real nunca usa número para dinheiro), cada
 * resposta de sucesso declara o seu corpo, os erros apontam para o esquema de erro e nenhum campo de resposta
 * fica opcional (o gerador marcaria com "?" e o front teria de tratar como ausente algo que sempre vem).
 */
@QuarkusTest
class OpenApiContractTest {

    private static final String SCHEMAS = "#/components/schemas/";

    private static JsonPath openApi() {
        return given().get("/q/openapi?format=json").then().statusCode(200).extract().jsonPath();
    }

    // As chaves do documento têm "/" e "$": o caminho GPath as cita entre aspas simples.
    private static String body(String path, String operation, String status) {
        return "paths.'" + path + "'." + operation + ".responses.'" + status + "'.content.'application/json'.schema.'$ref'";
    }

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

    // Quebra se: um POST deixar de declarar o corpo de sucesso (o front perderia os tipos de User e Transaction)
    // ou voltar a anunciar o 200 sem corpo que o gerador devolve para métodos que retornam Response.
    @Test
    void successResponsesDeclareTheirBodies() {
        JsonPath doc = openApi();

        assertEquals(SCHEMAS + "ResponseUser", doc.getString(body("/auth/register", "post", "201")));
        assertNull(doc.get("paths.'/auth/register'.post.responses.'200'"), "register responde 201, não 200");

        assertEquals(SCHEMAS + "ResponseUser", doc.getString(body("/auth/login", "post", "200")));

        assertNotNull(doc.get("paths.'/auth/logout'.post.responses.'204'"), "logout responde 204");
        assertNull(doc.get("paths.'/auth/logout'.post.responses.'200'"), "logout não responde 200");

        assertEquals(SCHEMAS + "ResponseTransaction", doc.getString(body("/transaction", "post", "201")));
        assertNull(doc.get("paths.'/transaction'.post.responses.'200'"), "a transferência responde 201, não 200");
    }

    // Quebra se: as respostas de leitura perderem o tipo. Armadilha do gerador que já apareceu aqui: qualquer
    // @APIResponse num método apaga o 200 que ele deduz do retorno; na página genérica isso deixa o front sem o tipo
    // dos itens (sobra só um "ResponsePage" com items: {}). O front depende dos três tipos abaixo.
    @Test
    void readResponsesKeepTheirTypes() {
        JsonPath doc = openApi();

        assertEquals(SCHEMAS + "ResponseUser", doc.getString(body("/users/me", "get", "200")));
        assertEquals("array", doc.getString("paths.'/users/search'.get.responses.'200'.content.'application/json'.schema.type"));
        assertEquals(SCHEMAS + "ResponseUserSummary",
                doc.getString("paths.'/users/search'.get.responses.'200'.content.'application/json'.schema.items.'$ref'"));
        assertEquals(SCHEMAS + "ResponsePageResponseTransaction", doc.getString(body("/transaction", "get", "200")));
        assertEquals(SCHEMAS + "ResponseTransaction",
                doc.getString("components.schemas.ResponsePageResponseTransaction.properties.items.items.'$ref'"));
    }

    // Quebra se: um erro que o front trata por código deixar de apontar para o esquema de erro (o gerador não tiparia o corpo).
    @Test
    void errorResponsesPointToTheErrorSchema() {
        JsonPath doc = openApi();
        Map<String, List<String>> errorsByOperation = Map.of(
                "/auth/register post", List.of("400", "409"),
                "/auth/login post", List.of("400", "401"),
                "/transaction post", List.of("400", "401", "403", "404", "422", "503"));

        errorsByOperation.forEach((operation, statuses) -> {
            String[] parts = operation.split(" ");
            for (String status : statuses) {
                assertEquals(SCHEMAS + "ErrorResponseDTO", doc.getString(body(parts[0], parts[1], status)),
                        operation + " " + status);
            }
        });
    }

    // Quebra se: o esquema de erro perder um campo do contrato, ou fieldErrors virar obrigatório (ele some quando vazio).
    @Test
    void errorSchemaListsTheContractFields() {
        JsonPath doc = openApi();

        Map<String, Object> properties = doc.getMap("components.schemas.ErrorResponseDTO.properties");
        assertNotNull(properties, "ErrorResponseDTO precisa estar no contrato");
        assertThat(properties.keySet(), hasItems("statusCode", "code", "message", "fieldErrors"));
        assertThat(doc.getList("components.schemas.ErrorResponseDTO.required"), containsInAnyOrder("statusCode", "code", "message"));
        assertEquals(SCHEMAS + "FieldError", doc.getString("components.schemas.ErrorResponseDTO.properties.fieldErrors.items.'$ref'"));
        assertThat(doc.getList("components.schemas.FieldError.required"), containsInAnyOrder("field", "code"));
    }

    // Quebra se: um campo de resposta ficar opcional. O gerador de tipos o marcaria com "?" e o front passaria a
    // tratar como ausente o que o back-end sempre manda (saldo, nome, direção da transferência).
    @Test
    void responseSchemasRequireEveryProperty() {
        JsonPath doc = openApi();

        for (String schema : List.of("ResponseUser", "ResponseUserSummary", "ResponseTransaction", "Party", "ResponsePageResponseTransaction")) {
            Map<String, Object> properties = doc.getMap("components.schemas." + schema + ".properties");
            List<String> required = doc.getList("components.schemas." + schema + ".required");
            assertNotNull(properties, schema + " deve ter propriedades");
            assertThat(schema + ": required", required, containsInAnyOrder(properties.keySet().toArray()));
        }
    }
}
