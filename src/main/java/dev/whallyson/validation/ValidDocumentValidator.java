package dev.whallyson.validation;

import dev.whallyson.dtos.requests.RequestRegister;
import dev.whallyson.entitys.user.UserType;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ValidDocumentValidator implements ConstraintValidator<ValidDocument, RequestRegister> {

    @Override
    public boolean isValid(RequestRegister request, ConstraintValidatorContext context) {
        // Documento em branco e tipo ausente já são reportados (REQUIRED) pelas constraints dos campos.
        if (request == null || request.document() == null || request.document().isBlank() || request.userType() == null) {
            return true;
        }
        String digits = DocumentValidator.digitsOnly(request.document());
        boolean valid = request.userType() == UserType.MERCHANT
                ? DocumentValidator.isValidCnpj(digits)
                : DocumentValidator.isValidCpf(digits);
        if (!valid) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                    .addPropertyNode("document")
                    .addConstraintViolation();
        }
        return valid;
    }
}
