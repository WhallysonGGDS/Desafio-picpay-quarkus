package dev.whallyson.services;

import dev.whallyson.dtos.requests.RequestSendNotification;
import dev.whallyson.entitys.transaction.NotificationStatus;
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
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.rest.client.inject.RestClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import static dev.whallyson.support.TestUsers.balanceOf;
import static dev.whallyson.support.TestUsers.transfer;
import static java.util.concurrent.TimeUnit.NANOSECONDS;
import static java.util.concurrent.TimeUnit.SECONDS;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@QuarkusTest
class NotificationApiTest {

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
        b = TestUsers.register(UserType.COMMON, "Rafa");
    }

    // O envio é assíncrono: entregas atrasadas de outros testes podem tocar este mock. Por isso cada verificação
    // olha só as chamadas destinadas aos e-mails DESTE teste, em vez de contar todas as chamadas.
    static RequestSendNotification to(String email) {
        return argThat(r -> email.equals(r.email));
    }

    static RequestSendNotification to(String email, String message) {
        return argThat(r -> email.equals(r.email) && message.equals(r.mensagem));
    }

    NotificationStatus status(int txId, boolean sender) {
        Transaction t = QuarkusTransaction.requiringNew().call(() -> Transaction.<Transaction>findById((long) txId));
        return sender ? t.notifySender : t.notifyReceiver;
    }

    int send250() {
        return transfer(a, b.id(), "250.00").then().statusCode(201).extract().path("id");
    }

    void awaitStatuses(int id, NotificationStatus expected) {
        await().atMost(8, SECONDS).untilAsserted(() -> {
            assertEquals(expected, status(id, true));
            assertEquals(expected, status(id, false));
        });
    }

    // Quebra se: o aviso sair antes do commit, sem e-mail/mensagem, na ordem errada ou não marcar SENT.
    @Test
    void afterCommit_notifiesBothSides_inOrder_withEmailAndMessage() {
        int id = send250();
        InOrder order = inOrder(notifier);
        order.verify(notifier, timeout(5000)).sendNotification(to(a.email(), "Você enviou R$ 250,00 para Rafa Teste."));
        order.verify(notifier, timeout(5000)).sendNotification(to(b.email(), "Você recebeu R$ 250,00 de Ana Teste."));
        awaitStatuses(id, NotificationStatus.SENT);
    }

    // Quebra se: a resposta voltar a esperar os avisos (o envio deixar de sair numa thread à parte). Com o notificador lento o POST levaria
    // a soma dos dois avisos (2 x 1,5 s), e quem envia ficaria em "Autorizando…" por mais tempo do que a transferência levou. O
    // README promete "a resposta 201 não espera os avisos"; nenhum outro teste usa um notificador lento.
    @Test
    void slowNotifier_doesNotDelayTheResponse() {
        when(notifier.sendNotification(any())).thenAnswer(invocation -> {
            Thread.sleep(1_500);
            return null;
        });

        long start = System.nanoTime();
        int id = send250();
        long millis = NANOSECONDS.toMillis(System.nanoTime() - start);

        assertTrue(millis < 1_000, "o 201 esperou " + millis + " ms: deveria sair sem esperar os avisos");
        // Segura o teste até as entregas lentas acabarem: elas não podem vazar para o teste seguinte.
        awaitStatuses(id, NotificationStatus.SENT);
    }

    // Quebra se: a falha do notificador desfizer a transferência, ou as tentativas passarem de 3 por pessoa.
    @Test
    void notifierDown_retriesThenFails_butTransferStays() {
        when(notifier.sendNotification(any())).thenThrow(new WebApplicationException(Response.status(503).build()));
        int id = send250();
        awaitStatuses(id, NotificationStatus.FAILED);
        verify(notifier, times(3)).sendNotification(to(a.email()));
        verify(notifier, times(3)).sendNotification(to(b.email()));
        assertEquals("250.00", balanceOf(a));
    }

    // Quebra se: uma falha passageira marcar o aviso como FAILED em vez de tentar de novo.
    @Test
    void notifierRecoversOnSecondAttempt_marksSent() {
        when(notifier.sendNotification(to(a.email())))
                .thenThrow(new WebApplicationException(Response.status(503).build()))
                .thenReturn(null);
        int id = send250();
        awaitStatuses(id, NotificationStatus.SENT);
        verify(notifier, times(2)).sendNotification(to(a.email()));
        verify(notifier, times(1)).sendNotification(to(b.email()));
    }

    // Quebra se: o aviso for enviado antes de a transferência ser aprovada (a notificação sairia de uma transferência recusada).
    @Test
    void rejectedTransfer_neverNotifies() throws Exception {
        transfer(a, b.id(), "999.00").then().statusCode(422);
        Thread.sleep(400);
        verify(notifier, never()).sendNotification(to(a.email()));
        verify(notifier, never()).sendNotification(to(b.email()));
    }
}
