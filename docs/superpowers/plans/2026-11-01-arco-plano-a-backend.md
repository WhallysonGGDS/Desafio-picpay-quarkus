# Arco — Plano A: Back-end — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o back-end integrável do Arco: login com JWT em cookie, transferência segura, extrato, busca de destinatário, erros com código estável e OpenAPI exportado.

**Architecture:** Mantém os pacotes `dev.whallyson.*`. Controllers finos devolvem DTOs (a entidade nunca sai pela API). As regras ficam em `services`. Erros de negócio são `ApiException(ErrorCode)`, traduzidos por mappers JAX-RS para `{statusCode, code, message, fieldErrors?}`. A autenticação é preguiçosa, por cookie JWT. A transferência roda numa transação com *lock* pessimista e a notificação sai assíncrona depois do commit.

**Tech Stack:** Java 21, Quarkus 3.15.1 (Quarkus REST, Panache, H2), smallrye-jwt, hibernate-validator, Elytron BCrypt, JUnit 5, RestAssured, Mockito, Awaitility, Node 22 (stub e smoke).

**Spec:** `docs/superpowers/specs/2026-11-01-arco-frontend-backend-design.md` (seções 4, 7 e Etapas 0–2 da seção 8). O Plano B (front-end) é escrito depois deste, sobre o contrato real.

## Global Constraints

- Java 21, Quarkus 3.15.1. Pacote raiz `dev.whallyson`. Os pacotes e a grafia `entitys` existentes são mantidos.
- Mensagens ao usuário em PT-BR. Corpo de erro `{ statusCode, code, message, fieldErrors? }`, com `fieldErrors` = lista de `{field, code}`.
- Códigos e status: 400 `VALIDATION_ERROR`; 401 `INVALID_CREDENTIALS`, `UNAUTHENTICATED`; 403 `MERCHANT_CANNOT_SEND`; 404 `USER_NOT_FOUND`, `NOT_FOUND`; 405 `METHOD_NOT_ALLOWED`; 409 `DUPLICATE_EMAIL`, `DUPLICATE_DOCUMENT`; 422 `INSUFFICIENT_BALANCE`, `SELF_TRANSFER`, `AUTHORIZATION_DENIED`; 503 `AUTHORIZER_UNAVAILABLE`; 500 `INTERNAL_ERROR`. Outros status HTTP do JAX-RS: `HTTP_<status>`.
- Dinheiro nas respostas: sempre string com duas casas (`"1250.00"`). Colunas `precision=19, scale=2`.
- Nenhuma resposta contém `password` nem `passwordHash`. A entidade nunca é serializada pela API.
- Senha: 8 a 72 caracteres, BCrypt. Saldo inicial: `app.signup.initial-balance` (padrão `1000.00`) para `COMMON` e `0.00` para `MERCHANT`.
- Cookie `arco_session`: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` fora de dev e test. JWT com `sub` = id do usuário, issuer `arco`, validade `app.jwt.lifetime` (padrão `PT1H`).
- Autenticação preguiçosa (`quarkus.http.auth.proactive=false`). Nenhuma chave no repositório: par RSA efêmero como fallback, e produção usa `SMALLRYE_JWT_SIGN_KEY` e `MP_JWT_VERIFY_PUBLICKEY`.
- Rotas só aceitam JSON (`@Consumes(APPLICATION_JSON)`), o que completa a defesa contra CSRF.
- Autorizador: timeout de 3 s. Notificador: timeout de 2 s e até 2 retentativas. Busca: `q` com no mínimo 3 caracteres e correspondência exata. Extrato: `size` máximo 50.
- Os testes nunca chamam `util.devi.tools`: os clientes REST são *mockados* com `@InjectMock @RestClient`.

## Convenções de execução

- Maven: `mvn -B -ntp` (o `mvnw` não funciona neste ambiente). Teste isolado: `mvn -B -ntp test -Dtest=NomeDaClasse`. Sucesso = `BUILD SUCCESS` e `Failures: 0, Errors: 0`.
- Nos testes: imports estáticos de `RestAssured.given`, `ContentType.JSON`, `org.hamcrest.Matchers.*` e `TestUsers.*`. O `@InjectMock` é `io.quarkus.test.junit.mockito.InjectMock`.
- **Todo parâmetro de corpo de requisição se chama `body`.** O mapper usa o nome do último nó do caminho como `field`.
- Ao ver um teste falhar (passo "ver falhar"), confirme que falhou pelo motivo esperado. Se falhou por erro de compilação ou de configuração, corrija o teste antes de seguir.
- Cada tarefa termina com commit (mensagem em PT-BR, formato `tipo(escopo): resumo`, com os trailers de atribuição da sessão) e `git push -u origin ccr-2f5e7339-pybi0z`. Em falha de rede, repetir com espera de 2, 4, 8 e 16 s.

## Review Focus

Entradas e falhas que a spec implica, mas que nenhum teste "óbvio" cobriria. Cada linha tem o teste na tarefa dona:

1. **Cookie de sessão inválido ou expirado enviado a `/auth/login`, `/auth/register` e `/auth/logout`.** A rota pública o ignora e nunca responde `401`. Sem isso, quem tem cookie velho não consegue entrar de novo. (T5)
2. **Token válido de um usuário que não existe mais** (banco em memória reiniciado com as mesmas chaves): `401 UNAUTHENTICATED`, nunca `500`. (T5)
3. **Dois cadastros simultâneos com o mesmo e-mail:** um `201` e um `409 DUPLICATE_EMAIL`, nunca `500`. (T5)
4. **Variações de entrada:** e-mail com espaços e maiúsculas e CPF com pontuação cadastram, autenticam e colidem como o mesmo usuário. (T4 e T5)
5. **Valores monetários incomuns:** `250.5` vira `"250.50"`, o número JSON `250.10` é aceito, `"1e2"` vira `"100.00"`, `"0.001"` dá `400`, e `"999999999999999.99"` dá `422 INSUFFICIENT_BALANCE`, nunca `500`. (T7)

## Mapa de arquivos

```
src/main/java/dev/whallyson/
  controllers/  AuthController (novo) · UserController (reescrito) · TransactionController (reescrito) · HelloController (intacto)
  services/     UserService · TransactionService · TransferCompleted · NotificationDispatcher · NotificationSender · NotificationMessages
  entitys/      user/User (alterado) · transaction/Transaction (alterado) · transaction/NotificationStatus (novo)
  dtos/         requests/{RequestRegister, RequestLogin, RequestTransaction, RequestSendNotification*}
                responses/{ResponseUser, ResponseUserSummary, ResponseTransaction, ResponsePage} · exception/ErrorResponseDTO* · MoneySerializer
  exceptions/   ErrorCode · ApiException
  validation/   DocumentValidator · DocumentMask · ValidDocument · ValidDocumentValidator
  infra/        ApiExceptionMapper · ConstraintViolationMapper · JsonErrorMapper · GlobalExceptionHandler* · SecurityExceptionMappers · SeedData
  infra/security/ EphemeralJwtKeysConfigSource · TokenService · SessionCookie · CurrentUser
  mocks/        configKey nas duas interfaces
