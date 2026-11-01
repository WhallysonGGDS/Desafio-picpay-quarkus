package dev.whallyson.infra;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.jackson.ObjectMapperCustomizer;
import jakarta.inject.Singleton;

// Configuração do Jackson da aplicação.
// Por padrão o Jackson aceita fração onde se espera um inteiro e trunca em silêncio ("receiverId": 2.9 viraria 2).
// Numa API que move dinheiro, um id malformado tem de ser recusado (400), não interpretado como outra conta.
@Singleton
public class JacksonConfig implements ObjectMapperCustomizer {

    @Override
    public void customize(ObjectMapper objectMapper) {
        objectMapper.disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT);
    }
}
