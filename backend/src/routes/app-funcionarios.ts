import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { logger } from '../utils/logger';
import { sendError } from '../utils/apiError';

const router = Router();
const TAG = 'APP-FUNC';
router.use(requireAuth);

// Endpoint para listar OS pendentes/agendadas ou histórico
router.get('/os', async (req, res) => {
    try {
        const { history, date } = req.query;
        const funcionarioId = (req as any).user?.funcionarioId || (req as any).user?.funcionario_id;
        const funcionarioNome = (req as any).user?.nome || (req as any).user?.username;
        logger.os(TAG, `Agenda consultada por ${funcionarioNome} (ID: ${funcionarioId}) na data: ${date || 'hoje'}${history === 'true' ? ' [HISTÓRICO]' : ''}`);
        
        let statusFilter = "";
        let params: any[] = [];
        params.push(funcionarioId);
        
        if (history === 'true') {
            statusFilter = "o.status = 'fechada' AND (o.funcionario_id = $1 OR o.entregue_por_id = $1 OR o.recolhido_por_id = $1)";
        } else {
            // Fila Global filtrada por DATA
            // $2 será a data no formato YYYY-MM-DD
            // OS de ENTREGA aparecem em 'aberta'/'despachada'
            // OS de RECOLHIMENTO aparecem em 'recolhimento'/'despachada'
            statusFilter = `(
                (o.status IN ('aberta', 'despachada') AND o.tipo_operacao = 'ENTREGA' AND o.data_entrega = $2)
                OR (o.status IN ('recolhimento', 'despachada') AND o.tipo_operacao = 'RECOLHIMENTO' AND o.data_recolhimento_programada = $2)
                OR (o.status IN ('entregue', 'recolhimento_solicitado', 'em_cliente') AND (o.funcionario_id = $1 OR o.entregue_por_id = $1 OR o.recolhido_por_id = $1))
            )`;
            params.push(date || new Date().toISOString().split('T')[0]);
        }

        let query = `
            SELECT o.*, o.entregue_por_nome AS "entreguePorNome", o.recolhido_por_nome AS "recolhidoPorNome",
                   cu.customer_name as "customerName",
                   COALESCE(
                     NULLIF(BTRIM(o.endereco_entrega), ''),
                     NULLIF(BTRIM(q.endereco_entrega), ''),
                     NULLIF(CONCAT_WS(', ',
                       NULLIF(BTRIM(cu.address), ''),
                       NULLIF(BTRIM(cu.numero), ''),
                       NULLIF(BTRIM(cu.complemento), ''),
                       NULLIF(BTRIM(cu.bairro), ''),
                       NULLIF(CONCAT_WS(' - ', NULLIF(BTRIM(cu.cidade), ''), NULLIF(BTRIM(cu.estado), '')), ''),
                       CASE WHEN NULLIF(BTRIM(cu.cep), '') IS NOT NULL THEN 'CEP ' || BTRIM(cu.cep) END
                     ), '')
                   ) as "customerAddress",
                   q.responsavel_telefone as "customerPhone",
                   q.responsavel_nome as "responsavelNome",
                   q.responsavel_email as "responsavelEmail",
                   (SELECT json_agg(qi) FROM (
                       SELECT produto, quantidade, 
                              COALESCE(is_sanitario, FALSE) as "isSanitario", 
                              COALESCE(is_generic_service, FALSE) as "isGenericService"
                       FROM erp_quote_items 
                       WHERE quote_id = o.quote_id 
                       ORDER BY ordem ASC
                   ) qi) as items
            FROM erp_service_orders o
            LEFT JOIN customers cu ON cu.id = o.customer_id
            LEFT JOIN erp_quotes q ON q.id = o.quote_id
            WHERE ${statusFilter}
              AND o.use_new_flow = TRUE
            ORDER BY o.data_entrega ASC
        `;
        
        const r = await pool.query(query, params);
        res.json(Array.isArray(r.rows) ? r.rows : []);
    } catch (e: any) { 
        return sendError(res, e, `[${TAG}] Erro ao listar OS`);
    }
});

// Assumir uma OS da fila global
router.post('/os/:id/assumir', async (req, res) => {
    const { id } = req.params;
    const funcionarioId = (req as any).user?.funcionarioId || (req as any).user?.funcionario_id;
    const funcionarioNome = (req as any).user?.nome || (req as any).user?.username;

    try {
        await pool.query(
            "UPDATE erp_service_orders SET funcionario_id = $1, status = 'despachada', updated_at = NOW() WHERE id = $2 AND (funcionario_id IS NULL OR status IN ('aberta', 'recolhimento'))",
            [funcionarioId, id]
        );
        
        // Registrar no histórico
        await pool.query(
            "INSERT INTO erp_os_history (os_id, tipo, descricao, payload, created_by) VALUES ($1, 'STATUS_CHANGE', $2, $3, $4)",
            [id, `OS assumida por ${funcionarioNome}`, JSON.stringify({ old_status: 'aberta', new_status: 'despachada' }), funcionarioId]
        );

        logger.info(TAG, `Funcionario ${funcionarioNome} assumiu OS ${id}`);
        res.json({ ok: true });
    } catch (e: any) {
        return sendError(res, e, `[${TAG}] Erro ao assumir OS`);
    }
});

