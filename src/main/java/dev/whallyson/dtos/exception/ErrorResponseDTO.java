package dev.whallyson.dtos.exception;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

// Corpo único de erro da API: { statusCode, code, message, fieldErrors? }.
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ErrorResponseDTO(int statusCode, String code, String message, List<FieldError> fieldErrors) {

    public record FieldError(String field, String code) {}
}
