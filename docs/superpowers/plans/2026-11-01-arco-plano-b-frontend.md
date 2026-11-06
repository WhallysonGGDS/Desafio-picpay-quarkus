# Arco — Plano B: Front-end — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (ou superpowers:subagent-driven-development, se o autor pedir subagentes). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o front-end do Arco: uma vitrine cinematográfica em seis cenas e um app de carteira (cadastro, login, carteira, transferir, extrato), servidos pelo próprio Quarkus e integrados à API do Plano A.

**Architecture:** SPA em Vite + React + TypeScript dentro de `frontend/`, empacotada e servida pelo Quarkus na mesma origem via Quinoa (cookie de sessão, sem CORS). Os tipos vêm do OpenAPI; o objeto `api` é a única porta para o back-end e converte toda falha em `ApiError` com `code` estável. Dinheiro só como string ou centavos (`bigint`). A vitrine (GSAP + Lenis) é um *chunk* carregado sob demanda, e o arco de luz é um SVG desenhado por uma variável CSS (`--p`).

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, React Router 7, TanStack Query 5, openapi-typescript 7 + openapi-fetch 0.17, GSAP 3.15 + Lenis 1.3, Geist (fontsource), CSS Modules; Vitest 3, Testing Library, MSW 2, Playwright 1.63 + axe-core; Quarkus Quinoa 2.5.5.

**Spec:** `docs/superpowers/specs/2026-11-01-arco-frontend-backend-design.md` (seções 5, 6 e 7, e Etapas 3 a 6 da seção 8). Depende do contrato entregue pelo Plano A (`target/openapi/openapi.json`, gerado por `mvn package`), que a T4 completa.

## Global Constraints

- Identidade **Arco**, própria: sem logo nem verde do PicPay. Crédito discreto no rodapé da vitrine, com este texto: `Implementação do desafio PicPay Simplificado, com Quarkus e React`.
- Cor: base `#05070C`, superfícies `#0A0E17`, linhas de 1 px `#1A2233`, texto `#EEF1F6` e `#8A94A6`. Um único acento, **gelo-ciano `#8FE3FF`**, reservado ao valor em movimento e ao estado confirmado. O erro usa um vermelho discreto, só funcional.
- Tipografia: **Geist** e **Geist Mono**. Títulos e saldo em peso 200–300, escala grande. Valores, datas e códigos em mono tabular.
- Sem cards, gradiente decorativo, sombras, grade de ícones, foto ou estatística inventada. A estrutura vem de hairlines, espaço negativo e escala.
- Dinheiro: apenas strings. Cálculos em centavos inteiros (`bigint`). Nenhuma aritmética de ponto flutuante.
- Sessão: o front nunca toca o token. Na abertura chama `GET /users/me`. `401` significa deslogado e redireciona preservando o destino.
- Erros: `ApiError` com `code`, `statusCode` e `fieldErrors`. Um mapa único `code` → texto em PT-BR. Falha de rede e erro de servidor são estados distintos.
- Todo `POST` envia `Content-Type: application/json`, inclusive o logout, que não tem corpo.
- Rotas do app: `/entrar`, `/criar-conta`, `/carteira`, `/transferir`, `/extrato`. Nenhuma coincide com os prefixos da API (`/auth`, `/users`, `/transaction`, `/hello`, `/q`).
- Botões dizem o ato (`Enviar R$ 250,00 para Marina →`, `Abrir minha carteira →`) e ficam desabilitados durante a requisição.
- Vitrine: `prefers-reduced-motion` troca o scroll animado por fades. Sem *hijack* de scroll. Contraste AA e foco visível em acento. Só `transform`, `opacity` e o traço do arco (`stroke-dashoffset`, dirigido pela variável `--p`) são animados; nenhuma propriedade de layout. GSAP e Lenis em *chunk* separado. Sem WebGL.
- Mobile com composição própria: arco na vertical, barra inferior de três itens, teclado numérico no campo de valor.
- Fora do escopo: chave de idempotência, banco persistente, *refresh token*, tema claro, outros idiomas além do PT-BR, WebGL, perfil editável, recuperação de senha, depósito e saque.

## Review Focus

Entradas e falhas que a spec implica, mas que os testes "óbvios" não cobririam. Cada linha tem o teste na tarefa dona:

1. **Valores digitados em formato brasileiro** (`1.250,50`, `12.5`, `1.000`, `0,5`, `R$ 10,00`) viram os centavos exatos. Os ambíguos ou inválidos (`1,234`, `1.2.3`, `0`) são recusados. (T3)
2. **Resultado desconhecido de uma transferência** (a rede cai depois do envio, `500`, `502`): a tela nunca reenvia sozinha nem oferece reenvio cego, e aponta para o extrato. Duplo clique envia uma vez só. (T9, T10 e T11)
3. **Parâmetro `next` do login e sessão que expira no meio do fluxo:** destino externo ou começando com `//` é ignorado. `401` leva ao login e volta ao ponto certo. (T6, T7, T10 e T11)
4. **Horário em UTC no extrato:** 23h30 do dia 1º em São Paulo (02h30 UTC do dia 2) aparece como dia 1º. (T3 e T8)
5. **Tela estreita e movimento reduzido:** em 320 px nenhuma rota rola na horizontal. Com `prefers-reduced-motion`, a vitrine inteira é legível sem *pins* e o CTA é alcançável pelo teclado. (T12 e T14)

## Convenções de execução

- npm: `npm --prefix frontend <script>`. Maven: `mvn -B -ntp` (o `mvnw` não funciona neste ambiente). Teste isolado: `npm --prefix frontend test -- <arquivo>`. Sucesso do Vitest = `Tests  N passed (N)`.
- Instale os pacotes com os intervalos abaixo e **commite o `package-lock.json`** (o Quinoa usa `npm ci`). O `@playwright/test` fica **exato em `1.63.0`**, a mesma versão do Playwright pré-instalado aqui: outra versão não encontra o navegador. Na máquina do autor, rode uma vez `npx playwright install chromium`.
- O e2e precisa do jar: `mvn -B -ntp -DskipTests package` antes. O Playwright sobe o stub (porta 9000) e o app (porta 8080) pelo `webServer`; não inicie processos à mão.
- Cada tarefa termina com commit em PT-BR (`tipo(escopo): resumo`, com os trailers da sessão) e `git push -u origin ccr-2f5e7339-pybi0z`.
- Nas T2, T12 e T13, consulte as skills `frontend-design:frontend-design`, `motion-design:motion-design` e `gsap-skills:gsap-scrolltrigger`.
- **Verificado neste ambiente (spike):** o `openapi-fetch` com `baseUrl` vazia falha (`Failed to parse URL`), então use `window.location.origin`. O jsdom do Vitest tem origem `http://localhost:3000`. O `signal` do TanStack Query e o do jsdom funcionam com o `fetch`. `tsc` e `vite build` passam; só o React DOM pesa 69 kB gzip. As famílias são `'Geist Variable'` e `'Geist Mono Variable'` (eixo 100–900). O `lenis` exporta `lenis/dist/lenis.css`. O Chromium 153 abre e captura. O `test.env.TZ` do Vitest só vale no pool `forks` (com `--pool=threads` a data sai em UTC); um `globalSetup` que atribui `process.env.TZ` vale nos dois e independe do fuso da máquina.

## Mapa de arquivos

```
pom.xml · application.properties        Quinoa 2.5.5 e suas propriedades
src/main/java/dev/whallyson/            controllers/ e dtos/: só anotações do contrato OpenAPI (T4)
src/test/java/dev/whallyson/            SpaServingIT.java (T1) · OpenApiContractTest.java (T4)
frontend/
  package.json · package-lock.json · tsconfig.json · vite.config.ts · index.html · playwright.config.ts
  scripts/        gen-api.mjs · check-bundle.mjs
  src/
    main.tsx · routes.ts
    app/          router.tsx · providers.tsx · session.ts · RequireSession.tsx · RedirectIfSignedIn.tsx · safeNext.ts
                  layouts/{AppShell,PublicShell}.tsx · pages/NotFound.tsx
    api/          schema.d.ts (gerado) · types.ts · client.ts · ApiError.ts · errorMessages.ts
    design/       tokens.css · global.css · Button.tsx · Field.tsx · Wordmark.tsx · Money.tsx
    lib/          money.ts · document.ts · format.ts
    features/     auth/{LoginPage,RegisterPage}.tsx · wallet/{WalletPage,WalletBalance}.tsx
                  statement/{StatementPage,MovementRow,useStatement}.tsx
                  transfer/{TransferPage,transferFlow,Arc,RecipientStep,AmountStep,ConfirmStep,ResultView}.tsx
    showcase/     Showcase.tsx · useScrollScenes.ts · ScrollArc.tsx · Scene.tsx · copy.ts · scenes/{Impact,Context,Proposal,Details,Climax,Conversion}.tsx
    test/         global-setup.ts · setup.ts · server.ts · fixtures.ts · render.tsx
  e2e/            support/{users,stub}.ts · app.spec.ts · failures.spec.ts · showcase.spec.ts · quality.spec.ts
```

---

