package dev.whallyson;

import io.quarkus.test.junit.QuarkusIntegrationTest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

// Roda contra o jar empacotado, em perfil de produção: é onde o Quinoa serve o front na mesma origem da API.
// (Nos @QuarkusTest o Quinoa fica desligado; o fallback do SPA também só existe em produção.)
@QuarkusIntegrationTest
class SpaServingIT {

    // O que um navegador envia ao navegar para uma URL: HTML primeiro, qualquer coisa depois.
    private static final String BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

    // Quebra se: o front deixar de ser empacotado/servido na raiz, ou o index.html perder a raiz do React ou o idioma.
    @Test
    void servesTheAppShellOnTheRoot() {
        given().accept(BROWSER).get("/").then().statusCode(200)
                .contentType(containsString("text/html"))
                .body(containsString("<div id=\"root\"></div>"))
                .body(containsString("lang=\"pt-BR\""));
    }

    // Quebra se: o fallback sumir. Quem atualiza a página em /carteira receberia 404 em vez do app.
    @Test
    void clientRoutesFallBackToIndexHtml() {
        for (String path : List.of("/carteira", "/transferir", "/extrato", "/entrar", "/criar-conta")) {
            given().accept(BROWSER).get(path).then().statusCode(200)
                    .contentType(containsString("text/html"))
                    .body(containsString("<div id=\"root\"></div>"));
        }
    }

    // Quebra se: o fallback responder HTML a quem não é navegador. Um cliente da API que erra a URL
    // precisa receber o JSON de erro do contrato, mesmo numa rota que o SPA conhece.
    @Test
    void nonBrowserClientsKeepGettingJson404() {
        for (String path : List.of("/carteira", "/qualquer-coisa")) {
            given().accept("application/json").get(path).then().statusCode(404).body("code", is("NOT_FOUND"));
        }
    }

    // Quebra se: o fallback reescrever pedido de arquivo. Um asset ausente viraria HTML 200 e
    // o navegador falharia lá na frente com "Unexpected token <".
    @Test
    void missingFilesStay404() {
        given().accept(BROWSER).get("/assets/nao-existe.js").then().statusCode(404);
    }

    // Quebra se: o fallback engolir rota inexistente da API e devolver HTML onde o contrato promete JSON de erro.
    @Test
    void unknownApiRoutesStayJson404() {
        for (String path : List.of("/users/nao-existe", "/auth/nao-existe", "/transaction/nao-existe")) {
            given().accept(BROWSER).get(path).then().statusCode(404).body("code", is("NOT_FOUND"));
        }
    }

    // Quebra se: um prefixo da API ficar de fora de ignored-path-prefixes e o SPA passar a responder por ele.
    @Test
    void apiAndDocsAreNotShadowedByTheSpa() {
        given().accept(BROWSER).get("/hello").then().statusCode(200).body(is("Hello from Quarkus REST"));
        given().accept(BROWSER).get("/q/openapi?format=json").then().statusCode(200).body("openapi", notNullValue());
        given().accept(BROWSER).get("/users/me").then().statusCode(401).body("code", is("UNAUTHENTICATED"));
    }
}
