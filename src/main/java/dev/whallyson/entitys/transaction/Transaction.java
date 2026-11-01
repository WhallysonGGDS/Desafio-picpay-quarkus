package dev.whallyson.entitys.transaction;

import dev.whallyson.entitys.user.User;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.Instant;

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
    @Column(nullable = false, precision = 19, scale = 2)
    public BigDecimal amount;

    // Aviso do usuário que envia: nasce PENDING e passa a SENT ou FAILED depois do commit
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public NotificationStatus notifySender = NotificationStatus.PENDING;

    // Aviso do usuário que recebe: nasce PENDING e passa a SENT ou FAILED depois do commit
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public NotificationStatus notifyReceiver = NotificationStatus.PENDING;

    // Usuário que envia a transferência
    // Muitos-para-um: um mesmo usuário pode fazer várias transferências
    @ManyToOne(optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    public User sender;

    // Usuário que recebe a transferência
    // Muitos-para-um: um mesmo usuário pode receber várias transferências
    @ManyToOne(optional = false)
    @JoinColumn(name = "receiver_id", nullable = false)
    public User receiver;

    // Momento da transferência, sempre em UTC (o front formata no fuso de quem olha)
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    public Instant timestamp;
}