### Task 1: Esqueleto, Quinoa e servir a SPA (Etapa 3)

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/vite-env.d.ts`, `frontend/src/test/global-setup.ts`, `src/test/java/dev/whallyson/SpaServingIT.java`
- Modify: `pom.xml`, `src/main/resources/application.properties`, `.gitignore`

**Interfaces:**
- Produces: os scripts npm (`dev`, `build` = `tsc --noEmit && vite build`, `typecheck`, `test` = `vitest run`, `gen:api`, `check:api`, `e2e` = `playwright test`, `check:bundle`), o diretório `frontend/` e as propriedades do Quinoa. O app é servido em `/`, e as rotas do SPA caem no `index.html`.
- Pacotes: `react@^19`, `react-dom@^19`, `react-router-dom@^7`, `@tanstack/react-query@^5`, `openapi-fetch@^0.17`, `gsap@^3.15`, `lenis@^1.3`, `@fontsource-variable/geist@^5.3`, `@fontsource-variable/geist-mono@^5.3`. Dev: `vite@^7`, `@vitejs/plugin-react@^5`, `typescript@~5.9`, `vitest@^3`, `jsdom@^26`, `@testing-library/react@^16`, `@testing-library/dom@^10`, `@testing-library/jest-dom@^6`, `@testing-library/user-event@^14`, `msw@^2`, `openapi-typescript@^7`, `@types/react@^19`, `@types/react-dom@^19`, `@types/node@^22`, `@playwright/test@1.63.0`, `@axe-core/playwright@^4`.

- [ ] **Step 1: Escrever o teste que falha** (`SpaServingIT`, `@QuarkusIntegrationTest`, roda contra o jar em perfil de produção).

```java
@QuarkusIntegrationTest class SpaServingIT {
  @Test void servesTheAppShellOnTheRoot() { given().get("/").then().statusCode(200).contentType(containsString("text/html"))
      .body(containsString("<div id=\"root\"></div>")).body(containsString("lang=\"pt-BR\"")); }
  @Test void clientRoutesFallBackToIndexHtml() { for (String p : List.of("/carteira", "/transferir", "/extrato", "/entrar", "/criar-conta"))
      given().get(p).then().statusCode(200).body(containsString("<div id=\"root\"></div>")); }
  @Test void unknownApiRoutesStayJson404() { for (String p : List.of("/users/nao-existe", "/auth/nao-existe", "/transaction/nao-existe"))
      given().get(p).then().statusCode(404).body("code", is("NOT_FOUND")); }
  @Test void apiAndDocsAreNotShadowedByTheSpa() { given().get("/hello").then().statusCode(200).body(is("Hello from Quarkus REST"));
      given().get("/q/openapi?format=json").then().statusCode(200).body("openapi", notNullValue());
      given().get("/users/me").then().statusCode(401).body("code", is("UNAUTHENTICATED")); }
}
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp verify -DskipITs=false -Dit.test=SpaServingIT`. Expected: FAIL (a raiz responde `404` em JSON, sem `index.html`).
- [ ] **Step 3: Criar o esqueleto do front.**
  - `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `jsx: react-jsx`, `moduleResolution: bundler`, `verbatimModuleSyntax`, `types: ["vite/client"]`, `include: ["src"]`.
  - `vite.config.ts` (de `vitest/config`): plugin React, `build.outDir = "dist"`, `server.proxy` de `/auth`, `/users`, `/transaction` e `/hello` para `http://localhost:8080`, e `test: { environment: "jsdom", globalSetup: ["./src/test/global-setup.ts"], setupFiles: ["./src/test/setup.ts"] }`. O `global-setup.ts` exporta por padrão uma função que faz `process.env.TZ = 'America/Sao_Paulo'`, para que as datas dos testes não dependam do fuso da máquina.
  - `index.html`: `<html lang="pt-BR">`, `viewport` com `viewport-fit=cover`, `theme-color` `#05070C`, `<title>Arco</title>`, `<div id="root"></div>`.
  - `main.tsx` renderiza um `<h1>arco</h1>` provisório. Os testes de setup (`src/test/setup.ts`) nascem na T5; até lá crie o arquivo vazio.
  - `.gitignore`: `frontend/node_modules/`, `frontend/dist/`, `frontend/test-results/`, `frontend/playwright-report/`, `frontend/e2e/__screenshots__/`.
  - Run: `npm --prefix frontend install && npm --prefix frontend run build`. Expected: `dist/index.html` existe e o build termina sem erro.
- [ ] **Step 4: Ligar o Quinoa.** Adicione ao `pom.xml` a dependência `io.quarkiverse.quinoa:quarkus-quinoa:2.5.5` e ao `application.properties`:

```properties
quarkus.quinoa.ui-dir=frontend
quarkus.quinoa.build-dir=dist
quarkus.quinoa.package-manager=npm
quarkus.quinoa.enable-spa-routing=true
quarkus.quinoa.ignored-path-prefixes=/auth,/users,/transaction,/hello,/q
%dev.quarkus.quinoa.dev-server.port=5173
%test.quarkus.quinoa.enabled=false
```

- [ ] **Step 5: Ver passar.** Run: `mvn -B -ntp verify -DskipITs=false`. Expected: `BUILD SUCCESS`, `SpaServingIT` com 4 testes e `GreetingResourceIT` verdes, e a suíte de back-end com `Tests run: 99` (o Quinoa fica desligado em `%test`). Se um prefixo da API for engolido pelo SPA, corrija `ignored-path-prefixes`.
- [ ] **Step 6: Provar a opção só-back-end** (o README a promete). Run: `rm -rf frontend/node_modules frontend/dist && mvn -B -ntp -Dquarkus.quinoa.enabled=false -DskipTests package; ls frontend/node_modules frontend/dist`. Expected: `BUILD SUCCESS` e os dois diretórios **não existem** (o Quinoa não rodou). Depois reinstale com `npm --prefix frontend install`.
- [ ] **Step 7: Commit e push.** `feat(front): esqueleto Vite/React servido pelo Quarkus via Quinoa`

---

### Task 2: Sistema de design (tokens, fontes e primitivos)

**Files:**
- Create: `frontend/src/design/tokens.css`, `global.css`, `Button.tsx`, `Field.tsx`, `Wordmark.tsx` (cada um com seu `.module.css`), `frontend/src/design/tokens.contrast.test.ts`, `Button.test.tsx`, `Field.test.tsx`
- Modify: `frontend/src/main.tsx` (importa as fontes `@fontsource-variable/geist` e `@fontsource-variable/geist-mono`, `tokens.css` e `global.css`)

**Interfaces:**
- Produces:
  - Tokens em `:root`: `--bg #05070C`, `--surface #0A0E17`, `--line #1A2233`, `--text #EEF1F6`, `--text-2 #8A94A6`, `--text-3 #6F7A8E`, `--accent #8FE3FF`, `--danger #E8737B`.
  - Famílias `--font-sans: 'Geist Variable', system-ui, sans-serif` e `--font-mono: 'Geist Mono Variable', ui-monospace, monospace`.
  - Escala: `--fs-micro .75rem`, `--fs-small .875rem`, `--fs-body 1rem`, `--fs-title clamp(1.5rem, 1.1rem + 1.6vw, 2.25rem)`, `--fs-display-l clamp(2.5rem, 1.6rem + 4vw, 5rem)`, `--fs-display-xl clamp(3.5rem, 1rem + 10vw, 9.5rem)`. Pesos: `--fw-display 200`, `--fw-title 300`, `--fw-body 350`.
  - Espaço: `--sp-1` a `--sp-8` (4, 8, 12, 16, 24, 32, 48, 72 px), `--sp-section clamp(96px, 16vh, 200px)`, `--gutter clamp(16px, 4vw, 48px)`.
  - Movimento: `--ease-out cubic-bezier(.16,1,.3,1)`, `--ease-in-out cubic-bezier(.65,0,.35,1)`, `--dur-1 160ms`, `--dur-2 320ms`, `--dur-3 640ms`, `--dur-4 1200ms`.
  - `Button({ variant?: 'primary' | 'quiet'; loading?: boolean; arrow?: boolean } & ButtonHTMLAttributes)` e `ButtonLink` (mesmo visual, renderiza `<Link>`). O primário é texto com borda de 1 px que passa a acento no hover, sem preenchimento. `Field({ label: string; hint?: string; error?: string } & InputHTMLAttributes)` com `ref`. `Wordmark` escreve `arco` em peso 300.
- Regras do `global.css`: `html { color-scheme: dark }`, fundo `--bg`, `:focus-visible` com contorno de 2 px em `--accent` e *offset* 3 px, utilitário `.sr-only`, e `@media (prefers-reduced-motion: reduce)` zerando animações e transições.

- [ ] **Step 1: Escrever os testes que falham.**

```ts
// tokens.contrast.test.ts — ratios calculados pela fórmula WCAG, lendo o CSS de verdade
const tokens = readTokens('./tokens.css');                       // { '--bg': '#05070C', ... }
it.each(['--text', '--text-2', '--text-3', '--accent', '--danger'])('%s tem contraste AA (>= 4.5) sobre o fundo e sobre a superfície',
  (t) => { expect(contrast(tokens[t], tokens['--bg'])).toBeGreaterThanOrEqual(4.5); expect(contrast(tokens[t], tokens['--surface'])).toBeGreaterThanOrEqual(4.5); });
// Button.test.tsx
it('é type=button por padrão', ...);                              // não envia formulário por acidente
it('em loading fica desabilitado, aria-busy=true e não dispara onClick', async () => { /* clique via user-event; expect(onClick).not.toHaveBeenCalled() */ });
it('com arrow acrescenta a seta aria-hidden', ...);
// Field.test.tsx
it('o label está ligado ao input (getByLabelText)', ...);
it('o erro é anunciado (role=alert), ligado por aria-describedby, e o input fica aria-invalid', ...);
```

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend test`. Expected: FAIL (arquivos inexistentes).
- [ ] **Step 3: Implementar** tokens, `global.css` e os três primitivos conforme as interfaces. Em `Button`, `loading` implica `disabled`, `aria-busy` e rótulo próprio dado por quem usa.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend test && npm --prefix frontend run build`. Expected: todos verdes e build sem erro.
- [ ] **Step 5: Commit e push.** `feat(front): tokens, fontes e primitivos do design Arco`

---

### Task 3: Dinheiro, documento e datas (`lib/`)

**Files:**
- Create: `frontend/src/lib/money.ts`, `document.ts`, `format.ts` e os testes `money.test.ts`, `document.test.ts`, `format.test.ts`

