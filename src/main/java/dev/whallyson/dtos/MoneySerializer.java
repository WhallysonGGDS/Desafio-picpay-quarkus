package dev.whallyson.dtos;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;

import java.io.IOException;
import java.math.BigDecimal;

// Dinheiro sai sempre como string com duas casas e sem notação científica ("1250.00"), nunca como número JSON:
// o JavaScript lê número como ponto flutuante e não pode somar dinheiro com ele.
public class MoneySerializer extends JsonSerializer<BigDecimal> {

    @Override
    public void serialize(BigDecimal value, JsonGenerator generator, SerializerProvider serializers) throws IOException {
        generator.writeString(value.setScale(2).toPlainString());
    }
}
