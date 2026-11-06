package dev.whallyson.infra;

import dev.whallyson.exceptions.ApiException;
import dev.whallyson.exceptions.ErrorCode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/**
 * Recurso existente só nos testes: provoca cada tipo de falha para provar o modelo de erros
 * sem depender de nenhuma funcionalidade de negócio.
 */
@Path("/__probe")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class ErrorProbeResource {

    public record ProbeBody(@NotBlank(message = "REQUIRED") String name) {}

    @GET
    @Path("api")
    public String api() {
        throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
    }

    @GET
    @Path("boom")
    public String boom() {
        throw new IllegalStateException("segredo interno");
    }

    @POST
    @Path("validate")
    public String validate(@NotNull(message = "REQUIRED") @Valid ProbeBody body) {
        return "ok";
    }
}
