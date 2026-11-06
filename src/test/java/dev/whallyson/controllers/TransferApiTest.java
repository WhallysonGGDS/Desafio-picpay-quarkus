package dev.whallyson.controllers;

import dev.whallyson.entitys.transaction.Transaction;
import dev.whallyson.entitys.user.UserType;
import dev.whallyson.mocks.AuthorizationTransaction.AuthorizationTransaction;
import dev.whallyson.mocks.SendNotification.SendNotification;
import dev.whallyson.support.Authorizations;
import dev.whallyson.support.TestUsers;
import dev.whallyson.support.TestUsers.Session;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.mockito.InjectMock;
import jakarta.ws.rs.ProcessingException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.stream.Stream;

import static dev.whallyson.support.TestUsers.balanceOf;
import static dev.whallyson.support.TestUsers.transfer;
import static io.restassured.RestAssured.given;
import static io.restassured.http.ContentType.JSON;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.matchesPattern;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
class TransferApiTest {

    // Nenhum teste fala com o util.devi.tools: os dois clientes REST externos são substituídos.
    @InjectMock
    @RestClient
    AuthorizationTransaction authorizer;

    @InjectMock
    @RestClient
    SendNotification notifier;

    Session a;
    Session b;

    @BeforeEach
    void setUp() {
        when(authorizer.authorize()).thenReturn(Authorizations.granted());
        a = TestUsers.registerWithBalance(UserType.COMMON, "500.00");
        b = TestUsers.registerWithBalance(UserType.COMMON, "100.00");
    }

    // Chamada direta (e não Transaction::count): o Panache só reescreve chamadas estáticas explícitas.
    long txCount() {
        return QuarkusTransaction.requiringNew().call(() -> Transaction.count());
    }

    void assertUntouched(long before) {
        assertEquals("500.00", balanceOf(a));
        assertEquals("100.00", balanceOf(b));
        assertEquals(before, txCount());
    }

    // Quebra se: o débito/crédito errar, a transação voltar sem os status PENDING, ou o horário sair sem fuso.
    @Test
    void movesMoney_andReturnsPendingTransaction() {
        transfer(a, b.id(), "250.00").then().statusCode(201)
                .body("amount", is("250.00"))
                .body("sender.id", is((int) a.id()))
                .body("receiver.id", is((int) b.id()))
                .body("direction", is("SENT"))
                .body("notifySender", is("PENDING"))
                .body("notifyReceiver", is("PENDING"))
                .body("timestamp", matchesPattern("\\d{4}-\\d{2}-\\d{2}T.*Z"));
        assertEquals("250.00", balanceOf(a));
        assertEquals("350.00", balanceOf(b));
    }

    // Quebra se: a conferência de saldo virar "<= 0" em vez de "< 0": quem tem R$ 10,00 não conseguiria enviar R$ 10,00 (o formulário
    // deixa), e o servidor responderia INSUFFICIENT_BALANCE para um envio que a conta cobre. Um centavo a mais continua recusado.
    @Test
    void transferringTheWholeBalance_isAllowed_andOneCentMoreIsNot() {
        Session c = TestUsers.registerWithBalance(UserType.COMMON, "10.00");

        transfer(c, b.id(), "10.01").then().statusCode(422).body("code", is("INSUFFICIENT_BALANCE"));
        assertEquals("10.00", balanceOf(c));

        transfer(c, b.id(), "10.00").then().statusCode(201);
        assertEquals("0.00", balanceOf(c));
        assertEquals("110.00", balanceOf(b));
    }

    // Quebra se: o remetente voltar a ser lido do corpo — qualquer um moveria o dinheiro de qualquer pessoa.
    @Test
    void senderIsAlwaysTheAuthenticatedUser() {
        given().cookie("arco_session", a.cookie()).contentType(JSON)
                .body(Map.of("receiverId", b.id(), "senderId", b.id(), "amount", "10.00"))
                .post("/transaction").then().statusCode(201);
        assertEquals("490.00", balanceOf(a));
        assertEquals("110.00", balanceOf(b));
    }

    @Test
    void requiresAuthentication_andJson() {
        given().contentType(JSON).body("{}").post("/transaction").then().statusCode(401);
        given().cookie("arco_session", a.cookie()).contentType("text/plain").body("x").post("/transaction").then().statusCode(415);
    }

    // RF5
    @Test
    void nonPositiveOrTooPreciseAmount_is400WithAmountField() {
        for (String v : List.of("0", "0.00", "-5.00", "0.001", "10.123")) {
            transfer(a, b.id(), v).then().statusCode(400).body("fieldErrors.field", hasItem("amount"));
        }
    }

    @Test
    void missingFields_are400() {
        given().cookie("arco_session", a.cookie()).contentType(JSON).body("{}").post("/transaction").then().statusCode(400)
                .body("fieldErrors.field", hasItems("receiverId", "amount"))
                .body("fieldErrors.code", everyItem(is("REQUIRED")));
    }

    @Test
    void nonNumericAmount_is400() {
        transfer(a, b.id(), "abc").then().statusCode(400).body("code", is("VALIDATION_ERROR"));
    }