src/test/java/dev/whallyson/  support/{TestDocuments, TestUsers, Authorizations} + um *Test por tarefa
scripts/        stub-externals.mjs · smoke-api.mjs        (* = alterado)
```

---

### Task 1: Fundação (Etapa 0)

**Files:**
- Modify: `pom.xml`, `src/main/resources/application.properties` (reescrever em UTF-8, mesmos valores)
- Create: `scripts/stub-externals.mjs`

**Interfaces:**
- Produces: o contrato do stub, usado por T11 e pelo Plano B. Porta `STUB_PORT` (padrão `9000`). O corpo é lido como JSON independentemente do `Content-Type`.

| Rota | Modo | Resposta |
|---|---|---|
| `GET /api/v2/authorize` | `grant` (padrão) | `200` `{"status":"success","data":{"authorization":true}}` |
| | `deny` | `403` `{"status":"fail","data":{"authorization":false}}` |
| | `down` | fecha o socket sem responder |
| `POST /api/v1/notify` | `ok` (padrão) | `204` sem corpo |
| | `fail` | `503` `{"status":"error"}` |
| `POST /__mode` | corpo `{"authorize":"grant\|deny\|down","notify":"ok\|fail"}`, campos opcionais | `200` com os modos atuais |
| `GET /__calls` | | `200` `{"authorize":<n>,"notify":[<corpos JSON recebidos>]}` |
| `POST /__reset` | | `204`; zera as chamadas e volta aos modos padrão |

- Para o Plano B: a versão a fixar do Quinoa é `io.quarkiverse.quinoa:quarkus-quinoa:2.5.5` (seu parent usa Quarkus 3.15.1).

- [ ] **Step 1: Adicionar dependências ao `pom.xml`** (versões gerenciadas pelo BOM). Compile: `quarkus-smallrye-jwt`, `quarkus-smallrye-jwt-build`, `quarkus-hibernate-validator`, `quarkus-elytron-security-common`. Test: `quarkus-junit5-mockito`, `org.awaitility:awaitility`.
- [ ] **Step 2: Provar que resolvem.** Run: `mvn -B -ntp -DskipTests compile`. Expected: `BUILD SUCCESS`.
- [ ] **Step 3: Provar o Quinoa.** Run: `mvn -B -ntp dependency:get -Dartifact=io.quarkiverse.quinoa:quarkus-quinoa:2.5.5`. Expected: `BUILD SUCCESS`. Se der 429, repita depois de alguns segundos. Se persistir, pare e avise o autor.
- [ ] **Step 4: Reescrever `application.properties` em UTF-8** (o arquivo atual tem bytes inválidos nos comentários), com os mesmos 8 valores. Run: `mvn -B -ntp test`. Expected: `Tests run: 1, Failures: 0, Errors: 0` (linha de base: `GreetingResourceTest`).
- [ ] **Step 5: Criar `scripts/stub-externals.mjs`** (Node 22, sem dependências) conforme o contrato acima.
- [ ] **Step 6: Verificar o stub.**

```bash
node scripts/stub-externals.mjs & sleep 1
curl -s -w ' %{http_code}\n' localhost:9000/api/v2/authorize                 # {"status":"success","data":{"authorization":true}} 200
curl -s -X POST localhost:9000/__mode -d '{"authorize":"deny","notify":"fail"}'; echo
curl -s -w ' %{http_code}\n' localhost:9000/api/v2/authorize                 # {"status":"fail","data":{"authorization":false}} 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:9000/api/v1/notify -d '{"email":"a@b.c","mensagem":"oi"}'   # 503
curl -s localhost:9000/__calls                                               # {"authorize":2,"notify":[{"email":"a@b.c","mensagem":"oi"}]}
curl -s -X POST localhost:9000/__mode -d '{"authorize":"down"}'; echo; curl -s localhost:9000/api/v2/authorize; echo "exit=$?"   # exit=52
kill %1
```

- [ ] **Step 7: Commit e push.** `chore(build): dependências do back-end e stub dos serviços externos`

---

### Task 2: Modelo de erros

**Files:**
- Create: `exceptions/ErrorCode.java`, `exceptions/ApiException.java`, `infra/ApiExceptionMapper.java`, `infra/ConstraintViolationMapper.java`, `infra/JsonErrorMapper.java`
- Modify: `dtos/exception/ErrorResponseDTO.java`, `infra/GlobalExceptionHandler.java`
- Delete: `infra/DataIntegrityViolationExceptionMapper.java`
- Test: `src/test/java/dev/whallyson/infra/ErrorProbeResource.java` (só de teste), `ErrorModelTest.java`

**Interfaces:**
- Produces: `enum ErrorCode` com os valores da seção Global Constraints, `int status()` e `String defaultMessage()`. `ApiException(ErrorCode)` e `ApiException(ErrorCode, List<ErrorResponseDTO.FieldError>)`, com `code()` e `fieldErrors()`. `ErrorResponseDTO(int statusCode, String code, String message, List<FieldError> fieldErrors)` com `record FieldError(String field, String code)`, anotado com `@JsonInclude(NON_EMPTY)`.
- Mensagens padrão: `VALIDATION_ERROR` "Dados inválidos."; `INVALID_CREDENTIALS` "E-mail ou senha incorretos."; `UNAUTHENTICATED` "Sessão ausente ou expirada."; `MERCHANT_CANNOT_SEND` "Usuário do tipo lojista não está autorizado a realizar transferências."; `USER_NOT_FOUND` "Usuário não encontrado."; `NOT_FOUND` "Recurso não encontrado."; `METHOD_NOT_ALLOWED` "Método não permitido."; `DUPLICATE_EMAIL` "O e-mail informado já está registrado."; `DUPLICATE_DOCUMENT` "O documento informado já está registrado."; `INSUFFICIENT_BALANCE` "Saldo insuficiente."; `SELF_TRANSFER` "Não é possível transferir para si mesmo."; `AUTHORIZATION_DENIED` "Transferência recusada pelo serviço de autorização."; `AUTHORIZER_UNAVAILABLE` "Serviço de autorização indisponível. Tente novamente."; `INTERNAL_ERROR` "Erro interno. Tente novamente."

- [ ] **Step 1: Escrever o recurso de apoio e os testes que falham.**

```java
@Path("/__probe") @Consumes(MediaType.APPLICATION_JSON) @Produces(MediaType.APPLICATION_JSON)
public class ErrorProbeResource {
    public record ProbeBody(@NotBlank(message = "REQUIRED") String name) {}
    @GET @Path("api")  public String api()  { throw new ApiException(ErrorCode.INSUFFICIENT_BALANCE); }
    @GET @Path("boom") public String boom() { throw new IllegalStateException("segredo interno"); }
    @POST @Path("validate") public String validate(@NotNull(message = "REQUIRED") @Valid ProbeBody body) { return "ok"; }
}
```

```java
@QuarkusTest class ErrorModelTest {
  @Test void unknownRoute_is404Json()   { given().get("/nao-existe").then().statusCode(404).body("code", is("NOT_FOUND")).body("statusCode", is(404)); }
  @Test void wrongMethod_is405Json()    { given().post("/hello").then().statusCode(405).body("code", is("METHOD_NOT_ALLOWED")); }
  @Test void unsupportedMediaType_isHttp415() { given().contentType("text/plain").body("x").post("/__probe/validate").then().statusCode(415).body("code", is("HTTP_415")); }
  @Test void apiException_usesCodeStatusAndMessage() { given().get("/__probe/api").then().statusCode(422).body("code", is("INSUFFICIENT_BALANCE")).body("message", is("Saldo insuficiente.")); }
  @Test void bodyValidation_listsFieldErrors() { given().contentType(JSON).body("{\"name\":\"\"}").post("/__probe/validate").then().statusCode(400)
      .body("code", is("VALIDATION_ERROR")).body("fieldErrors[0].field", is("name")).body("fieldErrors[0].code", is("REQUIRED")); }
  @Test void missingBody_reportsFieldBody() { given().contentType(JSON).post("/__probe/validate").then().statusCode(400)
      .body("fieldErrors[0].field", is("body")).body("fieldErrors[0].code", is("REQUIRED")); }
  @Test void malformedJson_is400() { given().contentType(JSON).body("{").post("/__probe/validate").then().statusCode(400).body("code", is("VALIDATION_ERROR")); }
  @Test void unexpectedException_is500WithoutDetails() { given().get("/__probe/boom").then().statusCode(500).body("code", is("INTERNAL_ERROR")).body("message", not(containsString("segredo"))); }
}
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp test -Dtest=ErrorModelTest`. Expected: FAIL (corpo sem `code`, e `404`/`405` virando `500`).
- [ ] **Step 3: Implementar.**
  - `ApiExceptionMapper`: usa `code().status()`, o `code` e a mensagem padrão.
  - `ConstraintViolationMapper` (`ConstraintViolationException`): 400 `VALIDATION_ERROR`. `field` = nome do último nó do caminho. `code` = `violation.getMessage()`. Lista ordenada por `field` e depois `code`.
  - `JsonErrorMapper` (`JsonProcessingException`): 400 `VALIDATION_ERROR` sem `fieldErrors`.
  - `GlobalExceptionHandler`: `WebApplicationException` preserva o status (400→`VALIDATION_ERROR`, 401→`UNAUTHENTICATED`, 404→`NOT_FOUND`, 405→`METHOD_NOT_ALLOWED`, demais→`HTTP_<status>`). Qualquer outra exceção grava o stack no log em `ERROR` e responde 500 `INTERNAL_ERROR` com a mensagem padrão, sem detalhes.
  - Apagar `DataIntegrityViolationExceptionMapper`.
- [ ] **Step 4: Ver passar.** Run: `mvn -B -ntp test`. Expected: `ErrorModelTest` com 8 testes verdes e o restante verde.
- [ ] **Step 5: Commit e push.** `feat(api): modelo de erros com código estável e status semânticos`

---

### Task 3: Documentos (CPF, CNPJ e máscara)

**Files:**
- Create: `validation/DocumentValidator.java`, `validation/DocumentMask.java`
- Test: `src/test/java/dev/whallyson/validation/DocumentValidatorTest.java`, `DocumentMaskTest.java` (JUnit puro, sem Quarkus)

**Interfaces:**
- Produces: `DocumentValidator.digitsOnly(String): String` (`null` vira `""`); `DocumentValidator.isValidCpf(String digits): boolean`; `DocumentValidator.isValidCnpj(String digits): boolean`; `DocumentMask.mask(String digits): String`.

- [ ] **Step 1: Escrever os testes que falham.**

```java
class DocumentValidatorTest {
  @Test void digitsOnly_stripsPunctuation_andHandlesNull() { assertEquals("52998224725", DocumentValidator.digitsOnly("529.982.247-25")); assertEquals("", DocumentValidator.digitsOnly(null)); }
  @ParameterizedTest @ValueSource(strings = {"52998224725", "11144477735"}) void validCpf(String s) { assertTrue(DocumentValidator.isValidCpf(s)); }
  @ParameterizedTest @ValueSource(strings = {"52998224724", "11111111111", "123", "", "529982247250"}) void invalidCpf(String s) { assertFalse(DocumentValidator.isValidCpf(s)); }
  @Test void validCnpj() { assertTrue(DocumentValidator.isValidCnpj("11222333000181")); }
  @ParameterizedTest @ValueSource(strings = {"11222333000182", "00000000000000", "1122233300018", ""}) void invalidCnpj(String s) { assertFalse(DocumentValidator.isValidCnpj(s)); }
}
class DocumentMaskTest {
  @Test void masksCpf()  { assertEquals("***.982.247-**", DocumentMask.mask("52998224725")); }
  @Test void masksCnpj() { assertEquals("**.222.333/****-**", DocumentMask.mask("11222333000181")); }
  @Test void masksOtherLengthsFully() { assertEquals("***", DocumentMask.mask("123")); }
}
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp test -Dtest='Document*Test'`. Expected: erro de compilação (classes inexistentes).
- [ ] **Step 3: Implementar** os dois utilitários. CPF e CNPJ pelo algoritmo oficial de dígitos verificadores, rejeitando sequências de dígitos iguais.
- [ ] **Step 4: Ver passar.** Run: `mvn -B -ntp test -Dtest='Document*Test'`. Expected: `Failures: 0, Errors: 0`.
- [ ] **Step 5: Commit e push.** `feat(validation): validação de CPF e CNPJ e máscara de documento`

---

### Task 4: Domínio de usuários

**Files:**
- Modify: `entitys/user/User.java`, `application.properties`
- Rewrite: `services/UserService.java`
- Create: `dtos/requests/RequestRegister.java`, `validation/ValidDocument.java`, `validation/ValidDocumentValidator.java`
- Delete (substituídos nas T5 e T7): `controllers/UserController.java`, `controllers/TransactionController.java`, `services/TransactionService.java`, `dtos/requests/RequestTransaction.java`
- Test: `src/test/java/dev/whallyson/support/TestDocuments.java`, `services/UserServiceTest.java`

**Interfaces:**
- Consumes: `DocumentValidator` (T3), `ApiException`/`ErrorCode` (T2).
- Produces:
  - `User` com campos públicos `id, firstName, lastName, document, email, passwordHash, balance, userType`. Restrições únicas nomeadas `uk_users_email` e `uk_users_document`.
  - `record RequestRegister(String firstName, String lastName, String document, String email, String password, UserType userType)` com `@ValidDocument` na classe.
  - `UserService.register(RequestRegister): User` (`@Transactional`), `authenticate(String email, String password): User`, `requireById(Long id): User` (ausente vira `UNAUTHENTICATED`).
  - `TestDocuments.cpf()`, `cnpj()`, `email()` (únicos e válidos) e `formatCpf(String digits)`.
- Códigos de violação usados como `message` das constraints: `REQUIRED`, `TOO_LONG`, `INVALID_EMAIL`, `PASSWORD_LENGTH`, `INVALID_DOCUMENT`.

- [ ] **Step 1: Escrever `TestDocuments` e os testes que falham.**

```java
@QuarkusTest class UserServiceTest {
  @Inject UserService users;  @Inject Validator validator;
  static RequestRegister req(String email, String doc, UserType t) { return new RequestRegister("Ana", "Souza", doc, email, "segredo123", t); }
  Map<String, String> violations(RequestRegister r) { return validator.validate(r).stream().collect(Collectors.toMap(v -> v.getPropertyPath().toString(), ConstraintViolation::getMessage, (a, b) -> a)); }

