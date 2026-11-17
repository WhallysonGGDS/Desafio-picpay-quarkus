# Arco: front-end e evolução do back-end — Design

Data: 2026-11-01
Branch: `ccr-2f5e7339-pybi0z`
Status: entregue na PR #2 (os desvios e as decisões estão no diário do plano B); o CNPJ alfanumérico, que ficou de fora da entrega original, entrou depois (R81 a R86 do diário)

## 1. Contexto e objetivo

O repositório contém uma API Quarkus 3.15 (Java 21) do desafio PicPay Simplificado: cadastro de usuários, transferência com autorização externa e notificação. Hoje ela não tem front-end, não tem autenticação e tem falhas que impedem uma integração segura.

**Objetivo:** entregar (a) um front-end completo, composto por uma vitrine cinematográfica e um app de carteira, e (b) as mudanças de back-end necessárias para que a integração seja segura e confiável, incluindo login real.

**Critério de sucesso:**
- Uma pessoa se cadastra, entra, transfere dinheiro para outra, vê o extrato e sai, tudo pela interface, contra o Quarkus real.
- Nenhuma resposta da API contém senha. O remetente de uma transferência é sempre o usuário autenticado.
- Cada etapa termina com testes executados e verdes.
- A vitrine causa a reação "caramba, isso é diferente" sem sacrificar acessibilidade nem desempenho.

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Formato do front | Vitrine cinematográfica + app funcional |
| Escopo do back-end | Integrável + login real (JWT), mantendo o H2 em memória |
| Arquitetura | SPA Vite + React + TypeScript, no mesmo repositório, servida pelo Quarkus (mesma origem) |
| Identidade | **Arco**, própria. Sem logo nem verde do PicPay. Crédito discreto no rodapé ao desafio |
| Dinheiro no contrato | String com duas casas (`"1250.00"`) |
| Rotas `GET/POST /users` | Removidas. Substituídas por `/auth/*` e `/users/*` novos |
| Saldo inicial | Definido pelo servidor (configurável), nunca pelo cliente |

## 3. Fora do escopo

Chave de idempotência no POST de transferência, banco persistente (PostgreSQL/Flyway), refresh token, tema claro, outros idiomas além do PT-BR, WebGL, perfil editável, recuperação de senha, depósito/saque.

## 4. Back-end

### 4.1 Contrato

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/auth/register` | público | Cria o usuário, já o autentica (grava o cookie) e responde `201` com o perfil. |
| POST | `/auth/login` | público | Valida credenciais, grava o cookie, responde `200` com o perfil. |
| POST | `/auth/logout` | público | Expira o cookie e responde `204`. É idempotente e funciona mesmo com a sessão já expirada. |
| GET | `/users/me` | autenticado | Perfil e saldo do usuário autenticado. |
| GET | `/users/search?q=` | autenticado | Busca de destinatário (4.4). |
| POST | `/transaction` | autenticado | Cria a transferência (4.3). |
| GET | `/transaction` | autenticado | Extrato paginado (4.5). |
| GET | `/hello` | público | Mantido como está. |

Corpos principais:

- **Register:** `firstName`, `lastName`, `document` (CPF para `COMMON`, CNPJ para `MERCHANT`), `email`, `password` (mínimo 8 caracteres), `userType`.
- **Login:** `email`, `password`.
- **Perfil (`UserResponse`):** `id`, `firstName`, `lastName`, `document`, `email`, `balance`, `userType`. Nunca inclui senha.
- **Transferência (entrada):** `receiverId`, `amount`. O remetente **não** vem no corpo. Qualquer `senderId` enviado é ignorado.
- **Transferência (`TransactionResponse`):** `id`, `amount`, `sender {id, name}`, `receiver {id, name}`, `notifySender`, `notifyReceiver` (`PENDING`, `SENT` ou `FAILED`), `timestamp` (ISO-8601 em UTC, por exemplo `2026-11-01T13:05:00Z`) e `direction` (`SENT` ou `RECEIVED`, relativa a quem consulta). O mesmo formato serve ao `POST` e ao extrato.

### 4.2 Autenticação

- Senha com BCrypt (`BcryptUtil`).
- JWT assinado com `smallrye-jwt`, `sub` igual ao id do usuário, validade curta (padrão 1 hora, configurável).
- Cookie `arco_session`: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` fora do perfil dev. O token é lido do cookie (`mp.jwt.token.header=Cookie`).
- Login inválido responde `401 INVALID_CREDENTIALS`, com a mesma mensagem para e-mail desconhecido e senha errada.
- Proteção contra CSRF: `SameSite=Strict` mais rotas que só aceitam JSON.
- Nenhuma chave no repositório. Se nenhuma chave for configurada, a aplicação gera um par RSA efêmero na inicialização, como configuração de menor prioridade (dev e testes funcionam sem preparo, e as sessões não sobrevivem a um reinício). Produção define as chaves por variável de ambiente (`SMALLRYE_JWT_SIGN_KEY` e `MP_JWT_VERIFY_PUBLICKEY`), que prevalecem sobre a efêmera.
- A autenticação é preguiçosa (`quarkus.http.auth.proactive=false`). Assim, um cookie de sessão antigo ou inválido enviado a uma rota pública (`/auth/login`, `/auth/register`, `/auth/logout`) é ignorado em vez de provocar `401`. Sem isso, quem tem um cookie expirado não conseguiria nem entrar de novo.

