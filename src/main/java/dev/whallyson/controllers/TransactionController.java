package dev.whallyson.controllers;

import dev.whallyson.dtos.requests.RequestTransaction;
import dev.whallyson.entitys.transaction.Transaction;
import dev.whallyson.services.TransactionService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

// "/transaction" - rota do controller (O controller tem basicamente a funcionalidade de chamar métodos no servidor)
// Métodos do tipo POST, PUT e DELETE precisam ser anotados com @Transactional, pois alteram dados do banco de dados
// Eu coloquei o @Transactional nos métodos chamados pelos métodos POST - veja nos Package services!
@Path("/transaction")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TransactionController {

    // Injeta dependências
    // O Quarkus, durante a execução, se encarrega de fornecer uma instância de TransactionService pronta para uso.
    @Inject
    TransactionService transactionService;

    // O verbo POST na rota "/transaction" deve receber em seu body um JSON da dto requestTransaction
    // O methode solicita uma nova transação, passando pelo serviço externo de autorização
    // (Mock - AuthorizationTransaction), quando o serviço de autorização retornar uma response de success, a
    // transferência é computada no banco e o serviço de enviar notificação é solicitado (Mock - SendNotification)
    // Se a autorização não for recebida, a transferência não é computada!
    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createTransaction(RequestTransaction requestTransaction) throws Exception {
        Transaction createTransaction = transactionService.createTransaction(requestTransaction);
        return Response.status(Response.Status.CREATED).entity(createTransaction).build();
    }
}
