package dev.whallyson.infra;

import dev.whallyson.dtos.exception.ErrorResponseDTO.FieldError;
import dev.whallyson.exceptions.ErrorCode;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Path;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

import java.util.Comparator;
import java.util.List;

// Violações do Bean Validation viram 400 VALIDATION_ERROR com um erro por campo.
// O "field" é o nome do último nó do caminho (por isso todo parâmetro de corpo se chama "body")
// e o "code" é a própria mensagem da constraint, que a API usa como código (REQUIRED, INVALID_EMAIL...).
@Provider
public class ConstraintViolationMapper implements ExceptionMapper<ConstraintViolationException> {

    @Override
    public Response toResponse(ConstraintViolationException exception) {
        List<FieldError> fieldErrors = exception.getConstraintViolations().stream()
                .map(violation -> new FieldError(fieldName(violation.getPropertyPath()), violation.getMessage()))
                .sorted(Comparator.comparing(FieldError::field).thenComparing(FieldError::code))
                .toList();
        return ErrorResponses.of(ErrorCode.VALIDATION_ERROR, fieldErrors);
    }

    private static String fieldName(Path path) {
        String name = "body";
        for (Path.Node node : path) {
            if (node.getName() != null) {
                name = node.getName();
            }
        }
        return name;
    }
}