  @Test void register_normalizesFieldsAndHashesPassword() {           // RF4
    String cpf = TestDocuments.cpf(), email = TestDocuments.email();
    User u = users.register(req("  " + email.toUpperCase() + " ", TestDocuments.formatCpf(cpf), UserType.COMMON));
    assertEquals(email, u.email);  assertEquals(cpf, u.document);
    assertTrue(BcryptUtil.matches("segredo123", u.passwordHash));  assertNotEquals("segredo123", u.passwordHash);
  }
  @Test void register_setsInitialBalanceByType() {
    assertEquals(new BigDecimal("1000.00"), users.register(req(TestDocuments.email(), TestDocuments.cpf(), UserType.COMMON)).balance);
    assertEquals(new BigDecimal("0.00"), users.register(req(TestDocuments.email(), TestDocuments.cnpj(), UserType.MERCHANT)).balance);
  }
  @Test void register_rejectsDuplicateEmail_acrossVariants() {          // RF4
    String email = TestDocuments.email();  users.register(req(email, TestDocuments.cpf(), UserType.COMMON));
    assertEquals(ErrorCode.DUPLICATE_EMAIL, assertThrows(ApiException.class, () -> users.register(req(" " + email.toUpperCase(), TestDocuments.cpf(), UserType.COMMON))).code());
  }
  @Test void register_rejectsDuplicateDocument_acrossVariants() {       // RF4
    String cpf = TestDocuments.cpf();  users.register(req(TestDocuments.email(), cpf, UserType.COMMON));
    assertEquals(ErrorCode.DUPLICATE_DOCUMENT, assertThrows(ApiException.class, () -> users.register(req(TestDocuments.email(), TestDocuments.formatCpf(cpf), UserType.COMMON))).code());
  }
  @Test void requestRegister_constraints() {
    String ok = TestDocuments.cpf();
    assertEquals(Map.of(), violations(req("ana@teste.com", ok, UserType.COMMON)));
    assertEquals("REQUIRED",         violations(new RequestRegister("", "Souza", ok, "a@b.co", "segredo123", UserType.COMMON)).get("firstName"));
    assertEquals("TOO_LONG",         violations(new RequestRegister("x".repeat(81), "Souza", ok, "a@b.co", "segredo123", UserType.COMMON)).get("firstName"));
    assertEquals("INVALID_EMAIL",    violations(req("sem-arroba", ok, UserType.COMMON)).get("email"));
    assertEquals("PASSWORD_LENGTH",  violations(new RequestRegister("Ana", "Souza", ok, "a@b.co", "1234567", UserType.COMMON)).get("password"));
    assertEquals("PASSWORD_LENGTH",  violations(new RequestRegister("Ana", "Souza", ok, "a@b.co", "x".repeat(73), UserType.COMMON)).get("password"));
    assertEquals("INVALID_DOCUMENT", violations(req("a@b.co", "52998224724", UserType.COMMON)).get("document"));
    assertEquals("INVALID_DOCUMENT", violations(req("a@b.co", TestDocuments.cnpj(), UserType.COMMON)).get("document"));
    assertEquals("INVALID_DOCUMENT", violations(req("a@b.co", ok, UserType.MERCHANT)).get("document"));
    assertEquals("REQUIRED",         violations(new RequestRegister("Ana", "Souza", ok, "a@b.co", "segredo123", null)).get("userType"));
  }
  @Test void authenticate_isCaseInsensitive_andWrongCredentialsLookAlike() {
    String email = TestDocuments.email();  User u = users.register(req(email, TestDocuments.cpf(), UserType.COMMON));
    assertEquals(u.id, users.authenticate("  " + email.toUpperCase(), "segredo123").id);
    assertEquals(ErrorCode.INVALID_CREDENTIALS, assertThrows(ApiException.class, () -> users.authenticate(email, "errada123")).code());
    assertEquals(ErrorCode.INVALID_CREDENTIALS, assertThrows(ApiException.class, () -> users.authenticate("nao@existe.com", "segredo123")).code());
  }
  @Test void requireById_unknownId_isUnauthenticated() { assertEquals(ErrorCode.UNAUTHENTICATED, assertThrows(ApiException.class, () -> users.requireById(987654321L)).code()); }
}
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp test -Dtest=UserServiceTest`. Expected: erro de compilação (`RequestRegister`, `UserService.register` inexistentes).
- [ ] **Step 3: Apagar o legado** (os quatro arquivos listados). Eles dependem de campos que mudam, e as T5 e T7 os recriam no novo contrato.
- [ ] **Step 4: Implementar a entidade `User`.** `@Table(name = "tb_users", uniqueConstraints = {@UniqueConstraint(name = "uk_users_email", columnNames = "email"), @UniqueConstraint(name = "uk_users_document", columnNames = "document")})`, sem `@Column(unique = true)`. Troque `password` por `passwordHash`. `balance` com `@Column(nullable = false, precision = 19, scale = 2)`. Demais campos `nullable = false`.
- [ ] **Step 5: Implementar `RequestRegister` e `@ValidDocument`.**
  - Anotações do record: nomes `@NotBlank(REQUIRED) @Size(max = 80, TOO_LONG)`; e-mail `@NotBlank @Email(INVALID_EMAIL) @Size(max = 160, TOO_LONG)`; senha `@NotBlank @Size(min = 8, max = 72, PASSWORD_LENGTH)`; `userType` `@NotNull(REQUIRED)`; `document` `@NotBlank`.
  - `@ValidDocument` é uma constraint de classe cuja mensagem é `INVALID_DOCUMENT`. Aceita CPF válido para `COMMON` e CNPJ válido para `MERCHANT`. Ignora o caso de `document` em branco ou `userType` nulo, que outras constraints já reportam. A violação é registrada no nó de propriedade `document`.
- [ ] **Step 6: Implementar o `UserService`.**
  - `register`: normaliza o e-mail (`trim` e minúsculas) e o documento (`digitsOnly`). Calcula o hash com `BcryptUtil.bcryptHash`. O saldo inicial vem de `@ConfigProperty app.signup.initial-balance` (`BigDecimal`, padrão `1000.00`) para `COMMON`, e `0.00` para `MERCHANT`. Chama `persistAndFlush()`. Se vier `PersistenceException` cuja cadeia de causas contenha, em maiúsculas, `UK_USERS_EMAIL` ou `UK_USERS_DOCUMENT`, lança `ApiException(DUPLICATE_EMAIL ou DUPLICATE_DOCUMENT)`. Qualquer outra é repropagada.
  - `authenticate`: busca pelo e-mail normalizado. Quando o e-mail não existe, executa `BcryptUtil.matches` contra um hash fixo antes de lançar `INVALID_CREDENTIALS`, para que as duas falhas levem tempo parecido.
  - Adicione `app.signup.initial-balance=1000.00` ao `application.properties`.
- [ ] **Step 7: Ver passar.** Run: `mvn -B -ntp test`. Expected: tudo verde, com `UserServiceTest` em 7 testes.
- [ ] **Step 8: Commit e push.** `feat(users): cadastro com BCrypt, normalização, documento válido e saldo inicial`

---

### Task 5: Autenticação e sessão

**Files:**
- Create: `infra/security/EphemeralJwtKeysConfigSource.java`, `src/main/resources/META-INF/services/org.eclipse.microprofile.config.spi.ConfigSource`, `infra/security/TokenService.java`, `infra/security/SessionCookie.java`, `infra/security/CurrentUser.java`, `infra/SecurityExceptionMappers.java`, `dtos/MoneySerializer.java`, `dtos/requests/RequestLogin.java`, `dtos/responses/ResponseUser.java`, `controllers/AuthController.java`
- Rewrite: `controllers/UserController.java` (só `GET /users/me`)
- Modify: `application.properties`
- Test: `support/TestUsers.java`, `AuthApiTest.java`, `TokenServiceTest.java`, `SessionCookieTest.java`, `EphemeralJwtKeysConfigSourceTest.java`, `MoneySerializerTest.java`

**Interfaces:**
- Consumes: `UserService.register/authenticate/requireById` (T4), `ApiException` (T2).
- Produces:
  - `TokenService.issue(User): String` (usa só `user.id`).
  - `SessionCookie.create(String token): NewCookie` e `SessionCookie.expire(): NewCookie`.
  - `CurrentUser.id(): Long` (sem principal ou `sub` inválido vira `UNAUTHENTICATED`).
  - `ResponseUser.from(User)` com `id, firstName, lastName, document, email, balance, userType`.
  - `@JsonSerialize(using = MoneySerializer.class)` para dinheiro. Escreve `value.setScale(2).toPlainString()` como string.
  - `RequestLogin(String email, String password)`, ambos `@NotBlank(REQUIRED)`.
  - Rotas: `POST /auth/register` (201 e cookie), `POST /auth/login` (200 e cookie), `POST /auth/logout` (204, público e idempotente) e `GET /users/me`.
  - Testes: `TestUsers.register(UserType)`, `register(UserType, String firstName)`, `registerWithBalance(UserType, String balance)`, `balanceOf(Session)`, `setBalance(long userId, String balance)`, `record Session(long id, String email, String firstName, String document, String cookie)` (`document` = dígitos do CPF, ou do CNPJ para `MERCHANT`). Primeiro nome padrão `Ana`, sobrenome fixo `Teste`, senha `segredo123`.

- [ ] **Step 1: Escrever os testes que falham** (e o `TestUsers`).

```java
@QuarkusTest class AuthApiTest {
  @Inject TokenService tokens;
  static Map<String, Object> registerBody(String email, String doc, String type) { return Map.of("firstName", "Ana", "lastName", "Souza", "document", doc, "email", email, "password", "segredo123", "userType", type); }

