import { sendError } from '../utils/apiError';
import { parsePagination, sendPaginated } from '../utils/pagination';
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireCompanyId(value: any) {
  const companyId = typeof value === 'string' ? value.trim() : '';
  if (!UUID_RE.test(companyId)) {
    const err: any = new Error('Empresa emissora obrigatória para numeração por empresa.');
    err.status = 400;
    throw err;
  }
  return companyId;
}

const SELECT = `
  c.id, c.numero, c.company_id AS "companyId", c.customer_id AS "customerId",
  c.os_id AS "osId", c.origem, c.descricao,
  c.tipo_contrato AS "tipoContrato",
  c.data_inicio AS "dataInicio", c.data_fim AS "dataFim",
  c.primeira_competencia AS "primeiraCompetencia",
  c.data_evento AS "dataEvento", c.data_recolhimento AS "dataRecolhimento",
  c.local_evento AS "localEvento", c.hora_entrega AS "horaEntrega",
  c.endereco_obra AS "enderecoObra", c.cno AS "cno",
  c.valor_total_evento AS "valorTotalEvento",
  c.dia_vencimento AS "diaVencimento",
  c.valor_mensal AS "valorMensal",
  c.frete AS "frete",

  c.renovacao_automatica AS "renovacaoAutomatica",
  c.ativo, c.encerrado_em AS "encerradoEm", c.motivo_encerramento AS "motivoEncerramento",
  c.pdf_url AS "pdfUrl", c.observacoes,
  c.responsavel_nome     AS "responsavelNome",
  c.responsavel_telefone AS "responsavelTelefone",
  c.responsavel_email    AS "responsavelEmail",
  c.company_snapshot AS "companySnapshot", c.customer_snapshot AS "customerSnapshot",
  c.created_at AS "createdAt",
  emp.razao_social AS "companyRazaoSocial", emp.cnpj AS "companyCnpj",
  emp.logo_url AS "companyLogoUrl",
  cu.customer_name AS "customerName", cu.document AS "customerDocument",
  os.numero AS "osNumero"
`;

