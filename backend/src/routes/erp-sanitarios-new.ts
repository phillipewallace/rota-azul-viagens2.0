import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { logger } from '../utils/logger';
import { sendError } from '../utils/apiError';

const router = Router();
const TAG = 'SAN-STOCK';

router.use(requireAuth);

// Histórico completo de um sanitário (Unificado)
router.get('/:id/historico-completo', async (req, res) => {
    const { id } = req.params;
    try {
        // Buscar movimentações (sanitario_movimentacoes — tabela onde os dados reais são gravados)
        // Alias driver_name → funcionario_nome para manter compatibilidade com o frontend.
        const movs = await pool.query(
            "SELECT *, COALESCE(funcionario_nome, driver_name) AS funcionario_nome FROM sanitario_movimentacoes WHERE sanitario_id = $1 ORDER BY occurred_at DESC",
            [id]
        );

        // Buscar fotos (erp_sanitario_fotos) - Fonte da verdade interligada
        const fotos = await pool.query(
            "SELECT * FROM erp_sanitario_fotos WHERE sanitario_id = $1 ORDER BY created_at DESC",
            [id]
        );

        res.json({
            movimentacoes: movs.rows,
            fotos: fotos.rows
        });
    } catch (e: any) {
        sendError(res, e, `Erro ao buscar histórico do sanitário ${id}`);
    }
});

export default router;