  @Test void register_is201_setsHardenedCookie_andHidesPassword() {
    var r = given().contentType(JSON).body(registerBody(TestDocuments.email(), TestDocuments.cpf(), "COMMON")).post("/auth/register");
    r.then().statusCode(201).body("balance", is("1000.00")).body("userType", is("COMMON"))
     .body("keySet()", not(hasItem("password"))).body("keySet()", not(hasItem("passwordHash")));
    String c = r.header("Set-Cookie");
    assertAll(() -> assertTrue(c.startsWith("arco_session=")), () -> assertTrue(c.contains("HttpOnly")), () -> assertTrue(c.contains("SameSite=Strict")),
              () -> assertTrue(c.contains("Path=/")), () -> assertTrue(c.contains("Max-Age=3600")));
  }
  @Test void register_emptyBody_listsRequiredFields() { given().contentType(JSON).body("{}").post("/auth/register").then().statusCode(400)
      .body("code", is("VALIDATION_ERROR")).body("fieldErrors.field", hasItems("firstName", "lastName", "document", "email", "password", "userType")); }
  @Test void register_duplicates_are409() {
    var s = TestUsers.register(UserType.COMMON);  String cpf = TestDocuments.cpf();
    given().contentType(JSON).body(registerBody(s.email(), cpf, "COMMON")).post("/auth/register").then().statusCode(409).body("code", is("DUPLICATE_EMAIL"));
    given().contentType(JSON).body(registerBody(TestDocuments.email(), cpf, "COMMON")).post("/auth/register").then().statusCode(201);
    given().contentType(JSON).body(registerBody(TestDocuments.email(), cpf, "COMMON")).post("/auth/register").then().statusCode(409).body("code", is("DUPLICATE_DOCUMENT"));
  }
  @Test void register_concurrentSameEmail_oneCreatedOneConflict() throws Exception {   // RF3
    String email = TestDocuments.email();  var pool = Executors.newFixedThreadPool(2);  var gate = new CountDownLatch(1);
    Callable<Integer> call = () -> { gate.await(); return given().contentType(JSON).body(registerBody(email, TestDocuments.cpf(), "COMMON")).post("/auth/register").statusCode(); };
    var f1 = pool.submit(call);  var f2 = pool.submit(call);  gate.countDown();
    assertEquals(List.of(201, 409), Stream.of(f1.get(), f2.get()).sorted().toList());  pool.shutdown();
  }
  @Test void login_is200_caseInsensitive_andSetsCookie() {
    var s = TestUsers.register(UserType.COMMON);
    var r = given().contentType(JSON).body(Map.of("email", "  " + s.email().toUpperCase(), "password", "segredo123")).post("/auth/login");
    r.then().statusCode(200).body("id", is((int) s.id()));  assertTrue(r.header("Set-Cookie").startsWith("arco_session="));
  }
  @Test void login_wrongPasswordAndUnknownEmail_are401WithSameMessage() {
    var s = TestUsers.register(UserType.COMMON);
    String m1 = given().contentType(JSON).body(Map.of("email", s.email(), "password", "errada123")).post("/auth/login").then().statusCode(401).body("code", is("INVALID_CREDENTIALS")).extract().path("message");
    String m2 = given().contentType(JSON).body(Map.of("email", "nao@existe.com", "password", "errada123")).post("/auth/login").then().statusCode(401).extract().path("message");
    assertEquals(m1, m2);
  }
  @Test void login_rejectsNonJsonContentType() { given().contentType("application/x-www-form-urlencoded").body("email=a&password=b").post("/auth/login").then().statusCode(415).body("code", is("HTTP_415")); }
  @Test void me_withValidCookie_returnsProfileWithoutPassword() {
    var s = TestUsers.register(UserType.COMMON);
    given().cookie("arco_session", s.cookie()).get("/users/me").then().statusCode(200).body("email", is(s.email())).body("balance", is("1000.00")).body("keySet()", not(hasItem("passwordHash")));
  }
  @Test void me_withoutOrGarbageCookie_is401Json() {
    given().get("/users/me").then().statusCode(401).body("code", is("UNAUTHENTICATED"));
    given().cookie("arco_session", "lixo").get("/users/me").then().statusCode(401).body("code", is("UNAUTHENTICATED"));
  }
  @Test void me_tokenOfNonexistentUser_is401() {                                     // RF2
    User ghost = new User();  ghost.id = 987654321L;
    given().cookie("arco_session", tokens.issue(ghost)).get("/users/me").then().statusCode(401).body("code", is("UNAUTHENTICATED"));
  }
  @Test void publicRoutes_ignoreStaleCookie() {                                       // RF1
    var s = TestUsers.register(UserType.COMMON);
    given().cookie("arco_session", "lixo.lixo.lixo").contentType(JSON).body(Map.of("email", s.email(), "password", "segredo123")).post("/auth/login").then().statusCode(200);
    given().cookie("arco_session", "lixo").contentType(JSON).body(registerBody(TestDocuments.email(), TestDocuments.cpf(), "COMMON")).post("/auth/register").then().statusCode(201);
    given().cookie("arco_session", "lixo").post("/auth/logout").then().statusCode(204);
  }
  @Test void logout_expiresCookie() {
    var s = TestUsers.register(UserType.COMMON);
    var r = given().cookie("arco_session", s.cookie()).post("/auth/logout");  r.then().statusCode(204);  assertTrue(r.header("Set-Cookie").contains("Max-Age=0"));
  }
}
```

```java
@QuarkusTest class TokenServiceTest { @Inject TokenService tokens; @Inject JWTParser parser;
  @Test void issue_hasSubjectIssuerAndOneHourLifetime() throws Exception {
    User u = new User();  u.id = 42L;  JsonWebToken jwt = parser.parse(tokens.issue(u));
    assertEquals("42", jwt.getSubject());  assertEquals("arco", jwt.getIssuer());  assertEquals(3600L, jwt.getExpirationTime() - jwt.getIssuedAtTime());
  } }
