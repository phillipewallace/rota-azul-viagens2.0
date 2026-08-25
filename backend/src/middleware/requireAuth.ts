import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const TAG = 'MIDDLEWARE-AUTH';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    // Falha rápido em produção — nunca rodar com segredo padrão
    throw new Error('JWT_SECRET não configurado em produção. Defina no .env do backend.');
  } else {
    console.warn('⚠️  [AUTH] JWT_SECRET ausente — usando fallback APENAS em dev.');
  }
}
const SECRET = JWT_SECRET || 'dev-only-insecure-secret';

export interface AuthedRequest extends Request {
  user?: { userId: string; username: string; role: string; funcionarioId?: string };
}

/**
 * Middleware: exige Bearer token JWT válido.
 */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): any {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      logger.warn('AUTH', `🔓 Acesso negado: Token ausente em ${req.method} ${req.path}`, { ip: req.ip });
      return res.status(401).json({ error: 'Token ausente' });
    }
    const decoded = jwt.verify(token, SECRET) as any;
    req.user = { userId: decoded.userId, username: decoded.username, role: decoded.role, funcionarioId: decoded.funcionario_id || (decoded.role === 'funcionario' ? decoded.userId : undefined) };
    
    // Log vibrante de sessão ativa no Detective Mode
    logger.auth('SESSION', `👤 Usuário ${req.user.username} (${req.user.role}) acessando ${req.method} ${req.url}`);
    
    next();
  } catch (e: any) {
    logger.error(TAG, `Token inválido ou expirado em ${req.method} ${req.path}`, { error: e.message });
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Versão "soft": tenta autenticar, mas não bloqueia se falhar.
 */
export function softAuth(req: AuthedRequest, _res: Response, next: NextFunction): any {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token) {
      const decoded = jwt.verify(token, SECRET) as any;
      req.user = { userId: decoded.userId, username: decoded.username, role: decoded.role, funcionarioId: decoded.funcionario_id || (decoded.role === 'funcionario' ? decoded.userId : undefined) };
    }
  } catch {}
  next();
}

/**
 * Exige que o usuário autenticado tenha um dos papéis informados.
 * Use APÓS requireAuth (ou combine: [requireAuth, requireRole('admin')]).
 * O super-admin `phillipe.sodre` sempre passa.
 */
export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): any => {
    const u = req.user;
    if (!u) {
      logger.warn('AUTH', `🚫 Tentativa de acesso sem usuário autenticado em rota restrita: ${req.url}`);
      return res.status(401).json({ error: 'Não autenticado' });
    }
    if (u.username === 'phillipe.sodre') {
      logger.auth('ADMIN', `👑 Super-admin phillipe.sodre bypass em ${req.url}`);
      return next();
    }
    if (!u.role || !roles.includes(u.role)) {
      logger.warn('AUTH', `🚫 Acesso negado: Usuário ${u.username} tentou acessar ${req.url} (Requer: ${roles.join(',')})`);
      return res.status(403).json({ error: 'Permissão insuficiente para esta ação' });
    }
    next();
  };
}

export { SECRET as JWT_SECRET };