### 4.3 Regras da transferência

Ordem de avaliação, todas dentro de uma única transação de banco:

1. `amount` maior que zero, com no máximo duas casas decimais. Caso contrário `400 VALIDATION_ERROR`.
2. Destinatário existe, senão `404 USER_NOT_FOUND`.
3. Remetente diferente do destinatário, senão `422 SELF_TRANSFER`.
4. Remetente não é lojista, senão `403 MERCHANT_CANNOT_SEND`.
5. Os dois saldos são lidos com *lock* pessimista de escrita, em ordem crescente de id (evita deadlock).
6. Saldo do remetente cobre o valor, senão `422 INSUFFICIENT_BALANCE`.
7. O autorizador externo responde 2xx **e** `data.authorization == true`, senão `422 AUTHORIZATION_DENIED`. A chamada tem timeout de 3 segundos, porque os *locks* do passo 5 ficam seguros durante ela. Falha de rede ou timeout do autorizador resulta em `503 AUTHORIZER_UNAVAILABLE` e a transferência **não** acontece (falha fechada).
8. Débito, crédito e registro da transação são gravados juntos.

**Notificação:** depois do commit, fora da transação e fora do caminho da resposta (assíncrona). Corpo com `email` e `mensagem` preenchidos ("Você enviou R$ X para Nome." e "Você recebeu R$ X de Nome."). Timeout de 2 segundos e até duas retentativas. A transação nasce com `PENDING` nos dois campos. O resultado final (`SENT` ou `FAILED`) é gravado em transação própria. A falha da notificação nunca desfaz a transferência.

### 4.4 Busca de destinatário

`GET /users/search?q=` exige `q` com pelo menos 3 caracteres e faz correspondência **exata**, sem diferenciar maiúsculas, com o e-mail ou com os dígitos do documento. Devolve no máximo um item, nunca o próprio usuário, com `id`, `firstName`, `lastName`, `userType` e `maskedDocument`. Não devolve saldo, e-mail nem senha. A correspondência exata evita que a busca vire um diretório de usuários.

### 4.5 Extrato

`GET /transaction?direction=all|sent|received&page=0&size=20`: transações do usuário autenticado, da mais recente para a mais antiga, com `direction` (`SENT` ou `RECEIVED`) relativa a quem consulta. Resposta com `items`, `page`, `size` e `total`. `size` máximo 50.

### 4.6 Modelo de erro

Corpo único: `{ statusCode, code, message, fieldErrors? }`. O `code` é estável e é o contrato. A `message` é apenas legível. `fieldErrors` é uma lista de `{field, code}`.

| Status | `code` |
|---|---|
| 400 | `VALIDATION_ERROR` |
| 401 | `INVALID_CREDENTIALS`, `UNAUTHENTICATED` |
| 403 | `MERCHANT_CANNOT_SEND` |
| 404 | `USER_NOT_FOUND`, `NOT_FOUND` |
| 405 | `METHOD_NOT_ALLOWED` |
| 409 | `DUPLICATE_EMAIL`, `DUPLICATE_DOCUMENT` |
| 422 | `INSUFFICIENT_BALANCE`, `SELF_TRANSFER`, `AUTHORIZATION_DENIED` |
| 503 | `AUTHORIZER_UNAVAILABLE` |
| 500 | `INTERNAL_ERROR` (mensagem genérica, sem vazar detalhes) |

O mapeador global passa a tratar `WebApplicationException` preservando o status original e usando o mesmo modelo de erro: rota inexistente volta a ser `404 NOT_FOUND` e método não suportado volta a ser `405 METHOD_NOT_ALLOWED`, ambos em JSON. Os demais status HTTP do JAX-RS usam o `code` `HTTP_<status>`. As exceções de segurança (cookie ausente ou inválido) são mapeadas para `401 UNAUTHENTICATED`. A duplicidade identifica o campo pela restrição violada, sem depender do nome gerado pelo H2.

