import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';
import { logger } from '../utils/logger';
import { sendError } from '../utils/apiError';

const router = Router();
const TAG = 'OS-RECOLHIMENTO';
router.use(requireAuth);

/**
 * Inicia o fluxo de recolhimento de uma OS.
 * Transforma a OS atual em uma OS de recolhimento.
 */
router.post('/:id/solicitar-recolhimento', requireRole('admin', 'manager'), async (req, res) => {
    const { id } = req.params;
    const { data_recolhimento, itens_selecionados, observacoes } = req.body;
    const user = (req as any).user?.username || (req as any).user?.nome;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Verificar se a OS existe e está em status que permite recolhimento
        const osQ = await client.query('SELECT status, tipo_operacao FROM erp_service_orders WHERE id = $1', [id]);
        if (osQ.rowCount === 0) throw new Error('OS não encontrada');
        
        const os = osQ.rows[0];
        if (os.status !== 'em_cliente' && os.status !== 'entregue') {
            throw new Error(`Status atual (${os.status}) não permite solicitar recolhimento`);
        }

        // 2. Atualizar a OS para status 'recolhimento' e definir data programada
        await client.query(
            `UPDATE erp_service_orders SET 
                status = 'recolhimento', 
                tipo_operacao = 'RECOLHIMENTO',
                data_recolhimento_programada = $2,
                observacoes = COALESCE($3, observacoes),
                funcionario_id = NULL, -- Remove vínculo para cair na fila global
                updated_at = NOW()
             WHERE id = $1`,
            [id, data_recolhimento || new Date().toISOString().split('T')[0], observacoes || null]
        );

        // 3. Registrar no histórico
        await client.query(
            "INSERT INTO erp_os_history (os_id, tipo, descricao, payload, created_by) VALUES ($1, 'STATUS_CHANGE', $2, $3, $4)",
            [id, `Recolhimento solicitado por ${user}`, JSON.stringify({ old_status: os.status, new_status: 'recolhimento', itens: itens_selecionados }), (req as any).user?.id]
        );

        await client.query('COMMIT');
        logger.info(TAG, `Recolhimento solicitado para OS ${id} por ${user}`);
        res.json({ ok: true });
    } catch (e: any) {
        await client.query('ROLLBACK');
        return sendError(res, e, `[${TAG}] Erro ao solicitar recolhimento`);
    } finally {
        client.release();
    }
});

export default router;