    // RF5. Quebra se: a escala do valor deixar de ser normalizada, o número JSON deixar de ser aceito
    // ou a notação exponencial passar a gerar um valor errado.
    @Test
    void unusualAmountFormats_areAcceptedAndNormalized() {
        transfer(a, b.id(), "250.5").then().statusCode(201).body("amount", is("250.50"));
        transfer(a, b.id(), new BigDecimal("10.10")).then().statusCode(201).body("amount", is("10.10")); // número JSON
        transfer(a, b.id(), "1e2").then().statusCode(201).body("amount", is("100.00"));
    }

    // RF5. Quebra se: um valor enorme estourar em vez de ser recusado por saldo.
    @Test
    void hugeAmount_isInsufficientBalance_not500() {
        transfer(a, b.id(), "999999999999999.99").then().statusCode(422).body("code", is("INSUFFICIENT_BALANCE"));
    }

    // Quebra se: o Jackson voltar a truncar fração em campo inteiro — "receiverId": 2.9 pagaria ao usuário 2 em silêncio.
    @Test
    void fractionalReceiverId_isRejected_notTruncatedToAnotherUser() {
        long before = txCount();
        transfer(a, b.id() + 0.9, "1.00").then().statusCode(400).body("code", is("VALIDATION_ERROR"));
        assertUntouched(before);
    }

    @Test
    void unknownReceiver_is404() {
        long before = txCount();
        transfer(a, 987654321L, "1.00").then().statusCode(404).body("code", is("USER_NOT_FOUND"));
        assertUntouched(before);
    }

    @Test
    void toSelf_is422() {
        long before = txCount();
        transfer(a, a.id(), "1.00").then().statusCode(422).body("code", is("SELF_TRANSFER"));
        assertUntouched(before);
    }

    @Test
    void merchantSender_is403() {
        var m = TestUsers.registerWithBalance(UserType.MERCHANT, "500.00");
        transfer(m, b.id(), "1.00").then().statusCode(403).body("code", is("MERCHANT_CANNOT_SEND"));
        assertEquals("500.00", balanceOf(m));
    }

    @Test
    void merchantReceiver_isAllowed() {
        var m = TestUsers.register(UserType.MERCHANT);
        transfer(a, m.id(), "10.00").then().statusCode(201);
        assertEquals("10.00", balanceOf(m));
    }

    // Quebra se: o autorizador passar a ser chamado antes de checar o saldo (consulta externa à toa).
    @Test
    void insufficientBalance_is422_andAuthorizerNotCalled() {
        var poor = TestUsers.registerWithBalance(UserType.COMMON, "10.00");
        transfer(poor, b.id(), "50.00").then().statusCode(422).body("code", is("INSUFFICIENT_BALANCE"));
        verify(authorizer, never()).authorize();
        assertEquals("10.00", balanceOf(poor));
    }

    // Quebra se: só o status HTTP for olhado (data.authorization=false com 200 passaria) ou uma recusa mexer no saldo.
    @Test
    void authorizerDenial_is422_andRollsBack() {
        List<Consumer<AuthorizationTransaction>> denials = List.of(
                m -> when(m.authorize()).thenThrow(new WebApplicationException(Response.status(403).build())),
                m -> when(m.authorize()).thenReturn(Authorizations.denied()),
                m -> when(m.authorize()).thenReturn(null));
        for (var stub : denials) {
            reset(authorizer); // when(mock.m()) chama m(); sem o reset ele lançaria a exceção programada antes
            stub.accept(authorizer);
            long before = txCount();
            transfer(a, b.id(), "10.00").then().statusCode(422).body("code", is("AUTHORIZATION_DENIED"));
            assertUntouched(before);
        }
    }

    // Quebra se: autorizador fora do ar for tratado como recusa (422) ou, pior, como aprovação.
    @Test
    void authorizerUnavailable_is503_andRollsBack() {
        for (Throwable t : List.of(new ProcessingException("timeout"), new WebApplicationException(Response.status(500).build()))) {
            reset(authorizer);
            when(authorizer.authorize()).thenThrow(t);
            long before = txCount();
            transfer(a, b.id(), "10.00").then().statusCode(503).body("code", is("AUTHORIZER_UNAVAILABLE"));
            assertUntouched(before);
        }
    }

    // Quebra se: o saldo deixar de ser travado — duas transferências simultâneas deixariam a conta negativa.
    @Test
    void concurrentTransfers_neverOverdraw() throws Exception {
        var rich = TestUsers.registerWithBalance(UserType.COMMON, "100.00");
        var dest = TestUsers.registerWithBalance(UserType.COMMON, "0.00");
        var pool = Executors.newFixedThreadPool(2);
        var gate = new CountDownLatch(1);
        Callable<Integer> call = () -> {
            gate.await();
            return transfer(rich, dest.id(), "80.00").statusCode();
        };
        var f1 = pool.submit(call);
        var f2 = pool.submit(call);
        gate.countDown();
        assertEquals(List.of(201, 422), Stream.of(f1.get(), f2.get()).sorted().toList());
        pool.shutdown();
        assertEquals("20.00", balanceOf(rich));
        assertEquals("80.00", balanceOf(dest));
    }

