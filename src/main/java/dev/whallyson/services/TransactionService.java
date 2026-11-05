package dev.whallyson.services;

import dev.whallyson.dtos.exception.ErrorResponseDTO;
import dev.whallyson.dtos.requests.RequestTransaction;
import dev.whallyson.dtos.responses.ResponseAuthorizationTransaction;
import dev.whallyson.dtos.responses.ResponsePage;
import dev.whallyson.dtos.responses.ResponseTransaction;
import dev.whallyson.entitys.transaction.Transaction;
import dev.whallyson.entitys.user.User;
import dev.whallyson.entitys.user.UserType;
import dev.whallyson.exceptions.ApiException;
import dev.whallyson.exceptions.ErrorCode;
import dev.whallyson.mocks.AuthorizationTransaction.AuthorizationTransaction;
import io.quarkus.hibernate.orm.panache.PanacheQuery;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.persistence.LockModeType;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import org.eclipse.microprofile.rest.client.inject.RestClient;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@ApplicationScoped
public class TransactionService {

    private final AuthorizationTransaction authorizer;
    private final Event<TransferCompleted> completed;

    // Injeta dependências
    // O Quarkus, durante a execução, se encarrega de fornecer o cliente REST do autorizador externo
    // e o disparador do evento "transferência concluída" (quem avisa as pontas observa esse evento).
    public TransactionService(@RestClient AuthorizationTransaction authorizer, Event<TransferCompleted> completed) {
        this.authorizer = authorizer;
        this.completed = completed;
    }

    // A transferência acontece em três tempos, para os locks de saldo durarem só o trabalho do banco (milissegundos) e não a ida a
    // um serviço externo (até 4 s):
    //   1. confere o que dá para conferir SEM lock (falha rápido e não gasta uma chamada ao autorizador à toa);
    //   2. pede a autorização, sem transação aberta e sem lock (o autorizador é um GET sem parâmetros: não depende do saldo);
    //   3. numa transação NOVA, trava os dois saldos em ordem, CONFERE DE NOVO (o saldo pode ter mudado desde o passo 1) e grava.
    // O remetente vem sempre do usuário autenticado, nunca do corpo da requisição. Se qualquer regra falhar, nada é gravado.
    public Transaction transfer(Long senderId, RequestTransaction body) {
        Long receiverId = body.receiverId();
        BigDecimal amount = body.amount().setScale(2);

        // Antes de tocar o banco
        if (senderId.equals(receiverId)) {
            throw new ApiException(ErrorCode.SELF_TRANSFER);
        }

        QuarkusTransaction.requiringNew().run(() -> validate(User.findById(senderId), User.findById(receiverId), amount));

        requireAuthorization();

        return QuarkusTransaction.requiringNew().call(() -> record(senderId, receiverId, amount));
    }

    // As regras que dependem do estado das contas, na ordem em que o cliente as vê falhar. Roda duas vezes: sem lock (falha rápido)
    // e com os saldos travados (a conferência que vale).
    private void validate(User sender, User receiver, BigDecimal amount) {
        if (sender == null) {
            throw new ApiException(ErrorCode.UNAUTHENTICATED);
        }
        if (receiver == null) {
            throw new ApiException(ErrorCode.USER_NOT_FOUND);
        }
        if (sender.userType == UserType.MERCHANT) {
            throw new ApiException(ErrorCode.MERCHANT_CANNOT_SEND);
        }
        if (sender.balance.compareTo(amount) < 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE);
        }
    }

    // Passo 3. Os dois saldos são travados em ordem crescente de id (evita deadlock entre transferências cruzadas).
    // Nenhum dos dois pode ser lido ANTES do lock: uma entidade já carregada não seria atualizada pelo lock.
    private Transaction record(Long senderId, Long receiverId, BigDecimal amount) {
        Map<Long, User> locked = new HashMap<>();
        for (Long id : Stream.of(senderId, receiverId).sorted().toList()) {
            locked.put(id, User.findById(id, LockModeType.PESSIMISTIC_WRITE));
        }
        User sender = locked.get(senderId);
        User receiver = locked.get(receiverId);
        validate(sender, receiver, amount);

        sender.balance = sender.balance.subtract(amount);
        receiver.balance = receiver.balance.add(amount);

        Transaction transaction = new Transaction();
        transaction.amount = amount;
        transaction.sender = sender;
        transaction.receiver = receiver;
        transaction.persist();

        // Os avisos só saem se esta transação fizer commit (o observador roda em AFTER_SUCCESS).
        completed.fire(new TransferCompleted(transaction.id));
        return transaction;
    }

    // Extrato do usuário: transferências que ele enviou e/ou recebeu, da mais recente para a mais antiga.
    // direction: "all", "sent" ou "received". O id decresce junto com o tempo, então ordena sem empates.
    @Transactional
    public ResponsePage<ResponseTransaction> list(Long userId, String direction, int page, int size) {
        String filter = switch (direction) {
            case "all" -> "sender.id = ?1 or receiver.id = ?1";
            case "sent" -> "sender.id = ?1";
            case "received" -> "receiver.id = ?1";
            default -> throw new ApiException(ErrorCode.VALIDATION_ERROR,
                    List.of(new ErrorResponseDTO.FieldError("direction", "INVALID_DIRECTION")));
        };
        PanacheQuery<Transaction> query = Transaction.find(filter, Sort.descending("id"), userId);
        long total = query.count();
        // Página além do fim é uma página vazia. A checagem usa long antes de paginar: o Panache calcula
        // page * size em int, e um page enorme estouraria para negativo (e viraria 500).
        if ((long) page * size >= total) {
            return new ResponsePage<>(List.of(), page, size, total);
        }
        List<ResponseTransaction> items = query.page(Page.of(page, size)).list().stream()
                .map(transaction -> ResponseTransaction.from(transaction, userId))
                .toList();
        return new ResponsePage<>(items, page, size, total);
    }

    // Autorizador externo (mock). Falha FECHADA: só uma resposta que afirma data.authorization == true libera.
    // 403 ou authorization=false (ou corpo vazio) é recusa; qualquer outra falha (rede, timeout, 5xx) é indisponibilidade.
    // Nenhum lock de saldo está retido nesta chamada; o timeout curto do cliente (3 s) é para o cliente não esperar à toa.
    private void requireAuthorization() {
        ResponseAuthorizationTransaction response;
        try {
            response = authorizer.authorize();
        } catch (WebApplicationException e) {
            if (e.getResponse() != null && e.getResponse().getStatus() == 403) {
                throw new ApiException(ErrorCode.AUTHORIZATION_DENIED);
            }
            throw new ApiException(ErrorCode.AUTHORIZER_UNAVAILABLE);
        } catch (RuntimeException e) {
            throw new ApiException(ErrorCode.AUTHORIZER_UNAVAILABLE);
        }
        if (response == null || response.data == null || !response.data.authorization) {
            throw new ApiException(ErrorCode.AUTHORIZATION_DENIED);
        }
    }
}
