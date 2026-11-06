package dev.whallyson;

import dev.whallyson.support.TestDocuments;
import io.quarkus.test.junit.QuarkusIntegrationTest;
import io.restassured.RestAssured;
import io.restassured.config.DecoderConfig;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static io.restassured.RestAssured.given;
import static io.restassured.http.ContentType.JSON;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.MatcherAssert.assertThat;

// Roda contra o jar empacotado, em perfil de produção: é onde o Quinoa serve o front na mesma origem da API.
// (Nos @QuarkusTest o Quinoa fica desligado; o fallback do SPA também só existe em produção.)
@QuarkusIntegrationTest
class SpaServingIT {

    // O que um navegador envia ao navegar para uma URL: HTML primeiro, qualquer coisa depois.
    private static final String BROWSER = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

    // Quebra se: o cookie de sessão de PRODUÇÃO sair sem Secure (app.jwt.cookie-secure virar false no application.properties, ou ganhar
    // um valor padrão na injeção). Os @QuarkusTest rodam com cookie-secure=false (%test), o e2e sobe o jar com
    // -Dapp.jwt.cookie-secure=false, e SessionCookieTest monta o cookie à mão: só este teste, que roda o jar no perfil de produção
    // e faz um cadastro de verdade, prova o que o README promete ("Secure fora dos perfis dev e test").
    @Test
    void theSessionCookieIsSecureHttpOnlyAndSameSiteStrictInProduction() {
        String setCookie = given().contentType(JSON)
                .body(Map.of("firstName", "Ana", "lastName", "Prod", "document", TestDocuments.cpf(), "email", TestDocuments.email(),
                        "password", "senha-de-producao", "userType", "COMMON"))
                .post("/auth/register").then().statusCode(201)
                .extract().header("Set-Cookie");

        assertNotNull(setCookie, "o cadastro não mandou o cookie de sessão");
        assertThat(setCookie, allOf(containsString("arco_session="), containsString("Secure"), containsString("HttpOnly"),
                containsString("SameSite=Strict")));
    }

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

    // O pacote que o index.html carrega ("/assets/index-<hash>.js") e a folha de estilo dele: é o que o navegador baixa primeiro.
    private static String asset(String extension) {
        String html = given().accept(BROWSER).get("/").asString();
        Matcher matcher = Pattern.compile("/assets/index-[^\"]+\\." + extension).matcher(html);
        if (!matcher.find()) {
            throw new AssertionError("o index.html não carrega um /assets/index-*." + extension + ":\n" + html);
        }
        return matcher.group();
    }

    // Sem os decodificadores o cliente não descomprime sozinho nem apaga o Content-Encoding da resposta: o que se confere é o que
    // o servidor mandou.
    private static RequestSpecification acceptingGzip() {
        return given().config(RestAssured.config().decoderConfig(DecoderConfig.decoderConfig().noContentDecoders()))
                .header("Accept-Encoding", "gzip");
    }

    // Quebra se: o servidor não comprimir o que o navegador aceita comprimido. O orçamento do bundle (170 kB) é medido em gzip:
    // sem compressão a entrada de uns 127 kB baixaria com uns 400 kB.
    @Test
    void compressesScriptsStylesAndHtmlForBrowsersThatAcceptGzip() {
        acceptingGzip().get(asset("js")).then().statusCode(200).header("Content-Encoding", "gzip");
        acceptingGzip().get(asset("css")).then().statusCode(200).header("Content-Encoding", "gzip");
        acceptingGzip().accept(BROWSER).get("/").then().statusCode(200).header("Content-Encoding", "gzip");
    }

    // Quebra se: a compressão passar a valer para quem não pediu (um cliente sem Accept-Encoding receberia bytes que não sabe ler).
    @Test
    void sendsPlainBytesToClientsThatDidNotAskForGzip() {
        given().config(RestAssured.config().decoderConfig(DecoderConfig.decoderConfig().noContentDecoders()))
                .get(asset("js")).then().statusCode(200).header("Content-Encoding", is((String) null));
    }

    // Quebra se: o index.html for servido com cache longo (e "immutable"): depois de um novo build ele apontaria, por até um dia,
    // para pacotes de nome-hash que já não existem. Já os pacotes de nome-hash podem (e devem) ficar em cache.
    @Test
    void indexHtmlIsRevalidatedButHashedAssetsAreCachedForLong() {
        for (String path : List.of("/", "/carteira", "/entrar")) {
            given().accept(BROWSER).get(path).then().statusCode(200)
                    .header("Cache-Control", is("no-cache"));
        }
        given().get(asset("js")).then().statusCode(200)
                .header("Cache-Control", containsString("immutable"))
                .header("Cache-Control", not(containsString("no-cache")));
    }

    // Quebra se: algum tipo de resposta (página, pacote ou API) sair sem os cabeçalhos básicos de segurança: o navegador voltaria
    // a adivinhar o tipo do conteúdo (nosniff), a mandar a URL inteira como origem de quem sai do app e a deixar outro site
    // enquadrar o app (clickjacking).
    @Test
    void sendsTheBasicSecurityHeadersOnPagesAssetsAndTheApi() {
        for (String path : List.of("/", "/carteira", "/hello", "/users/me", asset("js"), asset("css"))) {
            given().accept(BROWSER).get(path).then()
                    .header("X-Content-Type-Options", is("nosniff"))
                    .header("Referrer-Policy", is("strict-origin-when-cross-origin"))
                    .header("X-Frame-Options", is("DENY"));
        }
    }

    // Quebra se: a política do front afrouxar: nada de fora da própria origem (nem imagem ou fonte `data:`), nenhum script ou estilo
    // embutido ou gerado (o que um XSS precisaria), nenhum objeto, ninguém enquadra o app e nenhum formulário envia para fora.
    // O front não carrega nada de terceiros nem injeta HTML, então a política mais estrita que serve é a certa. Confere a política
    // inteira, diretiva por diretiva: afrouxar uma, ou acrescentar uma fonte, tem de ser uma decisão tomada aqui, de propósito.
    @Test
    void contentSecurityPolicyConfinesTheAppToItsOwnOrigin() {
        String policy = given().accept(BROWSER).get("/").then().statusCode(200).extract().header("Content-Security-Policy");
        assertNotNull(policy, "a página precisa de Content-Security-Policy");

        Map<String, String> directives = new HashMap<>();
        for (String part : policy.split(";")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                int space = trimmed.indexOf(' ');
                directives.put(space < 0 ? trimmed : trimmed.substring(0, space), space < 0 ? "" : trimmed.substring(space + 1));
            }
        }
        assertEquals(Map.of(
                "default-src", "'self'",
                "script-src", "'self'",
                "style-src", "'self'",
                "img-src", "'self'",
                "font-src", "'self'",
                "connect-src", "'self'",
                "object-src", "'none'",
                "base-uri", "'self'",
                "form-action", "'self'",
                "frame-ancestors", "'none'"), directives, "a política de conteúdo mudou: " + policy);
    }
}
