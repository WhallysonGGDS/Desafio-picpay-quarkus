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

    // Quebra se: as letras do meio do CNPJ alfanumérico forem tratadas como "dígitos a esconder" de outro jeito (ou o tamanho 14 deixar
    // de bastar para reconhecer um CNPJ): a máscara mostra os mesmos seis caracteres do meio, sejam letras ou números.
    @Test
    void masksAlphanumericCnpj() {
        assertEquals("**.ABC.345/****-**", DocumentMask.mask("12ABC34501DE35"));
    }

    // Um documento de tamanho desconhecido não pode vazar nenhum dígito.
    @Test
    void masksOtherLengthsFully() {
        assertEquals("***", DocumentMask.mask("123"));
    }
}
