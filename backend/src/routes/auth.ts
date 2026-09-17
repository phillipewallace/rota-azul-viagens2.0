import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import { JWT_SECRET } from '../middleware/requireAuth';
import { logger } from '../utils/logger';

const router = express.Router();

const BCRYPT_ROUNDS = 10;
const isBcryptHash = (s: string) => typeof s === 'string' && /^\$2[aby]\$/.test(s);

// ─────────────────────────────────────────────────────────────────────────────
//  Rastreamento de tentativas de login (proteção contra força bruta)
// ─────────────────────────────────────────────────────────────────────────────

const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000;     // 15 minutos
const MAX_FAILED_ATTEMPTS_PER_KEY = 10;            // bloqueia o "username/CPF" informado
const MAX_FAILED_ATTEMPTS_PER_IP  = 30;            // bloqueia o IP
const IP_LOCKOUT_DURATION_MS     = 30 * 60 * 1000; // 30 minutos
const KEY_LOCKOUT_DURATION_MS    = 5 * 60 * 1000;  // 5 minutos

const sanitizeTrackingKey = (raw: string): string => {
  const s = String(raw ?? '').trim().slice(0, 64);
  return /^[a-zA-Z0-9._@\-\s]+$/.test(s) ? s : 'unknown';
};

const isLocked = async (key: string, ip: string): Promise<{ locked: boolean; reason?: string }> => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - BRUTE_FORCE_WINDOW_MS);
    
    // Bloqueio por IP
    const ipRow = await pool.query<{ cnt: number; last_failed_at: Date | null }>(
      `SELECT COUNT(*)::int AS cnt, MAX(failed_at)::timestamptz AS last_failed_at
       FROM login_attempt_tracker
       WHERE ip_address = $1 AND succeeded = false AND failed_at > $2`,
      [ip, since]
    );
    const ipCount = ipRow.rows[0].cnt;
    if (ipCount >= MAX_FAILED_ATTEMPTS_PER_IP) {
      const lastFailed = ipRow.rows[0].last_failed_at;
      const blockedUntil = lastFailed ? new Date(lastFailed.getTime() + IP_LOCKOUT_DURATION_MS) : now;
      if (Date.now() < blockedUntil.getTime()) {
        return { locked: true, reason: `IP temporariamente bloqueado (${MAX_FAILED_ATTEMPTS_PER_IP} falhas)` };
      }
    }
    
    // Bloqueio por username/CPF informado
    const keyRow = await pool.query<{ cnt: number; last_failed_at: Date | null }>(
      `SELECT COUNT(*)::int AS cnt, MAX(failed_at)::timestamptz AS last_failed_at
       FROM login_attempt_tracker
       WHERE attempt_key = $1 AND succeeded = false AND failed_at > $2`,
      [key, since]
    );
    const keyCount = keyRow.rows[0].cnt;
    if (keyCount >= MAX_FAILED_ATTEMPTS_PER_KEY) {
      const lastFailed = keyRow.rows[0].last_failed_at;
      const blockedUntil = lastFailed ? new Date(lastFailed.getTime() + KEY_LOCKOUT_DURATION_MS) : now;
      if (Date.now() < blockedUntil.getTime()) {
        return { locked: true, reason: `Conta temporariamente bloqueada (${MAX_FAILED_ATTEMPTS_PER_KEY} falhas)` };
      }
    }
    
    return { locked: false };
  } catch (err) {
    logger.error('SECURITY-BRUTE', 'Falha no check de bloqueio', { error: err });
    return { locked: false };
  }
};

const recordFailedLoginAttempt = async (key: string, ip: string, userAgent: string): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO login_attempt_tracker (attempt_key, ip_address, user_agent, failed_at, succeeded)
       VALUES ($1, $2, $3, NOW(), false)`,
      [key, ip, userAgent.slice(0, 255)]
    );
    
    // Verifica se atingiu limiar para alerta de força bruta
    const windowStart = new Date(Date.now() - BRUTE_FORCE_WINDOW_MS);
    const recentFailed = await pool.query<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt FROM login_attempt_tracker
       WHERE ip_address = $1 AND succeeded = false AND failed_at > $2`,
      [ip, windowStart]
    );
    if (recentFailed.rows[0].cnt >= MAX_FAILED_ATTEMPTS_PER_IP) {
      logger.warn('SECURITY-BRUTE', 'Limite de falhas por IP atingido', {
        ip, attempts: recentFailed.rows[0].cnt, key
      });
    }
  } catch (err) {
    logger.error('SECURITY-BRUTE', 'Falha ao registrar tentativa falha', { error: err });
  }
};