### 4.7 Outras mudanças

- Bean Validation (`quarkus-hibernate-validator`), com validadores próprios de CPF e CNPJ por dígito verificador.
- Normalização no cadastro: o e-mail é gravado em minúsculas e o documento só com dígitos, e a unicidade vale sobre esses valores normalizados.
- Saldo inicial no cadastro: `app.signup.initial-balance` (padrão `1000.00`) para `COMMON`. `MERCHANT` começa com `0.00`.
- URLs do autorizador e do notificador movidas para `application.properties`.
- Seed de demonstração controlado por `app.seed.enabled` (ligado só no perfil dev, desligado por padrão): dois usuários comuns e um lojista, com documentos válidos.
- Colunas monetárias com `precision=19, scale=2`.
- Esquema OpenAPI gravado no build (`target/openapi`) para gerar os tipos do front.
- O README é atualizado: API nova, configuração, testes e limitações restantes.

## 5. Front-end

### 5.1 Estrutura

```
frontend/
  src/
    app/        rotas, providers, layouts
    api/        tipos gerados, cliente, ApiError, mapa code -> texto PT-BR
    features/   auth, wallet, transfer, statement
    showcase/   cenas, arco, scroll
    design/     tokens, tipografia, primitivos
    lib/        money, format
  e2e/          Playwright
```

O Quinoa (linha 2.5.x, construída contra o Quarkus 3.15.1 e verificada na Etapa 0) roda o build do front no Maven e o serve na mesma origem. Em desenvolvimento faz proxy para o Vite e entrega o fallback de rotas da SPA. Os prefixos da API (`/auth`, `/users`, `/transaction`, `/q`) ficam fora desse fallback. Plano B se o Quinoa for incompatível: copiar o build do Vite para `META-INF/resources` e registrar uma rota de fallback da SPA. Uma opção de build (`-Dquarkus.quinoa=false`) compila só o back-end.

### 5.2 Camadas

- **Contrato:** tipos gerados do OpenAPI com `openapi-typescript` e cliente `openapi-fetch`. O arquivo gerado é versionado, e um script confere se está atualizado.
- **Estado do servidor:** TanStack Query. Sem store global.
- **Rotas:** React Router com histórico normal.
- **Erros:** `ApiError` com `code`, `statusCode`, `fieldErrors`. Um mapa único `code` → texto. Falha de rede e erro de servidor são estados distintos.
- **Dinheiro:** apenas strings. Cálculos usam centavos inteiros (`BigInt`). Sem ponto flutuante.
- **Sessão:** o front nunca toca o token. Na abertura chama `GET /users/me`. `401` significa deslogado e redireciona para o login preservando o destino.

### 5.3 Telas do app

1. Cadastro e Login.
2. Carteira: saldo e últimas movimentações.
3. Transferir, em três passos: destinatário, valor, confirmação. Mostra o saldo resultante e o estado "autorizando".
4. Extrato, com filtro enviadas, recebidas ou todas.

Cada tela tem estados de carregando, vazio e erro. O botão de enviar fica desabilitado durante a requisição.

## 6. Direção criativa

**Sensação:** precisão calma. Ambiente escuro onde só o valor em movimento brilha.

**Conceito:** a transferência como um **arco de luz** entre duas pessoas. O motivo aparece só quando há valor em trânsito.

**Sistema visual**
- Cor: base `#05070C`, superfícies `#0A0E17`, linhas de 1 px `#1A2233`, texto `#EEF1F6` e `#8A94A6`. Acento único **gelo-ciano `#8FE3FF`**, reservado ao valor em movimento e ao estado confirmado. O erro usa um vermelho discreto, só funcional.
- Tipografia: **Geist** e **Geist Mono**. Títulos e saldo em peso 200–300, escala grande. Valores, datas e códigos em mono tabular.
- Sem cards, gradiente decorativo, sombras, grade de ícones, foto ou estatística inventada. Estrutura por hairlines, espaço negativo e escala.

**Vitrine** (Lenis + GSAP ScrollTrigger; o arco é um caminho SVG desenhado pelo scroll):

