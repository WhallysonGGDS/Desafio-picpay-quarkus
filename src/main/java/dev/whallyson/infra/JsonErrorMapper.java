package dev.whallyson.infra;

import com.fasterxml.jackson.core.JsonProcessingException;
import dev.whallyson.exceptions.ErrorCode;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

import java.util.List;

// JSON malformado ou com tipo incompatível é erro do cliente: 400 VALIDATION_ERROR, sem vazar a mensagem do Jackson.
@Provider
public class JsonErrorMapper implements ExceptionMapper<JsonProcessingException> {

    @Override
    public Response toResponse(JsonProcessingException exception) {
        return ErrorResponses.of(ErrorCode.VALIDATION_ERROR, List.of());
    }
}
