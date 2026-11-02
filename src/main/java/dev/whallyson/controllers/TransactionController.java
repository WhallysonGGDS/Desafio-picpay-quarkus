package dev.whallyson.controllers;

import dev.whallyson.dtos.exception.ErrorResponseDTO;
import dev.whallyson.dtos.requests.RequestTransaction;
import dev.whallyson.dtos.responses.ResponsePage;
import dev.whallyson.dtos.responses.ResponseTransaction;
import dev.whallyson.entitys.transaction.Transaction;
import dev.whallyson.infra.security.CurrentUser;
import dev.whallyson.services.TransactionService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;

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

    // O verbo GET devolve o extrato do usuário autenticado, paginado e da transferência mais recente à mais antiga.
    // direction = all | sent | received; page começa em 0; size de 1 a 50.
    @GET
    public ResponsePage<ResponseTransaction> statement(
            @QueryParam("direction") @DefaultValue("all") String direction,
            @QueryParam("page") @DefaultValue("0") @Min(value = 0, message = "INVALID_PAGE") int page,
            @QueryParam("size") @DefaultValue("20") @Min(value = 1, message = "INVALID_SIZE")
            @Max(value = 50, message = "INVALID_SIZE") int size) {
        return transactionService.list(currentUser.id(), direction, page, size);
    }

    // O verbo POST recebe receiverId e amount; o remetente é o usuário do cookie de sessão.
    // O serviço consulta o autorizador externo (mock); sem autorização, nada é gravado.
    @POST
    @APIResponse(responseCode = "201", description = "Transferência feita; os avisos às duas pontas saem em seguida",
            content = @Content(mediaType = MediaType.APPLICATION_JSON, schema = @Schema(implementation = ResponseTransaction.class)))
    @APIResponse(responseCode = "400", description = "VALIDATION_ERROR (valor ou destinatário inválidos)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON, schema = @Schema(implementation = ErrorResponseDTO.class)))
    @APIResponse(responseCode = "401", description = "UNAUTHENTICATED (sem sessão ou sessão vencida)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON, schema = @Schema(implementation = ErrorResponseDTO.class)))
    @APIResponse(responseCode = "403", description = "MERCHANT_CANNOT_SEND (lojista não envia)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON, schema = @Schema(implementation = ErrorResponseDTO.class)))
    @APIResponse(responseCode = "404", description = "USER_NOT_FOUND (destinatário não existe)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON, schema = @Schema(implementation = ErrorResponseDTO.class)))
    @APIResponse(responseCode = "422", description = "INSUFFICIENT_BALANCE, SELF_TRANSFER ou AUTHORIZATION_DENIED",
            content = @Content(mediaType = MediaType.APPLICATION_JSON, schema = @Schema(implementation = ErrorResponseDTO.class)))
    @APIResponse(responseCode = "503", description = "AUTHORIZER_UNAVAILABLE (nada foi gravado)",
            content = @Content(mediaType = MediaType.APPLICATION_JSON, schema = @Schema(implementation = ErrorResponseDTO.class)))
    public Response transfer(@NotNull(message = "REQUIRED") @Valid RequestTransaction body) {
        Long senderId = currentUser.id();
        Transaction transaction = transactionService.transfer(senderId, body);
        return Response.status(Response.Status.CREATED)
                .entity(ResponseTransaction.from(transaction, senderId))
                .build();
    }
}
