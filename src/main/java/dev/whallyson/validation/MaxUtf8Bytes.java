package dev.whallyson.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * O texto não pode passar de {@code value} BYTES em UTF-8 (e não de caracteres). Existe por causa do BCrypt, que só lê os 72 primeiros
 * bytes da senha: com "é" (2 bytes) 40 caracteres já passam de 72, e o que vem depois seria ignorado em silêncio (duas senhas
 * diferentes abririam a mesma conta).
 */
@Documented
@Constraint(validatedBy = MaxUtf8BytesValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface MaxUtf8Bytes {

    int value();

    String message() default "TOO_LONG";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
