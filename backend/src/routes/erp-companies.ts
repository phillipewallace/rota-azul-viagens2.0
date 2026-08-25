import { sendError } from '../utils/apiError';
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const MAX_COMPANIES = 3;

router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, razao_social AS "razaoSocial", nome_fantasia AS "nomeFantasia",
             cnpj, inscricao_estadual AS "inscricaoEstadual",
             endereco, cidade, estado, cep, telefone, email, logo_url AS "logoUrl",
             assinatura_url AS "assinaturaUrl",
             financeiro_contato AS "financeiroContato",
             sigla,
             ativo, created_at AS "createdAt"
        FROM erp_companies
       ORDER BY created_at ASC`);
    res.json(r.rows);
  } catch (e: any) {
    console.error('[ERP companies GET]', e);
    sendError(res, e);
  }
});

// Validação de CNPJ (algoritmo dígitos verificadores)
function isValidCnpj(raw: string): boolean {
  const c = (raw || '').replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (slice: number) => {
    const w = slice === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let s = 0;
    for (let i = 0; i < w.length; i++) s += parseInt(c[i]) * w[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(c[12]) && calc(13) === parseInt(c[13]);
}

router.post('/', async (req, res) => {
  try {
    const c = req.body || {};
    if (!c.razaoSocial || !c.cnpj) {
      return res.status(400).json({ error: 'razaoSocial e cnpj são obrigatórios' });
    }
    const cnpjDigits = String(c.cnpj).replace(/\D/g, '');
    if (!isValidCnpj(cnpjDigits)) {                          // [#30 baixo] valida CNPJ
      return res.status(400).json({ error: 'CNPJ inválido' });
    }
    // [#4 crítico] insert condicional dentro de transação — evita race no limite de empresas.
    const finContato = c.financeiroContato != null
      ? String(c.financeiroContato).trim().slice(0, 500) || null
      : null;
    const sigla = c.sigla != null && String(c.sigla).trim() !== ''
      ? String(c.sigla).trim().toUpperCase().slice(0, 6)
      : null;
    if (sigla && !/^[A-Z0-9_-]{1,6}$/.test(sigla)) {
      return res.status(400).json({ error: 'Sigla inválida (até 6 caracteres, A-Z/0-9/-/_)' });
    }
    const r = await pool.query(
      `INSERT INTO erp_companies
        (razao_social, nome_fantasia, cnpj, inscricao_estadual,
         endereco, cidade, estado, cep, telefone, email, logo_url, assinatura_url,
         financeiro_contato, sigla, ativo)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15,TRUE)
        WHERE (SELECT COUNT(*) FROM erp_companies) < ${MAX_COMPANIES}
       RETURNING *`,
      [c.razaoSocial, c.nomeFantasia || null, cnpjDigits,
       c.inscricaoEstadual || null, c.endereco || null, c.cidade || null,
       c.estado || null, c.cep || null, c.telefone || null, c.email || null,
       c.logoUrl || null, c.assinaturaUrl || null, finContato, sigla, c.ativo]
    );
    if (!r.rows[0]) {
      return res.status(400).json({ error: `Limite de ${MAX_COMPANIES} empresas atingido` });
    }
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error('[ERP companies POST]', e);
    if (String(e.message).includes('duplicate key')) {
      return res.status(400).json({ error: 'CNPJ já cadastrado' });
    }
    sendError(res, e);
  }
});


router.put('/:id', async (req, res) => {
  try {
    const c = req.body || {};
    const finContato = c.financeiroContato != null
      ? String(c.financeiroContato).trim().slice(0, 500) || null
      : null;
    const sigla = c.sigla !== undefined
      ? (c.sigla == null || String(c.sigla).trim() === ''
          ? null
          : String(c.sigla).trim().toUpperCase().slice(0, 6))
      : undefined;
    if (sigla && !/^[A-Z0-9_-]{1,6}$/.test(sigla)) {
      return res.status(400).json({ error: 'Sigla inválida (até 6 caracteres, A-Z/0-9/-/_)' });
    }
    const r = await pool.query(
      `UPDATE erp_companies SET
         razao_social = COALESCE($2, razao_social),
         nome_fantasia = $3,
         cnpj = COALESCE($4, cnpj),
         inscricao_estadual = $5,
         endereco = $6, cidade = $7, estado = $8, cep = $9,
         telefone = $10, email = $11, logo_url = $12,
         assinatura_url = $13,
         financeiro_contato = $14,
         sigla = COALESCE($16, sigla),
         ativo = COALESCE($15, ativo),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, c.razaoSocial, c.nomeFantasia || null,
       c.cnpj ? String(c.cnpj).replace(/\D/g, '') : null,
       c.inscricaoEstadual || null, c.endereco || null, c.cidade || null,
       c.estado || null, c.cep || null, c.telefone || null, c.email || null,
       c.logoUrl || null, c.assinaturaUrl || null, finContato, c.ativo,
       sigla === undefined ? null : sigla]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error('[ERP companies PUT]', e);
    sendError(res, e);
  }
});

router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM erp_companies WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[ERP companies DELETE]', e);
    sendError(res, e);
  }
});

export default router;
