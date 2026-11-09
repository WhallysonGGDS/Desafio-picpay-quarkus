package dev.whallyson.services;

import dev.whallyson.dtos.requests.RequestRegister;
import dev.whallyson.entitys.user.User;
import dev.whallyson.entitys.user.UserType;
import dev.whallyson.exceptions.ApiException;
import dev.whallyson.exceptions.ErrorCode;
import dev.whallyson.support.TestDocuments;
import io.quarkus.elytron.security.common.BcryptUtil;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class UserServiceTest {

    @Inject
    UserService users;

    @Inject
    Validator validator;

    static RequestRegister req(String email, String doc, UserType type) {
        return new RequestRegister("Ana", "Souza", doc, email, "segredo123", type);
    }

    // campo -> código da primeira violação
    Map<String, String> violations(RequestRegister r) {
        return validator.validate(r).stream()
                .collect(Collectors.toMap(v -> v.getPropertyPath().toString(), ConstraintViolation::getMessage, (a, b) -> a));
    }

    // RF4. Quebra se: o e-mail não for gravado em minúsculas, o documento com pontuação, ou a senha em texto puro.
    @Test
    void register_normalizesFieldsAndHashesPassword() {
        String cpf = TestDocuments.cpf();
        String email = TestDocuments.email();
        User u = users.register(req("  " + email.toUpperCase() + " ", TestDocuments.formatCpf(cpf), UserType.COMMON));
        assertEquals(email, u.email);
        assertEquals(cpf, u.document);
        assertTrue(BcryptUtil.matches("segredo123", u.passwordHash));
        assertNotEquals("segredo123", u.passwordHash);
    }

    // Quebra se: o saldo inicial voltar a depender do cliente ou o lojista começar com saldo.
    @Test
    void register_setsInitialBalanceByType() {
        assertEquals(new BigDecimal("1000.00"), users.register(req(TestDocuments.email(), TestDocuments.cpf(), UserType.COMMON)).balance);
        assertEquals(new BigDecimal("0.00"), users.register(req(TestDocuments.email(), TestDocuments.cnpj(), UserType.MERCHANT)).balance);
    }

    // RF4
    @Test
    void register_rejectsDuplicateEmail_acrossVariants() {
        String email = TestDocuments.email();
        users.register(req(email, TestDocuments.cpf(), UserType.COMMON));
        ApiException ex = assertThrows(ApiException.class,
                () -> users.register(req(" " + email.toUpperCase(), TestDocuments.cpf(), UserType.COMMON)));
        assertEquals(ErrorCode.DUPLICATE_EMAIL, ex.code());
    }

    // RF4
    @Test
    void register_rejectsDuplicateDocument_acrossVariants() {
        String cpf = TestDocuments.cpf();
        users.register(req(TestDocuments.email(), cpf, UserType.COMMON));
        ApiException ex = assertThrows(ApiException.class,
                () -> users.register(req(TestDocuments.email(), TestDocuments.formatCpf(cpf), UserType.COMMON)));
        assertEquals(ErrorCode.DUPLICATE_DOCUMENT, ex.code());
    }

    @Test
    void requestRegister_constraints() {
        String ok = TestDocuments.cpf();
        assertEquals(Map.of(), violations(req("ana@teste.com", ok, UserType.COMMON)));
        assertEquals("REQUIRED", violations(new RequestRegister("", "Souza", ok, "a@b.co", "segredo123", UserType.COMMON)).get("firstName"));
        assertEquals("TOO_LONG", violations(new RequestRegister("x".repeat(81), "Souza", ok, "a@b.co", "segredo123", UserType.COMMON)).get("firstName"));
        assertEquals("INVALID_EMAIL", violations(req("sem-arroba", ok, UserType.COMMON)).get("email"));
        assertEquals("PASSWORD_LENGTH", violations(new RequestRegister("Ana", "Souza", ok, "a@b.co", "1234567", UserType.COMMON)).get("password"));
        assertEquals("PASSWORD_LENGTH", violations(new RequestRegister("Ana", "Souza", ok, "a@b.co", "x".repeat(73), UserType.COMMON)).get("password"));
        assertEquals("INVALID_DOCUMENT", violations(req("a@b.co", "52998224724", UserType.COMMON)).get("document"));
        assertEquals("INVALID_DOCUMENT", violations(req("a@b.co", TestDocuments.cnpj(), UserType.COMMON)).get("document"));
        assertEquals("INVALID_DOCUMENT", violations(req("a@b.co", ok, UserType.MERCHANT)).get("document"));
        assertEquals("REQUIRED", violations(new RequestRegister("Ana", "Souza", ok, "a@b.co", "segredo123", null)).get("userType"));
    }

    // RF4. Quebra se: um espaço sobrando ao colar o e-mail voltar a reprovar a validação do formato,
    // ou se a senha passar a ser aparada (espaços na senha são legítimos).
    @Test
    void requestRegister_trimsSurroundingWhitespace_exceptThePassword() {
        RequestRegister r = new RequestRegister("  Ana ", " Souza", " " + TestDocuments.cpf() + " ", "  ana@teste.com ", " segredo123 ", UserType.COMMON);
        assertEquals("Ana", r.firstName());
        assertEquals("Souza", r.lastName());
        assertEquals("ana@teste.com", r.email());
        assertEquals(" segredo123 ", r.password());
        assertEquals(Map.of(), violations(r));
    }

    // Quebra se: a comparação de e-mail voltar a diferenciar maiúsculas, ou se e-mail desconhecido e senha
    // errada passarem a ter códigos de erro diferentes (enumeração de contas).
    @Test
    void authenticate_isCaseInsensitive_andWrongCredentialsLookAlike() {
        String email = TestDocuments.email();
        User u = users.register(req(email, TestDocuments.cpf(), UserType.COMMON));
        assertEquals(u.id, users.authenticate("  " + email.toUpperCase(), "segredo123").id);
        assertEquals(ErrorCode.INVALID_CREDENTIALS, assertThrows(ApiException.class, () -> users.authenticate(email, "errada123")).code());
        assertEquals(ErrorCode.INVALID_CREDENTIALS, assertThrows(ApiException.class, () -> users.authenticate("nao@existe.com", "segredo123")).code());
    }

    @Test
    void requireById_unknownId_isUnauthenticated() {
        assertEquals(ErrorCode.UNAUTHENTICATED, assertThrows(ApiException.class, () -> users.requireById(987654321L)).code());
    }
}
