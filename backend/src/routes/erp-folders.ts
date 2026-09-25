/**
 * ERP → Pastas (Explorer de Documentos)
 * Árvore hierárquica de pastas que organiza a Central de Documentos.
 * A raiz é implícita (documentos com folder_id NULL); cada pasta pode ter
 * um pai (parent_id) formando a árvore exibida na sidebar do explorer.
 *
 * Endpoints:
 *   GET    /           → lista plana com contagem de documentos (árvore é montada no cliente)
 *   POST   /           → cria pasta { nome, parentId? }
 *   PUT    /:id        → renomeia e/ou move { nome?, parentId? } (com proteção contra ciclo)
 *   DELETE /:id        → apaga a pasta em transação: documentos voltam para o pai
 *                        (ou raiz) e sub-pastas são promovidas para o pai.
 */
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { sendError } from '../utils/apiError';
import { logger } from '../utils/logger';

const router = Router();
router.use(requireAuth);

const str = (v: any, max = 200): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
};

/** Há pasta com este nome entre os irmãos (case-insensitive)? */
async function siblingConflict(nome: string, parentId: string | null, exceptId?: string): Promise<boolean> {
  const params: any[] = [nome.toLowerCase()];
  let sql = `SELECT 1 FROM erp_folders WHERE LOWER(nome) = $1 AND `;
  if (parentId) {
    params.push(parentId);
    sql += `parent_id = $${params.length}`;
  } else {
    sql += `parent_id IS NULL`;
  }
  if (exceptId) {
    params.push(exceptId);
    sql += ` AND id <> $${params.length}`;
  }
  const r = await pool.query(sql, params);
  return r.rows.length > 0;
}

/** true se `candidateId` é ascendente de `maybeDescendantId` — impede ciclos. */
async function isAncestor(candidateId: string, maybeDescendantId: string): Promise<boolean> {
  let cursor: string | null = candidateId;
  for (let depth = 0; cursor && depth < 50; depth += 1) {
    if (cursor === maybeDescendantId) return true;
    const r = await pool.query(`SELECT parent_id FROM erp_folders WHERE id = $1`, [cursor]);
    if (!r.rows[0]) return false;
    cursor = r.rows[0].parent_id || null;
  }
  return false;
}

// ── GET / → lista plana (id, nome, parentId, contagens) ─────────────────────
router.get('/', async (_req: any, res: any) => {
  try {
    const r = await pool.query(`
      SELECT f.id,
             f.nome,
             f.parent_id AS "parentId",
             f.created_at AS "createdAt",
             (SELECT COUNT(*)::int FROM erp_documents d WHERE d.folder_id = f.id)
               AS "documentosCount",
             (SELECT COUNT(*)::int FROM erp_folders c WHERE c.parent_id = f.id)
               AS "subpastasCount"
        FROM erp_folders f
       ORDER BY LOWER(f.nome)`);
    res.json(r.rows);
  } catch (e: any) {
    logger.error('ERP-FOLDERS', 'Erro ao listar pastas', { error: e.message });
    sendError(res, e, '[erp-folders GET]');
  }
});

// ── POST / → cria pasta ─────────────────────────────────────────────────────
router.post('/', async (req: any, res: any) => {
  try {
    const nome = str(req.body?.nome, 200);
    if (!nome) return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
    const parentId = str(req.body?.parentId, 36);

    if (parentId) {
      const parent = await pool.query(`SELECT id FROM erp_folders WHERE id = $1`, [parentId]);
      if (!parent.rows[0]) return res.status(404).json({ error: 'Pasta pai não encontrada' });
    }
    if (await siblingConflict(nome, parentId)) {
      return res.status(409).json({ error: `Já existe uma pasta chamada "${nome}" aqui.` });
    }

    const r = await pool.query(
      `INSERT INTO erp_folders (nome, parent_id, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, nome, parent_id AS "parentId", created_at AS "createdAt"`,
      [nome, parentId, req.user?.username || null],
    );
    logger.info('ERP-FOLDERS', 'Pasta criada', { nome, parentId });
    res.status(201).json({ ...r.rows[0], documentosCount: 0, subpastasCount: 0 });
  } catch (e: any) {
    logger.error('ERP-FOLDERS', 'Erro ao criar pasta', { error: e.message });
    sendError(res, e, '[erp-folders POST]');
  }
});

