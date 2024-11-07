package dev.whallyson.services;

import dev.whallyson.dtos.requests.RequestSendNotification;
import dev.whallyson.dtos.requests.RequestTransaction;
import dev.whallyson.dtos.responses.ResponseSendNotification;
import dev.whallyson.entitys.transaction.Transaction;
import dev.whallyson.entitys.user.User;
import dev.whallyson.mocks.SendNotification.SendNotification;
import org.jboss.resteasy.reactive.ClientWebApplicationException;
import dev.whallyson.dtos.responses.ResponseAuthorizationTransaction;
import dev.whallyson.mocks.AuthorizationTransaction.AuthorizationTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.rest.client.inject.RestClient;

import java.math.BigDecimal;

@ApplicationScoped
public class TransactionService {

    private final UserService userService;
    private final AuthorizationTransaction authorizationTransaction;
    private final SendNotification sendNotification;

    // Injeta dependências
    // O Quarkus, durante a execução, se encarrega de fornecer uma instância de UserService, NotificationTransaction e AuthorizationTransaction pronta para uso.
    public TransactionService(UserService userService,
                              @RestClient AuthorizationTransaction authorizationTransaction,
                              @RestClient SendNotification sendNotification) {
        this.userService = userService;
        this.authorizationTransaction = authorizationTransaction;
        this.sendNotification = sendNotification;
    }

    // Transactional pois o methode altera dados no banco de dados!
    @Transactional
    public Transaction createTransaction(RequestTransaction requestTransaction) throws  Exception{

        // Validações das regras de negócio:
        BigDecimal amount = requestTransaction.amount;
        User sender = userService.findUserSenderById(requestTransaction.senderId);
        User receiver = userService.findUserReceiverById(requestTransaction.receiverId);
        userService.validadeTransaction(sender, requestTransaction.amount);

        // Validação por autorização externa do Mock:
        authorizeTransaction();

        // Passando por todas às autorizações (não ocorreu nenhuma Exceptions) a transferência é realizada:
        sender.balance = sender.balance.subtract(requestTransaction.amount);
        receiver.balance = receiver.balance.add(requestTransaction.amount);

        // Persiste a transferência:
        Transaction transaction = new Transaction();

        transaction.amount = amount;
        transaction.sender = sender;
        transaction.receiver = receiver;
        transaction.notifySender = sendNotificationEmail();
        transaction.notifyReceiver = sendNotificationEmail();

        userService.saveUser(sender);
        userService.saveUser(receiver);
        transaction.persist();

        return transaction;
    }

    // MOCK de Autorização da transação
    // Se a autorização falhar uma Exception é lançada
    public void authorizeTransaction() throws Exception {
        try {
            ResponseAuthorizationTransaction response = authorizationTransaction.authorize();
        } catch (ClientWebApplicationException err) {
            throw new Exception("Transferência recusada pelo serviço de autorização");
        }
    }

    // MOCK que envia notificação
    // Retorna o feedback da notificação (Sucesso ou Falha)
    public String sendNotificationEmail() {
        String notifyStatus;
        RequestSendNotification requestSendNotification = new RequestSendNotification();

        try {
            ResponseSendNotification response = sendNotification.sendNotification(requestSendNotification);
            return "Notificação enviada com sucesso";
        } catch (ClientWebApplicationException err) {
            return "Falha ao enviar a notificação";
        }
    }
}
