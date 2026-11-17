package dev.whallyson.controllers;

import dev.whallyson.entitys.user.UserType;
import dev.whallyson.support.TestDocuments;
import dev.whallyson.support.TestUsers;
import dev.whallyson.support.TestUsers.Session;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.matchesPattern;

@QuarkusTest
class UserSearchApiTest {

    Session me;
    Session target;

    @BeforeEach
    void users() {
        me = TestUsers.register(UserType.COMMON);
        target = TestUsers.register(UserType.COMMON, "Rafa");
    }

    Response search(String q) {
        return given().cookie("arco_session", me.cookie()).queryParam("q", q).get("/users/search");
    }

    // Quebra se: a busca passar a devolver saldo, e-mail ou documento inteiro de quem não é o dono da conta.
    @Test
    void byExactEmail_ignoringCase_returnsSummaryOnly() {
        search(target.email().toUpperCase()).then().statusCode(200)
                .body("size()", is(1))
                .body("[0].id", is((int) target.id()))
                .body("[0].maskedDocument", matchesPattern("\\*\\*\\*\\.\\d{3}\\.\\d{3}-\\*\\*"))
                .body("[0].keySet()", containsInAnyOrder("id", "firstName", "lastName", "userType", "maskedDocument"));
    }

    @Test
    void byDocument_withOrWithoutPunctuation() {
        search(TestDocuments.formatCpf(target.document())).then().statusCode(200)
                .body("size()", is(1)).body("[0].id", is((int) target.id()));
        search(target.document()).then().statusCode(200)
                .body("size()", is(1)).body("[0].id", is((int) target.id()));
    }

    // Quebra se: os dígitos voltarem a ser extraídos de qualquer texto — a busca viraria aproximada
    // e "x<cpf>y" acharia a pessoa.
    @Test
    void textAroundDocumentDigits_doesNotMatch() {
        search("x" + target.document() + "y").then().statusCode(200).body("size()", is(0));
    }

    // Quebra se: a busca voltar a reconhecer como documento só o que tem dígitos e pontuação. Os CNPJs com letras (que a Receita emite desde
    // julho de 2026) não seriam achados, e a busca os trataria como e-mail. Vale com máscara, sem máscara, em minúsculas e com espaços nas pontas.
    @Test
    void byAlphanumericCnpj_withMask_lowerCase_orPlain() {
        var shop = TestUsers.register(UserType.MERCHANT, "Loja", TestDocuments.alphanumericCnpj());
        String masked = TestDocuments.formatCnpj(shop.document());
        for (String q : List.of(shop.document(), masked, masked.toLowerCase(), "  " + shop.document().toLowerCase() + " ")) {
            search(q).then().statusCode(200)
                    .body("size()", is(1)).body("[0].id", is((int) shop.id()))
                    .body("[0].userType", is("MERCHANT"))
                    .body("[0].maskedDocument", matchesPattern("\\*\\*\\.[0-9A-Z]{3}\\.[0-9A-Z]{3}/\\*\\*\\*\\*-\\*\\*"));
        }
    }

    // Quebra se: a busca por documento virar aproximada com as letras: texto em volta, um pedaço do CNPJ ou o CNPJ com um caractere a mais
    // achariam a loja.
    @Test
    void aroundOrPartOfAnAlphanumericCnpj_doesNotMatch() {
        var shop = TestUsers.register(UserType.MERCHANT, "Loja", TestDocuments.alphanumericCnpj());
        search("x" + shop.document() + "y").then().statusCode(200).body("size()", is(0));
        search("CNPJ " + shop.document()).then().statusCode(200).body("size()", is(0));
        search(shop.document().substring(0, 8)).then().statusCode(200).body("size()", is(0));
        search(shop.document() + "0").then().statusCode(200).body("size()", is(0));
    }

    // Quebra se: a conversão para maiúsculas passar a ser a do Unicode. Nela "ſ" (s longo) vira "S", "ı" (i sem ponto) vira "I" e "ß" vira
    // "SS" (um caractere a menos no texto, um a mais no documento): um texto com esses caracteres acharia a loja.
    @Test
    void nonAsciiLookalikes_doNotMatchAnAlphanumericCnpj() {
        var si = TestUsers.register(UserType.MERCHANT, "Loja", TestDocuments.alphanumericCnpjStartingWith("SI"));
        search("ſı" + si.document().substring(2)).then().statusCode(200).body("size()", is(0));
        var ss = TestUsers.register(UserType.MERCHANT, "Loja", TestDocuments.alphanumericCnpjStartingWith("SS"));
        search("ß" + ss.document().substring(2)).then().statusCode(200).body("size()", is(0));
        search(si.document()).then().statusCode(200).body("size()", is(1)); // o texto de verdade continua achando
    }

    // Quebra se: a busca virar por prefixo — daria para varrer a base de usuários letra a letra.
    @Test
    void partialEmail_returnsEmptyList() {
        search(target.email().substring(0, 6)).then().statusCode(200).body("size()", is(0));
    }

    @Test
    void ownAccount_isExcluded() {
        search(me.email()).then().statusCode(200).body("size()", is(0));
    }

    @Test
    void unknown_returnsEmptyList() {
        search("ninguem@lugar.com").then().statusCode(200).body("size()", is(0));
    }

    @Test
    void tooShortQ_is400() {
        search("ab").then().statusCode(400)
                .body("fieldErrors[0].field", is("q")).body("fieldErrors[0].code", is("QUERY_TOO_SHORT"));
    }

    @Test
    void missingQ_is400() {
        given().cookie("arco_session", me.cookie()).get("/users/search").then().statusCode(400)
                .body("fieldErrors[0].code", is("REQUIRED"));
    }

    @Test
    void unauthenticated_is401() {
        given().queryParam("q", "abc@def.com").get("/users/search").then().statusCode(401);
    }
}
