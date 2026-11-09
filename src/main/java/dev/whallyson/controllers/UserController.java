package dev.whallyson.controllers;

import dev.whallyson.dtos.responses.ResponseUser;
import dev.whallyson.dtos.responses.ResponseUserSummary;
import dev.whallyson.infra.security.CurrentUser;
import dev.whallyson.services.UserService;
import io.quarkus.security.Authenticated;
import jakarta.inject.Inject;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

// "/users" - rotas do usuário autenticado. O id vem sempre do token, nunca da requisição.
@Path("/users")
@Authenticated
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class UserController {

    @Inject
    UserService userService;

    @Inject
    CurrentUser currentUser;

    // Perfil e saldo de quem está logado
    @GET
    @Path("me")
    public ResponseUser me() {
        return ResponseUser.from(userService.requireById(currentUser.id()));
    }

    // Busca de destinatário por e-mail ou documento (correspondência exata). Devolve uma lista com 0 ou 1 item.
    @GET
    @Path("search")
    public List<ResponseUserSummary> search(
            @QueryParam("q") @NotNull(message = "REQUIRED") @Size(min = 3, message = "QUERY_TOO_SHORT") String q) {
        return userService.lookup(q, currentUser.id()).stream().map(ResponseUserSummary::from).toList();
    }
}
