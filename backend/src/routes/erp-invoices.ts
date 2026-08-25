/**
 * ERP → Notas Fiscais — vinculação de NF emitida no portal do governo
 * a um contrato + competência. Substitui o fluxo antigo de "Marcar pago"
 * quando o cliente pagou por NF (não por recibo do app).
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';
import { sendError } from '../utils/apiError';
import { parsePagination, sendPaginated } from '../utils/pagination';

// Valida "YYYY-MM-DD" como data real (rejeita mês 13, dia 32, etc.).
function isValidISODate(s: any): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}
// Valida número financeiro: finito, >= 0.
function parseMoney(v: any): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN as any;
}
const actor = (req: any) => req.user?.username || req.user?.name || null;

const router = Router();
router.use(requireAuth);

// Papéis autorizados a mutar dados financeiros (NF).
const FIN_ROLES = ['admin', 'manager'] as const;

const invoicesDir = path.join(__dirname, '../../uploads/invoices');
// Garante o diretório na inicialização (síncrono só aqui — não em request path).
if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

// Remove arquivo sem lançar (helper reutilizável, async).
const safeUnlink = async (filename?: string | null) => {
  if (!filename) return;
  try { await fsp.unlink(path.join(invoicesDir, filename)); } catch {}
};

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, invoicesDir),
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!/pdf/i.test(file.mimetype) && !/\.pdf$/i.test(file.originalname)) {
      return cb(new Error('Somente PDF é aceito'));
    }
    cb(null, true);
  },
});

const SELECT = `
  i.id, i.contract_id AS "contractId", i.competencia,
  i.numero, i.serie,
  i.data_emissao AS "dataEmissao",
  i.valor,
  i.forma_pagamento AS "formaPagamento",
  i.observacoes,
  i.pdf_url AS "pdfUrl",
  i.pdf_original_filename AS "pdfOriginalFilename",
  i.pdf_stored_filename   AS "pdfStoredFilename",
  i.pdf_size_bytes AS "pdfSizeBytes",
  i.status,
  i.cancelado_em AS "canceladoEm",
  i.motivo_cancelamento AS "motivoCancelamento",
  i.created_by AS "createdBy",
  i.created_at AS "createdAt",
  i.updated_at AS "updatedAt",
  c.numero AS "contractNumero",
  c.company_id AS "companyId",
  emp.razao_social AS "companyRazaoSocial", emp.cnpj AS "companyCnpj",
  cu.customer_name AS "customerName", cu.document AS "customerDocument"
`;

// ---------- LIST ---------------------------------------------------------
router.get('/', async (req: any, res: any) => {
  try {
    const { contractId, competencia, from, to, status, formaPagamento, companyId, search } =
      req.query || {};
    const conds: string[] = [];
    const params: any[] = [];
    const push = (sql: string, val: any) => { params.push(val); conds.push(sql.replace('?', `$${params.length}`)); };

    if (contractId)     push('i.contract_id = ?', contractId);
    if (competencia)    push('i.competencia = ?', competencia);
    if (from)           push('i.data_emissao >= ?', from);
    if (to)             push('i.data_emissao <= ?', to);
    if (status)         push('i.status = ?', status);
    if (formaPagamento) push('i.forma_pagamento = ?', formaPagamento);
    if (companyId)      push('c.company_id = ?', companyId);
    if (search) {
      const s = `%${String(search).toLowerCase()}%`;
      params.push(s);
      conds.push(`(LOWER(i.numero) LIKE $${params.length}
                OR LOWER(COALESCE(cu.customer_name,'')) LIKE $${params.length}
                OR LOWER(COALESCE(c.numero,'')) LIKE $${params.length}
                OR LOWER(COALESCE(emp.razao_social,'')) LIKE $${params.length})`);
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const fromSql = `FROM erp_invoices i
         JOIN erp_contracts c ON c.id = i.contract_id
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         ${where}`;
    const pg = parsePagination(req, params.length);
    const rowsQ = await pool.query(
      `SELECT ${SELECT} ${fromSql}
        ORDER BY i.data_emissao DESC, i.created_at DESC
        ${pg.sql}`,
      [...params, ...pg.params],
    );
    if (pg.paginated) {
      const totalQ = await pool.query(`SELECT COUNT(*)::int AS c ${fromSql}`, params);
      return sendPaginated(res, rowsQ.rows, totalQ.rows[0].c, pg);
    }
    res.json(rowsQ.rows);
  } catch (e: any) {
    return sendError(res, e, '[erp-invoices GET]');
  }
});

// ---------- KPIs (respeitam os mesmos filtros server-side, sem paginação) ----
router.get('/stats/kpis', async (req: any, res: any) => {
  try {
    const { contractId, competencia, from, to, status, formaPagamento, companyId, search } =
      req.query || {};
    const conds: string[] = [];
    const params: any[] = [];
    const push = (sql: string, val: any) => { params.push(val); conds.push(sql.replace('?', `$${params.length}`)); };
    if (contractId)     push('i.contract_id = ?', contractId);
    if (competencia)    push('i.competencia = ?', competencia);
    if (from)           push('i.data_emissao >= ?', from);
    if (to)             push('i.data_emissao <= ?', to);
    if (status)         push('i.status = ?', status);
    if (formaPagamento) push('i.forma_pagamento = ?', formaPagamento);
    if (companyId)      push('c.company_id = ?', companyId);
    if (search) {
      const s = `%${String(search).toLowerCase()}%`;
      params.push(s);
      conds.push(`(LOWER(i.numero) LIKE $${params.length}
                OR LOWER(COALESCE(cu.customer_name,'')) LIKE $${params.length}
                OR LOWER(COALESCE(c.numero,'')) LIKE $${params.length}
                OR LOWER(COALESCE(emp.razao_social,'')) LIKE $${params.length})`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const q = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE i.status='ativa')::int      AS "qtdAtivas",
        COUNT(*) FILTER (WHERE i.status='cancelada')::int  AS "qtdCanceladas",
        COALESCE(SUM(CASE WHEN i.status='ativa' THEN i.valor ELSE 0 END), 0)::float AS "totalAtivo",
        COALESCE(AVG(CASE WHEN i.status='ativa' THEN i.valor END), 0)::float        AS "ticketMedio"
      FROM erp_invoices i
      JOIN erp_contracts c ON c.id = i.contract_id
      LEFT JOIN erp_companies emp ON emp.id = c.company_id
      LEFT JOIN customers cu ON cu.id = c.customer_id
      ${where}`, params);
    res.json(q.rows[0] || {
      total: 0, qtdAtivas: 0, qtdCanceladas: 0, totalAtivo: 0, ticketMedio: 0,
    });
  } catch (e: any) { return sendError(res, e, '[erp-invoices kpis]'); }
});

router.get('/:id', async (req: any, res: any) => {
  try {
    const r = await pool.query(
      `SELECT ${SELECT}
         FROM erp_invoices i
         JOIN erp_contracts c ON c.id = i.contract_id
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
        WHERE i.id = $1`,
      [req.params.id],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    res.json(r.rows[0]);
  } catch (e: any) { return sendError(res, e, '[erp-invoices GET id]'); }
});

// ---------- CREATE (multipart) ------------------------------------------
router.post('/', requireRole(...FIN_ROLES), (req: any, res: any) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Erro no upload' });
    const file = req.file;
    let keepFile = false;                       // libera o cleanup no finally
    try {
      const {
        contractId, competencia, numero, serie, dataEmissao, valor,
        formaPagamento, observacoes,
      } = req.body || {};
      if (!file)         return res.status(400).json({ error: 'PDF da nota fiscal é obrigatório' });
      if (!contractId)   return res.status(400).json({ error: 'contractId obrigatório' });
      if (!numero)       return res.status(400).json({ error: 'Número da NF obrigatório' });
      if (!dataEmissao)  return res.status(400).json({ error: 'Data de emissão obrigatória' });
      if (!isValidISODate(dataEmissao)) {
        return res.status(400).json({ error: 'Data de emissão inválida (use YYYY-MM-DD).' });
      }
      const valorNum = parseMoney(valor);
      if (valorNum === null || Number.isNaN(valorNum)) {
        return res.status(400).json({ error: 'Valor da NF inválido (deve ser um número ≥ 0).' });
      }

      // A competência enviada pela linha pendente é a fonte de verdade. A data
      // de emissão pode pertencer a outro mês (faturamento antecipado).
      const comp = typeof competencia === 'string' ? competencia.trim() : '';
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(comp)) {
        return res.status(400).json({ error: 'Competência obrigatória e inválida (use YYYY-MM).' });
      }

      const url = `/uploads/invoices/${file.filename}`;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const contract = await client.query(
          'SELECT id FROM erp_contracts WHERE id=$1 FOR SHARE',
          [contractId],
        );
        if (!contract.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Contrato não encontrado.' });
        }

        // Impede duplicidade de NF ativa na mesma competência do contrato.
        const dup = await client.query(
          `SELECT id, numero FROM erp_invoices
            WHERE contract_id = $1 AND competencia = $2 AND status = 'ativa' LIMIT 1`,
          [contractId, comp],
        );
        if (dup.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `Já existe uma NF ativa (${dup.rows[0].numero}) nessa competência para este contrato.`,
          });
        }

        const r = await client.query(
          `INSERT INTO erp_invoices
             (contract_id, competencia, numero, serie, data_emissao, valor,
              forma_pagamento, observacoes,
              pdf_url, pdf_original_filename, pdf_stored_filename, pdf_size_bytes,
              created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING id`,
          [
            contractId, comp, String(numero).trim(), serie || null,
            dataEmissao, valorNum,
            formaPagamento || null, observacoes || null,
            url, file.originalname, file.filename, file.size || null,
            actor(req),
          ],
        );
        await client.query(
          `INSERT INTO erp_invoice_billed_competences
             (invoice_id, contract_id, competencia, reconciled)
           VALUES ($1, $2, $3, FALSE)
           ON CONFLICT (invoice_id, competencia)
           DO UPDATE SET contract_id=EXCLUDED.contract_id, reconciled=FALSE`,
          [r.rows[0].id, contractId, comp],
        );
        await client.query('COMMIT');
        keepFile = true;
        res.json({ ok: true, id: r.rows[0].id, contractId, competencia: comp });
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    } catch (e: any) {
      return sendError(res, e, '[erp-invoices POST]');
    } finally {
      if (file && !keepFile) await safeUnlink(file.filename);
    }
  });
});

// ---------- UPDATE metadata ---------------------------------------------
router.patch('/:id', requireRole(...FIN_ROLES), async (req: any, res: any) => {
  const body = req.body || {};
  const { numero, dataEmissao, valor, formaPagamento, competencia } = body;
  const serieProvided = Object.prototype.hasOwnProperty.call(body, 'serie');
  const obsProvided   = Object.prototype.hasOwnProperty.call(body, 'observacoes');
  const formaProvided = Object.prototype.hasOwnProperty.call(body, 'formaPagamento');

  // Validações defensivas antes de tocar em transação.
  if (dataEmissao && !isValidISODate(dataEmissao)) {
    return res.status(400).json({ error: 'Data de emissão inválida (use YYYY-MM-DD).' });
  }
  if (competencia !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(competencia))) {
    return res.status(400).json({ error: 'Competência inválida (use YYYY-MM).' });
  }
  let valorNum: number | null = null;
  if (valor !== undefined && valor !== null) {
    const v = parseMoney(valor);
    if (v === null || Number.isNaN(v)) {
      return res.status(400).json({ error: 'Valor inválido (deve ser número ≥ 0).' });
    }
    valorNum = v;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock da NF em edição — evita TOCTOU entre dup-check e UPDATE.
    const cur = await client.query(
      'SELECT status, contract_id, competencia FROM erp_invoices WHERE id=$1 FOR UPDATE',
      [req.params.id],
    );
    if (!cur.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    }
    if (cur.rows[0].status === 'cancelada') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'NF cancelada — reative para editar (contate um administrador).' });
    }

    let newComp: string | null = null;
    if (competencia !== undefined) {
      const comp = String(competencia);
      if (comp !== cur.rows[0].competencia) {
        const dup = await client.query(
          `SELECT id, numero FROM erp_invoices
            WHERE contract_id = $1 AND competencia = $2
              AND status = 'ativa' AND id <> $3 LIMIT 1`,
          [cur.rows[0].contract_id, comp, req.params.id],
        );
        if (dup.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `Já existe uma NF ativa (${dup.rows[0].numero}) na competência ${comp} para este contrato.`,
          });
        }
        newComp = comp;
      }
    }

    const norm = (v: any) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s.length ? s : null;
    };

    await client.query(
      `UPDATE erp_invoices
          SET numero = COALESCE($2, numero),
              serie  = CASE WHEN $3::boolean THEN $4 ELSE serie END,
              data_emissao = COALESCE($5, data_emissao),
              competencia  = COALESCE($11, competencia),
              valor  = COALESCE($6, valor),
              forma_pagamento = CASE WHEN $7::boolean THEN $8 ELSE forma_pagamento END,
              observacoes     = CASE WHEN $9::boolean THEN $10 ELSE observacoes END,
              updated_by = $12,
              updated_at = NOW()
        WHERE id = $1`,
      [req.params.id,
       numero ? String(numero).trim() : null,
       serieProvided, serieProvided ? norm(body.serie) : null,
       dataEmissao || null,
       valorNum,
       formaProvided, formaProvided ? norm(formaPagamento) : null,
       obsProvided, obsProvided ? norm(body.observacoes) : null,
       newComp,
       actor(req)],
    );
    if (newComp) {
      await client.query(
        `DELETE FROM erp_invoice_billed_competences
          WHERE invoice_id=$1 AND competencia=$2`,
        [req.params.id, cur.rows[0].competencia],
      );
      await client.query(
        `INSERT INTO erp_invoice_billed_competences
           (invoice_id, contract_id, competencia, reconciled)
         VALUES ($1, $2, $3, FALSE)
         ON CONFLICT (invoice_id, competencia)
         DO UPDATE SET contract_id=EXCLUDED.contract_id, reconciled=FALSE`,
        [req.params.id, cur.rows[0].contract_id, newComp],
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    return sendError(res, e, '[erp-invoices PATCH]');
  } finally {
    client.release();
  }
});

// ---------- REPLACE PDF -------------------------------------------------
router.post('/:id/replace-pdf', requireRole(...FIN_ROLES), (req: any, res: any) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Erro no upload' });
    const file = req.file;
    let keepFile = false;
    let oldStored: string | null = null;
    try {
      if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      const cur = await pool.query(
        'SELECT pdf_stored_filename, updated_at FROM erp_invoices WHERE id=$1',
        [req.params.id],
      );
      if (!cur.rows[0]) return res.status(404).json({ error: 'Nota fiscal não encontrada' });

      // Lock otimista: só atualiza se ninguém trocou o PDF entre o SELECT e o UPDATE.
      // Evita que uploads concorrentes apaguem o PDF "vencedor" na race.
      const url = `/uploads/invoices/${file.filename}`;
      const upd = await pool.query(
        `UPDATE erp_invoices
            SET pdf_url = $2,
                pdf_original_filename = $3,
                pdf_stored_filename   = $4,
                pdf_size_bytes        = $5,
                updated_at            = NOW()
          WHERE id = $1 AND updated_at = $6
          RETURNING id`,
        [req.params.id, url, file.originalname, file.filename, file.size || null,
         cur.rows[0].updated_at],
      );
      if (upd.rowCount === 0) {
        return res.status(409).json({
          error: 'Outra troca de PDF ocorreu ao mesmo tempo. Recarregue e tente novamente.',
        });
      }
      keepFile = true;
      oldStored = cur.rows[0].pdf_stored_filename || null;
      res.json({ ok: true, pdfUrl: url });
    } catch (e: any) {
      return sendError(res, e, '[erp-invoices replace-pdf]');
    } finally {
      if (file && !keepFile) await safeUnlink(file.filename);
      if (keepFile && oldStored) await safeUnlink(oldStored);
    }
  });
});

// ---------- CANCEL (soft) -----------------------------------------------
router.post('/:id/cancel', requireRole(...FIN_ROLES), async (req: any, res: any) => {
  try {
    const { motivo } = req.body || {};
    if (!motivo || !String(motivo).trim()) {
      return res.status(400).json({ error: 'motivo é obrigatório' });
    }
    const cur = await pool.query('SELECT status FROM erp_invoices WHERE id=$1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    if (cur.rows[0].status === 'cancelada') {
      return res.status(409).json({ error: 'NF já está cancelada.' });
    }
    await pool.query(
      `UPDATE erp_invoices
          SET status = 'cancelada',
              cancelado_em = NOW(),
              motivo_cancelamento = $2,
              cancelado_por = $3,
              updated_by = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [req.params.id, String(motivo).trim(), actor(req)],
    );
    res.json({ ok: true });
  } catch (e: any) { return sendError(res, e, '[erp-invoices cancel]'); }
});

// ---------- DELETE (admin/manager) --------------------------------------
router.delete('/:id', requireRole('admin', 'manager'), async (req: any, res: any) => {
  try {
    const r = await pool.query(
      'DELETE FROM erp_invoices WHERE id=$1 RETURNING pdf_stored_filename',
      [req.params.id],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    await safeUnlink(r.rows[0].pdf_stored_filename);
    res.json({ ok: true });
  } catch (e: any) { return sendError(res, e, '[erp-invoices DELETE]'); }
});

export default router;
