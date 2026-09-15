/**
 * ERP → Documentos
 * Central de documentos com nome, tipo, numeração, empresa emissora e arquivo
 * vinculado (qualquer tipo/extensão). O arquivo é enviado pelo endpoint /upload
 * e aqui guardamos apenas a referência + metadados.
 */
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { sendError } from '../utils/apiError';
import { parsePagination, sendPaginated } from '../utils/pagination';
import { logger } from '../utils/logger';

const router = Router();
router.use(requireAuth);

const uploadsDir = path.join(__dirname, '../../uploads');

// Upload de arquivos da sub-pasta (max 50MB, qualquer tipo).
const fileStorage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, uploadsDir),
  filename: (_req: any, file: any, cb: any) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const fileUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req: any, _file: any, cb: any) => cb(null, true),
});

/** Remove arquivo físico (best-effort) se a URL apunta a /uploads/. */
const removePhysical = (url?: string | null) => {
  if (url && url.startsWith('/uploads/')) {
    try {
      const fp = path.join(uploadsDir, path.basename(url));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) {
      logger.warn('ERP-DOCS', 'Falha ao remover arquivo físico', { error: (e as any).message });
    }
  }
};

const str = (v: any, max = 2000): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
};

const num = (v: any): number | null => {
  if (v == null || v === '' || Number.isNaN(Number(v))) return null;
  return Number(v);
};

const COLUMNS = `
  d.id,
  d.nome,
  d.tipo,
  d.numeracao,
  d.empresa_emissora AS "empresaEmissora",
  d.arquivo_url AS "arquivoUrl",
  d.arquivo_nome AS "arquivoNome",
  d.arquivo_tamanho::int AS "arquivoTamanho",
  d.arquivo_tipo AS "arquivoTipo",
  d.observacoes,
  d.created_by AS "createdBy",
  d.created_at AS "createdAt",
  d.updated_at AS "updatedAt",
  (SELECT COUNT(*)::int FROM erp_document_files f WHERE f.document_id = d.id)
    + CASE WHEN d.arquivo_url IS NOT NULL AND d.arquivo_url <> '' THEN 1 ELSE 0 END AS "arquivosCount"
`;

// Mesmos campos sem o prefixo de alias d. — usado em UPDATE ... RETURNING.
const RETURN_COLUMNS = `
  id,
  nome,
  tipo,
  numeracao,
  empresa_emissora AS "empresaEmissora",
  arquivo_url AS "arquivoUrl",
  arquivo_nome AS "arquivoNome",
  arquivo_tamanho::int AS "arquivoTamanho",
  arquivo_tipo AS "arquivoTipo",
  observacoes,
  created_by AS "createdBy",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  (SELECT COUNT(*)::int FROM erp_document_files f WHERE f.document_id = id)
    + CASE WHEN arquivo_url IS NOT NULL AND arquivo_url <> '' THEN 1 ELSE 0 END AS "arquivosCount"
`;

