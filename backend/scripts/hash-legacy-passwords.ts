/**
 * Migração one-shot: converte senhas em texto plano para bcrypt.
 * Uso: cd backend && npx ts-node scripts/hash-legacy-passwords.ts
 */
import bcrypt from 'bcrypt';
import { pool } from '../src/config/database';

const ROUNDS = 10;
const isBcrypt = (s: string) => /^\$2[aby]\$/.test(s || '');

(async () => {
  const { rows } = await pool.query('SELECT id, username, password FROM users');
  let migrated = 0, skipped = 0;
  for (const u of rows) {
    if (isBcrypt(u.password)) { skipped++; continue; }
    const hashed = await bcrypt.hash(u.password, ROUNDS);
    await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashed, u.id]);
    console.log(`✔ ${u.username}`);
    migrated++;
  }
  console.log(`\nMigrados: ${migrated} • Já em bcrypt: ${skipped}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
