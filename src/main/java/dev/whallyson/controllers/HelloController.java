package dev.whallyson.controllers;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;

@Path("/hello")
public class HelloController {

    @GET
    public String hello() {
        return "Hello from Quarkus REST";
    }
}
