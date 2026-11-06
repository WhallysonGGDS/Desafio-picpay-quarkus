package dev.whallyson.infra;

import io.quarkus.arc.profile.IfBuildProfile;
import io.quarkus.arc.profile.UnlessBuildProfile;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

// O modo de desenvolvimento (quarkus:dev) não roda nos testes automáticos: o perfil dele não existe aqui. O que dá para travar é
// a anotação que decide ONDE o filtro das rotas do front vale.
class SpaFallbackProfileTest {

    // Quebra se: o filtro voltar a valer só em prod. Em dev, atualizar a página numa rota do front (/carteira) dava 404 do
    // back-end: o GlobalExceptionHandler responde o 404 sozinho e o fallback do próprio Quinoa nunca roda, então só este filtro
    // leva a navegação ao index.html que o Vite serve.
    @Test
    void valeEmProdEEmDevESoFicaForaDosTestes() {
        assertNull(SpaFallback.class.getAnnotation(IfBuildProfile.class), "não pode ser restrito a um perfil");

        UnlessBuildProfile unless = SpaFallback.class.getAnnotation(UnlessBuildProfile.class);
        assertNotNull(unless, "precisa de @UnlessBuildProfile");
        assertEquals("test", unless.value());
    }
}
