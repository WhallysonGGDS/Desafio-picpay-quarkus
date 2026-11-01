package dev.whallyson.validation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocumentValidatorTest {

    @Test
    void digitsOnly_stripsPunctuation_andHandlesNull() {
        assertEquals("52998224725", DocumentValidator.digitsOnly("529.982.247-25"));
        assertEquals("11222333000181", DocumentValidator.digitsOnly("11.222.333/0001-81"));
        assertEquals("", DocumentValidator.digitsOnly(null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"52998224725", "11144477735"})
    void validCpf(String cpf) {
        assertTrue(DocumentValidator.isValidCpf(cpf));
    }

    // "11111111111" passa na conta dos dígitos verificadores; só a regra de dígitos repetidos o rejeita.
    @ParameterizedTest
    @ValueSource(strings = {"52998224724", "11111111111", "123", "", "529982247250", "5299822472a", "abcdefghijk"})
    void invalidCpf(String cpf) {
        assertFalse(DocumentValidator.isValidCpf(cpf));
    }

    @Test
    void validCnpj() {
        assertTrue(DocumentValidator.isValidCnpj("11222333000181"));
    }

    // "00000000000000" também passa na conta dos dígitos verificadores.
    @ParameterizedTest
    @ValueSource(strings = {"11222333000182", "00000000000000", "1122233300018", "", "1122233300018a"})
    void invalidCnpj(String cnpj) {
        assertFalse(DocumentValidator.isValidCnpj(cnpj));
    }
}