function buildWhere(q: any, startIdx = 1): { where: string; params: any[] } {
  const params: any[] = [];
  const conds: string[] = [];
  let i = startIdx;
  if (q.search) {
    const term = `%${String(q.search).toLowerCase()}%`;
    params.push(term);
    // eslint-disable-next-line max-len
    conds.push(`(LOWER(d.nome) LIKE $${i} OR LOWER(COALESCE(d.numeracao,'')) LIKE $${i} OR LOWER(COALESCE(d.empresa_emissora,'')) LIKE $${i} OR LOWER(COALESCE(d.tipo,'')) LIKE $${i} OR LOWER(COALESCE(d.arquivo_nome,'')) LIKE $${i})`);
    i++;
  }
  if (q.tipo) {
    params.push(String(q.tipo));
    conds.push(`d.tipo = $${i}`);
    i++;
  }
  if (q.empresa) {
    const term = `%${String(q.empresa).toLowerCase()}%`;
    params.push(term);
    conds.push(`LOWER(COALESCE(d.empresa_emissora,'')) LIKE $${i}`);
    i++;
  }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

// Tipos/empresas já utilizados — alimenta os filtros e autocomplete.
router.get('/tipos', async (_req: any, res: any) => {
  try {
    const t = await pool.query(`SELECT DISTINCT tipo FROM erp_documents WHERE tipo IS NOT NULL AND tipo <> '' ORDER BY tipo`);
    const e = await pool.query(`SELECT DISTINCT empresa_emissora AS "empresaEmissora" FROM erp_documents WHERE empresa_emissora IS NOT NULL AND empresa_emissora <> '' ORDER BY empresa_emissora`);
    res.json({ tipos: t.rows.map((r: any) => r.tipo), empresas: e.rows });
  } catch (err: any) {
    logger.error('ERP-DOCS', 'Erro ao buscar tipos/empresas', { error: err.message });
    sendError(res, err, '[erp-documents tipos]');
  }
});

router.get('/', async (req: any, res: any) => {
  try {
    const { where, params } = buildWhere(req.query);
    const pg = parsePagination(req, params.length);
    const rowsQ = await pool.query(
      `SELECT ${COLUMNS}
         FROM erp_documents d
         ${where}
        ORDER BY d.created_at DESC
        ${pg.sql}`,
      [...params, ...pg.params],
    );
    if (pg.paginated) {
      const totalQ = await pool.query(
        `SELECT COUNT(*)::int AS c FROM erp_documents d ${where}`,
        params,
      );
      const total = totalQ.rows[0] ? totalQ.rows[0].c : 0;
      return sendPaginated(res, rowsQ.rows, total, pg);
    }
    res.json(rowsQ.rows);
  } catch (e: any) {
    logger.error('ERP-DOCS', 'Erro ao listar documentos', { error: e.message });
    sendError(res, e, '[erp-documents GET]');
  }
});

router.get('/:id', async (req: any, res: any) => {
  try {
    const r = await pool.query(`SELECT ${COLUMNS} FROM erp_documents d WHERE d.id = $1`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Documento não encontrado' });
    res.json(r.rows[0]);
  } catch (e: any) {
    sendError(res, e, '[erp-documents GET/:id]');
  }
});

// ── Sub-pasta: múltiplos arquivos por documento ────────────────────────────
router.get('/:id/files', async (req: any, res: any) => {
  try {
    const params: any[] = [req.params.id];
    const conds: string[] = ['document_id = $1'];
    let i = 2;
    if (req.query.search) {
      params.push(`%${String(req.query.search).toLowerCase()}%`);
      conds.push(`LOWER(arquivo_nome) LIKE $${i}`);
      i++;
    }
    if (req.query.tipo && req.query.tipo !== 'all') {
      params.push(`%.${String(req.query.tipo).toLowerCase()}`);
      conds.push(`LOWER(arquivo_nome) LIKE $${i}`);
      i++;
    }
    const r = await pool.query(
      `SELECT id, document_id AS "documentId", arquivo_url AS "arquivoUrl", arquivo_nome AS "arquivoNome",
              arquivo_tamanho::int AS "arquivoTamanho", arquivo_tipo AS "arquivoTipo",
              created_by AS "createdBy", created_at AS "createdAt"
         FROM erp_document_files
        WHERE ${conds.join(' AND ')}
        ORDER BY created_at DESC`,
      params,
    );
    res.json(r.rows);
  } catch (e: any) {
    logger.error('ERP-DOCS', 'Erro ao listar arquivos da sub-pasta', { error: e.message });
    sendError(res, e, '[erp-documents GET /:id/files]');
  }
});

router.post('/:id/files', (req: any, res: any, next: any) => {
  fileUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      logger.error('ERP-DOCS', 'Erro no upload de arquivo da sub-pasta', { error: err.message });
      return res.status(400).json({ error: err.message || 'Erro no upload do arquivo' });
    }
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

      const docQ = await pool.query(`SELECT id FROM erp_documents WHERE id = $1`, [req.params.id]);
      if (!docQ.rows[0]) {
        removePhysical(`/uploads/${file.filename}`);
        return res.status(404).json({ error: 'Documento não encontrado' });
      }

      const url = `/uploads/${file.filename}`;
      const r = await pool.query(
        `INSERT INTO erp_document_files (document_id, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, document_id AS "documentId", arquivo_url AS "arquivoUrl", arquivo_nome AS "arquivoNome",
                   arquivo_tamanho::int AS "arquivoTamanho", arquivo_tipo AS "arquivoTipo",
                   created_by AS "createdBy", created_at AS "createdAt"`,
        [req.params.id, url, file.originalname, file.size, file.mimetype, req.user?.username || null],
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) {
      logger.error('ERP-DOCS', 'Erro ao criar arquivo na sub-pasta', { error: e.message });
      sendError(res, e, '[erp-documents POST /:id/files]');
    }
  });
});

