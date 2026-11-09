package dev.whallyson.infra;

import dev.whallyson.dtos.exception.ErrorResponseDTO;
import dev.whallyson.dtos.exception.ErrorResponseDTO.FieldError;
import dev.whallyson.exceptions.ErrorCode;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.List;

// Monta a resposta de erro padrão em um só lugar, para todos os mappers.
final class ErrorResponses {

    private ErrorResponses() {}

    static Response of(ErrorCode code, List<FieldError> fieldErrors) {
        return of(code.status(), code.name(), code.defaultMessage(), fieldErrors);
    }

    static Response of(int status, String code, String message, List<FieldError> fieldErrors) {
        return Response.status(status)
                .type(MediaType.APPLICATION_JSON)
                .entity(new ErrorResponseDTO(status, code, message, fieldErrors))
                .build();
    }
}
