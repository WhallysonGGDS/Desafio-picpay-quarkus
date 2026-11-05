package dev.whallyson.validation;

import dev.whallyson.dtos.requests.RequestRegister;
import dev.whallyson.entitys.user.UserType;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.regex.Pattern;

public class ValidDocumentValidator implements ConstraintValidator<ValidDocument, RequestRegister> {

    private static final Pattern MASKED_DOCUMENT = Pattern.compile("[0-9.\\-/\\s]+");

    @Override
    public boolean isValid(RequestRegister request, ConstraintValidatorContext context) {
        // Documento em branco e tipo ausente já são reportados (REQUIRED) pelas constraints dos campos.
        if (request == null || request.document() == null || request.document().isBlank() || request.userType() == null) {
            return true;
        }
        String digits = DocumentValidator.digitsOnly(request.document());
        // Só dígitos e a pontuação de um documento (ponto, traço, barra, espaço): letras em volta ("CPF: 529.982.247-25 ok") não passam,
        // como na busca de destinatário. Antes só os dígitos eram conferidos e o texto inteiro era gravado.
        boolean valid = MASKED_DOCUMENT.matcher(request.document()).matches()
                && (request.userType() == UserType.MERCHANT
                        ? DocumentValidator.isValidCnpj(digits)
                        : DocumentValidator.isValidCpf(digits));
        if (!valid) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                    .addPropertyNode("document")
                    .addConstraintViolation();
        }
        return valid;
    }
}
