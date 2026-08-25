import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import { JWT_SECRET } from '../middleware/requireAuth';

const router = express.Router();

const BCRYPT_ROUNDS = 10;
const isBcryptHash = (s: string) => typeof s === 'string' && /^\$2[aby]\$/.test(s);

// Login endpoint — aceita username (users) OU CPF (funcionários com acesso ao Ponto).
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
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
      if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      const { password: _pw, ...userWithoutPassword } = user;
      return res.json({ token, user: userWithoutPassword });
    }

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
