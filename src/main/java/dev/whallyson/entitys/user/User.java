package dev.whallyson.entitys.user;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.*;
import java.math.BigDecimal;

// Entidade Usuário na modelagem do banco de dados
@Entity(name = "users")
@Table(name = "tb_users")
public class User extends PanacheEntityBase {

    // Id do Usuário (Chave primária)
    // Estratégia de geração automática
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    // Primeiro nome do Usuário
    public String firstName;

    // Sobrenome do Usuário
    public String lastName;

    // CPF do Usuário
    // O registro deve ser único, ou seja, não pode repetir
    // ### Pretendo criar uma validação para o CPF
    @Column(unique = true)
    public String  document;

    // E-mail do Usuário
    // O registro deve ser único, ou seja, não pode repetir
    @Column(unique = true)
    public String email;

    // Senha do Usuário
    // ### Pretendo criar uma criptografia de senha (mascarar a senha)
    public String password;

    // Saldo do Usuário
    public BigDecimal balance;

    // Tipo de Usuário
    // Enum de String:
    // COMMON = Um usuário comum
    // MERCHANT = Um usuário logista
    @Enumerated(EnumType.STRING)
    public UserType userType;

}
