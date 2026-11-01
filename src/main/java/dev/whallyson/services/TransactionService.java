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

    // Tudo acontece em UMA transação de banco: se qualquer regra falhar, nada é gravado.
    // O remetente vem sempre do usuário autenticado, nunca do corpo da requisição.
    @Transactional
    public Transaction transfer(Long senderId, RequestTransaction body) {
        Long receiverId = body.receiverId();
        BigDecimal amount = body.amount().setScale(2);

        // Antes de tocar o banco
        if (senderId.equals(receiverId)) {
            throw new ApiException(ErrorCode.SELF_TRANSFER);
        }

        // Os dois saldos são travados em ordem crescente de id (evita deadlock entre transferências cruzadas).
        // Nenhum dos dois pode ser lido ANTES do lock: uma entidade já carregada não seria atualizada pelo lock.
        Map<Long, User> locked = new HashMap<>();
        for (Long id : Stream.of(senderId, receiverId).sorted().toList()) {
            locked.put(id, User.findById(id, LockModeType.PESSIMISTIC_WRITE));
        }
        User sender = locked.get(senderId);
        User receiver = locked.get(receiverId);
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

        requireAuthorization();

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
    // Os locks de saldo ficam retidos durante esta chamada, por isso o cliente tem timeout curto (3 s).
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