**Interfaces:**
- Produces (todas puras, sem `number` para dinheiro):
  - `apiToCents(value: string): bigint` (aceita 0 a 2 casas e `-` à frente; malformado lança `Error`), `centsToApi(cents: bigint): string` (`125000n` → `"1250.00"`, `-5n` → `"-0.05"`).
  - `parseAmountInput(text: string): bigint | null`: texto digitado em pt-BR para centavos, ou `null` se inválido ou menor ou igual a zero.
  - `formatBRL(cents: bigint): string` (`125000n` → `"R$ 1.250,00"`, `-5n` → `"-R$ 0,05"`), `formatBRLFromApi(value: string): string`.
  - `digitsOnly(text: string): string`, `isValidCpf(digits: string): boolean`, `isValidCnpj(digits: string): boolean`, `maskDocumentInput(text: string, type: 'COMMON' | 'MERCHANT'): string` (máscara progressiva, limita a 11 ou 14 dígitos).
  - `formatDateTime(iso: string, timeZone?: string): string` → `"DD/MM/AAAA HH:mm"` no fuso do navegador (ou o informado), montado por `formatToParts` para não depender da vírgula do ICU.
- Regra de `parseAmountInput`: remove `R$` e espaços. Com vírgula, ela é o decimal (1 ou 2 dígitos) e os pontos são milhar em grupos de 3. Sem vírgula, um único ponto seguido de 1 ou 2 dígitos é decimal (`12.5`), e pontos seguidos de exatamente 3 dígitos são milhar (`1.000`). No máximo 15 dígitos inteiros. Recusa também parte inteira vazia (`,5`, `.5`), separador sem decimais (`1,`, `1.`), o formato inglês (`1,000.50`) e milhar começando por zero (`0.500`).

- [ ] **Step 1: Escrever os testes que falham.**

```ts
describe('parseAmountInput (RF1)', () => {
  it.each([['250','25000'],['250,5','25050'],['250,50','25050'],['0,5','50'],['0,01','1'],['1.250,50','125050'],['1250,50','125050'],
           ['R$ 10,00','1000'],['12.5','1250'],['12.50','1250'],['1.000','100000'],['1.000.000','100000000'],['  7  ','700'],
           ['999999999999999,99','99999999999999999']])('aceita "%s" como %s centavos', (t, c) => expect(parseAmountInput(t)).toBe(BigInt(c)));
  it.each(['', 'R$', '0', '0,00', '-5', '+5', '1,234', '0,001', '1.2.3', '12,5,0', 'abc', '1.0000', '1.00.000,5', '1,', ',5', '.5', '1.', '1,000.50', '0.500', '٣', '9999999999999999'])
    ('recusa "%s"', (t) => expect(parseAmountInput(t)).toBeNull());
});
it('formatBRL', () => { expect(formatBRL(125000n)).toBe('R$ 1.250,00'); expect(formatBRL(5n)).toBe('R$ 0,05'); expect(formatBRL(0n)).toBe('R$ 0,00');
  expect(formatBRL(99999999999999999n)).toBe('R$ 999.999.999.999.999,99'); expect(formatBRL(-5n)).toBe('-R$ 0,05');
  expect(formatBRLFromApi('1234567.89')).toBe('R$ 1.234.567,89'); });
it('apiToCents / centsToApi', () => { expect(apiToCents('1250.00')).toBe(125000n); expect(apiToCents('0.05')).toBe(5n); expect(apiToCents('7')).toBe(700n); expect(apiToCents('-0.05')).toBe(-5n);
  for (const bad of ['', 'abc', '1.234', '1,50']) expect(() => apiToCents(bad)).toThrow(); expect(centsToApi(5n)).toBe('0.05'); expect(centsToApi(-5n)).toBe('-0.05'); });
// document.test.ts — as mesmas fixtures do back-end
it('CPF válidos', () => { for (const c of ['52998224725','11144477735']) expect(isValidCpf(c)).toBe(true); });
it('CPF inválidos', () => { for (const c of ['52998224724','11111111111','123','','529982247250','5299822472a']) expect(isValidCpf(c)).toBe(false); });
it('CNPJ', () => { expect(isValidCnpj('11222333000181')).toBe(true); for (const c of ['11222333000182','00000000000000','1122233300018','']) expect(isValidCnpj(c)).toBe(false); });
it('máscara progressiva', () => { expect(digitsOnly('529.982.247-25')).toBe('52998224725'); expect(maskDocumentInput('5299','COMMON')).toBe('529.9'); expect(maskDocumentInput('529982247','COMMON')).toBe('529.982.247');
  expect(maskDocumentInput('52998224725999','COMMON')).toBe('529.982.247-25'); expect(maskDocumentInput('11222333000181','MERCHANT')).toBe('11.222.333/0001-81'); });
// format.test.ts (America/Sao_Paulo vem do global-setup.ts) — RF4
it('virada de dia no fuso local', () => { expect(formatDateTime('2026-11-02T02:30:00Z')).toBe('01/11/2026 23:30');
  expect(formatDateTime('2026-11-02T02:30:00Z', 'Asia/Tokyo')).toBe('02/11/2026 11:30'); });
```

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend test -- src/lib`. Expected: FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar** `lib/money.ts`, `lib/document.ts` e `lib/format.ts` conforme as interfaces. Use `Intl.NumberFormat('pt-BR')` com `bigint` para o milhar e monte o resto à mão.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend test -- src/lib`. Expected: todos verdes.
- [ ] **Step 5: Commit e push.** `feat(front): dinheiro em centavos, documentos e datas em pt-BR`

---

### Task 4: Contrato OpenAPI completo (back-end)

O cliente tipado nasce do OpenAPI, e o que o Plano A exportou não basta para isso: os três `POST` que devolvem `Response` aparecem como `200` sem corpo (na realidade são `201` com o perfil, `200` com o perfil e `204`), os erros não têm esquema e nenhum campo das respostas é `required`, então o gerador marcaria tudo como opcional. A correção é no produtor, com teste, para que o `schema.d.ts` seja o contrato de verdade e o `check:api` (T5) valha alguma coisa.

**Files:**
- Modify: `src/main/java/dev/whallyson/controllers/{AuthController,TransactionController,UserController}.java` (`@APIResponse` nos métodos), `dtos/responses/{ResponseUser,ResponseUserSummary,ResponseTransaction,ResponsePage}.java` e `dtos/exception/ErrorResponseDTO.java` (`@Schema(requiredProperties = …)`)
- Test: `src/test/java/dev/whallyson/OpenApiContractTest.java`

**Interfaces:**
- Produces: o documento em `/q/openapi` e, depois do `package`, em `target/openapi/openapi.json`, com este conteúdo:

| Operação | Sucesso | Erros (corpo `ErrorResponseDTO`) |
|---|---|---|
| `POST /auth/register` | `201` `ResponseUser` | `400`, `409` |
| `POST /auth/login` | `200` `ResponseUser` | `400`, `401` |
| `POST /auth/logout` | `204`, sem corpo | |
| `POST /transaction` | `201` `ResponseTransaction` | `400`, `401`, `403`, `404`, `422`, `503` |
| `GET /transaction` e `GET /users/search` | `200` (já documentado) | `400` |

- O `200` sem corpo que hoje aparece em `register`, `login`, `logout` e `POST /transaction` deixa de existir. O esquema `ErrorResponseDTO` exige `statusCode`, `code` e `message`; `fieldErrors` (lista de `FieldError {field, code}`) é opcional. `ResponseUser`, `ResponseUserSummary`, `ResponseTransaction`, `Party` e `ResponsePageResponseTransaction` listam todas as suas propriedades em `required`.

- [ ] **Step 1: Escrever o teste que falha** (`@QuarkusTest`; o documento vem de `GET /q/openapi?format=json` e é lido como mapa, porque as chaves têm `/` e `$`).

```java
@QuarkusTest class OpenApiContractTest {
  // Quebra se: um POST deixar de declarar o corpo de sucesso (o front perderia os tipos) ou voltar a anunciar o 200 errado.
  @Test void successResponsesDeclareTheirBodies() { /* register 201 -> $ref .../ResponseUser, sem 200; login 200 -> .../ResponseUser;
      logout tem 204 e não tem 200; POST /transaction 201 -> .../ResponseTransaction, sem 200 */ }
  // Quebra se: um erro da tabela deixar de apontar para o esquema de erro.
  @Test void errorResponsesPointToTheErrorSchema() { /* cada (operação, status) da tabela: content.application/json.schema.$ref termina em /ErrorResponseDTO */ }
  @Test void errorSchemaListsTheContractFields() { /* properties contém statusCode, code, message, fieldErrors; required == {statusCode, code, message} */ }
  // Quebra se: um campo de resposta ficar opcional, o que o gerador de tipos marcaria com `?`.
  @Test void responseSchemasRequireEveryProperty() { /* para os cinco esquemas: conjunto(required) == conjunto(properties) */ }
}
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp test -Dtest=OpenApiContractTest`. Expected: FAIL nos quatro testes (hoje `register` documenta só `200` sem corpo e os esquemas não têm `required`).
- [ ] **Step 3: Implementar.** Em cada método, `@APIResponse(responseCode = …, content = @Content(schema = @Schema(implementation = …)))` conforme a tabela (o `description` pode ser o nome do código de erro); nos DTOs, `@Schema(requiredProperties = {…})` no tipo. Se o gerador ignorar `requiredProperties` em `record`, marque cada componente com `@Schema(required = true)`: o teste decide.
- [ ] **Step 4: Ver passar.** Run: `mvn -B -ntp test && mvn -B -ntp -DskipTests package`. Expected: `BUILD SUCCESS`, a suíte inteira verde (os 99 do Plano A mais os 4 novos) e `target/openapi/openapi.json` com os `201` e o `ErrorResponseDTO`.
- [ ] **Step 5: Commit e push.** `feat(api): contrato OpenAPI completo para o cliente tipado`

---

### Task 5: Camada de API tipada (`api/`)

**Files:**
- Create: `frontend/scripts/gen-api.mjs`, `frontend/src/api/schema.d.ts` (gerado e versionado), `types.ts`, `ApiError.ts`, `errorMessages.ts`, `client.ts`, `frontend/src/test/setup.ts`, `server.ts`, `fixtures.ts`, e os testes `ApiError.test.ts`, `errorMessages.test.ts`, `client.test.ts`

