package dev.whallyson.dtos;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MoneySerializerTest {

    record Wrapper(@JsonSerialize(using = MoneySerializer.class) BigDecimal v) {}

    // Quebra se: o dinheiro voltar a sair como número JSON, em notação científica ou com menos de 2 casas.
    @Test
    void alwaysTwoPlainDecimals_asJsonString() throws Exception {
        var mapper = new ObjectMapper();
        assertEquals("{\"v\":\"1000.00\"}", mapper.writeValueAsString(new Wrapper(new BigDecimal("1E+3"))));
        assertEquals("{\"v\":\"250.50\"}", mapper.writeValueAsString(new Wrapper(new BigDecimal("250.5"))));
        assertEquals("{\"v\":\"0.00\"}", mapper.writeValueAsString(new Wrapper(BigDecimal.ZERO)));
    }
}
