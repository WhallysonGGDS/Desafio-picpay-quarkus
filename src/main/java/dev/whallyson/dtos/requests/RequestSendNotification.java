package dev.whallyson.dtos.requests;

// Objeto request(o corpo/body) da requisição que envia uma notificação por e-mail
// (mock - SendNotification)
public class RequestSendNotification {

    public String email;
    public String mensagem;

    public RequestSendNotification() {
    }

    public RequestSendNotification(String email, String mensagem) {
        this.email = email;
        this.mensagem = mensagem;
    }
}
