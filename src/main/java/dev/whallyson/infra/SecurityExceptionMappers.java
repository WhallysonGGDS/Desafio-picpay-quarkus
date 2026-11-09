package dev.whallyson.infra;

import dev.whallyson.exceptions.ErrorCode;
import io.quarkus.security.AuthenticationFailedException;
import io.quarkus.security.UnauthorizedException;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.server.ServerExceptionMapper;

import java.util.List;

// Sessão ausente (UnauthorizedException) ou inválida (AuthenticationFailedException) respondem o mesmo
// 401 UNAUTHENTICATED, no modelo de erro padrão. Só são alcançadas porque a autenticação é preguiçosa.
public class SecurityExceptionMappers {

    @ServerExceptionMapper
    public Response unauthorized(UnauthorizedException exception) {
        return ErrorResponses.of(ErrorCode.UNAUTHENTICATED, List.of());
    }

    @ServerExceptionMapper
    public Response authenticationFailed(AuthenticationFailedException exception) {
        return ErrorResponses.of(ErrorCode.UNAUTHENTICATED, List.of());
    }
}
