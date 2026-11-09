package dev.whallyson.entitys.user;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.math.BigDecimal;

// Entidade Usuário na modelagem do banco de dados
// As restrições de unicidade têm nome fixo para que a violação possa ser traduzida em erro de negócio
// (DUPLICATE_EMAIL / DUPLICATE_DOCUMENT) sem depender do nome que o banco geraria.
@Entity(name = "users")
@Table(name = "tb_users", uniqueConstraints = {
        @UniqueConstraint(name = "uk_users_email", columnNames = "email"),
        @UniqueConstraint(name = "uk_users_document", columnNames = "document")
})
public class User extends PanacheEntityBase {

    // Id do Usuário (Chave primária)
    // Estratégia de geração automática
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // Primeiro nome do Usuário
    @Column(nullable = false)
    public String firstName;

    // Sobrenome do Usuário
    @Column(nullable = false)
    public String lastName;

    // CPF (usuário comum) ou CNPJ (lojista), guardado só com dígitos
    @Column(nullable = false)
    public String document;

    // E-mail do Usuário, guardado em minúsculas
    @Column(nullable = false)
    public String email;

    // Hash BCrypt da senha. A senha em si nunca é guardada nem devolvida pela API.
    @Column(nullable = false)
    public String passwordHash;

    // Saldo do Usuário
    @Column(nullable = false, precision = 19, scale = 2)
    public BigDecimal balance;

    // Tipo de Usuário
    // Enum de String:
    // COMMON = Um usuário comum
    // MERCHANT = Um usuário logista
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public UserType userType;

}
