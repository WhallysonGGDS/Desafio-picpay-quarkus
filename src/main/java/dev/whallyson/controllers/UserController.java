package dev.whallyson.controllers;

import dev.whallyson.entitys.user.User;
import dev.whallyson.services.UserService;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;

// "/users" - rota do controller (O controller tem basicamente a funcionalidade de chamar métodos no servidor)
// Métodos do tipo POST, PUT e DELETE precisam ser anotados com @Transactional, pois alteram dados do banco de dados
// Eu coloquei o @Transactional nos métodos chamados pelos métodos POST - veja nos Package services!
@Path("/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserController {

    // Injeta dependências
    // O Quarkus, durante a execução, se encarrega de fornecer uma instância de UserService pronta para uso.
    @Inject
    UserService userService;

    // O verbo GET na rota /users retorna a lista de Usuários do sistema
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public List<User> getUsers() {
        return userService.listUsers();
    }

    // O verbo POST na rota /users deve receber em seu body um JSON da entity User
    // O methode cria o usuário no sistema seguindo às regras definidas na entity
    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response createUser (User newUser) {
        User createUser = userService.saveUser(newUser);
        return Response.status(Response.Status.CREATED).entity(createUser).build();
    }
}