router.delete('/:id/files/:fileId', async (req: any, res: any) => {
  try {
    const r = await pool.query(
      `DELETE FROM erp_document_files WHERE id = $1 AND document_id = $2 RETURNING arquivo_url`,
      [req.params.fileId, req.params.id],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Arquivo não encontrado' });
    removePhysical(r.rows[0].arquivo_url);
    res.json({ ok: true });
  } catch (e: any) {
    logger.error('ERP-DOCS', 'Erro ao eliminar arquivo da sub-pasta', { error: e.message });
    sendError(res, e, '[erp-documents DELETE /:id/files/:fileId]');
  }
});

router.post('/', async (req: any, res: any) => {
  try {
    const b = req.body || {};
    const nome = str(b.nome, 255);
    if (!nome) return res.status(400).json({ error: 'Nome do documento é obrigatório' });
    const r = await pool.query(
      `INSERT INTO erp_documents
         (nome, tipo, numeracao, empresa_emissora, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo, observacoes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, nome, tipo, numeracao, empresa_emissora AS "empresaEmissora",
                 arquivo_url AS "arquivoUrl", arquivo_nome AS "arquivoNome",
                 arquivo_tamanho::int AS "arquivoTamanho", arquivo_tipo AS "arquivoTipo",
                 observacoes, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        nome,
        str(b.tipo, 120),
        str(b.numeracao, 120),
        str(b.empresaEmissora, 300),
        str(b.arquivoUrl, 1000),
        str(b.arquivoNome, 500),
        num(b.arquivoTamanho),
        str(b.arquivoTipo, 200),
        str(b.observacoes, 2000),
        req.user?.username || null,
      ],
    );
    res.status(201).json(r.rows[0]);
  } catch (e: any) {
    logger.error('ERP-DOCS', 'Erro ao criar documento', { error: e.message });
    sendError(res, e, '[erp-documents POST]');
  }
});

router.put('/:id', async (req: any, res: any) => {
  try {
    const b = req.body || {};
    const sets: string[] = [];
    const params: any[] = [];
    const set = (col: string, v: any) => {
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    };
    if (b.nome !== undefined) {
      const nome = str(b.nome, 255);
      if (!nome) return res.status(400).json({ error: 'Nome do documento é obrigatório' });
      set('nome', nome);
    }
    if (b.tipo !== undefined) set('tipo', str(b.tipo, 120));
    if (b.numeracao !== undefined) set('numeracao', str(b.numeracao, 120));
    if (b.empresaEmissora !== undefined) set('empresa_emissora', str(b.empresaEmissora, 300));
    if (b.arquivoUrl !== undefined) set('arquivo_url', str(b.arquivoUrl, 1000));
    if (b.arquivoNome !== undefined) set('arquivo_nome', str(b.arquivoNome, 500));
    if (b.arquivoTamanho !== undefined) set('arquivo_tamanho', num(b.arquivoTamanho));
    if (b.arquivoTipo !== undefined) set('arquivo_tipo', str(b.arquivoTipo, 200));
    if (b.observacoes !== undefined) set('observacoes', str(b.observacoes, 2000));
    if (sets.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    sets.push('updated_at = NOW()');
    params.push(req.params.id);
    const r = await pool.query(
      `UPDATE erp_documents SET ${sets.join(', ')}
        WHERE id = $${params.length}
       RETURNING ${RETURN_COLUMNS}`,
      params,
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Documento não encontrado' });
    res.json(r.rows[0]);
  } catch (e: any) {
    logger.error('ERP-DOCS', 'Erro ao atualizar documento', { error: e.message });
    sendError(res, e, '[erp-documents PUT]');
  }
});

router.delete('/:id', async (req: any, res: any) => {
  try {
    // Remove físicamente todos los archivos de la sub-pasta y el principal.
    const filesQ = await pool.query(`SELECT arquivo_url FROM erp_document_files WHERE document_id = $1`, [req.params.id]);
    for (const row of filesQ.rows) removePhysical(row.arquivo_url);

    const r = await pool.query(`DELETE FROM erp_documents WHERE id = $1 RETURNING arquivo_url`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Documento não encontrado' });
    removePhysical(r.rows[0].arquivo_url);
    res.json({ ok: true });
  } catch (e: any) {
    sendError(res, e, '[erp-documents DELETE]');
  }
});

export default router;