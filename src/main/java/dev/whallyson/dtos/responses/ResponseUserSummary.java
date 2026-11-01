package dev.whallyson.dtos.responses;

import dev.whallyson.entitys.user.User;
import dev.whallyson.entitys.user.UserType;
import dev.whallyson.validation.DocumentMask;

// O que outra pessoa pode ver de um usuário ao escolher um destinatário: nome, tipo e documento mascarado.
// Sem saldo, sem e-mail, sem documento inteiro.
public record ResponseUserSummary(Long id, String firstName, String lastName, UserType userType, String maskedDocument) {

    public static ResponseUserSummary from(User user) {
        return new ResponseUserSummary(user.id, user.firstName, user.lastName, user.userType, DocumentMask.mask(user.document));
    }
}