router.get('/', async (req, res) => {
  try {
    const { ativo, customerId, tipoContrato, companyId, search, vencendo } =
      req.query as Record<string, string | undefined>;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (ativo === 'true')  conds.push(`c.ativo = TRUE`);
    if (ativo === 'false') conds.push(`c.ativo = FALSE`);
    if (customerId) { params.push(customerId); conds.push(`c.customer_id = $${params.length}`); }
    if (tipoContrato) { params.push(tipoContrato); conds.push(`COALESCE(c.tipo_contrato,'locacao') = $${params.length}`); }
    if (companyId) { params.push(companyId); conds.push(`c.company_id = $${params.length}`); }
    if (vencendo === 'true') {
      conds.push(`c.ativo = TRUE AND c.data_fim IS NOT NULL AND c.data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`);
    }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      conds.push(`(c.numero ILIKE $${n} OR cu.customer_name ILIKE $${n} OR emp.razao_social ILIKE $${n} OR c.descricao ILIKE $${n})`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const from = `FROM erp_contracts c
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         LEFT JOIN erp_service_orders os ON os.id = c.os_id
         ${where}`;
    const pg = parsePagination(req, params.length);
    const rowsQ = await pool.query(
      `SELECT ${SELECT} ${from}
         ORDER BY c.ativo DESC, c.created_at DESC ${pg.sql}`,
      [...params, ...pg.params]
    );
    if (pg.paginated) {
      const totalQ = await pool.query(`SELECT COUNT(*)::int AS c ${from}`, params);
      return sendPaginated(res, rowsQ.rows, totalQ.rows[0].c, pg);
    }
    res.json(rowsQ.rows);
  } catch (e: any) { sendError(res, e); }
});

// KPIs agregados server-side (ativos, MRR, vencendo 30d, encerrados no mês)
router.get('/stats/kpis', async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE ativo)::int AS ativos,
        COALESCE(SUM(valor_mensal) FILTER (WHERE ativo), 0)::float AS mrr,
        COUNT(*) FILTER (WHERE ativo AND data_fim IS NOT NULL
                          AND data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::int AS vencendo,
        COUNT(*) FILTER (WHERE NOT ativo
                          AND encerrado_em IS NOT NULL
                          AND date_trunc('month', encerrado_em) = date_trunc('month', CURRENT_DATE))::int AS "encerradosMes"
      FROM erp_contracts`);
    res.json(r.rows[0] || { ativos: 0, mrr: 0, vencendo: 0, encerradosMes: 0 });
  } catch (e: any) { sendError(res, e); }
});


router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ${SELECT}
         FROM erp_contracts c
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
         LEFT JOIN customers cu ON cu.id = c.customer_id
         LEFT JOIN erp_service_orders os ON os.id = c.os_id
         WHERE c.id = $1`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.post('/', async (req, res) => {
  const c = req.body || {};
  const client = await pool.connect();
  try {
    const companyId = requireCompanyId(c.companyId);
    await client.query('BEGIN');
    const numRes = await client.query(
      `SELECT erp_next_doc_number('CTR', $1::uuid) AS num`,
      [companyId]
    );
    const numero = numRes.rows[0].num;

    let companySnap: any = null, customerSnap: any = null;
    const cc = await client.query('SELECT * FROM erp_companies WHERE id=$1', [companyId]);
    companySnap = cc.rows[0] || null;
    if (!companySnap) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Empresa emissora não encontrada.' });
    }
    if (c.customerId) {
      const cu = await client.query('SELECT * FROM customers WHERE id=$1', [c.customerId]);
      customerSnap = cu.rows[0] || null;
    }

    // Competência do 1º faturamento (opcional): normaliza para YYYY-MM.
    const normComp = (v: any): string | null => {
      const s = typeof v === 'string' ? v.trim() : '';
      if (!s) return null;
      const m = s.match(/^(\d{4})-(\d{2})/);
      return m ? `${m[1]}-${m[2]}` : null;
    };

    const ins = await client.query(
      `INSERT INTO erp_contracts
        (numero, company_id, customer_id, os_id, origem, descricao,
         tipo_contrato, data_inicio, data_fim,
         data_evento, data_recolhimento, local_evento, hora_entrega, valor_total_evento,
         dia_vencimento, valor_mensal,
         renovacao_automatica, ativo, pdf_url, observacoes,
         company_snapshot, customer_snapshot, frete, endereco_obra, cno,
         responsavel_nome, responsavel_telefone, responsavel_email,
         primeira_competencia)
       VALUES ($1,$2,$3,$4,COALESCE($5,'manual'),$6,
               COALESCE($7,'locacao'),$8,$9,
               $10,$11,$12,$13,$14,
               COALESCE($15,10),COALESCE($16,0),
               COALESCE($17,TRUE),COALESCE($18,TRUE),$19,$20,$21,$22,COALESCE($23,0),$24,$25,
               $26,$27,$28,$29)
       RETURNING id, numero`,
      [numero, companyId, c.customerId || null, c.osId || null,
       c.origem || null, c.descricao || null,
       c.tipoContrato || null,
       c.dataInicio, c.dataFim || null,
       c.dataEvento || null, c.dataRecolhimento || null, c.localEvento || null,
       c.horaEntrega || null, c.valorTotalEvento != null ? Number(c.valorTotalEvento) : null,
       c.diaVencimento ?? 10, c.valorMensal ?? 0,
       c.renovacaoAutomatica, c.ativo, c.pdfUrl || null, c.observacoes || null,
       companySnap, customerSnap, c.frete != null ? Number(c.frete) : 0,
       c.enderecoObra || null, c.cno || null,
       c.responsavelNome || null, c.responsavelTelefone || null, c.responsavelEmail || null,
       normComp(c.primeiraCompetencia)]
    );

    await client.query('COMMIT');
    res.json(ins.rows[0]);
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-contracts POST]', e);
    sendError(res, e);
  } finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  try {
    const c = req.body || {};
    // Competência do 1º faturamento (opcional): normaliza para YYYY-MM.
    // `undefined` = campo não enviado (mantém o valor atual); '' = limpar.
    const primeiraComp = c.primeiraCompetencia === undefined
      ? undefined
      : (() => {
          const s = typeof c.primeiraCompetencia === 'string' ? c.primeiraCompetencia.trim() : '';
          const m = s.match(/^(\d{4})-(\d{2})/);
          return m ? `${m[1]}-${m[2]}` : null;
        })();
    await pool.query(
      `UPDATE erp_contracts SET
         company_id = COALESCE($2, company_id),
         customer_id = COALESCE($3, customer_id),
         os_id = $4,
         descricao = $5,
         tipo_contrato = COALESCE($6, tipo_contrato),
         data_inicio = COALESCE($7, data_inicio),
         data_fim = $8,
         data_evento = $9,
         data_recolhimento = $10,
         local_evento = $11,
         hora_entrega = $12,
         valor_total_evento = $13,
         dia_vencimento = COALESCE($14, dia_vencimento),
         valor_mensal = COALESCE($15, valor_mensal),
         renovacao_automatica = COALESCE($16, renovacao_automatica),
         ativo = COALESCE($17, ativo),
         pdf_url = COALESCE($18, pdf_url),
         observacoes = $19,
         motivo_encerramento = $20,
         frete = COALESCE($21, frete),
         endereco_obra = $22,
         cno = $23,
         responsavel_nome     = $24,
         responsavel_telefone = $25,
         responsavel_email    = $26,
         primeira_competencia = CASE WHEN $27::boolean THEN $28::text ELSE primeira_competencia END,
         -- [#7 alto] encerrado_em só muda quando $17 vem definido; null deixa intacto.
         encerrado_em = CASE
           WHEN $17::boolean IS NULL THEN encerrado_em
           WHEN $17 = FALSE AND ativo = TRUE THEN NOW()
           WHEN $17 = TRUE THEN NULL
           ELSE encerrado_em
         END,
         updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, c.companyId || null, c.customerId || null, c.osId || null,
       c.descricao ?? null, c.tipoContrato || null,
       c.dataInicio || null, c.dataFim || null,
       c.dataEvento || null, c.dataRecolhimento || null, c.localEvento || null,
       c.horaEntrega || null, c.valorTotalEvento != null ? Number(c.valorTotalEvento) : null,
       c.diaVencimento ?? null, c.valorMensal ?? null,
       c.renovacaoAutomatica, c.ativo, c.pdfUrl || null,
       c.observacoes ?? null, c.motivoEncerramento ?? null,
       c.frete != null ? Number(c.frete) : null,
       c.enderecoObra ?? null, c.cno ?? null,
       c.responsavelNome ?? null, c.responsavelTelefone ?? null, c.responsavelEmail ?? null,
       primeiraComp !== undefined, primeiraComp ?? null]
    );
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});


router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    // [#26 baixo] Bloqueia exclusão de contrato com recibos associados.
    const dep = await client.query(
      `SELECT COUNT(*)::int AS n FROM erp_receipts WHERE contract_id=$1`,
      [req.params.id]
    );
    if ((dep.rows[0]?.n || 0) > 0) {
      return res.status(400).json({
        error: `Contrato possui ${dep.rows[0].n} recibo(s) emitido(s). Encerre o contrato em vez de excluí-lo.`,
      });
    }
    await client.query('BEGIN');
    // Reseta vínculo na OS de origem (se houver) para permitir re-geração do contrato.
    await client.query(
      `UPDATE erp_service_orders
          SET converted_contract_id = NULL, converted_at = NULL, updated_at = NOW()
        WHERE converted_contract_id = $1`,
      [req.params.id]
    );
    const r = await client.query('DELETE FROM erp_contracts WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'não encontrado' }); }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    sendError(res, e);
  } finally { client.release(); }
});


export default router;
