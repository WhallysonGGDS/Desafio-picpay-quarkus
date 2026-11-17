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
        // Só a pontuação da máscara sai: o resto do texto continua lá e reprova na conferência. Letras em volta ("CPF: 529.982.247-25 ok")
        // não passam, como na busca de destinatário. Antes só os dígitos eram conferidos e o texto inteiro era gravado.
        // As letras de A a Z valem no CNPJ (alfanumérico) e nunca no CPF.
        String document = DocumentValidator.normalize(request.document());
        boolean valid = request.userType() == UserType.MERCHANT
                ? DocumentValidator.isValidCnpj(document)
                : DocumentValidator.isValidCpf(document);
        if (!valid) {
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
                    .addPropertyNode("document")
                    .addConstraintViolation();
        }
        return valid;
    }
}
