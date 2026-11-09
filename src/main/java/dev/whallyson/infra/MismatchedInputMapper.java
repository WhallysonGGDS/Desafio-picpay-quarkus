package dev.whallyson.infra;

import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import dev.whallyson.exceptions.ErrorCode;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

import java.util.List;

// Valor com tipo incompatível no JSON (por exemplo "abc" onde se espera um número). O Quarkus traz um mapper
// embutido para este tipo exato, mais específico que o JsonErrorMapper, e ele responderia fora do nosso modelo
// de erro; por isso este mapper existe para o MESMO tipo e vence o embutido.
@Provider
public class MismatchedInputMapper implements ExceptionMapper<MismatchedInputException> {

    @Override
    public Response toResponse(MismatchedInputException exception) {
        return ErrorResponses.of(ErrorCode.VALIDATION_ERROR, List.of());
    }
}