@QuarkusTest class SessionCookieTest {
  @Test void create_isHardened() { NewCookie c = new SessionCookie(true, Duration.ofHours(1)).create("tok");
    assertAll(() -> assertTrue(c.isSecure()), () -> assertTrue(c.isHttpOnly()), () -> assertEquals(NewCookie.SameSite.STRICT, c.getSameSite()), () -> assertEquals("/", c.getPath()), () -> assertEquals(3600, c.getMaxAge())); }
  @Test void expire_hasZeroMaxAge() { NewCookie c = new SessionCookie(false, Duration.ofHours(1)).expire();  assertEquals(0, c.getMaxAge());  assertEquals("", c.getValue()); } }
class EphemeralJwtKeysConfigSourceTest {
  @Test void exposesLowestPriorityPemKeys_sharedAcrossInstances() { var a = new EphemeralJwtKeysConfigSource();  var b = new EphemeralJwtKeysConfigSource();
    assertEquals(100, a.getOrdinal());  assertTrue(a.getValue("smallrye.jwt.sign.key").startsWith("-----BEGIN PRIVATE KEY-----"));
    assertTrue(a.getValue("mp.jwt.verify.publickey").startsWith("-----BEGIN PUBLIC KEY-----"));  assertEquals(a.getValue("smallrye.jwt.sign.key"), b.getValue("smallrye.jwt.sign.key")); } }
class MoneySerializerTest { record W(@JsonSerialize(using = MoneySerializer.class) BigDecimal v) {}
  @Test void alwaysTwoPlainDecimals() throws Exception { var m = new ObjectMapper();
    assertEquals("{\"v\":\"1000.00\"}", m.writeValueAsString(new W(new BigDecimal("1E+3")))); assertEquals("{\"v\":\"250.50\"}", m.writeValueAsString(new W(new BigDecimal("250.5")))); assertEquals("{\"v\":\"0.00\"}", m.writeValueAsString(new W(BigDecimal.ZERO))); } }
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp test -Dtest='AuthApiTest,TokenServiceTest,SessionCookieTest,EphemeralJwtKeysConfigSourceTest,MoneySerializerTest'`. Expected: erro de compilação.
- [ ] **Step 3: Implementar as chaves efêmeras.**
  - `EphemeralJwtKeysConfigSource implements ConfigSource` gera uma vez por JVM (campo estático) um par RSA 2048.
  - Expõe `smallrye.jwt.sign.key` (PEM PKCS#8) e `mp.jwt.verify.publickey` (PEM X.509). Ordinal `100`. Grava um `WARN` explicando que as sessões não sobrevivem a um reinício.
  - Registre a classe no arquivo `META-INF/services`.
- [ ] **Step 4: Configurar o `application.properties`.**

```properties
quarkus.http.auth.proactive=false
mp.jwt.token.header=Cookie
mp.jwt.token.cookie=arco_session
mp.jwt.verify.issuer=arco
app.jwt.lifetime=PT1H
app.jwt.cookie-secure=true
%dev.app.jwt.cookie-secure=false
%test.app.jwt.cookie-secure=false
```

- [ ] **Step 5: Implementar sessão e controllers.**
  - `TokenService.issue` usa `Jwt.issuer("arco").subject(String.valueOf(user.id)).expiresIn(lifetime).sign()`.
  - `SessionCookie` tem construtor `(boolean secure, Duration lifetime)` com `@ConfigProperty` (`app.jwt.cookie-secure`, `app.jwt.lifetime`).
  - `CurrentUser` lê o `sub` do `JsonWebToken`.
  - `SecurityExceptionMappers` usa dois `@ServerExceptionMapper` (`UnauthorizedException` e `AuthenticationFailedException`) que respondem `401 UNAUTHENTICATED` no modelo de erro.
  - `AuthController` (`/auth`, `@PermitAll`) devolve `ResponseUser` e o cookie em `register` e `login`; `logout` devolve 204 com o cookie expirado.
  - `UserController` (`/users`, `@Authenticated`) devolve `ResponseUser.from(users.requireById(currentUser.id()))`.
  - Todos os controllers usam `@Consumes` e `@Produces` JSON. O parâmetro de corpo se chama `body`, com `@Valid`.
- [ ] **Step 6: Ver passar.** Run: `mvn -B -ntp test`. Expected: tudo verde (`AuthApiTest` com 12 testes). Se o mapper de segurança não for alcançado, confirme `quarkus.http.auth.proactive=false`.
- [ ] **Step 7: Commit e push.** `feat(auth): login com JWT em cookie HttpOnly, perfil e logout`

---

### Task 6: Busca de destinatário

**Files:**
- Modify: `services/UserService.java`, `controllers/UserController.java`
- Create: `dtos/responses/ResponseUserSummary.java`
- Test: `UserSearchApiTest.java`

**Interfaces:**
- Consumes: `CurrentUser.id()`, `DocumentValidator.digitsOnly`, `DocumentMask.mask`, `TestUsers` (T5).
- Produces: `GET /users/search?q=` retorna `List<ResponseUserSummary>`. `record ResponseUserSummary(Long id, String firstName, String lastName, UserType userType, String maskedDocument)`. `UserService.lookup(String q, Long exceptId): List<User>`, com no máximo um item.

- [ ] **Step 1: Escrever os testes que falham.**

```java
@QuarkusTest class UserSearchApiTest {
  Session me, target;
  @BeforeEach void users() { me = TestUsers.register(UserType.COMMON);  target = TestUsers.register(UserType.COMMON, "Rafa"); }
  Response search(String q) { return given().cookie("arco_session", me.cookie()).queryParam("q", q).get("/users/search"); }

  @Test void byExactEmail_ignoringCase_returnsSummaryOnly() { search(target.email().toUpperCase()).then().statusCode(200).body("size()", is(1)).body("[0].id", is((int) target.id()))
      .body("[0].maskedDocument", matchesPattern("\\*\\*\\*\\.\\d{3}\\.\\d{3}-\\*\\*")).body("[0].keySet()", containsInAnyOrder("id", "firstName", "lastName", "userType", "maskedDocument")); }
  @Test void byDocument_withPunctuation() { search(TestDocuments.formatCpf(target.document())).then().statusCode(200).body("size()", is(1)).body("[0].id", is((int) target.id())); }
  @Test void partialEmail_returnsEmptyList() { search(target.email().substring(0, 6)).then().statusCode(200).body("size()", is(0)); }
  @Test void ownAccount_isExcluded()         { search(me.email()).then().statusCode(200).body("size()", is(0)); }
  @Test void unknown_returnsEmptyList()      { search("ninguem@lugar.com").then().statusCode(200).body("size()", is(0)); }
  @Test void tooShortQ_is400()  { search("ab").then().statusCode(400).body("fieldErrors[0].field", is("q")).body("fieldErrors[0].code", is("QUERY_TOO_SHORT")); }
  @Test void missingQ_is400()   { given().cookie("arco_session", me.cookie()).get("/users/search").then().statusCode(400).body("fieldErrors[0].code", is("REQUIRED")); }
  @Test void unauthenticated_is401() { given().queryParam("q", "abc@def.com").get("/users/search").then().statusCode(401); }
}
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp test -Dtest=UserSearchApiTest`. Expected: FAIL (`404`).
- [ ] **Step 3: Implementar.**
  - O parâmetro é `@QueryParam("q") @NotNull(message = "REQUIRED") @Size(min = 3, message = "QUERY_TOO_SHORT") String q`.
  - `lookup` compara `email = ?1 or document = ?2`, com `q.trim().toLowerCase()` e `digitsOnly(q)`. Exclui `id = exceptId` e limita a 1.
  - O DTO usa `DocumentMask.mask(user.document)`.
- [ ] **Step 4: Ver passar.** Run: `mvn -B -ntp test`. Expected: tudo verde.
- [ ] **Step 5: Commit e push.** `feat(users): busca exata de destinatário sem expor saldo`

---

### Task 7: Transferência

**Files:**
- Modify: `entitys/transaction/Transaction.java`, `mocks/AuthorizationTransaction/AuthorizationTransaction.java`, `mocks/SendNotification/SendNotification.java`, `application.properties`
- Create: `entitys/transaction/NotificationStatus.java`, `dtos/requests/RequestTransaction.java`, `dtos/responses/ResponseTransaction.java`, `services/TransactionService.java`, `controllers/TransactionController.java`
- Test: `support/Authorizations.java`, `TransferApiTest.java`. Modify: `support/TestUsers.java`

**Interfaces:**
- Consumes: `CurrentUser.id()`, `MoneySerializer`, `ApiException` (T2/T5), `TestUsers` (T5).
- Produces:
  - `enum NotificationStatus { PENDING, SENT, FAILED }`.
  - `Transaction`: `id`, `amount` (`BigDecimal`, `precision=19, scale=2`), `notifySender` e `notifyReceiver` (`NotificationStatus`, `@Enumerated(STRING)`, padrão `PENDING`), `sender`, `receiver`, `timestamp` (`Instant`, `@CreationTimestamp`).
  - `record RequestTransaction(Long receiverId, BigDecimal amount)`: `receiverId` com `@NotNull(REQUIRED)`; `amount` com `@NotNull(REQUIRED) @Digits(integer = 15, fraction = 2, message = "INVALID_AMOUNT") @DecimalMin(value = "0.01", message = "INVALID_AMOUNT")`.
  - `record ResponseTransaction(Long id, BigDecimal amount, Party sender, Party receiver, NotificationStatus notifySender, NotificationStatus notifyReceiver, Instant timestamp, Direction direction)`. `Party(Long id, String name)`. `enum Direction { SENT, RECEIVED }`. `ResponseTransaction.from(Transaction, Long viewerId)`. `amount` sai pelo `MoneySerializer`. `name` = `firstName + " " + lastName`.
  - `TransactionService.transfer(Long senderId, RequestTransaction body): Transaction` (`@Transactional`).
  - `POST /transaction` devolve 201.
  - `Authorizations.granted()` e `denied()` (`ResponseAuthorizationTransaction`).
  - `TestUsers.transfer(Session from, Object receiverId, Object amount): io.restassured.response.Response`, que faz `POST /transaction` com o cookie de `from` e o corpo `{receiverId, amount}`. É usado nas T7, T8 e T9.
- Configuração: `quarkus.rest-client.authorizer.url=https://util.devi.tools` (`connect-timeout=1000`, `read-timeout=3000`) e `quarkus.rest-client.notifier.url=https://util.devi.tools` (`connect-timeout=1000`, `read-timeout=2000`). As interfaces passam a `@RegisterRestClient(configKey = "authorizer")` e `"notifier"`, mantendo os `@Path`. A URL JDBC vira `jdbc:h2:mem:picpay;INIT=SET LOCK_TIMEOUT 10000`.