**Interfaces:**
- Consumes: `target/openapi/openapi.json` já completo (T4; gere com `mvn -B -ntp -DskipTests package`).
- Produces:
  - `gen-api.mjs`: lê `OPENAPI_FILE` (padrão `../target/openapi/openapi.json`) e grava `src/api/schema.d.ts`. Com `--check`, não grava: sai com código 1 se o arquivo versionado diferir do gerado.
  - `types.ts` reexporta do esquema: `User` (ResponseUser), `UserSummary` (ResponseUserSummary), `Transaction` (ResponseTransaction), `RegisterBody`, `LoginBody`, `TransferBody` e `ErrorBody` (ErrorResponseDTO). `Page<T>` é escrito à mão (`{ items: T[]; page: number; size: number; total: number }`), porque o OpenAPI não expressa o genérico.
  - `ApiError.ts`: `API_ERROR_CODES` (os 14 códigos do back-end mais `NETWORK` e `UNKNOWN`) e `type ApiErrorCode = (typeof API_ERROR_CODES)[number] | \`HTTP_${number}\``. `class ApiError extends Error { constructor(statusCode: number, code: ApiErrorCode, fieldErrors: {field: string; code: string}[]); statusCode: number; code: ApiErrorCode; fieldErrors: {field: string; code: string}[]; isNetwork: boolean; fieldCode(field: string): string | undefined }`. `NETWORK` tem `statusCode` 0.
  - `errorMessages.ts`: `messageFor(error: unknown): string` e `fieldMessage(code: string): string`.
  - `client.ts`: `interface Api { me(): Promise<User | null>; register(b: RegisterBody): Promise<User>; login(b: LoginBody): Promise<User>; logout(): Promise<void>; searchUsers(q: string): Promise<UserSummary[]>; transfer(b: TransferBody): Promise<Transaction>; statement(p: { direction: 'all' | 'sent' | 'received'; page: number; size: number }): Promise<Page<Transaction>> }`, `createApi(baseUrl = window.location.origin): Api` e `export const api = createApi()`. Toda falha vira `ApiError`; `me()` devolve `null` no `401`.
  - Textos de `messageFor`: `VALIDATION_ERROR` "Confira os dados informados."; `INVALID_CREDENTIALS` "E-mail ou senha incorretos."; `UNAUTHENTICATED` "Sua sessão terminou. Entre de novo."; `MERCHANT_CANNOT_SEND` "Lojas recebem transferências, mas não enviam."; `USER_NOT_FOUND` "Não encontramos essa pessoa."; `NOT_FOUND` "Não encontramos o que você procura."; `METHOD_NOT_ALLOWED` "Essa ação não é permitida."; `DUPLICATE_EMAIL` "Já existe uma carteira com esse e-mail."; `DUPLICATE_DOCUMENT` "Já existe uma carteira com esse documento."; `INSUFFICIENT_BALANCE` "Saldo insuficiente para este valor."; `SELF_TRANSFER` "Você não pode enviar dinheiro para si mesmo."; `AUTHORIZATION_DENIED` "O serviço de autorização recusou esta transferência. Seu saldo não mudou."; `AUTHORIZER_UNAVAILABLE` "O serviço de autorização está fora do ar. Seu saldo não mudou. Tente de novo em instantes."; `INTERNAL_ERROR` "Algo deu errado do nosso lado. Tente de novo."; `NETWORK` "Sem conexão com o servidor."; `HTTP_*` e `UNKNOWN` "Não foi possível concluir. Tente de novo.". `fieldMessage`: `REQUIRED` "Preencha este campo."; `TOO_LONG` "Texto longo demais."; `INVALID_EMAIL` "E-mail inválido."; `PASSWORD_LENGTH` "A senha precisa ter de 8 a 72 caracteres."; `INVALID_DOCUMENT` "Documento inválido."; `QUERY_TOO_SHORT` "Digite ao menos 3 caracteres."; `INVALID_AMOUNT` "Digite um valor válido, com até duas casas decimais."; qualquer outro "Valor inválido.".
  - Utilitários de teste: `fixtures.ts` com `marina`, `rafael`, `loja` (formato exato do back-end, dinheiro em string), `tx(overrides)` e `page(items, total)`. `server.ts` exporta `server = setupServer()` sem handlers.

- [ ] **Step 1: Gerar os tipos e escrever os testes que falham.** Run: `npm --prefix frontend run gen:api` (cria `schema.d.ts`; precisa do `gen-api.mjs`, escreva-o antes, é a ferramenta e não tem teste próprio). Depois os testes:

```ts
// client.test.ts (MSW; baseUrl = window.location.origin)
it('me() devolve o usuário no 200 e null no 401', ...);   // com `const balance: string = user.balance`: não compila se o campo voltar a ser opcional
it('erro JSON do back-end vira ApiError com statusCode, code e fieldErrors', async () => {  // 422 INSUFFICIENT_BALANCE e 400 com fieldErrors
  server.use(http.post('*/transaction', () => HttpResponse.json({ statusCode: 422, code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente.' }, { status: 422 })));
  await expect(api.transfer({ receiverId: 2, amount: '5000.00' })).rejects.toMatchObject({ statusCode: 422, code: 'INSUFFICIENT_BALANCE' }); });
it('falha de rede vira ApiError NETWORK com statusCode 0', async () => { server.use(http.get('*/users/search', () => HttpResponse.error()));
  await expect(api.searchUsers('abc')).rejects.toMatchObject({ code: 'NETWORK', statusCode: 0, isNetwork: true }); });
it('corpo que não é JSON (502 em HTML) vira HTTP_502', ...);
it('todo POST envia content-type application/json, inclusive o logout sem corpo', async () => {
  let seen = ''; server.use(http.post('*/auth/logout', ({ request }) => { seen = request.headers.get('content-type') ?? ''; return new HttpResponse(null, { status: 204 }); }));
  await api.logout(); expect(seen).toContain('application/json'); });
it('dinheiro continua string', async () => { /* me() com balance "1000.00" */ expect(typeof user.balance).toBe('string'); });
it('statement monta a query direction=sent&page=0&size=20', ...);
// errorMessages.test.ts
it('todo código conhecido tem texto', () => { for (const c of API_ERROR_CODES) expect(messageFor(new ApiError(0, c, []))).not.toBe(''); });
it('texto de saldo insuficiente', () => expect(messageFor(new ApiError(422, 'INSUFFICIENT_BALANCE', []))).toBe('Saldo insuficiente para este valor.'));
it('erro desconhecido cai no texto genérico', () => expect(messageFor(new Error('x'))).toBe('Não foi possível concluir. Tente de novo.'));
```

`src/test/setup.ts`: importa `@testing-library/jest-dom/vitest` e registra `beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))`, `afterEach(() => { cleanup(); server.resetHandlers(); })` e `afterAll(() => server.close())`.

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend test -- src/api`. Expected: FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar** `ApiError`, `errorMessages` e `client` (com `openapi-fetch` por baixo; os componentes só conhecem `api.*`). Um *middleware* ou *wrapper* de `fetch` coloca `Content-Type: application/json` em todo `POST` e usa `credentials: 'same-origin'`.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend test -- src/api && npm --prefix frontend run typecheck && npm --prefix frontend run check:api`. Expected: verdes, `tsc` sem erro (ele confere os tipos dos testes) e `check:api` com código 0.
- [ ] **Step 5: Commit e push.** `feat(front): cliente da API tipado, ApiError e textos de erro`

---

### Task 6: Sessão, rotas, guardas e layouts

**Files:**
- Create: `frontend/src/routes.ts`, `app/{router.tsx, providers.tsx, session.ts, RequireSession.tsx, RedirectIfSignedIn.tsx, safeNext.ts}`, `app/layouts/{AppShell,PublicShell}.tsx` (+ `.module.css`), `app/pages/NotFound.tsx`, `src/test/render.tsx`, e páginas provisórias com `<h1>` em `features/{auth,wallet,statement,transfer}/` e `showcase/Showcase.tsx` (substituídas nas T7 a T13); testes `safeNext.test.ts`, `session.test.tsx`, `router.test.tsx`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError`, `User` (T5).
- Produces:
  - `ROUTES = { home: '/', login: '/entrar', register: '/criar-conta', wallet: '/carteira', transfer: '/transferir', statement: '/extrato' } as const`.
  - `safeNext(raw: string | null | undefined, fallback = '/carteira'): string`: só devolve `raw` se for caminho interno (começa com uma `/`, não com `//`, sem `\`, sem esquema).
  - `sessionKey = ['session'] as const`; `useSession(): { user: User | null | undefined; isLoading: boolean }` (`undefined` = carregando, `null` = deslogado); `useLogin()`, `useRegister()`, `useLogout()` (mutações do TanStack; sucesso grava `sessionKey`; logout zera o cache e vai a `/entrar`).
  - `routes: RouteObject[]` e `createAppRouter(): Router`. Mapa: `/` → `Showcase` (lazy); `/entrar` e `/criar-conta` → `RedirectIfSignedIn` → `PublicShell`; `RequireSession` → `AppShell` → `/carteira`, `/transferir`, `/extrato`; `*` → `NotFound`.
  - `renderApp(route: string, opts?: { user?: User | null }): RenderResult`, que monta `QueryClient` (`retry: false`) e um `createMemoryRouter(routes)`, pré-registrando o handler de `GET /users/me`.
  - `AppShell`: uma única `<nav aria-label="Principal">` com Carteira, Transferir e Extrato (`aria-current="page"` no ativo), o nome da pessoa e `Sair`. O CSS a posiciona no topo (desktop) ou como barra fixa inferior de três itens (< 768 px), sem ícones.

- [ ] **Step 1: Escrever os testes que falham.**

