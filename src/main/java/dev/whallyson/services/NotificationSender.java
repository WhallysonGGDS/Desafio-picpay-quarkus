package dev.whallyson.services;

import dev.whallyson.dtos.requests.RequestSendNotification;
import dev.whallyson.mocks.SendNotification.SendNotification;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.rest.client.inject.RestClient;

// Envia um aviso ao serviço externo, tentando até 3 vezes (com 200 ms entre as tentativas).
// Se todas falharem, lança a última exceção: quem chama decide o que fazer (o despachante marca FAILED).
@ApplicationScoped
public class NotificationSender {

    static final int MAX_ATTEMPTS = 3;
    static final long DELAY_BETWEEN_ATTEMPTS_MS = 200;

    @Inject
    @RestClient
    SendNotification notifier;

    public void send(RequestSendNotification request) {
        RuntimeException failure = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                notifier.sendNotification(request);
                return;
            } catch (RuntimeException e) {
                failure = e;
                if (attempt < MAX_ATTEMPTS && !pause()) {
                    break;
                }
            }
        }
        throw failure;
    }

    // false se a thread foi interrompida: não adianta insistir
    private static boolean pause() {
        try {
            Thread.sleep(DELAY_BETWEEN_ATTEMPTS_MS);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
