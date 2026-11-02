package dev.whallyson.dtos.responses;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

import java.util.List;

// Uma página de resultados: os itens, qual página e tamanho foram pedidos, e o total de itens em todas as páginas.
// A obrigatoriedade vai por componente: com @Schema também no tipo genérico, o gerador do OpenAPI repete cada
// item em required e cria um schema solto "ResponsePage" (items: {}) ao lado do ResponsePageResponseTransaction.
public record ResponsePage<T>(
        @Schema(required = true) List<T> items,
        @Schema(required = true) int page,
        @Schema(required = true) int size,
        @Schema(required = true) long total) {}