- [ ] **Step 1: Escrever os testes que falham.** Antes, crie `Authorizations` e acrescente `TestUsers.transfer`.

```java
@QuarkusTest class TransferApiTest {
  @InjectMock @RestClient AuthorizationTransaction authorizer;  @InjectMock @RestClient SendNotification notifier;
  Session a, b;
  @BeforeEach void setUp() { when(authorizer.authorize()).thenReturn(Authorizations.granted());
    a = TestUsers.registerWithBalance(UserType.COMMON, "500.00");  b = TestUsers.registerWithBalance(UserType.COMMON, "100.00"); }
  long txCount() { return QuarkusTransaction.requiringNew().call(Transaction::count); }
  void assertUntouched(long before) { assertEquals("500.00", balanceOf(a));  assertEquals("100.00", balanceOf(b));  assertEquals(before, txCount()); }

  @Test void movesMoney_andReturnsPendingTransaction() {
    transfer(a, b.id(), "250.00").then().statusCode(201).body("amount", is("250.00")).body("sender.id", is((int) a.id())).body("receiver.id", is((int) b.id()))
      .body("direction", is("SENT")).body("notifySender", is("PENDING")).body("notifyReceiver", is("PENDING")).body("timestamp", matchesPattern("\\d{4}-\\d{2}-\\d{2}T.*Z"));
    assertEquals("250.00", balanceOf(a));  assertEquals("350.00", balanceOf(b)); }
  @Test void senderIsAlwaysTheAuthenticatedUser() {
    given().cookie("arco_session", a.cookie()).contentType(JSON).body(Map.of("receiverId", b.id(), "senderId", b.id(), "amount", "10.00")).post("/transaction").then().statusCode(201);
    assertEquals("490.00", balanceOf(a));  assertEquals("110.00", balanceOf(b)); }
  @Test void requiresAuthentication_andJson() {
    given().contentType(JSON).body("{}").post("/transaction").then().statusCode(401);
    given().cookie("arco_session", a.cookie()).contentType("text/plain").body("x").post("/transaction").then().statusCode(415); }
  @Test void nonPositiveOrTooPreciseAmount_is400WithAmountField() {                                   // RF5
    for (String v : List.of("0", "0.00", "-5.00", "0.001", "10.123")) transfer(a, b.id(), v).then().statusCode(400).body("fieldErrors.field", hasItem("amount")); }
  @Test void missingFields_are400() { given().cookie("arco_session", a.cookie()).contentType(JSON).body("{}").post("/transaction").then().statusCode(400)
      .body("fieldErrors.field", hasItems("receiverId", "amount")).body("fieldErrors.code", everyItem(is("REQUIRED"))); }
  @Test void nonNumericAmount_is400() { transfer(a, b.id(), "abc").then().statusCode(400).body("code", is("VALIDATION_ERROR")); }
  @Test void unusualAmountFormats_areAcceptedAndNormalized() {                                          // RF5
    transfer(a, b.id(), "250.5").then().statusCode(201).body("amount", is("250.50"));
    transfer(a, b.id(), new BigDecimal("10.10")).then().statusCode(201).body("amount", is("10.10"));    // número JSON
    transfer(a, b.id(), "1e2").then().statusCode(201).body("amount", is("100.00")); }
  @Test void hugeAmount_isInsufficientBalance_not500() { transfer(a, b.id(), "999999999999999.99").then().statusCode(422).body("code", is("INSUFFICIENT_BALANCE")); }   // RF5
  @Test void unknownReceiver_is404() { long before = txCount();  transfer(a, 987654321L, "1.00").then().statusCode(404).body("code", is("USER_NOT_FOUND"));  assertUntouched(before); }
  @Test void toSelf_is422()          { long before = txCount();  transfer(a, a.id(), "1.00").then().statusCode(422).body("code", is("SELF_TRANSFER"));  assertUntouched(before); }
  @Test void merchantSender_is403()  { var m = TestUsers.registerWithBalance(UserType.MERCHANT, "500.00");
    transfer(m, b.id(), "1.00").then().statusCode(403).body("code", is("MERCHANT_CANNOT_SEND"));  assertEquals("500.00", balanceOf(m)); }
  @Test void merchantReceiver_isAllowed() { var m = TestUsers.register(UserType.MERCHANT);  transfer(a, m.id(), "10.00").then().statusCode(201);  assertEquals("10.00", balanceOf(m)); }
  @Test void insufficientBalance_is422_andAuthorizerNotCalled() { var poor = TestUsers.registerWithBalance(UserType.COMMON, "10.00");
    transfer(poor, b.id(), "50.00").then().statusCode(422).body("code", is("INSUFFICIENT_BALANCE"));  verify(authorizer, never()).authorize();  assertEquals("10.00", balanceOf(poor)); }
  @Test void authorizerDenial_is422_andRollsBack() {
    List<Consumer<AuthorizationTransaction>> denials = List.of(
        m -> when(m.authorize()).thenThrow(new WebApplicationException(Response.status(403).build())),
        m -> when(m.authorize()).thenReturn(Authorizations.denied()),
        m -> when(m.authorize()).thenReturn(null));
    for (var stub : denials) { reset(authorizer);  stub.accept(authorizer);  long before = txCount();
      transfer(a, b.id(), "10.00").then().statusCode(422).body("code", is("AUTHORIZATION_DENIED"));  assertUntouched(before); } }
  @Test void authorizerUnavailable_is503_andRollsBack() {
    for (Throwable t : List.of(new ProcessingException("timeout"), new WebApplicationException(Response.status(500).build()))) {
      reset(authorizer);  when(authorizer.authorize()).thenThrow(t);  long before = txCount();
      transfer(a, b.id(), "10.00").then().statusCode(503).body("code", is("AUTHORIZER_UNAVAILABLE"));  assertUntouched(before); } }
  @Test void concurrentTransfers_neverOverdraw() throws Exception {
    var rich = TestUsers.registerWithBalance(UserType.COMMON, "100.00");  var dest = TestUsers.registerWithBalance(UserType.COMMON, "0.00");
    var pool = Executors.newFixedThreadPool(2);  var gate = new CountDownLatch(1);
    Callable<Integer> call = () -> { gate.await();  return transfer(rich, dest.id(), "80.00").statusCode(); };
    var f1 = pool.submit(call);  var f2 = pool.submit(call);  gate.countDown();
    assertEquals(List.of(201, 422), Stream.of(f1.get(), f2.get()).sorted().toList());  pool.shutdown();
    assertEquals("20.00", balanceOf(rich));  assertEquals("80.00", balanceOf(dest)); }
}
```

