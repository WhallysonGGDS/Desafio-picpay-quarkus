// Gerado por scripts/gen-api.mjs a partir do OpenAPI do back-end. Não edite: rode "npm run gen:api".

export interface paths {
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["RequestLogin"];
                };
            };
            responses: {
                /** @description Credenciais válidas; a sessão está iniciada (cookie) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ResponseUser"];
                    };
                };
                /** @description VALIDATION_ERROR, com fieldErrors */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponseDTO"];
                    };
                };
                /** @description INVALID_CREDENTIALS (e-mail desconhecido e senha errada respondem igual) */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponseDTO"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Sessão encerrada; o cookie é expirado */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["RequestRegister"];
                };
            };
            responses: {
                /** @description Conta criada; a sessão já está iniciada (cookie) */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ResponseUser"];
                    };
                };
                /** @description VALIDATION_ERROR, com fieldErrors */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponseDTO"];
                    };
                };
                /** @description DUPLICATE_EMAIL ou DUPLICATE_DOCUMENT */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponseDTO"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/hello": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": string;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/transaction": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    direction?: string;
                    page?: number;
                    size?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ResponsePageResponseTransaction"];
                    };
                };
                /** @description Not Authorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Not Allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["RequestTransaction"];
                };
            };
            responses: {
                /** @description Transferência feita; os avisos às duas pontas saem em seguida */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ResponseTransaction"];
                    };
                };
                /** @description VALIDATION_ERROR (valor ou destinatário inválidos) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponseDTO"];
                    };
                };
                /** @description UNAUTHENTICATED (sem sessão ou sessão vencida) */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponseDTO"];
                    };
                };
                /** @description MERCHANT_CANNOT_SEND (lojista não envia) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponseDTO"];
                    };
                };
                /** @description USER_NOT_FOUND (destinatário não existe) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponseDTO"];
                    };
                };
                /** @description INSUFFICIENT_BALANCE, SELF_TRANSFER ou AUTHORIZATION_DENIED */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponseDTO"];
                    };
                };
                /** @description AUTHORIZER_UNAVAILABLE (nada foi gravado) */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponseDTO"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ResponseUser"];
                    };
                };
                /** @description Not Authorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Not Allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query: {
                    q: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ResponseUserSummary"][];
                    };
                };
                /** @description Not Authorized */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Not Allowed */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @enum {string} */
        Direction: "SENT" | "RECEIVED";
        ErrorResponseDTO: {
            /** Format: int32 */
            statusCode: number;
            code: string;
            message: string;
            fieldErrors?: components["schemas"]["FieldError"][];
        };
        FieldError: {
            field: string;
            code: string;
        };
        /**
         * Format: date-time
         * @example 2022-03-10T16:15:50Z
         */
        Instant: string;
        /** @enum {string} */
        NotificationStatus: "PENDING" | "SENT" | "FAILED";
        Party: {
            /** Format: int64 */
            id: number;
            name: string;
        };
        RequestLogin: {
            email: string;
            password: string;
        };
        RequestRegister: {
            firstName: string;
            lastName: string;
            document: string;
            email: string;
            password: string;
            userType: components["schemas"]["UserType"];
        };
        RequestTransaction: {
            /** Format: int64 */
            receiverId: number;
            /** @example 250.00 */
            amount: string;
        };
        ResponsePageResponseTransaction: {
            items: components["schemas"]["ResponseTransaction"][];
            /** Format: int32 */
            page: number;
            /** Format: int32 */
            size: number;
            /** Format: int64 */
            total: number;
        };
        ResponseTransaction: {
            /** Format: int64 */
            id: number;
            /** @example 250.00 */
            amount: string;
            sender: components["schemas"]["Party"];
            receiver: components["schemas"]["Party"];
            notifySender: components["schemas"]["NotificationStatus"];
            notifyReceiver: components["schemas"]["NotificationStatus"];
            timestamp: components["schemas"]["Instant"];
            direction: components["schemas"]["Direction"];
        };
        ResponseUser: {
            /** Format: int64 */
            id: number;
            firstName: string;
            lastName: string;
            document: string;
            email: string;
            /** @example 1000.00 */
            balance: string;
            userType: components["schemas"]["UserType"];
        };
        ResponseUserSummary: {
            /** Format: int64 */
            id: number;
            firstName: string;
            lastName: string;
            userType: components["schemas"]["UserType"];
            maskedDocument: string;
        };
        /** @enum {string} */
        UserType: "COMMON" | "MERCHANT";
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
