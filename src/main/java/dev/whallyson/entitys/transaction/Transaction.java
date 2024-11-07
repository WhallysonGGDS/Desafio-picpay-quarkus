package dev.whallyson.entitys.transaction;

import dev.whallyson.entitys.user.User;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.LocalDateTime;

// Entidade Transferência na modelagem do banco de dados
@Entity(name = "transactions")
@Table(name = "tb_transactions")
public class Transaction extends PanacheEntityBase {

    // Id da transferência (Chave primária)
    // Estratégia de geração automática
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // Valor da transferência
    public BigDecimal amount;

    // Notificação do usuário que envia:
    public String notifySender;

    // Notificação do usuário que recebe:
    public String notifyReceiver;

    // Usuário que envia a transferência
    // Muitos-para-um: um mesmo usuário pode fazer várias transferências
    @ManyToOne
    @JoinColumn(name = "sender_id")
    public User sender;

    // Usuário que recebe a transferência
    // Muitos-para-um: um mesmo usuário pode fazer várias transferências
    @ManyToOne
    @JoinColumn(name = "receiver_id")
    public User receiver;

    // Timestamp da transferência (registra hora e a data da transação)
    @CreationTimestamp
    public LocalDateTime timestamp;
}