Os saldos de partida (`a` = `500.00`, `b` = `100.00`) cobrem a soma dos três valores de `unusualAmountFormats` (`360.60`). O `reset(authorizer)` nos laços evita o armadilha do Mockito: `when(mock.m())` chama `m()` e, se ele já foi programado para lançar, lançaria na hora.

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp test -Dtest=TransferApiTest`. Expected: erro de compilação.
- [ ] **Step 3: Implementar entidade, DTOs e configuração** conforme as interfaces. O `amount` do request é normalizado com `setScale(2)` antes de qualquer uso. `Authorizations` monta `status` `success` com `data.authorization = true` e `status` `fail` com `false`.
- [ ] **Step 4: Implementar `TransactionService.transfer` nesta ordem.**
  1. `senderId.equals(receiverId)` lança `SELF_TRANSFER`, antes de tocar o banco.
  2. Lê os dois usuários com `User.findById(id, LockModeType.PESSIMISTIC_WRITE)`, **em ordem crescente de id**. Não carregue nenhum deles antes do *lock*, porque uma entidade já gerenciada não seria atualizada. Remetente ausente lança `UNAUTHENTICATED`. Destinatário ausente lança `USER_NOT_FOUND`.
  3. Remetente `MERCHANT` lança `MERCHANT_CANNOT_SEND`.
  4. Saldo menor que o valor lança `INSUFFICIENT_BALANCE`.
  5. Chama o autorizador. `WebApplicationException` com status 403, ou corpo sem `data.authorization == true` (inclusive `null`), lança `AUTHORIZATION_DENIED`. Qualquer outra exceção lança `AUTHORIZER_UNAVAILABLE`.
  6. Debita, credita e persiste a `Transaction` com os dois status em `PENDING`.
- [ ] **Step 5: Implementar `TransactionController`** (`/transaction`, `@Authenticated`, JSON). `POST` chama `transfer(currentUser.id(), body)` e responde 201 com `ResponseTransaction.from(tx, currentUser.id())`.
- [ ] **Step 6: Ver passar.** Run: `mvn -B -ntp test`. Expected: tudo verde (`TransferApiTest` com 16 testes). Repita `mvn -B -ntp test -Dtest=TransferApiTest` três vezes para checar que a concorrência não é intermitente.
- [ ] **Step 7: Commit e push.** `feat(transaction): transferência autenticada com lock de saldo e autorizador`

---

### Task 8: Notificação após o commit

**Files:**
- Create: `services/TransferCompleted.java`, `services/NotificationDispatcher.java`, `services/NotificationSender.java`, `services/NotificationMessages.java`
- Modify: `services/TransactionService.java`, `dtos/requests/RequestSendNotification.java` (acrescentar o construtor `(String email, String mensagem)`, mantendo o sem argumentos)
- Test: `NotificationApiTest.java`, `NotificationMessagesTest.java`

**Interfaces:**
- Consumes: `Transaction` e `NotificationStatus` (T7), `SendNotification` (cliente REST).
- Produces: `record TransferCompleted(Long transactionId)`. `NotificationMessages.sent(BigDecimal amount, String receiverName)` e `received(BigDecimal amount, String senderName)`. Formato: `"R$ "` mais `#,##0.00` com símbolos pt-BR (espaço comum). Textos: `Você enviou R$ 250,00 para Dani Teste.` e `Você recebeu R$ 250,00 de Dani Teste.` `NotificationSender.send(RequestSendNotification)`, que tenta até 3 vezes (espera de 200 ms entre elas) e lança a última exceção se todas falharem.

- [ ] **Step 1: Escrever os testes que falham.**

```java
class NotificationMessagesTest { @Test void formatsBrazilianCurrency() { assertEquals("Você enviou R$ 1.250,50 para Rafa Teste.", NotificationMessages.sent(new BigDecimal("1250.5"), "Rafa Teste"));
                                                                        assertEquals("Você recebeu R$ 250,00 de Ana Teste.", NotificationMessages.received(new BigDecimal("250.00"), "Ana Teste")); } }
@QuarkusTest class NotificationApiTest {
  @InjectMock @RestClient AuthorizationTransaction authorizer;  @InjectMock @RestClient SendNotification notifier;
  Session a, b;
  @BeforeEach void setUp() { when(authorizer.authorize()).thenReturn(Authorizations.granted());
    a = TestUsers.registerWithBalance(UserType.COMMON, "500.00");  b = TestUsers.register(UserType.COMMON, "Rafa"); }
  NotificationStatus status(int txId, boolean sender) { Transaction t = QuarkusTransaction.requiringNew().call(() -> Transaction.<Transaction>findById((long) txId));  return sender ? t.notifySender : t.notifyReceiver; }
  int send250() { return transfer(a, b.id(), "250.00").then().statusCode(201).extract().path("id"); }
  void awaitStatuses(int id, NotificationStatus s) { await().atMost(8, SECONDS).untilAsserted(() -> { assertEquals(s, status(id, true));  assertEquals(s, status(id, false)); }); }

  @Test void afterCommit_notifiesBothSides_inOrder_withEmailAndMessage() {
    int id = send250();  var cap = ArgumentCaptor.forClass(RequestSendNotification.class);
    verify(notifier, timeout(5000).times(2)).sendNotification(cap.capture());
    assertEquals(List.of(a.email(), b.email()), cap.getAllValues().stream().map(r -> r.email).toList());
    assertEquals(List.of("Você enviou R$ 250,00 para Rafa Teste.", "Você recebeu R$ 250,00 de Ana Teste."), cap.getAllValues().stream().map(r -> r.mensagem).toList());
    awaitStatuses(id, NotificationStatus.SENT); }
  @Test void notifierDown_retriesThenFails_butTransferStays() {
    when(notifier.sendNotification(any())).thenThrow(new WebApplicationException(Response.status(503).build()));
    int id = send250();  awaitStatuses(id, NotificationStatus.FAILED);
    verify(notifier, times(6)).sendNotification(any());  assertEquals("250.00", balanceOf(a)); }
  @Test void notifierRecoversOnSecondAttempt_marksSent() {
    when(notifier.sendNotification(any())).thenThrow(new WebApplicationException(Response.status(503).build())).thenReturn(null);
    int id = send250();  awaitStatuses(id, NotificationStatus.SENT);  verify(notifier, times(3)).sendNotification(any()); }
  @Test void rejectedTransfer_neverNotifies() throws Exception {
    transfer(a, b.id(), "999.00").then().statusCode(422);  Thread.sleep(400);  verifyNoInteractions(notifier); }
}
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp test -Dtest='Notification*Test'`. Expected: erro de compilação.
- [ ] **Step 3: Implementar.**
  - `TransactionService.transfer` dispara `Event<TransferCompleted>` depois de persistir.
  - `NotificationDispatcher.onCompleted(@Observes(during = TransactionPhase.AFTER_SUCCESS) TransferCompleted e)` entrega a tarefa a um `Executors.newVirtualThreadPerTaskExecutor()` (encerrado em `@PreDestroy`).
  - A tarefa lê, em `QuarkusTransaction.requiringNew()`, e-mails e nomes do remetente e do destinatário. Envia **primeiro ao remetente, depois ao destinatário**, de forma sequencial, cada envio via `NotificationSender` (bean separado). Grava `SENT` ou `FAILED` em outra transação própria.
  - Nenhuma exceção de notificação chega ao fluxo da transferência.
- [ ] **Step 4: Ver passar.** Run: `mvn -B -ntp test`. Expected: tudo verde.
- [ ] **Step 5: Commit e push.** `feat(notification): envio assíncrono após o commit com retentativas e status`

---

### Task 9: Extrato

**Files:**
- Modify: `services/TransactionService.java`, `controllers/TransactionController.java`
- Create: `dtos/responses/ResponsePage.java`
- Test: `StatementApiTest.java`

**Interfaces:**
- Consumes: `ResponseTransaction.from(Transaction, Long)` (T7).
- Produces: `record ResponsePage<T>(List<T> items, int page, int size, long total)`. `TransactionService.list(Long userId, String direction, int page, int size): ResponsePage<ResponseTransaction>`, em ordem decrescente de `id`. `GET /transaction?direction=all|sent|received&page=0&size=20`.

- [ ] **Step 1: Escrever os testes que falham.**

```java
@QuarkusTest class StatementApiTest {
  @InjectMock @RestClient AuthorizationTransaction authorizer;  @InjectMock @RestClient SendNotification notifier;
  Session a, b, c;
  @BeforeEach void setUp() { when(authorizer.authorize()).thenReturn(Authorizations.granted());
    a = TestUsers.registerWithBalance(UserType.COMMON, "500.00");  b = TestUsers.registerWithBalance(UserType.COMMON, "500.00");  c = TestUsers.register(UserType.COMMON);
    transfer(a, b.id(), "100.00");  transfer(b, a.id(), "30.00");  transfer(a, c.id(), "10.00"); }          // do mais antigo ao mais novo
  Response get(Session s, String query) { return given().cookie("arco_session", s.cookie()).get("/transaction?" + query); }

  @Test void all_listsBothDirections_newestFirst() { get(a, "").then().statusCode(200).body("total", is(3)).body("page", is(0)).body("size", is(20))
      .body("items.direction", contains("SENT", "RECEIVED", "SENT")).body("items.amount", contains("10.00", "30.00", "100.00")); }
  @Test void filtersSentAndReceived() { get(a, "direction=sent").then().body("total", is(2));  get(a, "direction=received").then().body("total", is(1)).body("items[0].direction", is("RECEIVED")); }
  @Test void paginates() { get(a, "size=1&page=1").then().body("items.size()", is(1)).body("items[0].amount", is("30.00")).body("total", is(3)); }
  @Test void onlyOwnTransactions() { get(c, "").then().body("total", is(1)).body("items[0].direction", is("RECEIVED")); }
  @Test void invalidPaging_is400() { for (String q : List.of("size=0", "size=51", "page=-1", "direction=foo")) get(a, q).then().statusCode(400).body("code", is("VALIDATION_ERROR")); }
  @Test void unauthenticated_is401() { given().get("/transaction").then().statusCode(401); }
  @Test void neverExposesSecrets() { String raw = get(a, "").asString();
    assertAll(() -> assertFalse(raw.contains("password")), () -> assertFalse(raw.contains("passwordHash")), () -> assertFalse(raw.contains("balance")), () -> assertFalse(raw.contains("@"))); }
}
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp test -Dtest=StatementApiTest`. Expected: FAIL (`405` no GET).
- [ ] **Step 3: Implementar.**
  - Parâmetros: `@QueryParam("direction") @DefaultValue("all") String`, `page` com `@Min(value = 0, message = "INVALID_PAGE")` e `size` com `@Min(value = 1, message = "INVALID_SIZE") @Max(value = 50, message = "INVALID_SIZE")`.
  - Um `direction` desconhecido lança `ApiException(VALIDATION_ERROR, [FieldError("direction", "INVALID_DIRECTION")])`.
  - A consulta Panache usa `sender.id = ?1 or receiver.id = ?1` (`all`), `sender.id = ?1` (`sent`) ou `receiver.id = ?1` (`received`), com `Sort.descending("id")`, `.page(Page.of(page, size))` e `.count()` para o total.
