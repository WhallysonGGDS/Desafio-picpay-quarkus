package dev.whallyson.dtos.responses;

// Objeto response(o que vem como resposta no corpo/body) da requisição que envia uma notificação por e-mail
// (mock - SendNotification)
public class ResponseSendNotification {

    public String status;
    public Data data;

    public static class Data {
        public boolean authorization;
    }
}
