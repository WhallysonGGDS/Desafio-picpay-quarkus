package dev.whallyson.infra;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.jackson.ObjectMapperCustomizer;
import jakarta.inject.Singleton;

// Configuração do Jackson da aplicação.
// Por padrão o Jackson aceita fração onde se espera um inteiro e trunca em silêncio ("receiverId": 2.9 viraria 2).
// Numa API que move dinheiro, um id malformado tem de ser recusado (400), não interpretado como outra conta.
// Pelo mesmo motivo uma chave repetida no corpo ({"amount":"1.00","amount":"400.00"}) é erro: sem isto o Jackson caía num erro de
// definição do record e a API respondia 500 com corpo vazio, e noutras configurações o último valor ganharia em silêncio.
@Singleton
public class JacksonConfig implements ObjectMapperCustomizer {

    @Override
    @SuppressWarnings("deprecation") // o Jackson 2.x ainda liga este recurso pelo JsonParser.Feature em um ObjectMapper pronto
    public void customize(ObjectMapper objectMapper) {
        objectMapper.disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT);
        objectMapper.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
    }
}
