package dev.whallyson.dtos.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

import java.util.List;

// Corpo único de erro da API: { statusCode, code, message, fieldErrors? }.
// fieldErrors some quando está vazio, por isso é o único campo opcional.
@JsonInclude(JsonInclude.Include.NON_EMPTY)
@Schema(requiredProperties = {"statusCode", "code", "message"})
public record ErrorResponseDTO(int statusCode, String code, String message, List<FieldError> fieldErrors) {

    @Schema(requiredProperties = {"field", "code"})
    public record FieldError(String field, String code) {}
}
