// O stub dos serviços externos (scripts/stub-externals.mjs) é estado global do processo: os testes o configuram e o
// consultam por aqui, e cada spec o zera antes de começar.
const STUB = process.env.STUB_URL ?? 'http://localhost:9000';

export interface StubModes {
  /** `deny`: o autorizador recusa (403). `down`: derruba a conexão (o back-end vê o autorizador fora do ar). */
  authorize?: 'grant' | 'deny' | 'down';
  /** `fail`: o notificador responde 503. */
  notify?: 'ok' | 'fail';
}

export interface StubCalls {
  authorize: number;
  notify: unknown[];
}

async function call(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${STUB}${path}`, init);
  if (!response.ok) throw new Error(`stub ${init?.method ?? 'GET'} ${path} respondeu ${response.status}`);
  return response;
}

export async function setStub(modes: StubModes): Promise<void> {
  await call('/__mode', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(modes) });
}

/** Volta aos modos padrão (autoriza, notifica) e zera as chamadas contadas. */
export async function resetStub(): Promise<void> {
  await call('/__reset', { method: 'POST' });
}

export async function stubCalls(): Promise<StubCalls> {
  return (await call('/__calls')).json() as Promise<StubCalls>;
}
