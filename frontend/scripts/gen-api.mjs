#!/usr/bin/env node
// Gera src/api/schema.d.ts a partir do OpenAPI que o back-end exporta (mvn package grava target/openapi/openapi.json).
//
//   npm run gen:api     grava o arquivo
//   npm run check:api   não grava: sai com código 1 se o arquivo versionado estiver desatualizado em relação ao contrato
//
// OPENAPI_FILE troca o arquivo de entrada.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(process.env.OPENAPI_FILE ?? resolve(here, '../../target/openapi/openapi.json'));
const target = resolve(here, '../src/api/schema.d.ts');
const check = process.argv.includes('--check');

if (!existsSync(source)) {
  console.error(`OpenAPI não encontrado em ${source}. Rode "mvn -B -ntp -DskipTests package" antes.`);
  process.exit(2);
}

const header = '// Gerado por scripts/gen-api.mjs a partir do OpenAPI do back-end. Não edite: rode "npm run gen:api".\n\n';
const generated = header + astToString(await openapiTS(pathToFileURL(source)));

if (check) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== generated) {
    console.error('src/api/schema.d.ts está desatualizado em relação ao contrato do back-end. Rode "npm run gen:api" e commite.');
    process.exit(1);
  }
  console.log('src/api/schema.d.ts está em dia com o contrato.');
} else {
  writeFileSync(target, generated);
  console.log(`src/api/schema.d.ts gerado a partir de ${source}`);
}
