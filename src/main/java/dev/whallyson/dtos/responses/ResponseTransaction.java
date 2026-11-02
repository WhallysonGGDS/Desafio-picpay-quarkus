package dev.whallyson.dtos.responses;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import dev.whallyson.dtos.MoneySerializer;
import dev.whallyson.entitys.transaction.NotificationStatus;
import dev.whallyson.entitys.transaction.Transaction;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;

// Uma transferência como quem consulta a enxerga: as duas pontas só com id e nome (nunca e-mail, documento
// ou saldo), a situação dos avisos e a direção (SENT/RECEIVED) relativa a quem consulta.
@Schema(requiredProperties = {"id", "amount", "sender", "receiver", "notifySender", "notifyReceiver", "timestamp", "direction"})
public record ResponseTransaction(
        Long id,
        @JsonSerialize(using = MoneySerializer.class) @Schema(type = SchemaType.STRING, example = "250.00") BigDecimal amount,
        Party sender,
        Party receiver,
        NotificationStatus notifySender,
        NotificationStatus notifyReceiver,
        Instant timestamp,
        Direction direction) {

    @Schema(requiredProperties = {"id", "name"})
    public record Party(Long id, String name) {}

    public enum Direction { SENT, RECEIVED }

    public static ResponseTransaction from(Transaction transaction, Long viewerId) {
        return new ResponseTransaction(
                transaction.id,
                transaction.amount,
                new Party(transaction.sender.id, transaction.sender.firstName + " " + transaction.sender.lastName),
                new Party(transaction.receiver.id, transaction.receiver.firstName + " " + transaction.receiver.lastName),
                transaction.notifySender,
                transaction.notifyReceiver,
                transaction.timestamp,
                transaction.sender.id.equals(viewerId) ? Direction.SENT : Direction.RECEIVED);
    }
}
