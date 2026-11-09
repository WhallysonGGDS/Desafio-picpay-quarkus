package dev.whallyson.infra.security;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.ws.rs.core.NewCookie;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class SessionCookieTest {

    // Quebra se: o cookie de sessão perder Secure (em produção), HttpOnly, SameSite=Strict, Path ou a validade.
    @Test
    void create_isHardened() {
        NewCookie c = new SessionCookie(true, Duration.ofHours(1)).create("tok");
        assertAll(
                () -> assertTrue(c.isSecure()),
                () -> assertTrue(c.isHttpOnly()),
                () -> assertEquals(NewCookie.SameSite.STRICT, c.getSameSite()),
                () -> assertEquals("/", c.getPath()),
                () -> assertEquals(3600, c.getMaxAge()));
    }

    // Quebra se: em dev/teste (http) o cookie continuar Secure e o navegador o descartar.
    @Test
    void create_isNotSecureWhenConfiguredSo() {
        assertFalse(new SessionCookie(false, Duration.ofHours(1)).create("tok").isSecure());
    }

    @Test
    void expire_hasZeroMaxAge() {
        NewCookie c = new SessionCookie(false, Duration.ofHours(1)).expire();
        assertEquals(0, c.getMaxAge());
        assertEquals("", c.getValue());
    }
}
