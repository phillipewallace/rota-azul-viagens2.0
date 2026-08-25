#!/usr/bin/env node
/**
 * Cria/atualiza o usuário `demo` (senha `demo1234`) — role 'demo'.
 * Idempotente: se já existir, apenas garante ativo=true e senha atualizada.
 *
 * Uso: node backend/scripts/ensure-demo-user.js
 *
 * IMPORTANTE: este é um login de demonstração. A role 'demo' é sempre
 * isolada em sandbox e não pode consultar/gravar dados reais.
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const USERNAME = 'demo';
const PASSWORD = 'demo1234';
const NAME = 'Usuário Demo';
const ROLE = 'demo';

(async () => {
  const pool = new Pool({
    host: process.env.DB_HOST || process.env.PGHOST,
    port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
    user: process.env.DB_USER || process.env.PGUSER,
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
    database: process.env.DB_NAME || process.env.PGDATABASE,
  });

  try {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [USERNAME]);

    if (existing.rows.length) {
      await pool.query(
        `UPDATE users SET password = $1, active = true, role = $2, name = COALESCE(name, $3), updated_at = CURRENT_TIMESTAMP WHERE username = $4`,
        [hash, ROLE, NAME, USERNAME]
      );
      console.log(`[demo-user] atualizado: ${USERNAME} / ${PASSWORD}`);
    } else {
      await pool.query(
        `INSERT INTO users (username, password, name, role, active) VALUES ($1, $2, $3, $4, true)`,
        [USERNAME, hash, NAME, ROLE]
      );
      console.log(`[demo-user] criado: ${USERNAME} / ${PASSWORD}`);
    }
  } catch (e) {
    console.error('[demo-user] erro:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