- [ ] **Step 4: Ver passar.** Run: `mvn -B -ntp test`. Expected: tudo verde.
- [ ] **Step 5: Commit e push.** `feat(transaction): extrato paginado com filtro por direção`

---

### Task 10: Dados de demonstração e OpenAPI

**Files:**
- Create: `infra/SeedData.java`
- Modify: `application.properties`, DTOs de resposta (`@Schema(type = SchemaType.STRING, example = "250.00")` nos campos de dinheiro)
- Test: `SeedDataTest.java`, `SeedProfile.java`

**Interfaces:**
- Consumes: `UserService.register`, `TestUsers`/`AuthApiTest.registerBody` (T4/T5).
- Produces: `SeedData.seed()` idempotente (por e-mail), executado no `StartupEvent` só se `app.seed.enabled=true` (padrão `false`, ligado em `%dev`). Contas, todas com senha `demo1234`: **Marina Alves** (`COMMON`, CPF `52998224725`, `marina@arco.demo`, `1000.00`), **Rafael Costa** (`COMMON`, CPF `11144477735`, `rafael@arco.demo`, `500.00`), **Loja Arco** (`MERCHANT`, CNPJ `11222333000181`, `loja@arco.demo`, `0.00`). `target/openapi/openapi.json` gerado no build.

- [ ] **Step 1: Escrever os testes que falham.**

```java
public class SeedProfile implements QuarkusTestProfile { public Map<String, String> getConfigOverrides() { return Map.of("app.seed.enabled", "true"); } }
@QuarkusTest @TestProfile(SeedProfile.class) class SeedDataTest { @Inject SeedData seed;
  Response login(String email) { return given().contentType(JSON).body(Map.of("email", email, "password", "demo1234")).post("/auth/login"); }
  @Test void createsDemoAccounts_thatCanLogIn() { login("marina@arco.demo").then().statusCode(200).body("balance", is("1000.00")); login("rafael@arco.demo").then().body("balance", is("500.00"));
                                                  login("loja@arco.demo").then().body("userType", is("MERCHANT")).body("balance", is("0.00")); }
  @Test void seed_isIdempotent() { seed.seed(); seed.seed(); login("marina@arco.demo").then().statusCode(200); } }
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp test -Dtest=SeedDataTest`. Expected: erro de compilação.
- [ ] **Step 3: Implementar o `SeedData`.** Cria cada conta via `UserService.register`, ajustando o saldo do Rafael para `500.00`, e pula e-mails já existentes. Acrescente ao `application.properties`: `app.seed.enabled=false`, `%dev.app.seed.enabled=true`, `quarkus.smallrye-openapi.store-schema-directory=target/openapi`, `quarkus.smallrye-openapi.info-title=Arco API`, `quarkus.smallrye-openapi.info-version=1.0.0`.
- [ ] **Step 4: Ver passar.** Run: `mvn -B -ntp test`. Expected: tudo verde.
- [ ] **Step 5: Verificar o OpenAPI.** Run: `mvn -B -ntp -DskipTests package`. Depois:

```bash
node -e 'const s=require("./target/openapi/openapi.json");const p=Object.keys(s.paths);for(const x of ["/auth/register","/auth/login","/auth/logout","/users/me","/users/search","/transaction"])if(!p.includes(x))throw new Error("falta "+x);if(s.components.schemas.ResponseUser.properties.balance.type!=="string")throw new Error("balance não é string");console.log("openapi ok")'
```

Expected: `openapi ok`. Se `target/openapi` não existir, suba o app empacotado, grave `curl localhost:8080/q/openapi?format=json` em `target/openapi/openapi.json` e registre no README que o Plano B deve usar essa rota.
- [ ] **Step 6: Commit e push.** `feat(demo): contas de demonstração e esquema OpenAPI exportado`

---

### Task 11: Fechamento do back-end

**Files:**
- Modify: `README.md` (seções Regras de negócio, Configuração, Referência da API, Limitações conhecidas e Roadmap)
- Create: `scripts/smoke-api.mjs`

**Interfaces:**
- Consumes: o stub (T1), as contas de demonstração (T10) e todas as rotas.
- Produces: `node scripts/smoke-api.mjs` (variáveis `BASE_URL`, padrão `http://localhost:8080`, e `STUB_URL`, padrão `http://localhost:9000`). Imprime `✔ <passo>` por verificação, termina com `SMOKE OK` e sai com código 0. Qualquer falha imprime o passo e sai com 1.

- [ ] **Step 1: Atualizar o README.** Reflita: rotas novas (`/auth/*`, `/users/me`, `/users/search`, `/transaction` POST e GET, com exemplos de corpo e erro); tabela de erros por `code`; configuração (`app.jwt.*`, `app.signup.initial-balance`, `app.seed.enabled`, `quarkus.rest-client.authorizer.*` e `notifier.*`, chaves JWT de produção por `SMALLRYE_JWT_SIGN_KEY` e `MP_JWT_VERIFY_PUBLICKEY`); limitações que continuam (dados em memória, sem limite de tentativas de login, sem idempotência no POST, chaves efêmeras fazem as sessões caírem a cada reinício). Remova as limitações já corrigidas e marque no Roadmap os itens entregues. Run: `grep -nE "POST /users|GET /users\b|senderId|\"password\"" README.md`. Expected: nenhuma ocorrência fora dos exemplos que explicam a mudança.
- [ ] **Step 2: Criar `scripts/smoke-api.mjs`** (Node 22, `fetch`, cookie lido de `res.headers.getSetCookie()`), com estes passos em ordem:
  1. Login da Marina (`marina@arco.demo` / `demo1234`).
  2. `/users/me` mostra `1000.00`.
  3. `/users/search?q=rafael@arco.demo` devolve 1 item.
  4. Stub em `grant`: `POST /transaction` de `250.00` devolve 201.
  5. `/users/me` mostra `750.00`.
  6. `GET /transaction` tem `total >= 1` e `items[0].direction == "SENT"`.
  7. Em até 3 s o `GET /__calls` do stub lista 2 notificações com `Você enviou R$ 250,00 para Rafael Costa.` e `Você recebeu R$ 250,00 de Marina Alves.`, e o extrato mostra `notifySender == "SENT"`.
  8. Stub em `deny`: transferência devolve 422 `AUTHORIZATION_DENIED` e o saldo segue `750.00`.
  9. Stub em `down`: devolve 503 `AUTHORIZER_UNAVAILABLE`.
  10. Login da Loja Arco: transferência devolve 403 `MERCHANT_CANNOT_SEND`.
  11. Logout devolve 204 e o cookie expira.
  12. `/users/me` sem cookie devolve 401 `UNAUTHENTICATED`.
- [ ] **Step 3: Rodar a suíte completa, incluindo o teste de integração do jar.** Run: `mvn -B -ntp verify -DskipITs=false`. Expected: `BUILD SUCCESS`, `Failures: 0, Errors: 0` e o `GreetingResourceIT` executado.
- [ ] **Step 4: Rodar o smoke contra o app empacotado.**

```bash
node scripts/stub-externals.mjs &
java -Dapp.seed.enabled=true -Dapp.jwt.cookie-secure=false \
  -Dquarkus.rest-client.authorizer.url=http://localhost:9000 -Dquarkus.rest-client.notifier.url=http://localhost:9000 \
  -jar target/quarkus-app/quarkus-run.jar &
until curl -sf localhost:8080/hello >/dev/null; do sleep 1; done
node scripts/smoke-api.mjs        # Expected: 12 linhas "✔ ..." e "SMOKE OK"
kill %1 %2
```

- [ ] **Step 5: Commit e push.** `docs(api): README do novo contrato e smoke test de ponta a ponta`
- [ ] **Step 6: Relatório.** Informe ao autor a saída do `verify` (contagem de testes) e do smoke. Diga o que **não** foi exercitado neste ambiente: a integração com o `util.devi.tools` real, que está bloqueado. Registre o contrato final (`target/openapi/openapi.json`) como entrada do Plano B.
