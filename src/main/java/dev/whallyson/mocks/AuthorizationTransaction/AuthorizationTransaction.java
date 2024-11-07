package dev.whallyson.mocks.AuthorizationTransaction;

import dev.whallyson.dtos.responses.ResponseAuthorizationTransaction;
import jakarta.ws.rs.Consumes;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@RegisterRestClient(baseUri = "https://util.devi.tools")
@Path("/api/v2/authorize")
public interface AuthorizationTransaction {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    ResponseAuthorizationTransaction authorize();
}