const trackLoginAttempt = async (key: string, succeeded: boolean, ip: string): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO login_attempt_tracker (attempt_key, ip_address, user_agent, failed_at, succeeded)
       VALUES ($1, $2, $3, NOW(), $4)`,
      [key, ip, '---', succeeded]
    );
  } catch (err) {
    logger.error('SECURITY-BRUTE', 'Falha ao registrar tentativa de login', { error: err });
  }
};

const recordLoginSession = async (
  identifier: string,
  userId: string,
  role: string,
  ip: string,
  userAgent: string
): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO login_attempt_tracker (attempt_key, ip_address, user_agent, session_id, succeeded, logged_at)
       VALUES ($1, $2, $3, $4, true, NOW())`,
      [
        sanitizeTrackingKey(identifier),
        ip,
        userAgent.slice(0, 255),
        `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      ]
    );
  } catch (err) {
    logger.error('SECURITY-SESSION', 'Falha ao registrar sessão de login', { error: err });
  }
};

// Login endpoint — aceita username (users) OU CPF (funcionários com acesso ao Ponto).
router.post('/login', async (req: any, res: any) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const trackKey = sanitizeTrackingKey(username);

    // Verifica bloqueio antes de qualquer consulta ao banco
    const lockCheck = await isLocked(trackKey, ip);
    if (lockCheck.locked) {
      logger.warn('SECURITY-BRUTE', 'Login bloqueado por força bruta', {
        ip, key: trackKey, reason: lockCheck.reason
      });
      return res.status(429).json({
        error: 'Muitas tentativas recentes. Tente novamente mais tarde.'
      });
    }

    // 1) Tenta como usuário do sistema principal
    const userQuery = 'SELECT * FROM users WHERE username = $1 AND active = true';
    const userResult = await pool.query(userQuery, [username]);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      let passwordMatch = false;
      if (isBcryptHash(user.password)) {
        passwordMatch = await bcrypt.compare(password, user.password);
      } else {
        passwordMatch = password === user.password;
        if (passwordMatch) {
          try {
            const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
            await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashed, user.id]);
          } catch (e) { console.error('⚠️  [AUTH] Falha ao migrar hash:', e); }
        }
      }
      if (!passwordMatch) {
        await recordFailedLoginAttempt(trackKey, ip, userAgent);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      const { password: _pw, ...userWithoutPassword } = user;
      await recordLoginSession(user.username, String(user.id), user.role, ip, userAgent);
      await trackLoginAttempt(user.username, true, ip);
      return res.json({ token, user: userWithoutPassword });
    }

    // 2) Tenta como funcionário (CPF)
    const funcQuery = 'SELECT * FROM erp_funcionarios WHERE cpf = $1 AND active = true';
    const funcResult = await pool.query(funcQuery, [username]);
    if (funcResult.rows.length > 0) {
      const func = funcResult.rows[0];
      if (!func.password_hash || !isBcryptHash(func.password_hash)) {
        await recordFailedLoginAttempt(trackKey, ip, userAgent);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const funcMatch = await bcrypt.compare(password, func.password_hash);
      if (!funcMatch) {
        await recordFailedLoginAttempt(trackKey, ip, userAgent);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: func.id, username: func.cpf, role: 'funcionario', funcionario_id: func.id },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      await recordLoginSession(func.cpf, String(func.id), 'funcionario', ip, userAgent);
      await trackLoginAttempt(func.cpf, true, ip);
      return res.json({
        token,
        user: {
          id: func.id,
          username: func.cpf,
          name: func.nome,
          role: 'funcionario',
          cpf: func.cpf,
          telefone: func.telefone,
          email: func.email,
          created_at: func.created_at,
        }
      });
    }

    // Nenhum login válido → registra falha e retorna genérico
    await recordFailedLoginAttempt(trackKey, ip, userAgent);
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('❌ [AUTH LOGIN] Erro:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




// Verificar token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userQuery = 'SELECT id, username, name, email, role, created_at FROM users WHERE id = $1 AND active = true';
    const userResult = await pool.query(userQuery, [decoded.userId]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('❌ [AUTH VERIFY] Erro:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
