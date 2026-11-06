package dev.whallyson.infra;

import io.quarkus.test.junit.QuarkusTestProfile;

import java.util.Map;

/** Liga as contas de demonstração, que por padrão ficam desligadas. */
public class SeedProfile implements QuarkusTestProfile {

    @Override
    public Map<String, String> getConfigOverrides() {
        return Map.of("app.seed.enabled", "true");
    }
}
