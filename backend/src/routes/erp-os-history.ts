import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { logger } from '../utils/logger';
import { sendError } from '../utils/apiError';

const router = Router();
const TAG = 'OS-HISTORY';
router.use(requireAuth);

// Listar histórico de uma OS
router.get('/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Buscar eventos do histórico, fotos e relatos
        const historyQ = await pool.query(`
            (SELECT 'EVENTO' as source, tipo, descricao, payload, created_at, created_by, NULL as author_name
             FROM erp_os_history 
             WHERE os_id = $1)
            UNION ALL
            (SELECT 'FOTO' as source, tipo_evento as tipo, observacoes as descricao, 
                    jsonb_build_object('url', url, 'funcionario_nome', funcionario_nome, 'estado', estado_conservacao) as payload,
                    created_at, funcionario_id as created_by, funcionario_nome as author_name
             FROM erp_sanitario_fotos 
             WHERE os_id = $1)
            UNION ALL
            (SELECT 'NOTA' as source, 'internal_note' as tipo, note as descricao, NULL as payload,
                    created_at, created_by, author_name
             FROM erp_os_notes
             WHERE os_id = $1)
            ORDER BY created_at DESC
        `, [id]);

        res.json(historyQ.rows);
    } catch (e: any) {
        return sendError(res, e, `[${TAG}] Erro ao buscar histórico da OS`);
    }
});

// Adicionar nota interna
router.post('/:id/notes', async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        const userId = (req as any).user?.id;
        const userName = (req as any).user?.nome || (req as any).user?.username || 'Sistema';

        if (!note) return res.status(400).json({ error: 'Conteúdo da nota é obrigatório' });

        await pool.query(
            `INSERT INTO erp_os_notes (os_id, note, created_by, author_name) VALUES ($1, $2, $3, $4)`,
            [id, note, userId, userName]
        );

        logger.info(TAG, `Nota adicionada na OS ${id} por ${userName}`);
        res.json({ ok: true });
    } catch (e: any) {
        return sendError(res, e, `[${TAG}] Erro ao adicionar nota na OS`);
    }
});

export default router;
