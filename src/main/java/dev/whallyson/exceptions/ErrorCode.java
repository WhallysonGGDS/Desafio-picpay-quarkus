package dev.whallyson.exceptions;

// Códigos de erro estáveis da API. O código é o contrato com o front-end; a mensagem é apenas legível.
public enum ErrorCode {
    VALIDATION_ERROR(400, "Dados inválidos."),
    INVALID_CREDENTIALS(401, "E-mail ou senha incorretos."),
    UNAUTHENTICATED(401, "Sessão ausente ou expirada."),
    MERCHANT_CANNOT_SEND(403, "Usuário do tipo lojista não está autorizado a realizar transferências."),
    USER_NOT_FOUND(404, "Usuário não encontrado."),
    NOT_FOUND(404, "Recurso não encontrado."),
    METHOD_NOT_ALLOWED(405, "Método não permitido."),
    DUPLICATE_EMAIL(409, "O e-mail informado já está registrado."),
    DUPLICATE_DOCUMENT(409, "O documento informado já está registrado."),
    INSUFFICIENT_BALANCE(422, "Saldo insuficiente."),
    SELF_TRANSFER(422, "Não é possível transferir para si mesmo."),
    AUTHORIZATION_DENIED(422, "Transferência recusada pelo serviço de autorização."),
    AUTHORIZER_UNAVAILABLE(503, "Serviço de autorização indisponível. Tente novamente."),
    INTERNAL_ERROR(500, "Erro interno. Tente novamente.");

    private final int status;
    private final String defaultMessage;

    ErrorCode(int status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public int status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
