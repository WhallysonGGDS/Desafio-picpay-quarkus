// Roda uma vez, no processo principal do Vitest, antes dos workers: o fuso vale para todos os testes e
// não depende da máquina de quem roda. (`test.env.TZ` só vale no pool `forks`; no `threads` a data sai em UTC.)
export default function setup(): void {
  process.env.TZ = 'America/Sao_Paulo';
}
