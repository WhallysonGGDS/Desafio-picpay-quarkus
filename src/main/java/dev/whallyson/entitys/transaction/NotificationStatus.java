package dev.whallyson.entitys.transaction;

// Situação do aviso enviado a uma das pontas da transferência.
// PENDING = ainda não enviado (o envio acontece depois do commit), SENT = enviado, FAILED = esgotou as tentativas.
public enum NotificationStatus {
    PENDING,
    SENT,
    FAILED
}
