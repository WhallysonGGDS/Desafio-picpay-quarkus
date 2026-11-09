#!/usr/bin/env node
// Stub local dos serviços externos do Arco (autorizador e notificador).
// Substitui o util.devi.tools em desenvolvimento, nos smoke tests e nos testes ponta a ponta.
//
//   GET  /api/v2/authorize   modos: grant (padrão) | deny | down
//   POST /api/v1/notify      modos: ok (padrão) | fail
//   POST /__mode             troca os modos: {"authorize": "...", "notify": "..."} (campos opcionais)
//   GET  /__calls            {"authorize": <n>, "notify": [<corpos recebidos>]}
//   POST /__reset            zera as chamadas e volta aos modos padrão
//
// Porta: STUB_PORT (padrão 9000). O corpo é lido como JSON, qualquer que seja o Content-Type.
import http from 'node:http';

const PORT = Number(process.env.STUB_PORT ?? 9000);
const DEFAULT_MODES = { authorize: 'grant', notify: 'ok' };
const VALID_MODES = { authorize: ['grant', 'deny', 'down'], notify: ['ok', 'fail'] };

let modes = { ...DEFAULT_MODES };
let calls = { authorize: 0, notify: [] };

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.trim() === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

async function handleMode(req, res) {
  const body = await readBody(req);
  for (const [key, allowed] of Object.entries(VALID_MODES)) {
    if (body?.[key] !== undefined && !allowed.includes(body[key])) {
      return send(res, 400, { status: 'error', message: `${key} deve ser um de: ${allowed.join(', ')}` });
    }
  }
  modes = { ...modes, ...Object.fromEntries(Object.keys(VALID_MODES).filter((k) => body?.[k] !== undefined).map((k) => [k, body[k]])) };
  return send(res, 200, modes);
}

const server = http.createServer(async (req, res) => {
  const route = `${req.method} ${new URL(req.url, 'http://localhost').pathname}`;
  switch (route) {
    case 'GET /api/v2/authorize':
      calls.authorize += 1;
      if (modes.authorize === 'down') return void req.socket.destroy();
      if (modes.authorize === 'deny') return send(res, 403, { status: 'fail', data: { authorization: false } });
      return send(res, 200, { status: 'success', data: { authorization: true } });
    case 'POST /api/v1/notify':
      calls.notify.push(await readBody(req));
      return modes.notify === 'fail' ? send(res, 503, { status: 'error' }) : send(res, 204);
    case 'POST /__mode':
      return handleMode(req, res);
    case 'GET /__calls':
      return send(res, 200, calls);
    case 'POST /__reset':
      modes = { ...DEFAULT_MODES };
      calls = { authorize: 0, notify: [] };
      return send(res, 204);
    default:
      return send(res, 404, { status: 'error', message: 'rota desconhecida' });
  }
});

server.listen(PORT, () => console.log(`stub dos serviços externos em http://localhost:${PORT}`));