// Desvincular-se de uma OS (voltar para a fila global)
router.post('/os/:id/desvincular', async (req, res) => {
    const { id } = req.params;
    const funcionarioId = (req as any).user?.funcionarioId || (req as any).user?.funcionario_id;
    const funcionarioNome = (req as any).user?.nome || (req as any).user?.username;

    try {
        // Apenas permite desvincular se a OS estiver com o status 'despachada' e pertencer ao funcionário
        // Voltamos para o status original baseado no tipo de operação
        const result = await pool.query(
            "UPDATE erp_service_orders SET funcionario_id = NULL, status = CASE WHEN tipo_operacao = 'RECOLHIMENTO' THEN 'recolhimento' ELSE 'aberta' END, updated_at = NOW() WHERE id = $1 AND funcionario_id = $2 AND status = 'despachada'",
            [id, funcionarioId]
        );
        
        if (result.rowCount === 0) {
            return res.status(400).json({ error: 'Não é possível desvincular esta OS (status inválido ou não pertence a você)' });
        }
        
        logger.info(TAG, `Funcionario ${funcionarioNome} desvinculou OS ${id} (voltou para fila global)`);
        
        // Registrar no histórico
        await pool.query(
            "INSERT INTO erp_os_history (os_id, tipo, descricao, payload, created_by) VALUES ($1, 'STATUS_CHANGE', $2, $3, $4)",
            [id, `OS solta por ${funcionarioNome}`, JSON.stringify({ old_status: 'despachada', new_status: 'aberta' }), funcionarioId]
        );

        res.json({ ok: true });
    } catch (e: any) {
        return sendError(res, e, `[${TAG}] Erro ao desvincular OS`);
    }
});

