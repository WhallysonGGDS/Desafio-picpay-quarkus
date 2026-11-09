package dev.whallyson.services;

import dev.whallyson.dtos.requests.RequestSendNotification;
import dev.whallyson.entitys.transaction.NotificationStatus;
import dev.whallyson.entitys.transaction.Transaction;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.event.TransactionPhase;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.math.BigDecimal;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// Avisa as duas pontas de uma transferência DEPOIS que ela foi gravada, fora da requisição e fora da transação:
// a resposta ao cliente não espera o serviço externo e uma falha de aviso nunca desfaz a transferência.
// O resultado de cada aviso (SENT ou FAILED) é gravado em uma transação própria.
@ApplicationScoped
public class NotificationDispatcher {

    private static final Logger LOG = Logger.getLogger(NotificationDispatcher.class);

    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    @Inject
    NotificationSender sender;

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }

    // AFTER_SUCCESS: só roda se a transação da transferência fez commit.
    void onTransferCompleted(@Observes(during = TransactionPhase.AFTER_SUCCESS) TransferCompleted event) {
        executor.execute(() -> deliver(event.transactionId()));
    }

    void deliver(Long transactionId) {
        try {
            Delivery delivery = QuarkusTransaction.requiringNew()
                    .call(() -> Delivery.of(Transaction.<Transaction>findById(transactionId)));

            // Primeiro quem enviou, depois quem recebeu, um de cada vez.
            NotificationStatus senderStatus = attempt(transactionId, "remetente", new RequestSendNotification(
                    delivery.senderEmail(), NotificationMessages.sent(delivery.amount(), delivery.receiverName())));
            NotificationStatus receiverStatus = attempt(transactionId, "destinatário", new RequestSendNotification(
                    delivery.receiverEmail(), NotificationMessages.received(delivery.amount(), delivery.senderName())));

            QuarkusTransaction.requiringNew().run(() -> {
                Transaction transaction = Transaction.findById(transactionId);
                transaction.notifySender = senderStatus;
                transaction.notifyReceiver = receiverStatus;
            });
        } catch (RuntimeException e) {
            LOG.errorf(e, "Falha ao entregar os avisos da transferência %s", transactionId);
        }
    }

    private NotificationStatus attempt(Long transactionId, String role, RequestSendNotification request) {
        try {
            sender.send(request);
            return NotificationStatus.SENT;
        } catch (RuntimeException e) {
            // Sem o e-mail no log: ele é dado pessoal.
            LOG.warnf("Aviso ao %s da transferência %s não entregue: %s", role, transactionId, e.toString());
            return NotificationStatus.FAILED;
        }
    }

    // Tudo que o envio precisa, lido de uma vez dentro de uma transação.
    private record Delivery(String senderEmail, String senderName, String receiverEmail, String receiverName, BigDecimal amount) {

        static Delivery of(Transaction transaction) {
            return new Delivery(
                    transaction.sender.email, transaction.sender.firstName + " " + transaction.sender.lastName,
                    transaction.receiver.email, transaction.receiver.firstName + " " + transaction.receiver.lastName,
                    transaction.amount);
        }
    }
}
