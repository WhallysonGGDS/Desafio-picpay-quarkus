package dev.whallyson.infra;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static io.restassured.http.ContentType.JSON;
import static org.hamcrest.Matchers.is;

@QuarkusTest
@TestProfile(SeedProfile.class)
class SeedDataTest {

    @Inject
    SeedData seed;

    Response login(String email) {
        return given().contentType(JSON).body(Map.of("email", email, "password", "demo1234")).post("/auth/login");
    }

    // Quebra se: o seed deixar de rodar na inicialização, esquecer uma conta ou errar tipo/saldo.
    @Test
    void createsDemoAccounts_thatCanLogIn() {
        login("marina@arco.demo").then().statusCode(200).body("balance", is("1000.00")).body("userType", is("COMMON"));
        login("rafael@arco.demo").then().statusCode(200).body("balance", is("500.00"));
        login("loja@arco.demo").then().statusCode(200).body("userType", is("MERCHANT")).body("balance", is("0.00"));
    }

    // Quebra se: rodar o seed de novo (reinício, recarga) estourar por e-mail duplicado ou recriar saldos.
    @Test
    void seed_isIdempotent() {
        seed.seed();
        seed.seed();
        login("marina@arco.demo").then().statusCode(200).body("balance", is("1000.00"));
    }
}
