package dev.whallyson.infra;

import dev.whallyson.dtos.exception.ErrorResponseDTO;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

// ### Vou criar o tratamento das Exceptions (Não se preocupem com isso por enquanto)
@Provider
public class GlobalExceptionHandler implements ExceptionMapper<Exception> {

    @Override
    public Response toResponse(Exception exception) {

        ErrorResponseDTO errorResponseDTO = new ErrorResponseDTO(
                Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
                exception.getMessage()
        );

        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(errorResponseDTO)
                .type(MediaType.APPLICATION_JSON)
                .build();
    }
}
