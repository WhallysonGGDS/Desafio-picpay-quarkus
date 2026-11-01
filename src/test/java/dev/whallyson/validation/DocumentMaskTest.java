package dev.whallyson.validation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DocumentMaskTest {

    @Test
    void masksCpf() {
        assertEquals("***.982.247-**", DocumentMask.mask("52998224725"));
    }

    @Test
    void masksCnpj() {
        assertEquals("**.222.333/****-**", DocumentMask.mask("11222333000181"));
    }

    // Um documento de tamanho desconhecido não pode vazar nenhum dígito.
    @Test
    void masksOtherLengthsFully() {
        assertEquals("***", DocumentMask.mask("123"));
    }
}
