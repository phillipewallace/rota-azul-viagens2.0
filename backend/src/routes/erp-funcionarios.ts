import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { sendError } from '../utils/apiError';

const router = Router();
const TAG = 'AUTH-FUNC';

// Login via CPF (Publico para o App de Funcionários)
router.post('/login', async (req, res) => {
    const { cpf, password } = req.body;
    logger.auth(TAG, `Tentativa de login iniciada para CPF: ${cpf}`);
    
    try {
        if (!cpf || !password) {
            logger.warn(TAG, 'Login falhou: CPF ou senha não fornecidos');
            return res.status(400).json({ error: 'CPF e senha são obrigatórios' });
        }

        const cleanCpf = String(cpf).replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            logger.warn(TAG, `Login falhou: CPF inválido (${cleanCpf})`);
            return res.status(400).json({ error: 'CPF deve conter 11 dígitos' });
        }

        const r = await pool.query('SELECT * FROM erp_funcionarios WHERE cpf = $1 AND active = true', [cleanCpf]);
        const func = r.rows[0];
        
        if (!func) {
            logger.warn(TAG, `Login falhou: Funcionário não encontrado ou inativo (CPF: ${cleanCpf})`);
            return res.status(401).json({ error: 'Funcionário não encontrado ou inativo' });
        }
        
        const valid = await bcrypt.compare(String(password), func.password_hash);
        if (!valid) {
            logger.warn(TAG, `Login falhou: Senha incorreta para o funcionário ${func.nome} (CPF: ${cleanCpf})`);
            return res.status(401).json({ error: 'Senha incorreta' });
        }

        const SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret';
        const token = jwt.sign(
            { 
                userId: func.id, 
                username: func.cpf, 
                role: 'funcionario',
                funcionario_id: func.id 
            }, 
            SECRET,
            { expiresIn: '30d' }
        );

        logger.auth(TAG, `Login realizado com sucesso: ${func.nome} (ID: ${func.id})`);
        
        res.json({ 
            id: func.id, 
            nome: func.nome, 
            tipo: func.tipo, 
            firstLogin: func.first_login,
            token 
        });
    } catch (e: any) { 
        return sendError(res, e, `[${TAG}] Erro crítico no login`);
    }
});


// Middlewares abaixo exigem autenticação
router.use((req, res, next) => {
    // Rota de login deve ser pública
    if (req.path === '/login' || req.path === '/login/' || req.path.endsWith('/login')) { 
        return next(); 
    }
    return requireAuth(req, res, next);
});

router.get('/', async (req, res) => {
    try {
        const r = await pool.query('SELECT id, nome, cpf, telefone, email, tipo, active, first_login FROM erp_funcionarios ORDER BY nome ASC');
        res.json(r.rows);
    } catch (e: any) { 
        console.error('[ERROR] Erro ao listar funcionários:', e);
        res.status(500).json({ error: e.message }); 
    }
});

router.post('/', async (req, res) => {
    const { nome, cpf, telefone, email, tipo } = req.body;
    try {
        const cleanCpf = String(cpf).replace(/\D/g, '');
        // Senha padrão 1234
        const hash = await bcrypt.hash('1234', 10);
        const r = await pool.query(
            `INSERT INTO erp_funcionarios (nome, cpf, telefone, email, tipo, password_hash, first_login) 
             VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id, nome, cpf`,
            [nome, cleanCpf, telefone, email, tipo, hash]
        );
        res.json(r.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Edição de funcionário
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, telefone, email, tipo, active } = req.body;
    try {
        await pool.query(
            `UPDATE erp_funcionarios SET nome = $1, telefone = $2, email = $3, tipo = $4, active = $5, updated_at = NOW() WHERE id = $6`,
            [nome, telefone, email, tipo, active, id]
        );
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Exclusão Híbrida (Inativação ou Exclusão Real)
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { permanent } = req.query;
    try {
        if (permanent === 'true') {
            await pool.query('DELETE FROM erp_funcionarios WHERE id = $1', [id]);
            return res.json({ success: true, message: 'Funcionário removido permanentemente' });
        } else {
            await pool.query('UPDATE erp_funcionarios SET active = false, updated_at = NOW() WHERE id = $1', [id]);
            return res.json({ success: true, message: 'Funcionário inativado com sucesso' });
        }
    } catch (e: any) { 
        if (e.code === '23503') {
            return res.status(400).json({ error: 'Não é possível excluir permanentemente: este funcionário possui registros vinculados (OS/Fotos). Recomenda-se apenas Inativar.' });
        }
        res.status(500).json({ error: e.message }); 
    }
});

export default router;