    // Quebra se: o autorizador voltar a ser chamado com os saldos TRAVADOS. A chamada externa leva até 4 s; com o lock retido, toda
    // transferência das mesmas contas esperava em fila (uma por ida ao autorizador) e, passados os 10 s de LOCK_TIMEOUT do banco,
    // virava 500: o front dizia "não deu para confirmar" para algo que nem tinha sido gravado.
    @Test
    void authorizerIsCalledWithoutHoldingTheBalanceLocks() throws Exception {
        var stuck = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var first = new AtomicBoolean(true);
        when(authorizer.authorize()).thenAnswer(invocation -> {
            if (first.getAndSet(false)) { // só o 1º pedido fica preso lá dentro
                stuck.countDown();
                release.await(15, TimeUnit.SECONDS);
            }
            return Authorizations.granted();
        });
        var pool = Executors.newSingleThreadExecutor();
        try {
            var held = pool.submit(() -> transfer(a, b.id(), "10.00").statusCode());
            assertTrue(stuck.await(10, TimeUnit.SECONDS), "o 1º pedido devia chegar ao autorizador");

            // Com o 1º parado no autorizador, outro pedido das MESMAS contas tem de terminar sem esperar por ele.
            assertEquals(201, transfer(a, b.id(), "20.00").statusCode());
            assertFalse(held.isDone(), "o 1º ainda devia estar preso no autorizador");

            release.countDown();
            assertEquals(201, held.get(10, TimeUnit.SECONDS));
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
        assertEquals("470.00", balanceOf(a)); // 500 - 10 - 20
        assertEquals("130.00", balanceOf(b)); // 100 + 10 + 20
    }

    // Quebra se: o saldo não for conferido DE NOVO depois da autorização, já com os saldos travados. Dois pedidos que passaram juntos
    // pela primeira conferência (e pelo autorizador) deixariam a conta negativa. A barreira dentro do autorizador garante que os dois
    // estão lá ao mesmo tempo: é o que o teste acima de concorrência, sem barreira, só pegava por sorte.
    @Test
    void balanceIsRecheckedUnderTheLock_afterTheAuthorization() throws Exception {
        var rich = TestUsers.registerWithBalance(UserType.COMMON, "100.00");
        var dest = TestUsers.registerWithBalance(UserType.COMMON, "0.00");
        var bothInside = new CyclicBarrier(2);
        when(authorizer.authorize()).thenAnswer(invocation -> {
            bothInside.await(10, TimeUnit.SECONDS);
            return Authorizations.granted();
        });
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> call = () -> transfer(rich, dest.id(), "80.00").statusCode();
            var f1 = pool.submit(call);
            var f2 = pool.submit(call);
            assertEquals(List.of(201, 422), Stream.of(f1.get(30, TimeUnit.SECONDS), f2.get(30, TimeUnit.SECONDS)).sorted().toList());
        } finally {
            pool.shutdownNow();
        }
        assertEquals("20.00", balanceOf(rich));
        assertEquals("80.00", balanceOf(dest));
    }

    // Quebra se: os saldos deixarem de ser travados em ordem crescente de id. A→B e B→A ao mesmo tempo travariam um de cada lado e
    // esperariam um pelo outro (o banco desfaz um dos dois com erro, ou os dois esperam o LOCK_TIMEOUT). Oito pedidos (quatro em cada
    // sentido) são alinhados por uma barreira no instante de travar, e a repetição cobre a sorte do entrelaçamento: com dois pedidos só,
    // a troca da ordem dos locks sobrevivia a cinco rodadas.
    @Test
    void crossedTransfers_neverDeadlock() throws Exception {
        var x = TestUsers.registerWithBalance(UserType.COMMON, "1000.00");
        var y = TestUsers.registerWithBalance(UserType.COMMON, "1000.00");
        int perSide = 4;
        var pool = Executors.newFixedThreadPool(2 * perSide);
        try {
            for (int round = 0; round < 10; round++) {
                var allInside = new CyclicBarrier(2 * perSide);
                reset(authorizer); // when(mock.m()) chama m(): sem o reset ele executaria a resposta da rodada anterior (e esperaria a barreira velha)
                when(authorizer.authorize()).thenAnswer(invocation -> {
                    allInside.await(20, TimeUnit.SECONDS);
                    return Authorizations.granted();
                });
                List<java.util.concurrent.Future<Integer>> calls = new java.util.ArrayList<>();
                for (int i = 0; i < perSide; i++) {
                    calls.add(pool.submit(() -> transfer(x, y.id(), "3.00").statusCode()));
                    calls.add(pool.submit(() -> transfer(y, x.id(), "1.00").statusCode()));
                }
                for (var call : calls) {
                    assertEquals(201, call.get(60, TimeUnit.SECONDS), "rodada " + round);
                }
            }
        } finally {
            pool.shutdownNow();
        }
        // 10 rodadas x (4 x 3,00 de x para y e 4 x 1,00 de y para x)
        assertEquals("920.00", balanceOf(x)); // 1000 - 10 x (12 - 4)
        assertEquals("1080.00", balanceOf(y));
    }
}
