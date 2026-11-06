package dev.whallyson.exceptions;

import dev.whallyson.dtos.exception.ErrorResponseDTO;

import java.util.List;

// Exceção de negócio: carrega o ErrorCode (status e código estável) e, opcionalmente, erros por campo.
// Não captura o stack trace: é um fluxo esperado, não uma falha do sistema.
public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final List<ErrorResponseDTO.FieldError> fieldErrors;

    public ApiException(ErrorCode code) {
        this(code, List.of());
    }

    public ApiException(ErrorCode code, List<ErrorResponseDTO.FieldError> fieldErrors) {
        super(code.defaultMessage(), null, false, false);
        this.code = code;
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    public ErrorCode code() {
        return code;
    }

    public List<ErrorResponseDTO.FieldError> fieldErrors() {
        return fieldErrors;
    }
}
