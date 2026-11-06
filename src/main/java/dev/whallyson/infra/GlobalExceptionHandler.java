package dev.whallyson.infra;

import dev.whallyson.exceptions.ErrorCode;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

import java.util.List;

// Último recurso. Exceções HTTP do JAX-RS (404, 405, 415...) mantêm o status original; qualquer outra
// falha vira 500 INTERNAL_ERROR com mensagem genérica, e o detalhe fica só no log.
@Provider
public class GlobalExceptionHandler implements ExceptionMapper<Exception> {

    private static final Logger LOG = Logger.getLogger(GlobalExceptionHandler.class);

    @Override
    public Response toResponse(Exception exception) {
        if (exception instanceof WebApplicationException web) {
            int status = web.getResponse().getStatus();
            return switch (status) {
                case 400 -> ErrorResponses.of(ErrorCode.VALIDATION_ERROR, List.of());
                case 401 -> ErrorResponses.of(ErrorCode.UNAUTHENTICATED, List.of());
                case 404 -> isUnreadableParameter(web)
                        ? ErrorResponses.of(ErrorCode.VALIDATION_ERROR, List.of())
                        : ErrorResponses.of(ErrorCode.NOT_FOUND, List.of());
                case 405 -> ErrorResponses.of(ErrorCode.METHOD_NOT_ALLOWED, List.of());
                default -> {
                    if (status >= 500) {
                        LOG.error("Erro HTTP " + status + " não tratado", exception);
                    }
                    yield ErrorResponses.of(status, "HTTP_" + status,
                            status >= 500 ? ErrorCode.INTERNAL_ERROR.defaultMessage() : "Requisição inválida.", List.of());
                }
            };
        }
        LOG.error("Erro inesperado", exception);
        return ErrorResponses.of(ErrorCode.INTERNAL_ERROR, List.of());
    }

    // Por força da especificação JAX-RS, um @QueryParam ou @PathParam que não converte (page=abc) vira NotFoundException, com a
    // NumberFormatException (ou outra IllegalArgumentException) por baixo. Quem mandou um parâmetro ilegível errou a requisição:
    // 400 VALIDATION_ERROR, como os parâmetros fora de faixa (page=-1). Um 404 de rota que não existe não tem causa nenhuma.
    private static boolean isUnreadableParameter(WebApplicationException web) {
        return web instanceof NotFoundException && web.getCause() instanceof IllegalArgumentException;
    }
}
