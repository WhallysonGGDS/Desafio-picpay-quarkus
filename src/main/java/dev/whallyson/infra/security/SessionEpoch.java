package dev.whallyson.infra.security;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.UUID;

/**
 * Identifica ESTA execução do app. Cada token leva o valor da execução que o emitiu, e só vale nela.
 *
 * <p>O banco é em memória e recriado do zero a cada início, então os ids (autoincrementais) recomeçam em 1. Sem isto, com
 * as chaves de produção fixas (que fazem as assinaturas sobreviverem a um reinício), o cookie antigo de uma pessoa passava
 * na verificação e, durante a hora de validade, abria a conta de quem tivesse recebido o mesmo id depois do reinício.
 */
@ApplicationScoped
public class SessionEpoch {

    private final String value = UUID.randomUUID().toString();

    public String value() {
        return value;
    }
}