```ts
// safeNext.test.ts (RF3)
it.each([['/transferir','/transferir'],['/extrato?x=1','/extrato?x=1'],['https://evil.com','/carteira'],['//evil.com','/carteira'],['/\\evil.com','/carteira'],
         ['javascript:alert(1)','/carteira'],['carteira','/carteira'],[' /transferir','/carteira'],['','/carteira'],[null,'/carteira'],[undefined,'/carteira']])
  ('safeNext(%j) = %s', (raw, out) => expect(safeNext(raw)).toBe(out));
// session.test.tsx
it('401 em /users/me deixa user=null e consulta uma vez só', ...);          // sem laço de refetch
it('login grava a sessão; logout limpa o cache e vai a /entrar', ...);
// router.test.tsx
it('sem sessão, /transferir?x=1 vai para /entrar?next=%2Ftransferir%3Fx%3D1', ...);
it('com sessão, /entrar redireciona para /carteira', ...);
it('rota desconhecida mostra a página não encontrada', ...);
it('a nav tem os três links e marca o ativo com aria-current=page', ...);
```

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend test -- src/app`. Expected: FAIL.
- [ ] **Step 3: Implementar** conforme as interfaces. `RequireSession` mostra só o `Wordmark` enquanto carrega (sem *spinner*), e redireciona com `?next=` codificado.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend test && npm --prefix frontend run build`. Expected: verdes.
- [ ] **Step 5: Commit e push.** `feat(front): sessão por cookie, rotas, guardas e layouts`

---

### Task 7: Cadastro e login

**Files:**
- Modify: `frontend/src/features/auth/LoginPage.tsx`, `RegisterPage.tsx` (+ `.module.css`)
- Test: `frontend/src/features/auth/auth.test.tsx`

**Interfaces:**
- Consumes: `useLogin`, `useRegister`, `safeNext`, `Field`, `Button`, `maskDocumentInput`, `isValidCpf`, `isValidCnpj`, `messageFor`, `fieldMessage`.
- Composição: `PublicShell`. Em tela larga, o formulário ocupa uma coluna à esquerda (máx. 440 px) e o resto da tela fica vazio: sem ilustração e sem arco, que só aparece com valor em trânsito (spec §6); no celular, coluna única.
- Textos: Login — título `Entrar na carteira`, botão `Entrar na carteira →` (em andamento: `Entrando…`), link `Criar minha carteira`. Cadastro — título `Criar minha carteira`, grupo `Eu sou` com `Pessoa` (`COMMON`) e `Loja` (`MERCHANT`), rótulo do documento `CPF` ou `CNPJ`, campos `Nome`, `Sobrenome`, `E-mail`, `Senha`, botão `Criar minha carteira →`, dica `Você começa com um saldo de demonstração.`.
- Regras: validação do cliente só no envio (obrigatório, CPF/CNPJ por dígito verificador, e-mail, senha de 8 a 72). O corpo enviado leva o documento **só com dígitos**. `fieldErrors` do servidor aparecem sob o campo certo (`DUPLICATE_EMAIL` → e-mail; `DUPLICATE_DOCUMENT` → documento). Erro geral em `role="alert"`. Falhando, o foco vai ao primeiro campo inválido. Sucesso do login vai a `safeNext(?next)`; do cadastro, a `/carteira`.

- [ ] **Step 1: Escrever os testes que falham** (Testing Library + user-event + MSW, `renderApp`).

```ts
it('login ok vai para o next seguro', ...);                                   // ?next=%2Ftransferir -> /transferir
it('login ignora next externo', ...);                                         // ?next=https%3A%2F%2Fevil.com -> /carteira (RF3)
it('login com senha errada mostra o alerta, mantém o e-mail e limpa a senha', ...);   // "E-mail ou senha incorretos."
it('duplo clique no login envia uma vez', async () => { /* contador do handler === 1 */ });
it('cadastro: o rótulo e a máscara do documento seguem o tipo', ...);          // Pessoa -> "CPF" 000.000.000-00; Loja -> "CNPJ"
it('cadastro: CPF inválido bloqueia o envio sem chamar o servidor', ...);      // 0 requisições; "Documento inválido."
it('cadastro envia o documento só com dígitos e o e-mail aparado', ...);       // body.document === "52998224725"
it('cadastro mapeia 409 DUPLICATE_EMAIL para o campo e-mail', ...);            // "Já existe uma carteira com esse e-mail."
it('cadastro ok vai para /carteira', ...);
```

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend test -- src/features/auth`. Expected: FAIL.
- [ ] **Step 3: Implementar** as duas páginas conforme as interfaces.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend test`. Expected: verdes.
- [ ] **Step 5: Commit e push.** `feat(front): telas de cadastro e login`

---

### Task 8: Carteira e extrato

**Files:**
- Create: `frontend/src/design/Money.tsx`, `features/statement/{useStatement.ts, MovementRow.tsx, StatementPage.tsx}`, `features/wallet/{WalletBalance.tsx, WalletPage.tsx}` (+ `.module.css`)
- Test: `features/statement/statement.test.tsx`, `features/wallet/wallet.test.tsx`

**Interfaces:**
- Consumes: `api.statement`, `useSession`, `formatBRLFromApi`, `formatDateTime`, `Transaction`.
- Produces:
  - `Money({ value: string | bigint; variant?: 'display' | 'row' | 'inline' } & HTMLAttributes<HTMLSpanElement>)`: "R$ 1.250,00" em mono tabular; `string` é o formato da API e `bigint` são centavos.
  - `statementKey = ['statement'] as const` (o prefixo, para invalidar tudo de uma vez); `useStatement(direction: 'all' | 'sent' | 'received', size = 20)` (`useInfiniteQuery`; a chave é `[...statementKey, direction, size]`, porque a carteira pede 5 e o extrato 20 e não podem dividir cache; `getNextPageParam` pelo `total`).
  - `MovementRow({ tx: Transaction })`: `[data mono] [contraparte] [±valor mono]`. `SENT` mostra o destinatário e `−R$ 250,00`; `RECEIVED` mostra o remetente e `+R$ 250,00`. Texto para leitor de tela: "Enviado para Rafael Costa em 01/11/2026 12:58, R$ 250,00". O nome completo vai no `title`. O sinal é um caractere à parte, `−` (U+2212) ou `+`, antes do `formatBRL` do valor; as colunas visíveis levam `aria-hidden` e a frase para leitor de tela vem num `.sr-only`.
  - `WalletBalance({ name: string; balance: string; movements: Transaction[] })`: só apresentação, sem ações (o rótulo `Saldo`, o saldo gigante em peso 200 com `data-testid="wallet-balance"` e as linhas); reaproveitado pela vitrine (T13). Em tela larga, o saldo ocupa as colunas 1–7 e as movimentações as colunas 9–12; no celular, empilha.
  - `WalletPage`: o `WalletBalance` com as 5 últimas movimentações (`useStatement('all', 5)`), mais `Enviar dinheiro →` (para `MERCHANT`, o texto `Lojas recebem transferências.`) e o link `Ver extrato →`.
  - `StatementPage`: título `Extrato`, abas `Tudo`, `Enviadas`, `Recebidas` (`role="tablist"`), contador `N movimentações`, botão `Carregar mais` enquanto houver itens.
  - Estados: carregando (linhas esqueléticas com `aria-busy`, sem *spinner*), vazio (`Nenhuma movimentação por aqui.`), erro (mensagem e `Tentar de novo`).

- [ ] **Step 1: Escrever os testes que falham.**

```ts
it('MovementRow: SENT mostra o destinatário e o valor negativo; RECEIVED, o remetente e o positivo', ...);
it('MovementRow: virada de dia no fuso local (RF4)', ...);           // 2026-11-02T02:30:00Z -> "01/11/2026 23:30"
it('MovementRow: texto de leitor de tela e title com o nome completo', ...);
it('extrato: cada aba chama a API com a direction certa', ...);       // all | sent | received
it('extrato: "Carregar mais" traz a página 1 e some no fim', ...);
it('extrato e carteira: vazio ("Nenhuma movimentação por aqui.") e erro com "Tentar de novo"', ...);
it('erro de rede e erro 500 mostram textos diferentes', ...);       // "Sem conexão com o servidor." x "Algo deu errado do nosso lado. Tente de novo."
it('carteira (5) e extrato (20) não dividem cache: size faz parte da chave', ...);
it('carteira: o saldo vem da string da API sem arredondar', ...);     // "1234567.89" -> "R$ 1.234.567,89"
it('carteira de lojista não mostra o botão de enviar', ...);          // "Lojas recebem transferências."
it('carteira: lista as 5 últimas e tem o link para o extrato', ...);
```

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend test -- src/features/statement src/features/wallet`. Expected: FAIL.
- [ ] **Step 3: Implementar** conforme as interfaces.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend test`. Expected: verdes.
- [ ] **Step 5: Commit e push.** `feat(front): carteira e extrato`

---

### Task 9: Fluxo de envio (máquina de estados) e o arco

**Files:**
- Create: `frontend/src/features/transfer/transferFlow.ts`, `Arc.tsx`, `Arc.module.css`
- Test: `features/transfer/transferFlow.test.ts`, `Arc.test.tsx`

