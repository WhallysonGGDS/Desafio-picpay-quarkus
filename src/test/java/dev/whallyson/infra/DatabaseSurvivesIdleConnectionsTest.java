package dev.whallyson.infra;

import dev.whallyson.entitys.user.UserType;
import dev.whallyson.support.TestUsers;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;

/**
 * O banco é o H2 em memória, e o H2 apaga um banco "mem:" quando a última conexão fecha. O pool do Quarkus começa com zero
 * conexões e fecha as ociosas (por padrão, depois de 5 minutos): sem {@code DB_CLOSE_DELAY=-1} na URL, um app parado por esse
 * tempo voltava com um banco VAZIO, sem tabelas, e todo login, cadastro e extrato respondia 500 até um reinício. Aqui o intervalo
 * cai para 1 s para o teste não esperar minutos.
 */
@QuarkusTest
@TestProfile(DatabaseSurvivesIdleConnectionsTest.ShortIdleRemoval.class)
class DatabaseSurvivesIdleConnectionsTest {

    public static class ShortIdleRemoval implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.of("quarkus.datasource.jdbc.idle-removal-interval", "PT1S");
        }
    }

    // Quebra se: a URL do banco perder o DB_CLOSE_DELAY=-1 (os dados e o esquema somem quando o pool fecha as conexões ociosas).
    @Test
    void dataSurvivesTheIdleConnectionReaper() throws Exception {
        var user = TestUsers.register(UserType.COMMON);

        // Tempo para o coletor do pool fechar todas as conexões ociosas (ele roda a cada segundo): não há como esperar menos.
        Thread.sleep(4_000);

        given().cookie("arco_session", user.cookie()).get("/users/me").then().statusCode(200).body("email", is(user.email()));
    }
}
