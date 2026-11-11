package dev.whallyson.services;

import dev.whallyson.dtos.requests.RequestRegister;
import dev.whallyson.entitys.user.User;
import dev.whallyson.entitys.user.UserType;
import dev.whallyson.exceptions.ApiException;
import dev.whallyson.exceptions.ErrorCode;
import dev.whallyson.validation.DocumentValidator;
import io.quarkus.elytron.security.common.BcryptUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@ApplicationScoped
public class UserService {

    // Hash fixo: quando o e-mail não existe, a senha é comparada com ele só para que "e-mail desconhecido"
    // e "senha errada" levem o mesmo tempo e não revelem quais contas existem.
    private static final String DUMMY_HASH = BcryptUtil.bcryptHash("senha-que-nunca-sera-usada");

    // Saldo que todo usuário comum recebe ao se cadastrar. Nunca vem do cliente.
    @ConfigProperty(name = "app.signup.initial-balance", defaultValue = "1000.00")
    BigDecimal initialBalance;

    // Cria o usuário: e-mail em minúsculas, documento normalizado (sem pontuação e em maiúsculas), senha em BCrypt e saldo inicial por tipo.
    // persistAndFlush faz a violação de unicidade acontecer aqui dentro, onde ela pode ser traduzida.
    @Transactional
    public User register(RequestRegister request) {
        User user = new User();
        user.firstName = request.firstName();
        user.lastName = request.lastName();
        user.document = DocumentValidator.normalize(request.document());
        user.email = request.email().trim().toLowerCase(Locale.ROOT);
        user.passwordHash = BcryptUtil.bcryptHash(request.password());
        user.userType = request.userType();
        user.balance = request.userType() == UserType.COMMON
                ? initialBalance.setScale(2)
                : BigDecimal.ZERO.setScale(2);
        try {
            user.persistAndFlush();
        } catch (RuntimeException e) {
            throw translateUniqueViolation(e);
        }
        return user;
    }

    // Confere e-mail e senha. As duas falhas possíveis devolvem o mesmo erro.
    @Transactional
    public User authenticate(String email, String password) {
        String normalized = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        User user = User.find("email", normalized).firstResult();
        boolean passwordMatches = password != null
                && BcryptUtil.matches(password, user != null ? user.passwordHash : DUMMY_HASH);
        if (user == null || !passwordMatches) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
        }
        return user;
    }

    // Usuário dono da sessão. Se ele não existe mais (token antigo), a sessão deixa de valer.
    @Transactional
    public User requireById(Long id) {
        User user = id == null ? null : User.findById(id);
        if (user == null) {
            throw new ApiException(ErrorCode.UNAUTHENTICATED);
        }
        return user;
    }

    // Busca de destinatário: correspondência EXATA, nunca por prefixo, para a busca não virar um diretório de usuários.
    // Se o texto só tem o que um documento pode ter (algarismos, letras de A a Z e a pontuação da máscara) ele é um documento, com
    // ou sem letras (o CNPJ alfanumérico); se traz "@" ou qualquer outro caractere, é tratado como e-mail.
    // Qualquer outra coisa não encontra ninguém. Nunca devolve o próprio usuário e devolve no máximo um.
    @Transactional
    public List<User> lookup(String q, Long exceptId) {
        String text = q == null ? "" : q.trim();
        List<User> found = DocumentValidator.usesOnlyDocumentCharacters(text)
                ? User.list("document = ?1 and id <> ?2", DocumentValidator.normalize(text), exceptId)
                : User.list("email = ?1 and id <> ?2", text.toLowerCase(Locale.ROOT), exceptId);
        return found.stream().limit(1).toList();
    }

    // Procura, na cadeia de causas, o nome da restrição única violada.
    private static RuntimeException translateUniqueViolation(RuntimeException failure) {
        int depth = 0;
        for (Throwable cause = failure; cause != null && depth < 10; cause = cause.getCause(), depth++) {
            String message = cause.getMessage() == null ? "" : cause.getMessage().toUpperCase(Locale.ROOT);
            if (message.contains("UK_USERS_EMAIL")) {
                return new ApiException(ErrorCode.DUPLICATE_EMAIL);
            }
            if (message.contains("UK_USERS_DOCUMENT")) {
                return new ApiException(ErrorCode.DUPLICATE_DOCUMENT);
            }
        }
        return failure;
    }
}
