package dev.whallyson.controllers;

import dev.whallyson.dtos.requests.RequestTransaction;
import dev.whallyson.dtos.responses.ResponseTransaction;
import dev.whallyson.entitys.transaction.Transaction;
import dev.whallyson.infra.security.CurrentUser;
import dev.whallyson.services.TransactionService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

// "/transaction" - transferências do usuário autenticado
@Path("/transaction")
@Authenticated
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class TransactionController {

    @Inject
    TransactionService transactionService;

    @Inject
    CurrentUser currentUser;

    // O verbo POST recebe receiverId e amount; o remetente é o usuário do cookie de sessão.
    // O serviço consulta o autorizador externo (mock); sem autorização, nada é gravado.
    @POST
    public Response transfer(@NotNull(message = "REQUIRED") @Valid RequestTransaction body) {
        Long senderId = currentUser.id();
        Transaction transaction = transactionService.transfer(senderId, body);
        return Response.status(Response.Status.CREATED)
                .entity(ResponseTransaction.from(transaction, senderId))
                .build();
    }
}
