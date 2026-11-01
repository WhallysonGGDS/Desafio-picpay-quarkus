package dev.whallyson.dtos.responses;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import dev.whallyson.dtos.MoneySerializer;
import dev.whallyson.entitys.user.User;
import dev.whallyson.entitys.user.UserType;

import java.math.BigDecimal;

// Perfil do próprio usuário. Não existe campo de senha nem de hash: a entidade nunca sai pela API.
public record ResponseUser(
        Long id,
        String firstName,
        String lastName,
        String document,
        String email,
        @JsonSerialize(using = MoneySerializer.class) BigDecimal balance,
        UserType userType) {

    public static ResponseUser from(User user) {
        return new ResponseUser(user.id, user.firstName, user.lastName, user.document, user.email, user.balance, user.userType);
    }
}
