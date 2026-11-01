package dev.whallyson.infra;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static io.restassured.http.ContentType.JSON;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;

@QuarkusTest
class ErrorModelTest {

    // Quebra se: o handler global voltar a transformar exceções HTTP do JAX-RS em 500.
    @Test
    void unknownRoute_is404Json() {
        given().get("/nao-existe").then().statusCode(404)
                .body("code", is("NOT_FOUND")).body("statusCode", is(404));
    }

    @Test
    void wrongMethod_is405Json() {
        given().post("/hello").then().statusCode(405).body("code", is("METHOD_NOT_ALLOWED"));
    }

    // Quebra se: um status HTTP sem código dedicado perder o corpo JSON ou o prefixo HTTP_.
    @Test
    void unsupportedMediaType_isHttp415() {
        given().contentType("text/plain").body("x").post("/__probe/validate").then().statusCode(415)
                .body("code", is("HTTP_415"));
    }

    // Quebra se: o mapper de ApiException ignorar o status ou a mensagem do ErrorCode.
    @Test
    void apiException_usesCodeStatusAndMessage() {
        given().get("/__probe/api").then().statusCode(422)
                .body("code", is("INSUFFICIENT_BALANCE")).body("message", is("Saldo insuficiente."));
    }

    // Quebra se: o mapper de validação não expuser campo e código por violação.
    @Test
    void bodyValidation_listsFieldErrors() {
        given().contentType(JSON).body("{\"name\":\"\"}").post("/__probe/validate").then().statusCode(400)
                .body("code", is("VALIDATION_ERROR"))
                .body("fieldErrors[0].field", is("name"))
                .body("fieldErrors[0].code", is("REQUIRED"));
    }

    @Test
    void missingBody_reportsFieldBody() {
        given().contentType(JSON).post("/__probe/validate").then().statusCode(400)
                .body("fieldErrors[0].field", is("body"))
                .body("fieldErrors[0].code", is("REQUIRED"));
    }

    @Test
    void malformedJson_is400() {
        given().contentType(JSON).body("{").post("/__probe/validate").then().statusCode(400)
                .body("code", is("VALIDATION_ERROR"));
    }

    // Quebra se: a mensagem da exceção interna vazar na resposta.
    @Test
    void unexpectedException_is500WithoutDetails() {
        given().get("/__probe/boom").then().statusCode(500)
                .body("code", is("INTERNAL_ERROR"))
                .body("message", not(containsString("segredo")));
    }
}
