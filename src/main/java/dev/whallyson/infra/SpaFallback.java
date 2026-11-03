package dev.whallyson.infra;

import io.quarkus.arc.profile.UnlessBuildProfile;
import io.quarkus.arc.properties.UnlessBuildProperty;
import io.quarkus.vertx.http.runtime.filters.Filters;
import io.vertx.core.http.HttpHeaders;
import io.vertx.core.http.HttpMethod;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.List;

// Fallback das rotas do front (SPA), em produção e em dev: quem abre ou atualiza /carteira num navegador recebe o
// index.html, que o Quinoa serve na raiz, e o roteador do React decide a tela.
//
// Por que não o fallback do próprio Quinoa (quarkus.quinoa.enable-spa-routing): quando nenhum recurso REST casa
// com o caminho, o Quarkus REST só repassa o pedido adiante se NÃO existir ExceptionMapper aplicável a
// NotFoundException. O GlobalExceptionHandler (JSON de erro para tudo) é um, então o REST responde o 404 sozinho
// e o handler do Quinoa nunca roda. Este filtro roda antes do REST e reescreve o pedido para "/".
//
// Só reescreve navegação de verdade: GET/HEAD com Accept text/html, caminho sem extensão de arquivo e fora dos
// prefixos da API. Cliente da API que erra a URL continua recebendo o JSON de erro, e arquivo ausente continua 404.
// Em dev a raiz é o proxy do Quinoa para o Vite, que devolve o index.html (com o cliente de recarga ao vivo); sem este
// filtro, atualizar a página em /carteira dava 404 também em dev. Nos testes o Quinoa fica desligado e o filtro não existe.
@ApplicationScoped
@UnlessBuildProfile("test")
@UnlessBuildProperty(name = "quarkus.quinoa", stringValue = "false", enableIfMissing = true)
public class SpaFallback {

    private static final int PRIORITY = 100;

    private final List<String> apiPrefixes;

    // A mesma lista que o Quinoa usa para não tocar na API: uma só fonte da verdade.
    SpaFallback(@ConfigProperty(name = "quarkus.quinoa.ignored-path-prefixes", defaultValue = "") List<String> apiPrefixes) {
        this.apiPrefixes = apiPrefixes;
    }

    void register(@Observes Filters filters) {
        filters.register(this::handle, PRIORITY);
    }

    private void handle(RoutingContext routing) {
        if (isNavigationToClientRoute(routing)) {
            routing.reroute("/");
        } else {
            routing.next();
        }
    }

    private boolean isNavigationToClientRoute(RoutingContext routing) {
        HttpMethod method = routing.request().method();
        if (!HttpMethod.GET.equals(method) && !HttpMethod.HEAD.equals(method)) {
            return false;
        }
        String path = routing.normalizedPath();
        if ("/".equals(path) || hasFileExtension(path) || isApi(path)) {
            return false;
        }
        String accept = routing.request().getHeader(HttpHeaders.ACCEPT);
        return accept != null && accept.contains("text/html");
    }

    private boolean isApi(String path) {
        return apiPrefixes.stream().anyMatch(prefix -> path.equals(prefix) || path.startsWith(prefix + "/"));
    }

    private static boolean hasFileExtension(String path) {
        return path.substring(path.lastIndexOf('/') + 1).contains(".");
    }
}