// ── PUT /:id → renomear e/ou mover ──────────────────────────────────────────
router.put('/:id', async (req: any, res: any) => {
  try {
    const id = req.params.id;
    const existing = await pool.query(
      `SELECT id, nome, parent_id AS "parentId" FROM erp_folders WHERE id = $1`, [id],
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Pasta não encontrada' });

    const nome = req.body?.nome !== undefined ? str(req.body.nome, 200) : existing.rows[0].nome;
    if (!nome) return res.status(400).json({ error: 'Nome da pasta é obrigatório' });

    // parentId undefined = mantém; null = mover para a raiz; id = mover para dentro.
    const moveRaw = req.body?.parentId;
    const parentId = moveRaw === undefined
      ? existing.rows[0].parentId
      : (moveRaw === null || moveRaw === '' ? null : str(moveRaw, 36));

    if (parentId) {
      if (parentId === id) return res.status(400).json({ error: 'Uma pasta não pode ficar dentro dela mesma.' });
      const parent = await pool.query(`SELECT id FROM erp_folders WHERE id = $1`, [parentId]);
      if (!parent.rows[0]) return res.status(404).json({ error: 'Pasta pai não encontrada' });
      // Ciclo: o destino não pode ser descendente da pasta que está sendo movida.
      if (await isAncestor(parentId, id)) {
        return res.status(400).json({ error: 'Não é possível mover uma pasta para dentro de uma subpasta dela.' });
      }
    }

    const changedParent = (parentId || null) !== (existing.rows[0].parentId || null);
    if (await siblingConflict(nome, parentId || null, id)
        && (nome !== existing.rows[0].nome || changedParent)) {
      return res.status(409).json({ error: `Já existe uma pasta chamada "${nome}" aqui.` });
    }

    const r = await pool.query(
      `UPDATE erp_folders
          SET nome = $1, parent_id = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING id, nome, parent_id AS "parentId", updated_at AS "updatedAt"`,
      [nome, parentId, id],
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    logger.error('ERP-FOLDERS', 'Erro ao atualizar pasta', { error: e.message });
    sendError(res, e, '[erp-folders PUT]');
  }
});

// ── DELETE /:id → apaga sem perder nada ─────────────────────────────────────
// Em transação: documentos e sub-pastas são "promovidos" para o pai da pasta
// apagada (ou para a raiz, se ela era de primeiro nível). Nada é excluído.
router.delete('/:id', async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const id = req.params.id;
    await client.query('BEGIN');

    const folderQ = await client.query(
      `SELECT parent_id FROM erp_folders WHERE id = $1 FOR UPDATE`, [id],
    );
    if (!folderQ.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }
    const newParent: string | null = folderQ.rows[0].parent_id || null;

    const subs = await client.query(
      `UPDATE erp_folders SET parent_id = $1 WHERE parent_id = $2`, [newParent, id],
    );
    const docs = await client.query(
      `UPDATE erp_documents SET folder_id = $1, updated_at = NOW() WHERE folder_id = $2`,
      [newParent, id],
    );
    await client.query(`DELETE FROM erp_folders WHERE id = $1`, [id]);
    await client.query('COMMIT');

    logger.info('ERP-FOLDERS', 'Pasta excluída (conteúdo movido para o pai)', {
      id, newParent, subpastasMovidas: subs.rowCount, documentosMovidos: docs.rowCount,
    });
    res.json({
      ok: true,
      documentosMovidos: docs.rowCount || 0,
      subpastasMovidas: subs.rowCount || 0,
    });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    logger.error('ERP-FOLDERS', 'Erro ao excluir pasta', { error: e.message });
    sendError(res, e, '[erp-folders DELETE]');
  } finally {
    client.release();
  }
});

export default router;
