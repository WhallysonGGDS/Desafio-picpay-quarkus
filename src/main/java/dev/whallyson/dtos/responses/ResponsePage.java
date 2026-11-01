package dev.whallyson.dtos.responses;

import java.util.List;

// Uma página de resultados: os itens, qual página e tamanho foram pedidos, e o total de itens em todas as páginas.
public record ResponsePage<T>(List<T> items, int page, int size, long total) {}