**Interfaces:**
- Consumes: `ApiError`, `ApiErrorCode`, `UserSummary`, `Transaction`, `parseAmountInput`.
- Produces:
  - `type Step = 'recipient' | 'amount' | 'confirm'`, `type Outcome = 'idle' | 'submitting' | 'success' | 'denied' | 'rejected' | 'unknown'`.
  - `interface TransferState { step: Step; recipient: UserSummary | null; amountText: string; outcome: Outcome; errorCode?: ApiErrorCode; result?: Transaction }`.
  - `type TransferAction = { type: 'selectRecipient'; recipient: UserSummary } | { type: 'clearRecipient' } | { type: 'setAmount'; text: string } | { type: 'next'; balanceCents: bigint } | { type: 'back' } | { type: 'submit' } | { type: 'succeeded'; result: Transaction } | { type: 'failed'; error: ApiError } | { type: 'reset' }`.
  - `transferReducer(state, action): TransferState`, `initialTransferState` (`step: 'recipient'`, `outcome: 'idle'`, `amountText: ''`), `canGoNext(state, balanceCents: bigint): boolean` (no passo `amount`: `parseAmountInput(amountText)` é válido e menor ou igual ao saldo), `classifyFailure(error: ApiError): 'denied' | 'rejected' | 'unknown'`.
  - Transições: `selectRecipient` grava o destinatário e vai a `amount`; `clearRecipient` volta a `recipient`; `setAmount` grava o texto e zera `outcome` e `errorCode`; `next` só avança de `amount` para `confirm` se `canGoNext`; `back` vai de `confirm` a `amount` e de `amount` a `recipient`, mantendo destinatário e texto; `submit` só vale em `confirm` com `outcome` `idle` ou `denied` (vira `submitting`) e, em qualquer outro caso, devolve **o mesmo objeto de estado**; `succeeded` grava `result` e vira `success`; `failed` grava `errorCode` e vira o resultado de `classifyFailure`, e com `rejected` o passo passa a `amount` (`INSUFFICIENT_BALANCE`, `VALIDATION_ERROR`) ou a `recipient` com o destinatário limpo (os demais); `reset` volta ao estado inicial.
  - `classifyFailure`: **`denied`** (o back-end garante que nada foi gravado; pode tentar de novo) para `AUTHORIZATION_DENIED` e `AUTHORIZER_UNAVAILABLE`; **`unknown`** (não dá para saber se enviou) para `NETWORK`, `INTERNAL_ERROR`, `UNKNOWN` e qualquer `HTTP_5xx`; **`rejected`** (recusado antes de gravar: corrigir e voltar) para todo o resto, inclusive `HTTP_4xx`.
  - `type ArcState = 'idle' | 'authorizing' | 'landed' | 'retracted'`; `Arc({ state, from, to }: { state: ArcState; from: string; to: string })`: SVG com um caminho (`pathLength=1`) entre dois nós e `data-arc-state`; um `<span role="status" class="sr-only">` anuncia `Pronto para enviar`, `Autorizando…`, `Enviado` ou `Não enviado`.
  - Movimento do arco: `idle` mostra o caminho em `--line`; `authorizing` faz um segmento em `--accent` percorrer o caminho em laço; `landed` desenha o acento inteiro em 640 ms (`--ease-out`) e pulsa o nó de chegada; `retracted` recolhe o traço em 480 ms. Com `prefers-reduced-motion`, nada anima: o estado aparece só pela cor.

- [ ] **Step 1: Escrever os testes que falham.**

```ts
it('submit enquanto já está enviando é ignorado (duplo clique)', () => { const s = reduce(confirmed(), { type: 'submit' }); expect(reduce(s, { type: 'submit' })).toBe(s); });   // RF2
it('submit depois de resultado desconhecido é ignorado: sem reenvio cego', () => { const s = reduce(submitting(), failed('NETWORK')); expect(s.outcome).toBe('unknown'); expect(reduce(s, { type: 'submit' })).toBe(s); });   // RF2
it.each([['NETWORK','unknown'],['INTERNAL_ERROR','unknown'],['HTTP_502','unknown'],['HTTP_504','unknown'],['AUTHORIZER_UNAVAILABLE','denied'],
         ['AUTHORIZATION_DENIED','denied'],['INSUFFICIENT_BALANCE','rejected'],['USER_NOT_FOUND','rejected'],['MERCHANT_CANNOT_SEND','rejected'],
         ['SELF_TRANSFER','rejected'],['VALIDATION_ERROR','rejected'],['HTTP_415','rejected'],['UNKNOWN','unknown']])
  ('classifyFailure(%s) = %s', (code, kind) => expect(classifyFailure(new ApiError(code === 'NETWORK' ? 0 : 500, code as ApiErrorCode, []))).toBe(kind));
it('canGoNext no passo do valor: 250,00 com saldo de 1000,00 passa; 1.001,00, 0 e vazio não', ...);
it('voltar da confirmação mantém destinatário e valor', ...);
it('depois de denied, o submit é permitido de novo', ...);
it('next sem valor válido é ignorado', ...);
it('rejected por saldo volta ao passo do valor; USER_NOT_FOUND limpa o destinatário e volta ao primeiro passo', ...);
it('setAmount depois de uma falha limpa a mensagem', ...);
it('reset limpa tudo', ...);
// Arc.test.tsx
it.each([['idle','Pronto para enviar'],['authorizing','Autorizando…'],['landed','Enviado'],['retracted','Não enviado']])
  ('estado %s expõe data-arc-state e anuncia "%s"', ...);
it('mostra os nomes das duas pontas', ...);
```

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend test -- src/features/transfer`. Expected: FAIL.
- [ ] **Step 3: Implementar** `transferFlow.ts` (puro, sem React) e `Arc` conforme as interfaces.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend test`. Expected: verdes.
- [ ] **Step 5: Commit e push.** `feat(front): máquina de estados do envio e o arco de luz`

---

### Task 10: Tela Transferir

**Files:**
- Modify: `frontend/src/features/transfer/TransferPage.tsx` (+ `.module.css`)
- Create: `RecipientStep.tsx`, `AmountStep.tsx`, `ConfirmStep.tsx`, `ResultView.tsx`, `useDebouncedValue.ts`
- Test: `features/transfer/transfer.test.tsx`

**Interfaces:**
- Consumes: `transferReducer` e `Arc` (T9), `api.searchUsers` e `api.transfer`, `useSession`, `sessionKey`, `statementKey`, `parseAmountInput`, `centsToApi`, `formatBRL`, `messageFor`.
- Composição: uma coluna de até 560 px, alinhada à esquerda; micro-rótulo `1 / 3`; o título é a pergunta em `--fs-display-l`; a troca de passo desliza na horizontal em 320 ms (`--ease-out`), sem animação com movimento reduzido; o foco vai ao título a cada passo; `Enter` avança.
- Passos e textos:
  1. `Para quem?`: campo `E-mail ou CPF/CNPJ`, espera 350 ms e 3 caracteres; resultado como uma linha `Rafael Costa · Pessoa · ***.444.777-**`; vazio: `Ninguém encontrado com esse e-mail ou documento.`; menos de 3: `Digite ao menos 3 caracteres.`. Escolher a linha avança. Enquanto busca, a lista leva `aria-busy`; se a busca falha, a mensagem de `messageFor` aparece sob o campo e digitar de novo tenta outra vez.
  2. `Quanto?`: campo grande com prefixo `R$` e `inputMode="decimal"`; `Disponível R$ 1.000,00`; com valor válido, `Saldo depois R$ 750,00`; acima do saldo: `Saldo insuficiente para este valor.` e `Continuar →` desabilitado, sem chamar o servidor.
  3. `Confirmar.`: resumo (`Para`, `Valor`, `Saldo depois`), o `Arc` (`from="Você"`, `to` = o primeiro nome do destinatário; `Outcome` → `ArcState`: `idle`→`idle`, `submitting`→`authorizing`, `success`→`landed`, `denied` e `rejected`→`retracted`, `unknown`→`idle`, porque ali o arco não afirma nada) e o botão `Enviar R$ 250,00 para Rafael Costa →` (enviando: `Autorizando…`).
- Resultados:
  - `success`: `Enviado.` e `R$ 250,00 para Rafael Costa.`, com os links `Ver extrato →` e `Nova transferência`; invalida `sessionKey` e `statementKey`.
  - `denied`: a mensagem do erro e `Tentar de novo`.
  - `rejected`: o reducer já leva ao passo certo (o do valor, para `INSUFFICIENT_BALANCE` e `VALIDATION_ERROR`; o do destinatário, para os demais) e a mensagem aparece sob o campo desse passo até a próxima digitação.
  - `unknown`: `Não deu para confirmar se o envio aconteceu. Confira o extrato antes de tentar de novo.`, com o link `Conferir extrato →` e `Nova transferência`; **sem botão de reenvio**.
  - `UNAUTHENTICATED` (tratado antes de despachar `failed`): grava `null` em `sessionKey`, e a guarda leva a `/entrar?next=%2Ftransferir`.
- Lojista: no lugar do formulário, `Lojas recebem, não enviam.` e o link `Ver carteira`.

- [ ] **Step 1: Escrever os testes que falham.**

