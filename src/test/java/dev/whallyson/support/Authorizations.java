package dev.whallyson.support;

import dev.whallyson.dtos.responses.ResponseAuthorizationTransaction;

/** Respostas do autorizador externo com a mesma estrutura completa da API real. */
public final class Authorizations {

    private Authorizations() {}

    /** {"status":"success","data":{"authorization":true}} */
    public static ResponseAuthorizationTransaction granted() {
        return build("success", true);
    }

    /** {"status":"fail","data":{"authorization":false}} */
    public static ResponseAuthorizationTransaction denied() {
        return build("fail", false);
    }

    private static ResponseAuthorizationTransaction build(String status, boolean authorization) {
        ResponseAuthorizationTransaction response = new ResponseAuthorizationTransaction();
        response.status = status;
        response.data = new ResponseAuthorizationTransaction.Data();
        response.data.authorization = authorization;
        return response;
    }
}
