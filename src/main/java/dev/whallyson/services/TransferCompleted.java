package dev.whallyson.services;

// Evento disparado por TransactionService quando uma transferência foi gravada.
// Quem o observa só age DEPOIS do commit (TransactionPhase.AFTER_SUCCESS): se a transação desfizer, ninguém é avisado.
public record TransferCompleted(Long transactionId) {}
