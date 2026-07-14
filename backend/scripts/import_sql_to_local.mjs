#!/usr/bin/env node
// Importa um arquivo SQL gerado pelo export (INSERTs com ON CONFLICT)
// Aplica no Postgres local usando credenciais de .env.local ou env padrão

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: path.resolve('.env.local') });

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

const INPUT = process.env.INPUT_FILE || getArg('--in') || 'data_export.sql';
const ENFORCE_UNIQUE = process.argv.includes('--unique-pasta') || String(process.env.UNIQUE_PASTA || '').toLowerCase() === 'true';

const DB = {
  host: process.env.LOCAL_DB_HOST || process.env.VITE_LOCAL_DB_HOST || 'localhost',
  port: parseInt(process.env.LOCAL_DB_PORT || process.env.VITE_LOCAL_DB_PORT || '5432', 10),
  database: process.env.LOCAL_DB_NAME || process.env.VITE_LOCAL_DB_NAME || 'cantina_verde',
  user: process.env.LOCAL_DB_USER || process.env.VITE_LOCAL_DB_USER || 'cantina_user',
  password: process.env.LOCAL_DB_PASSWORD || process.env.VITE_LOCAL_DB_PASSWORD || 'cantina_password',
};

function readStatements(sqlText) {
  // Remove comentários de linha e normaliza quebras
  const cleaned = sqlText
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  // Divide por ponto e vírgula preservando a estrutura
  return cleaned
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const sqlPath = path.resolve(INPUT);
  if (!fs.existsSync(sqlPath)) {
    console.error(`Arquivo não encontrado: ${sqlPath}`);
    process.exit(1);
  }
  const sqlText = fs.readFileSync(sqlPath, 'utf8');
  const statements = readStatements(sqlText);
  console.log(`Lendo ${statements.length} statements de ${INPUT}`);

  const client = new Client(DB);
  await client.connect();
  try {
    await client.query('BEGIN');
    // Opcional: índice único de numero_pasta quando houver
    if (ENFORCE_UNIQUE) {
      await client.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS alunos_numero_pasta_unique
         ON public.alunos (numero_pasta)
         WHERE numero_pasta IS NOT NULL;`
      );
    }
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await client.query(stmt);
      } catch (e) {
        console.error(`Erro ao executar statement #${i + 1}: ${e.message}`);
        console.error('Statement falho:\n', stmt);
        throw e;
      }
    }
    await client.query('COMMIT');
    console.log('Importação concluída com sucesso.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Importação abortada por erro. Mudanças revertidas.');
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
