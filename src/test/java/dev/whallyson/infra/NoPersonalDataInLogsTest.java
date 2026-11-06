package dev.whallyson.infra;

import dev.whallyson.entitys.user.UserType;
import dev.whallyson.support.TestDocuments;
import dev.whallyson.support.TestUsers;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.logging.Handler;
import java.util.logging.LogManager;
import java.util.logging.LogRecord;

import static io.restassured.RestAssured.given;
import static io.restassured.http.ContentType.JSON;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * O 409 de e-mail ou documento repetido é um caminho NORMAL (alguém tenta se cadastrar de novo), e a violação de unicidade era
 * registrada em ERROR pelo Hibernate com o dado dentro: a mensagem do H2 traz o valor do índice ({@code VALUES ( 'a@b.com' )}). E-mail e
 * CPF de gente em log de produção é dado pessoal onde não devia estar. Achado da revisão independente (r1-backend, M3).
 */
@QuarkusTest
class NoPersonalDataInLogsTest {

    // Quebra se: o log voltar a registrar a violação de unicidade com o e-mail ou o documento de quem tentou se cadastrar.
    @Test
    void duplicateSignup_doesNotLogTheEmailOrTheDocument() {
        var existing = TestUsers.register(UserType.COMMON);
        List<String> logged = new CopyOnWriteArrayList<>();
        Handler spy = new Handler() {
            @Override
            public void publish(LogRecord record) {
                logged.add(record.getLevel() + " " + record.getMessage() + " " + record.getParameters()
                        + (record.getThrown() == null ? "" : " " + describe(record.getThrown())));
            }

            @Override
            public void flush() {}

            @Override
            public void close() {}
        };
        java.util.logging.Logger root = LogManager.getLogManager().getLogger("");
        root.addHandler(spy);
        try {
            given().contentType(JSON).body(Map.of("firstName", "Ana", "lastName", "Souza", "document", TestDocuments.cpf(),
                            "email", existing.email(), "password", "segredo123", "userType", "COMMON"))
                    .post("/auth/register").then().statusCode(409);
            given().contentType(JSON).body(Map.of("firstName", "Ana", "lastName", "Souza", "document", existing.document(),
                            "email", TestDocuments.email(), "password", "segredo123", "userType", "COMMON"))
                    .post("/auth/register").then().statusCode(409);
        } finally {
            root.removeHandler(spy);
        }
        for (String line : logged) {
            assertTrue(!line.contains(existing.email()) && !line.contains(existing.document()), "dado pessoal no log: " + line);
        }
    }

    private static String describe(Throwable thrown) {
        StringBuilder text = new StringBuilder();
        for (Throwable t = thrown; t != null; t = t.getCause()) {
            text.append(t.getClass().getSimpleName()).append(": ").append(t.getMessage()).append(" | ");
        }
        return text.toString();
    }
}
