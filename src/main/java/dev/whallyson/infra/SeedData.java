package dev.whallyson.infra;

import dev.whallyson.dtos.requests.RequestRegister;
import dev.whallyson.entitys.user.User;
import dev.whallyson.entitys.user.UserType;
import dev.whallyson.services.UserService;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.math.BigDecimal;

// Contas de demonstração. O banco é H2 em memória e zera a cada reinício; sem elas o app abriria vazio.
// Só existem com app.seed.enabled=true (ligado no perfil dev, desligado por padrão e em produção).
// Todas usam a senha demo1234.
@ApplicationScoped
public class SeedData {

    private static final Logger LOG = Logger.getLogger(SeedData.class);
    private static final String DEMO_PASSWORD = "demo1234";

    @ConfigProperty(name = "app.seed.enabled", defaultValue = "false")
    boolean enabled;

    @Inject
    UserService userService;

    void onStart(@Observes StartupEvent event) {
        if (enabled) {
            seed();
        }
    }

    // Idempotente: pula quem já existe (pelo e-mail).
    public void seed() {
        QuarkusTransaction.requiringNew().run(() -> {
            create("Marina", "Alves", "52998224725", "marina@arco.demo", UserType.COMMON, "1000.00");
            create("Rafael", "Costa", "11144477735", "rafael@arco.demo", UserType.COMMON, "500.00");
            create("Loja", "Arco", "11222333000181", "loja@arco.demo", UserType.MERCHANT, "0.00");
        });
        LOG.info("Contas de demonstração prontas (senha demo1234): marina@arco.demo, rafael@arco.demo, loja@arco.demo");
    }

    private void create(String firstName, String lastName, String document, String email, UserType type, String balance) {
        if (User.count("email", email) > 0) {
            return;
        }
        User user = userService.register(new RequestRegister(firstName, lastName, document, email, DEMO_PASSWORD, type));
        user.balance = new BigDecimal(balance);
    }
}