| Cena | Conteúdo |
|---|---|
| 01 Impacto | Tela quase vazia. Um ponto de luz traça o arco uma vez. "Entre duas pessoas, um instante." |
| 02 Contexto | O arco acende as quatro decisões: quem pode enviar, há saldo, alguém autoriza, os dois são avisados. Em tipografia. |
| 03 Proposta | Seção fixada com a carteira real (componente real, dados fixos de demonstração). O saldo cai de R$ 1.000,00 para R$ 750,00 conforme o arco pousa. |
| 04 Detalhes | Três linhas com hairlines: débito, crédito e registro numa transação; os dois lados notificados; lojista recebe e não envia. |
| 05 Clímax | O arco termina e "Enviado." ocupa o quadro. |
| 06 Conversão | CTA **Abrir minha carteira** e o link "Já tenho conta". |

**O app** prolonga a Cena 03: saldo gigante em peso leve, extrato em linhas com hairlines. Em Transferir, o botão diz o ato ("Enviar R$ 250,00 para Marina") e, ao confirmar, o arco liga "você" ao destinatário: autorizando, pouso, "Enviado". Na falha o arco recua e o texto diz o motivo.

**Mobile com composição própria:** arco na vertical, cenas empilhadas, barra inferior de três itens no app, teclado numérico nativo no campo de valor.

**Qualidade:** `prefers-reduced-motion` troca o scroll animado por fades. Sem *hijack* de scroll. Contraste AA e foco visível. Só `transform` e `opacity` são animados. GSAP e Lenis em *chunk* separado da vitrine.

## 7. Testes

- **Back-end (TDD):** `@QuarkusTest` + RestAssured para cada endpoint, regra e código de erro, com o cliente do autorizador *mockado*. Teste de concorrência (duas transferências paralelas não deixam o saldo negativo). Testes de que nenhuma resposta contém `password`, de que o `senderId` do corpo é ignorado e das flags do cookie.
- **Front:** Vitest + Testing Library para unidades e componentes, com MSW simulando a API.
- **Ponta a ponta:** Playwright contra o Quarkus real e um stub local do autorizador e do notificador. Fluxos: cadastro, login, transferência, extrato, saldo insuficiente, autorização negada. Capturas de tela em desktop e celular.
- **Vitrine:** Playwright percorre as seis cenas sem erro de console. Auditoria de acessibilidade com axe-core e conferência do orçamento de tamanho do bundle.

## 8. Etapas

| Etapa | Entrega |
|---|---|
| 0. Fundação | Versões das dependências novas confirmadas, incluindo o Quinoa. Stub do autorizador e do notificador. `mvn test` na linha de base. |
| 1. Back: domínio e regras | Erros, validação, CPF/CNPJ, BCrypt, regras da transferência, *lock*, notificação pós-commit, extrato. |
| 2. Back: login e contrato | `/auth/*`, `/users/me`, `/users/search`, rotas protegidas, cookie JWT, OpenAPI exportado. |
| 3. Front: fundação | Vite/React/TS no Quarkus, tokens, fontes, cliente tipado, erros, sessão, rotas, layouts. |
| 4. Front: o app | Cadastro, login, carteira, transferir com o arco, extrato. |
| 5. Front: a vitrine | As seis cenas, o arco no scroll, movimento reduzido, *chunks* separados. |
| 6. Fechamento | README atualizado, `mvn verify` + `npm test` + e2e verdes juntos, revisão final. |

**Planos de implementação:** o escopo é grande demais para um plano só. Serão dois, nesta ordem: o **Plano A** cobre as Etapas 0 a 2 (back-end) e o **Plano B** cobre as Etapas 3 a 6 (front-end e fechamento). O Plano B depende do contrato entregue pelo Plano A.

Um commit por etapa, com *push* ao fim de cada uma na branch `ccr-2f5e7339-pybi0z`. Nenhuma etapa é dada como pronta sem os comandos de teste executados e a saída conferida. Não se abre PR sem pedido do autor.

## 9. Riscos

| Risco | Tratamento |
|---|---|
| Maven Central com limite de requisições (429) | Repetir a resolução. Se a dependência não vier, avisar em vez de contornar em silêncio. |
| Autorizador externo bloqueado neste ambiente | Testes com *mock*, e2e com stub local. A integração com `util.devi.tools` real não é exercitada aqui e isso é dito no fechamento. |
| Quinoa incompatível com o Quarkus 3.15 | Decidido na Etapa 0, com o plano B descrito em 5.1. |
| Node exigido no build do Maven | Opção `-Dquarkus.quinoa=false` para compilar só o back-end. |
| Quebra do contrato antigo (`/users`, `senderId`) | Não há outros consumidores. O README documenta a mudança. |
| Fontes Geist indisponíveis no npm | Conferir na Etapa 3. Plano B: outra grotesca neutra, mantendo a hierarquia por peso e escala. |