```ts
it('lojista vê o aviso no lugar do formulário', ...);
it('a busca espera 3 caracteres e 350 ms e mostra o resultado', ...);        // 1 requisição com q=rafael@arco.demo; "***.444.777-**"
it('sem resultado mostra a mensagem de vazio', ...);
it('falha na busca mostra a mensagem do erro sob o campo e digitar de novo tenta outra vez', ...);
it('valor digitado como "250,5" mostra "Saldo depois R$ 749,50" e envia amount "250.50" (RF1)', ...);
it('valor acima do saldo é barrado no cliente, sem requisição', ...);
it('o botão de confirmar diz o ato e mostra o saldo depois', ...);           // "Enviar R$ 250,00 para Rafael Costa →", "Saldo depois R$ 750,00"
it('caminho feliz: POST {receiverId: 2, amount: "250.00"}, mostra "Enviado." e atualiza o saldo', ...);
it('duplo clique envia uma vez só (RF2)', ...);                               // contador do handler === 1
it('autorização recusada: mensagem, saldo intacto, "Tentar de novo" reenvia e conclui', ...);
it('autorizador fora do ar (503) segue o mesmo caminho', ...);
it('resultado desconhecido (rede cai): sem botão de reenvio, link para o extrato, sem reenvio automático (RF2)', async () => {
  /* HttpResponse.error(); expect(screen.getByText(/Não deu para confirmar/)); expect(screen.queryByRole('button', { name: /tentar de novo|enviar de novo/i })).toBeNull();
     avance 5 s com timers falsos: o contador do POST continua em 1 */ });
it('500 também é resultado desconhecido', ...);
it('saldo insuficiente vindo do servidor volta ao passo do valor com a mensagem', ...);
it('401 no meio do envio leva a /entrar?next=%2Ftransferir (RF3)', ...);
```

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend test -- src/features/transfer/transfer.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implementar** a página e os passos conforme as interfaces, ligando `transferReducer` à API.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend test && npm --prefix frontend run build`. Expected: verdes.
- [ ] **Step 5: Commit e push.** `feat(front): tela de transferir com arco, busca e resultados`

---

### Task 11: Ponta a ponta do app (Playwright)

**Files:**
- Create: `frontend/playwright.config.ts`, `frontend/e2e/support/users.ts`, `frontend/e2e/support/stub.ts`, `frontend/e2e/app.spec.ts`, `frontend/e2e/failures.spec.ts`

**Interfaces:**
- Consumes: o jar (`mvn -B -ntp -DskipTests package`), o stub (`scripts/stub-externals.mjs`), as contas de demonstração.
- Produces:
  - `playwright.config.ts`: `testDir: 'e2e'`, `workers: 1` (o stub é estado global), `use: { baseURL: 'http://localhost:8080', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' }` (as datas do extrato ficam deterministas), projetos `desktop` (1440×900) e `phone` (390×844, `isMobile`, `hasTouch`) para todos os arquivos, mais `notebook` (1366×768) e `tablet` (768×1024) só para `showcase.spec.ts` (`testMatch`), e `webServer` com dois itens: `node ../scripts/stub-externals.mjs` (porta 9000) e `java -Dapp.seed.enabled=true -Dapp.jwt.cookie-secure=false -Dquarkus.rest-client.authorizer.url=http://localhost:9000 -Dquarkus.rest-client.notifier.url=http://localhost:9000 -jar ../target/quarkus-app/quarkus-run.jar` (URL de espera `http://localhost:8080/hello`), ambos com `reuseExistingServer: !process.env.CI`.
  - `users.ts`: `newUser(request, { type?: 'COMMON' | 'MERCHANT' })` cadastra pela API com e-mail e CPF/CNPJ válidos e únicos e devolve `{ email, password, document }`; `signIn(page, user)` loga pela API no contexto do navegador.
  - `stub.ts`: `setStub({ authorize?, notify? })`, `resetStub()`, `stubCalls()`.
  - `shot(page, name)`: grava `e2e/__screenshots__/<projeto>/<name>.png`.

- [ ] **Step 1: Escrever os testes que falham.**

```ts
// app.spec.ts
test('cadastro, envio, extrato e saída', async ({ page }) => {
  /* /criar-conta: preenche (Pessoa) e envia -> /carteira com "R$ 1.000,00"; "Enviar dinheiro" -> digita rafael@arco.demo -> escolhe "Rafael Costa"
     -> digita 250 -> "Continuar" -> vê "Saldo depois R$ 750,00" -> clica "Enviar R$ 250,00 para Rafael Costa" -> vê "Enviado."
     -> "Ver extrato": a primeira linha tem "Rafael Costa" e "−R$ 250,00"; /carteira mostra "R$ 750,00"; "Sair" -> /entrar;
     reabrir /carteira -> /entrar?next=%2Fcarteira; o stub recebeu 2 avisos (stubCalls().notify.length === 2 em até 3 s) */ });
test('login pela interface volta ao destino pedido', async ({ page, request }) => {
  /* newUser pela API; abrir /transferir sem sessão -> /entrar?next=%2Ftransferir; senha errada -> alerta "E-mail ou senha incorretos.";
     senha certa -> /transferir (RF3) */ });
test('lojista não envia', async ({ page }) => { /* signIn loja@arco.demo; /transferir mostra "Lojas recebem, não enviam." */ });
// failures.spec.ts (serial; o stub é global)
test('autorizador recusa: mensagem, saldo intacto e sucesso ao tentar de novo', ...);   // setStub deny -> texto "recusou"; grant -> "Tentar de novo" -> "Enviado."
test('autorizador fora do ar', ...);                                                    // down -> "fora do ar"
test('saldo insuficiente é barrado antes de enviar', ...);                               // 5000 -> "Saldo insuficiente para este valor."
test('sessão expira no meio do envio', ...);                                            // context.clearCookies() antes do clique -> /entrar?next=%2Ftransferir
test('resultado desconhecido: sem reenvio', ...);                                       // page.route('**/transaction', r => r.abort('failed')) -> "Não deu para confirmar", sem "Tentar de novo"
```

- [ ] **Step 2: Ver falhar.** Run: `mvn -B -ntp -DskipTests package && npm --prefix frontend run e2e -- app.spec.ts`. Expected: FAIL (telas ainda provisórias ou fluxo incompleto).
- [ ] **Step 3: Implementar** a configuração e os suportes; ajuste as telas das T7 a T10 só onde o e2e revelar diferença real do que os testes de componente não pegam. Cada divergência corrigida ganha antes um teste de componente que falha.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend run e2e`. Expected: todos verdes nos projetos `desktop` e `phone`.
- [ ] **Step 5: Capturas.** Os testes chamam `shot` nos estados: login, cadastro, carteira, transferir (3 passos), `Enviado.` e extrato. Run: `ls frontend/e2e/__screenshots__/desktop | wc -l`. Expected: ao menos 8 arquivos por projeto. Envie ao autor as capturas de `desktop` e `phone` (`SendUserFile`) para a revisão visual.
- [ ] **Step 6: Commit e push.** `test(front): ponta a ponta do app contra o Quarkus real e o stub`

---

### Task 12: Motor da vitrine (scroll, arco e carregamento sob demanda)

**Files:**
- Create: `frontend/src/showcase/{useScrollScenes.ts, ScrollArc.tsx, Scene.tsx, showcase.module.css, motion.ts}`
- Modify: `frontend/src/showcase/Showcase.tsx` (a página provisória vira o motor), `app/router.tsx` (rota `/` com `lazy`)
- Test: `frontend/src/showcase/motion.test.ts`, `frontend/e2e/showcase.spec.ts`

**Interfaces:**
- Produces:
  - `prefersReducedMotion(): boolean` (`matchMedia('(prefers-reduced-motion: reduce)')`).
  - `Scene({ id: 1 | 2 | 3 | 4 | 5 | 6; pinned?: boolean; children })`: um `<section data-scene={id} data-progress="0.000">`. O progresso (0 a 1, três casas) é atualizado pelo ScrollTrigger e espelhado na variável CSS `--p`.
  - `ScrollArc({ orientation: 'horizontal' | 'vertical' | 'auto', nodes?: number })`: SVG com `pathLength=1` cujo `stroke-dashoffset` é `calc(1 - var(--p))`; há dois caminhos (`.arc-h` e `.arc-v`), alternados por *media query* (< 768 px usa o vertical).
  - `useScrollScenes(root: RefObject<HTMLElement>)`: cria o Lenis (`lerp: 0.1`), registra o ScrollTrigger, liga `lenis.on('scroll', ScrollTrigger.update)` e `gsap.ticker`, e desfaz tudo na limpeza (`lenis.destroy()`, `ctx.revert()`). Com movimento reduzido, não cria Lenis nem *pins* e fixa `--p` em 1; só há *fades* por CSS.
  - O `Showcase` é carregado por `lazy(() => import('../showcase/Showcase'))`; o `Suspense` mostra só o `Wordmark` sobre `--bg`. **GSAP e Lenis só são importados dentro de `showcase/`.**

- [ ] **Step 1: Escrever os testes que falham.**

```ts
// showcase.spec.ts
test('a vitrine carrega GSAP e Lenis sob demanda', async ({ page }) => { /* coleta page.on('request'); em /carteira (logado) nenhuma requisição a /assets/Showcase-*.js; em / há exatamente o chunk Showcase */ });
test('o progresso das cenas avança com o scroll', async ({ page }) => { /* 6 elementos [data-scene]; em 0% todos os data-progress são 0.000; em 50% da altura, os progressos são monotônicos e dentro de [0,1] */ });
test('movimento reduzido: tudo legível, sem pins', async ({ browser }) => { /* reducedMotion: 'reduce'; locator('.pin-spacer') com count 0; os 6 títulos ficam visíveis ao rolar */ });   // RF5
test('o teclado alcança o CTA sem armadilha', async ({ page }) => { /* Tab até achar "Abrir minha carteira" em no máximo 40 Tabs; Enter -> /criar-conta */ });
test('sem erros de console em desktop e celular', ...);
// motion.test.ts
it('prefersReducedMotion lê o media query', ...);
```

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend run build && mvn -B -ntp -DskipTests package && npm --prefix frontend run e2e -- showcase.spec.ts`. Expected: FAIL (a vitrine provisória não tem cenas nem chunk separado).
- [ ] **Step 3: Implementar** o motor conforme as interfaces. Anime só `transform`, `opacity` e a variável `--p`.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend test && npm --prefix frontend run e2e -- showcase.spec.ts`. Expected: verdes. Os testes de "6 cenas" podem usar cenas vazias com `data-scene`; o conteúdo vem na T13.
- [ ] **Step 5: Commit e push.** `feat(front): motor da vitrine com Lenis, ScrollTrigger e o arco por CSS`

---

### Task 13: As seis cenas da vitrine

**Files:**
- Create: `frontend/src/showcase/copy.ts`, `showcase/scenes/{Impact,Context,Proposal,Details,Climax,Conversion}.tsx` (+ `.module.css`)
- Modify: `frontend/src/showcase/Showcase.tsx`
- Test: `frontend/e2e/showcase.spec.ts` (acrescenta casos)

**Interfaces:**
- Consumes: `Scene`, `ScrollArc`, `WalletBalance` (T8), `formatBRL`, `centsToApi`, `Button`/`ButtonLink`, `useSession`.
- Texto (todo em `copy.ts`), composição desktop / celular:
  - **01 Impacto.** Tela cheia; título em duas linhas, `Entre duas pessoas,` / `um instante.`, em `--fs-display-xl` peso 200, alinhado à esquerda; o arco se desenha uma vez, por tempo, ao carregar. Topo: `arco` à esquerda e `Entrar` à direita (para quem está logado, `Carteira`). Base: `Role` em micro, com uma linha de 1 px.
  - **02 Contexto (fixa).** Rótulo `Cada transferência`, título `passa por quatro decisões.`. Quatro nós no arco (horizontal em tela larga, vertical no celular), cada um acende quando o arco passa: `01 Quem envia?` / `Pessoas enviam. Lojas recebem.`; `02 Há saldo?` / `Sem saldo, nada acontece.`; `03 Alguém autoriza?` / `Um serviço externo aprova ou recusa.`; `04 Os dois sabem?` / `Quem envia e quem recebe são avisados.`
  - **03 Proposta (fixa).** Rótulo `A carteira` e a frase `Débito, crédito e registro acontecem juntos, ou não acontecem.`. O componente real `WalletBalance` com dados fixos (`Marina Alves`, `1000.00`). O arco vai de `Marina` a `Rafael`; entre 55% e 90% do progresso o saldo cai de `R$ 1.000,00` para `R$ 750,00`, interpolando **centavos inteiros em `bigint`**; acima de 90% entra a linha `Rafael Costa −R$ 250,00`.
  - **04 Detalhes.** Três linhas separadas por hairlines, cada uma revelada por `opacity` e `transform` ao entrar: `Uma transação. Débito, crédito e registro juntos.`, `Dois avisos. Para quem envia e para quem recebe.`, `Uma regra. Lojistas recebem. Não enviam.`
  - **05 Clímax.** O arco termina; a palavra `Enviado.` em `--fs-display-xl`, e abaixo `De uma mão para outra.`
  - **06 Conversão.** Título `Sua vez.`; CTA principal grande `Abrir minha carteira →` (para `/criar-conta`; para quem está logado, `/carteira`); abaixo, o link discreto `Já tenho conta` (`/entrar`; oculto se logado); rodapé em micro com `Implementação do desafio PicPay Simplificado, com Quarkus e React`.

- [ ] **Step 1: Escrever os testes que falham.**

```ts
test('cena 3: o saldo cai de R$ 1.000,00 para R$ 750,00 conforme o scroll', async ({ page }) => {
  /* rola ao começo da cena 3 -> o [data-testid=wallet-balance] mostra "R$ 1.000,00"; ao fim -> "R$ 750,00";
     em 8 pontos intermediários, o valor em centavos é monotônico não crescente e fica entre 75000 e 100000 */ });
test('CTA e links levam aonde dizem', ...);                       // "Abrir minha carteira" -> /criar-conta; "Já tenho conta" -> /entrar; topo "Entrar" -> /entrar
test('logado, o CTA vai para /carteira e o topo mostra "Carteira"', ...);
test('o rodapé traz o crédito do desafio com o texto exato', ...);
test('as quatro decisões da cena 2 aparecem com o texto da spec', ...);
test('celular: a cena 2 usa o arco vertical e a página não rola na horizontal', async ({ page }) => { /* project phone: .arc-v visível, .arc-h oculto; document.documentElement.scrollWidth <= window.innerWidth */ });
test('cenas fixadas (2 e 3) cabem na altura da janela em notebook, tablet e celular', ...);   // boundingBox().height <= window.innerHeight; nada cortado
test('movimento reduzido mostra o saldo final da cena 3 sem animação', ...);
```

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend run build && mvn -B -ntp -DskipTests package && npm --prefix frontend run e2e -- showcase.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** as seis cenas e o `copy.ts` conforme as interfaces; o texto não pode ficar espalhado pelos componentes.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend test && npm --prefix frontend run e2e -- showcase.spec.ts`. Expected: verdes.
- [ ] **Step 5: Capturas.** Salve com `shot` cada cena em `desktop`, `notebook`, `tablet` e `phone`. Envie ao autor as capturas das cenas 1, 3, 5 e 6 em `desktop` e `phone` (`SendUserFile`) para a revisão visual.
- [ ] **Step 6: Commit e push.** `feat(front): as seis cenas da vitrine`

---

### Task 14: Qualidade (acessibilidade, largura, console e orçamento do bundle)

**Files:**
- Create: `frontend/e2e/quality.spec.ts`, `frontend/e2e/support/axe.ts`, `frontend/scripts/check-bundle.mjs`

**Interfaces:**
- Produces:
  - `check-bundle.mjs`: lê `dist/assets`, comprime cada `.js` com gzip, identifica o *chunk* de entrada (o referenciado em `index.html`) e o da vitrine (nome começando em `Showcase`). Falha com código 1 se o de entrada passar de **170 kB gzip**, se o da vitrine passar de **70 kB gzip**, ou se o de entrada contiver `gsap` ou `ScrollTrigger`. Imprime os tamanhos.
  - `axe.ts`: `expectNoA11yViolations(page)` com `AxeBuilder` e as tags `wcag2a`, `wcag2aa`, `wcag21aa`.

- [ ] **Step 1: Escrever os testes que falham.**

```ts
test.describe('acessibilidade (axe)', () => { for (const route of ['/', '/entrar', '/criar-conta']) test(`público ${route}`, ...);
  for (const route of ['/carteira', '/transferir', '/extrato']) test(`logado ${route}`, ...);
  test('transferir nos 3 passos', ...); test('vitrine com movimento reduzido', ...); });
test('nenhuma rota rola na horizontal a 320 px (RF5)', async ({ page }) => { /* viewport 320x568; para cada rota: scrollWidth <= 320 */ });
test('sem erros de console nem exceções durante a jornada completa', ...);
test('as fontes Geist carregam da própria origem e nada externo é requisitado', async ({ page }) => {
  /* após `await document.fonts.ready`, em /carteira: alguma FontFace com família "Geist Variable" e outra com "Geist Mono Variable" têm status === 'loaded'
     (`document.fonts.check` não serve: devolve true para família que nem foi declarada); todas as origens das requisições === 'http://localhost:8080' */ });
```

- [ ] **Step 2: Ver falhar.** Run: `npm --prefix frontend run e2e -- quality.spec.ts`. Expected: FAIL onde houver violação real; corrija o componente, não o teste, e cada correção ganha antes um teste de componente quando for lógica.
- [ ] **Step 3: Corrigir** as violações achadas (contraste, rótulos, ordem de foco, estouro de largura) e escrever o `check-bundle.mjs`.
- [ ] **Step 4: Ver passar.** Run: `npm --prefix frontend run build && npm --prefix frontend run check:bundle && npm --prefix frontend run e2e`. Expected: `check:bundle` imprime os tamanhos dentro do orçamento e sai com 0; o e2e inteiro verde.
- [ ] **Step 5: Commit e push.** `test(front): acessibilidade, largura mínima e orçamento do bundle`

---

### Task 15: Fechamento do front

**Files:**
- Modify: `README.md` (stack, como rodar o front em desenvolvimento e empacotado, testes do front, estrutura de diretórios, roadmap e limitações do front)

**Interfaces:**
- Consumes: tudo acima.

- [ ] **Step 1: Atualizar o README.** Inclua: o front servido pelo Quarkus na mesma origem; `./mvnw quarkus:dev` (Quinoa sobe o Vite) e `npm run dev` com *proxy*; `-Dquarkus.quinoa.enabled=false` para compilar só o back-end; `npm run gen:api` quando o contrato mudar; os scripts de teste (`npm test`, `npm run e2e`, `npm run check:bundle`) e o pré-requisito do e2e; o mapa de rotas; as limitações (a sessão cai em 1 hora, sem idempotência no envio e o motivo do aviso de resultado desconhecido). Atualize a árvore de diretórios. Run: `grep -nE "frontend/|npm run|Quinoa" README.md | wc -l`. Expected: mais de 10 ocorrências.
- [ ] **Step 2: Rodar tudo junto.**

```bash
mvn -B -ntp verify -DskipITs=false                   # Quinoa constrói o front; testes do back-end (os 99 do Plano A e os da T4) + SpaServingIT + GreetingResourceIT
npm --prefix frontend run typecheck && npm --prefix frontend test && npm --prefix frontend run check:api
npm --prefix frontend run build && npm --prefix frontend run check:bundle
npm --prefix frontend run e2e                        # app, falhas e qualidade em desktop e phone; a vitrine também em notebook e tablet
```

O smoke do Plano A também deve continuar verde: suba o stub e o jar como no cabeçalho de `scripts/smoke-api.mjs`, rode `node scripts/smoke-api.mjs` (termina com `SMOKE OK`) e encerre os dois pelos PIDs das portas 9000 e 8080.

Expected: tudo verde, sem sobras de processo (`ps -eo comm | grep -c '^java$'` = 0).
- [ ] **Step 3: Modo de desenvolvimento.** Run: `mvn -B -ntp quarkus:dev -Dquarkus.analytics.disabled=true > /tmp/arco-dev.log 2>&1 &`, espere `http://localhost:8080/hello` responder e confira `curl -s localhost:8080/carteira`, `curl -s localhost:8080/hello` e `curl -si localhost:8080/users/me`. Expected: o primeiro traz `@vite/client` e `<div id="root">` (o Quinoa serve o `index.html` do Vite com o *fallback* da SPA), o segundo `Hello from Quarkus REST`, o terceiro `401`. Encerre pelos PIDs das portas (`lsof -tiTCP:8080 -sTCP:LISTEN`, `lsof -tiTCP:5173 -sTCP:LISTEN`), nunca com `pkill -f`. Se o Vite não subir neste ambiente, registre como "não exercitado" no relatório.
- [ ] **Step 4: Revisão final.** Leia o diff do front e as anotações da T4 (`git diff --stat <commit do plano B>..HEAD`) contra a spec e o Review Focus. Sonde o app empacotado com entradas hostis: `next=//evil.com` e `next=/\evil.com`, valores `1e3`, `0,001` e `٣`, CPF com letras, três cliques rápidos em "Enviar", apagar o cookie com o formulário aberto. Cada falha achada ganha primeiro um teste que falha.
- [ ] **Step 5: Commit e push.** `docs(front): README do front-end e verificação final`
- [ ] **Step 6: Relatório.** Informe ao autor a contagem de testes (Vitest, Playwright, JUnit) e os tamanhos do bundle. Diga o que **não** foi exercitado aqui: Safari e Firefox (só Chromium), o `util.devi.tools` real, a compilação nativa e, se for o caso, o modo de desenvolvimento.