// Registrar Entrega Individual (Suporte a múltiplos itens ou serviço único)
router.post('/os/:id/entregar-item', async (req, res) => {
    const { id } = req.params;
    const { 
        sanitario_numero, 
        fotos, 
        funcionario_id, 
        funcionario_nome, 
        categoria, 
        tipo_locacao_alvo, 
        estado_atual,
        item_index,
        is_last_item,
        is_generic_service, // Novo flag para serviço sem sanitário
        observacoes // Novo campo para relato do serviço
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        let sid = null;

        if (!is_generic_service) {
            const numClean = sanitario_numero?.trim().toUpperCase();
            if (!numClean) throw new Error('Número do sanitário é obrigatório');

            // 1. Garantir que o sanitário existe ou cadastrar na hora
            let s = await client.query('SELECT id FROM sanitarios WHERE numero = $1', [numClean]);
            if (!s.rows.length) {
                logger.info(TAG, `Auto-registrando novo sanitário: ${numClean}`);
                const nr = await client.query(
                    `INSERT INTO sanitarios (numero, status, categoria, tipo_locacao_alvo, estado_atual) 
                     VALUES ($1, 'em_cliente', $2, $3, $4) RETURNING id`,
                    [numClean, categoria || 'comum', tipo_locacao_alvo || 'obra', estado_atual || 'bom']
                );
                sid = nr.rows[0].id;
            } else {
                sid = s.rows[0].id;
                await client.query(
                    "UPDATE sanitarios SET status = 'em_cliente', updated_at = NOW() WHERE id = $1",
                    [sid]
                );
            }

            // 2. Vincular sanitário à OS
            await client.query(
                'INSERT INTO erp_os_sanitarios (os_id, sanitario_id, alocado_em) VALUES ($1, $2, NOW()) ON CONFLICT (os_id, sanitario_id) DO NOTHING',
                [id, sid]
            );
        }

        // 3. Registrar fotos e relato
        if (fotos && Array.isArray(fotos)) {
            for (const url of fotos) {
                // Registrar na tabela de fotos do sanitário (Histórico Interligado)
                await client.query(
                    'INSERT INTO erp_sanitario_fotos (sanitario_id, os_id, url, tipo_evento, funcionario_id, funcionario_nome, observacoes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [sid, id, url, is_generic_service ? 'servico' : 'entrega', funcionario_id, funcionario_nome, observacoes || null]
                );
            }
        }
        
        // Registrar relato e foto de finalização na tabela de vínculo para consulta fácil no ERP
        if (is_generic_service) {
            await client.query(
                `INSERT INTO erp_os_sanitarios (os_id, alocado_em, relato_finalizacao, foto_finalizacao_url) 
                 VALUES ($1, NOW(), $2, $3)`,
                [id, observacoes || 'Serviço finalizado', (fotos && fotos.length > 0) ? fotos[0] : null]
            );
        } else if (sid) {
            await client.query(
                `UPDATE erp_os_sanitarios SET relato_finalizacao = $3, foto_finalizacao_url = $4 
                 WHERE os_id = $1 AND sanitario_id = $2`,
                [id, sid, observacoes || null, (fotos && fotos.length > 0) ? fotos[0] : null]
            );
        }

        // 4. Se for o último item ou solicitado (ou serviço genérico), marcar OS como 'em_cliente'
        if (is_last_item || is_generic_service) {
            await client.query(
                "UPDATE erp_service_orders SET status = 'em_cliente', entregue_por_id = $2, entregue_por_nome = $3, updated_at = NOW() WHERE id = $1", 
                [id, funcionario_id, funcionario_nome]
            );
        }

        await client.query('COMMIT');
        res.json({ ok: true, sanitario_id: sid });
    } catch (e: any) {
        await client.query('ROLLBACK');
        logger.error(TAG, `Erro entregar-item OS ${id}: ${e.message}`);
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// Registrar Recolhimento Individual
router.post('/os/:id/recolher-item', async (req, res) => {
    const { id } = req.params;
    const { 
        sanitario_id, 
        fotos, 
        funcionario_id, 
        funcionario_nome, 
        estado_atual, 
        observacoes,
        is_last_item 
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Registrar fotos e estado para este sanitário específico
        if (fotos && Array.isArray(fotos)) {
            for (const url of fotos) {
                // Registrar na tabela de fotos do sanitário (Histórico Interligado)
                await client.query(
                    'INSERT INTO erp_sanitario_fotos (sanitario_id, os_id, url, tipo_evento, estado_conservacao, observacoes, funcionario_id, funcionario_nome) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                    [sanitario_id, id, url, 'recolhimento', estado_atual, observacoes, funcionario_id, funcionario_nome]
                );
            }
        }
        
        // Atualizar o vínculo com o relato de recolhimento
        await client.query(
            `UPDATE erp_os_sanitarios SET relato_finalizacao = $3, foto_finalizacao_url = $4, devolvido_em = NOW() 
             WHERE os_id = $1 AND sanitario_id = $2`,
            [id, sanitario_id, observacoes || 'Recolhimento realizado', (fotos && fotos.length > 0) ? fotos[0] : null]
        );

        // 2. Atualizar sanitário para disponível e atualizar estado
        await client.query(
            "UPDATE sanitarios SET status = 'disponivel', estado_atual = $2, updated_at = NOW() WHERE id = $1",
            [sanitario_id, estado_atual]
        );

        // 3. Marcar devolução na OS
        await client.query(
            "UPDATE erp_os_sanitarios SET devolvido_em = NOW() WHERE os_id = $1 AND sanitario_id = $2",
            [id, sanitario_id]
        );

        // 4. Se for o último, fechar a OS
        if (is_last_item) {
            await client.query(
                "UPDATE erp_service_orders SET status = 'fechada', recolhido_por_id = $2, recolhido_por_nome = $3, data_fechamento = NOW(), updated_at = NOW() WHERE id = $1", 
                [id, funcionario_id, funcionario_nome]
            );
        }

        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (e: any) {
        await client.query('ROLLBACK');
        logger.error(TAG, `Erro recolher-item OS ${id}: ${e.message}`);
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// Listar sanitários vinculados a uma OS (para recolhimento itemizado)
router.get('/os/:id/sanitarios', async (req, res) => {
    try {
        const { id } = req.params;
        const r = await pool.query(`
            SELECT 
                s.id, s.numero, s.categoria, s.estado_atual, os.alocado_em, os.devolvido_em,
                (SELECT url FROM erp_sanitario_fotos WHERE sanitario_id = s.id AND os_id = os.os_id ORDER BY created_at DESC LIMIT 1) as "ultimaFotoUrl"
            FROM erp_os_sanitarios os
            JOIN sanitarios s ON s.id = os.sanitario_id
            WHERE os.os_id = $1
        `, [id]);
        res.json(r.rows);
    } catch (e: any) {
        sendError(res, e, `Erro ao listar sanitários da OS ${req.params.id}`);
    }
});


// Cadastrar sanitário manualmente no estoque
router.post('/estoque-manual', async (req, res) => {
    const { numero, categoria, estado_atual } = req.body;
    const funcionarioId = (req as any).user?.funcionarioId || (req as any).user?.funcionario_id;

    if (!numero || !categoria) {
        return res.status(400).json({ error: 'Número e categoria são obrigatórios' });
    }

    try {
        const numClean = numero.trim().toUpperCase();
        const check = await pool.query('SELECT id FROM sanitarios WHERE numero = $1', [numClean]);
        
        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Este número de sanitário já está cadastrado' });
        }

        const nr = await pool.query(
            `INSERT INTO sanitarios (numero, status, categoria, estado_atual, created_at) 
             VALUES ($1, 'disponivel', $2, $3, NOW()) RETURNING id`,
            [numClean, categoria, estado_atual || 'bom']
        );

        logger.info(TAG, `Sanitário ${numClean} cadastrado manualmente por func_id: ${funcionarioId}`);
        res.json({ ok: true, id: nr.rows[0].id });
    } catch (e: any) {
        return sendError(res, e, `[${TAG}] Erro ao cadastrar sanitário no estoque`);
    }
});

export default router;
