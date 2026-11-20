package dev.whallyson.controllers;

import dev.whallyson.entitys.user.UserType;
import dev.whallyson.mocks.AuthorizationTransaction.AuthorizationTransaction;
import dev.whallyson.mocks.SendNotification.SendNotification;
import dev.whallyson.support.Authorizations;
import dev.whallyson.support.TestUsers;
import dev.whallyson.support.TestUsers.Session;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.mockito.InjectMock;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import org.hibernate.SessionFactory;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static dev.whallyson.support.TestUsers.transfer;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.when;

@QuarkusTest
class StatementApiTest {

    @InjectMock
    @RestClient
    AuthorizationTransaction authorizer;

    @InjectMock
    @RestClient
    SendNotification notifier;

    @Inject
    SessionFactory sessionFactory;

    Session a;
    Session b;
    Session c;

    // Do mais antigo ao mais novo: A->B 100.00, B->A 30.00, A->C 10.00
    @BeforeEach
    void setUp() {
        when(authorizer.authorize()).thenReturn(Authorizations.granted());
        a = TestUsers.registerWithBalance(UserType.COMMON, "500.00");
        b = TestUsers.registerWithBalance(UserType.COMMON, "500.00");
        c = TestUsers.register(UserType.COMMON);
        transfer(a, b.id(), "100.00");
        transfer(b, a.id(), "30.00");
        transfer(a, c.id(), "10.00");
    }

    Response get(Session s, String query) {
        String url = query.isEmpty() ? "/transaction" : "/transaction?" + query;
        return given().cookie("arco_session", s.cookie()).get(url);
    }

    // Consultas ao banco que um GET do extrato faz. Fica o menor de três medidas: um aviso que ainda esteja sendo gravado em
    // segundo plano (depois do commit da transferência) soma consultas à medida e não pode inflar o resultado.
    long statementQueries(Session s) {
        long fewest = Long.MAX_VALUE;
        for (int i = 0; i < 3; i++) {
            long before = sessionFactory.getStatistics().getPrepareStatementCount();
            get(s, "").then().statusCode(200);
            fewest = Math.min(fewest, sessionFactory.getStatistics().getPrepareStatementCount() - before);
        }
        return fewest;
    }

    // Quebra se: o extrato passar a ler remetente e destinatário com uma consulta por pessoa (o N+1): o número de consultas passaria a
    // crescer com quantas pessoas diferentes aparecem na página. Compara quem tem 2 contrapartes com quem tem 6. Quem evita o N+1 é a
    // leitura em lote do Quarkus (as pessoas vêm num único "where id in (...)", até 16 por consulta); com ela desligada
    // (quarkus.hibernate-orm.fetch.batch-size=1) este teste reprova (5 consultas contra 9).
    @Test
    void statementQueryCount_doesNotGrowWithTheNumberOfCounterparties() {
        Session d = TestUsers.registerWithBalance(UserType.COMMON, "500.00");
        for (int i = 0; i < 6; i++) {
            transfer(d, TestUsers.register(UserType.COMMON).id(), "1.00");
        }
        assertEquals(statementQueries(a), statementQueries(d));
    }

    // Quebra se: a ordem deixar de ser a mais recente primeiro, ou a direção for calculada para o lado errado.
    @Test
    void all_listsBothDirections_newestFirst() {
        get(a, "").then().statusCode(200)
                .body("total", is(3)).body("page", is(0)).body("size", is(20))
                .body("items.direction", contains("SENT", "RECEIVED", "SENT"))
                .body("items.amount", contains("10.00", "30.00", "100.00"));
    }

    @Test
    void filtersSentAndReceived() {
        get(a, "direction=sent").then().body("total", is(2));
        get(a, "direction=received").then().body("total", is(1)).body("items[0].direction", is("RECEIVED"));
    }

    // Quebra se: a página vier sem pular os itens anteriores, ou o total contar só a página.
    @Test
    void paginates() {
        get(a, "size=1&page=1").then()
                .body("items.size()", is(1)).body("items[0].amount", is("30.00")).body("total", is(3));
    }

    // Quebra se: o extrato listar transferências de outras pessoas.
    @Test
    void onlyOwnTransactions() {
        get(c, "").then().body("total", is(1)).body("items[0].direction", is("RECEIVED"));
    }

    @Test
    void invalidPaging_is400() {
        for (String q : List.of("size=0", "size=51", "page=-1", "direction=foo")) {
            get(a, q).then().statusCode(400).body("code", is("VALIDATION_ERROR"));
        }
    }

    // Página além do fim (inclusive um número enorme, em que página x tamanho estoura int) é uma página vazia
    // com o total correto, nunca 500. Quebra se: o deslocamento voltar a ser calculado em int.
    @Test
    void pageBeyondTheEnd_isAnEmptyPage_not500() {
        for (String page : List.of("5", "2147483647")) {
            get(a, "size=50&page=" + page).then().statusCode(200)
                    .body("items.size()", is(0)).body("total", is(3)).body("page", is(Integer.parseInt(page)));
        }
    }

    @Test
    void unauthenticated_is401() {
        given().get("/transaction").then().statusCode(401);
    }

    // Quebra se: o extrato passar a vazar senha, saldo ou e-mail de alguma das pontas.
    @Test
    void neverExposesSecrets() {
        String raw = get(a, "").asString();
        assertAll(
                () -> assertFalse(raw.contains("password")),
                () -> assertFalse(raw.contains("passwordHash")),
                () -> assertFalse(raw.contains("balance")),
                () -> assertFalse(raw.contains("@")));
    }

    // Quebra se: um parâmetro que não é número voltar a responder 404 "recurso não encontrado" (a conversão do @QueryParam falha) em vez
    // do 400 de validação que os fora de faixa (page=-1) já recebem.
    @Test
    void nonNumericOrHugePaging_is400() {
        for (String query : List.of("page=abc", "size=abc", "size=99999999999", "page=1.5", "page=")) {
            get(a, query).then().statusCode(400).body("code", org.hamcrest.Matchers.is("VALIDATION_ERROR"));
        }
    }
}
