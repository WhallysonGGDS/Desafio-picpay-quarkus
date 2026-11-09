package dev.whallyson.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

// Constraint de classe do cadastro: o documento precisa ser um CPF válido para usuário comum
// ou um CNPJ válido para lojista. A violação é registrada no campo "document".
@Documented
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidDocumentValidator.class)
public @interface ValidDocument {

    String message() default "INVALID_DOCUMENT";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
