package dev.whallyson.infra;

import dev.whallyson.exceptions.ApiException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

// Traduz as exceções de negócio para o corpo de erro padrão, com o status do ErrorCode.
@Provider
public class ApiExceptionMapper implements ExceptionMapper<ApiException> {

    @Override
    public Response toResponse(ApiException exception) {
        return ErrorResponses.of(exception.code(), exception.fieldErrors());
    }
}
