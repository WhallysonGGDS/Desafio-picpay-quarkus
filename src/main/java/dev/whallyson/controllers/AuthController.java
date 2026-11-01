package dev.whallyson.controllers;

import dev.whallyson.dtos.requests.RequestLogin;
import dev.whallyson.dtos.requests.RequestRegister;
import dev.whallyson.dtos.responses.ResponseUser;
import dev.whallyson.entitys.user.User;
import dev.whallyson.infra.security.SessionCookie;
import dev.whallyson.infra.security.TokenService;
import dev.whallyson.services.UserService;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

// "/auth" - cadastro, login e logout. Rotas públicas: um cookie de sessão velho enviado a elas é ignorado.
// A sessão é um JWT em cookie HttpOnly; o corpo da resposta traz só o perfil.
@Path("/auth")
@PermitAll
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AuthController {

    @Inject
    UserService userService;

    @Inject
    TokenService tokenService;

    @Inject
    SessionCookie sessionCookie;

    // Cria a conta e já inicia a sessão
    @POST
    @Path("register")
    public Response register(@NotNull(message = "REQUIRED") @Valid RequestRegister body) {
        User user = userService.register(body);
        return Response.status(Response.Status.CREATED)
                .entity(ResponseUser.from(user))
                .cookie(sessionCookie.create(tokenService.issue(user)))
                .build();
    }

    @POST
    @Path("login")
    public Response login(@NotNull(message = "REQUIRED") @Valid RequestLogin body) {
        User user = userService.authenticate(body.email(), body.password());
        return Response.ok(ResponseUser.from(user))
                .cookie(sessionCookie.create(tokenService.issue(user)))
                .build();
    }

    // Idempotente e público: expira o cookie mesmo que a sessão já tenha vencido
    @POST
    @Path("logout")
    public Response logout() {
        return Response.noContent().cookie(sessionCookie.expire()).build();
    }
}
