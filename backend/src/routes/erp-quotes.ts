import { sendError } from '../utils/apiError';
import { parsePagination, sendPaginated } from '../utils/pagination';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';
import { logger } from '../utils/logger';

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

// Upload de PDF do orçamento — usado ao compartilhar por WhatsApp/e-mail
// (o wa.me exige URL pública, então salvamos em uploads/quotes/, público).
const quotesPdfDir = path.join(__dirname, '../../uploads/quotes');
if (!fs.existsSync(quotesPdfDir)) fs.mkdirSync(quotesPdfDir, { recursive: true });
const quotePdfUpload = multer({
  storage: multer.diskStorage({
    destination: (_req: any, _file: any, cb: any) => cb(null, quotesPdfDir),
    filename: (req: any, _file: any, cb: any) => cb(null, `${req.params.id}.pdf`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!/pdf/i.test(file.mimetype) && !/\.pdf$/i.test(file.originalname)) {
      return cb(new Error('Somente PDF é aceito'));
    }
    cb(null, true);
  },
});

const QUOTE_SELECT = `
  q.id, q.numero, q.company_id AS "companyId", q.customer_id AS "customerId",
  q.customer_snapshot AS "customerSnapshot", q.company_snapshot AS "companySnapshot",
  q.modalidade, q.tipo_locacao AS "tipoLocacao",
  q.data_emissao AS "dataEmissao", q.validade_dias AS "validadeDias",
  q.data_entrega AS "dataEntrega", q.data_recolhimento AS "dataRecolhimento",
  q.endereco_entrega AS "enderecoEntrega",
  q.limpezas_semanais AS "limpezasSemanais",
  q.observacoes, q.condicoes_pagamento AS "condicoesPagamento",
  q.forma_pagamento AS "formaPagamento",
  q.desconto_pct AS "descontoPct", q.frete, q.subtotal, q.total,
  q.status, q.pdf_gerado_em AS "pdfGeradoEm",
  q.created_at AS "createdAt", q.updated_at AS "updatedAt",
  q.responsavel_nome     AS "responsavelNome",
  q.responsavel_telefone AS "responsavelTelefone",
  q.responsavel_email    AS "responsavelEmail",
  c.razao_social AS "companyRazaoSocial", c.cnpj AS "companyCnpj",
  cu.customer_name AS "customerName", cu.document AS "customerDocument"
`;

// [bug fix] strings vazias vindas do front quebram colunas DATE no Postgres
function emptyToNull(v: any) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    // Previne estouro de range de data e "Invalid Date"
    if (trimmed === '' || trimmed.toLowerCase() === 'invalid date') return null;
    
    // Padrão de erro de fuso horário/data inválida (ex: +020216-08)
    // Postgres code 22009: time zone displacement out of range
    if (trimmed.startsWith('+') && trimmed.length > 6) return null;
    
    // Se parecer uma data ISO mas com ano inválido/gigante
    if (trimmed.length > 10 && /^\+?\d{5,}/.test(trimmed)) return null;

    return trimmed;
  }
  return v;
}

function calcTotals(items: any[], descontoPct = 0, frete = 0) {
  const subtotal = items.reduce((acc, it) => acc + Number(it.quantidade || 0) * Number(it.valorUnitario || 0), 0);
  const desconto = subtotal * (Number(descontoPct) || 0) / 100;
  const total = Math.max(0, subtotal - desconto + Number(frete || 0));
  return { subtotal: +subtotal.toFixed(2), total: +total.toFixed(2) };
}

async function loadItems(quoteId: string) {
  const r = await pool.query(
    `SELECT id, produto, descricao, quantidade, valor_unitario AS "valorUnitario",
            valor_total AS "valorTotal", ordem, is_sanitario AS "isSanitario",
            is_generic_service AS "isGenericService"

       FROM erp_quote_items WHERE quote_id = $1 ORDER BY ordem ASC, id ASC`,
    [quoteId]
  );
  return r.rows;
}

router.get('/', async (req, res) => {
  try {
    const { status, customerId, modalidade, companyId, search } = req.query as any;
    const conds: string[] = [];
    const params: any[] = [];
    if (status)      { params.push(status);       conds.push(`q.status = $${params.length}`); }
    if (customerId)  { params.push(customerId);   conds.push(`q.customer_id = $${params.length}`); }
    if (modalidade)  { params.push(modalidade);   conds.push(`q.modalidade = $${params.length}`); }
    if (companyId)   { params.push(companyId);    conds.push(`q.company_id = $${params.length}`); }
    if (search) {
      const s = `%${String(search).toLowerCase()}%`;
      params.push(s);
      conds.push(`(LOWER(q.numero) LIKE $${params.length}
                OR LOWER(COALESCE(cu.customer_name,'')) LIKE $${params.length}
                OR LOWER(COALESCE(c.razao_social,'')) LIKE $${params.length})`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const from = `FROM erp_quotes q
         LEFT JOIN erp_companies c ON c.id = q.company_id
         LEFT JOIN customers cu ON cu.id = q.customer_id
         ${where}`;
    const pg = parsePagination(req, params.length);
    const rowsQ = await pool.query(
      `SELECT ${QUOTE_SELECT} ${from}
         ORDER BY q.created_at DESC ${pg.sql}`,
      [...params, ...pg.params]
    );
    if (pg.paginated) {
      const totalQ = await pool.query(`SELECT COUNT(*)::int AS c ${from}`, params);
      return sendPaginated(res, rowsQ.rows, totalQ.rows[0].c, pg);
    }
    res.json(rowsQ.rows);
  } catch (e: any) {
    console.error('[erp-quotes GET]', e);
    sendError(res, e);
  }
});

/**
 * KPIs de orçamentos — evita carregar toda a lista só para computar totais
 * quando o front usa paginação server-side.
 *
 * Retorna:
 *   - rascunhos:         total com status='rascunho'
 *   - enviados:          total com status='enviado'
 *   - aprovadosMes:      total com status='aprovado' no mês corrente (updated_at)
 *   - valorAprovadosMes: soma total dos aprovados no mês
 *   - ticketMedio:       média de total entre 'aprovado' e 'convertido'
 */
router.get('/stats/kpis', async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='rascunho')::int AS rascunhos,
        COUNT(*) FILTER (WHERE status='enviado')::int  AS enviados,
        COUNT(*) FILTER (WHERE status='aprovado'
                          AND to_char(updated_at,'YYYY-MM') = to_char(NOW(),'YYYY-MM'))::int
                                                       AS "aprovadosMes",
        COALESCE(SUM(total) FILTER (WHERE status='aprovado'
                          AND to_char(updated_at,'YYYY-MM') = to_char(NOW(),'YYYY-MM')),0)::float
                                                       AS "valorAprovadosMes",
        COALESCE(AVG(total) FILTER (WHERE status IN ('aprovado','convertido')),0)::float
                                                       AS "ticketMedio"
      FROM erp_quotes
    `);
    res.json(r.rows[0]);
  } catch (e: any) {
    sendError(res, e);
  }
});


router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ${QUOTE_SELECT}
         FROM erp_quotes q
         LEFT JOIN erp_companies c ON c.id = q.company_id
         LEFT JOIN customers cu ON cu.id = q.customer_id
         WHERE q.id = $1`, [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    const quote = r.rows[0];
    quote.items = await loadItems(req.params.id);
    res.json(quote);
  } catch (e: any) {
    sendError(res, e);
  }
});

router.post('/', async (req, res) => {
  const c = req.body || {};
  const user = (req as any).user?.username || (req as any).user?.nome;
  logger.info('QUOTES', `Solicitação de novo orçamento por ${user}`, { customerId: c.customerId });
  
  const items = Array.isArray(c.items) ? c.items : [];
  const client = await pool.connect();
  try {
    const companyId = requireCompanyId(c.companyId);
    await client.query('BEGIN');
    const numRes = await client.query(
      `SELECT erp_next_doc_number('ORC', $1::uuid) AS num`,
      [companyId]
    );
    const numero = numRes.rows[0].num;
    const { subtotal, total } = calcTotals(items, c.descontoPct, c.frete);

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

    const ins = await client.query(
      `INSERT INTO erp_quotes
         (numero, company_id, customer_id, company_snapshot, customer_snapshot,
          modalidade, tipo_locacao, data_emissao, validade_dias, observacoes, condicoes_pagamento,
          desconto_pct, frete, subtotal, total, status, data_entrega, limpezas_semanais,
          endereco_entrega, data_recolhimento, forma_pagamento,
          responsavel_nome, responsavel_telefone, responsavel_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,CURRENT_DATE),$9,$10,$11,$12,$13,$14,$15,COALESCE($16,'rascunho'),$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING id`,
      [numero, companyId, c.customerId || null, companySnap, customerSnap,
       c.modalidade || 'mensal', c.tipoLocacao || null, emptyToNull(c.dataEmissao), c.validadeDias || 15,
       c.observacoes || null, c.condicoesPagamento || null,
       c.descontoPct || 0, c.frete || 0, subtotal, total, c.status,
       emptyToNull(c.dataEntrega), c.limpezasSemanais ?? null,
       c.enderecoEntrega || null, emptyToNull(c.dataRecolhimento),
       c.formaPagamento || null,
       c.responsavelNome || null, c.responsavelTelefone || null, c.responsavelEmail || null]
    );
    const quoteId = ins.rows[0].id;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const linha = +(Number(it.quantidade || 0) * Number(it.valorUnitario || 0)).toFixed(2);
      await client.query(
        `INSERT INTO erp_quote_items (quote_id, produto, descricao, quantidade, valor_unitario, valor_total, ordem, is_sanitario, is_generic_service)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [quoteId, it.produto || 'Item', it.descricao || null,
         it.quantidade || 1, it.valorUnitario || 0, linha, i, it.isSanitario || false, it.isGenericService || false]

      );
    }
    await client.query('COMMIT');
    logger.success('QUOTES', `Orçamento ${numero} criado com sucesso por ${user}`);
    res.json({ id: quoteId, numero });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-quotes POST]', e);
    sendError(res, e);
  } finally { client.release(); }
});

router.put('/:id', async (req, res) => {
  const c = req.body || {};
  const items = Array.isArray(c.items) ? c.items : null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM erp_quotes WHERE id=$1', [req.params.id]);
    if (!existing.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'não encontrado' }); }

    let subtotal = existing.rows[0].subtotal;
    let total = existing.rows[0].total;
    if (items) {
      const t = calcTotals(items, c.descontoPct ?? existing.rows[0].desconto_pct, c.frete ?? existing.rows[0].frete);
      subtotal = t.subtotal; total = t.total;
    }

    await client.query(
      `UPDATE erp_quotes SET
         company_id = COALESCE($2, company_id),
         customer_id = COALESCE($3, customer_id),
         modalidade = COALESCE($4, modalidade),
         tipo_locacao = COALESCE($14, tipo_locacao),
         data_emissao = COALESCE($5, data_emissao),
         validade_dias = COALESCE($6, validade_dias),
         observacoes = COALESCE($7, observacoes),
         condicoes_pagamento = COALESCE($8, condicoes_pagamento),
         desconto_pct = COALESCE($9, desconto_pct),
         frete = COALESCE($10, frete),
         subtotal = $11, total = $12,
         status = COALESCE($13, status),
         data_entrega = COALESCE($15, data_entrega),
         limpezas_semanais = COALESCE($16, limpezas_semanais),
         endereco_entrega = COALESCE($17, endereco_entrega),
         data_recolhimento = COALESCE($18, data_recolhimento),
         forma_pagamento = COALESCE($19, forma_pagamento),
         responsavel_nome     = $20,
         responsavel_telefone = $21,
         responsavel_email    = $22,
         updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, c.companyId || null, c.customerId || null,
       c.modalidade || null, emptyToNull(c.dataEmissao), c.validadeDias || null,
       // [#25 baixo] preserva campos quando omitidos no PUT (não zera observações).
       c.observacoes !== undefined ? c.observacoes : null,
       c.condicoesPagamento !== undefined ? c.condicoesPagamento : null,
       c.descontoPct, c.frete, subtotal, total, c.status || null, c.tipoLocacao || null,
       emptyToNull(c.dataEntrega),
       c.limpezasSemanais !== undefined ? c.limpezasSemanais : null,
       c.enderecoEntrega !== undefined ? c.enderecoEntrega : null,
       emptyToNull(c.dataRecolhimento),
       c.formaPagamento || null,
       c.responsavelNome ?? null, c.responsavelTelefone ?? null, c.responsavelEmail ?? null]
    );


    if (items) {
      await client.query('DELETE FROM erp_quote_items WHERE quote_id=$1', [req.params.id]);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const linha = +(Number(it.quantidade || 0) * Number(it.valorUnitario || 0)).toFixed(2);
        await client.query(
          `INSERT INTO erp_quote_items (quote_id, produto, descricao, quantidade, valor_unitario, valor_total, ordem, is_sanitario, is_generic_service)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [req.params.id, it.produto || 'Item', it.descricao || null,
           it.quantidade || 1, it.valorUnitario || 0, linha, i, it.isSanitario || false, it.isGenericService || false]

        );
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-quotes PUT]', e);
    sendError(res, e);
  } finally { client.release(); }
});

router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM erp_quotes WHERE id=$1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

/**
 * Converte orçamento em OS.
 * Não consome sanitários reais — apenas registra qtd_reservada na OS.
 * Os números reais são vinculados depois, no fluxo "Entregar / vincular".
 */
router.post('/:id/convert-to-os', requireRole('admin','manager'), async (req, res) => {
  const client = await pool.connect();
  const user = (req as any).user?.username || (req as any).user?.nome;
  try {
    await client.query('BEGIN');
    const q = await client.query('SELECT * FROM erp_quotes WHERE id=$1', [req.params.id]);
    if (!q.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'não encontrado' }); }
    const quote = q.rows[0];
    logger.os('CONVERT', `Iniciando conversão Orc ${quote.numero} -> OS por ${user}`);
    if (!quote.company_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Orçamento sem empresa emissora não pode gerar OS.' });
    }
    const items = await loadItems(req.params.id);

    // Detecção de sanitário: prioriza a flag booleana is_sanitario/isSanitario,
    // depois tenta regex por compatibilidade com orçamentos antigos.
    const isSanitarioItem = (it: any) =>
      it.isSanitario === true || it.is_sanitario === true || it.isSanitario === 'true' || it.is_sanitario === 'true' || /banheiro\s*qu[íi]mico|sanit[áa]rios?(\s|$)/i.test(it.produto || '');
    const qtdSanit = items
      .filter((it: any) => isSanitarioItem(it))
      .reduce((acc: number, it: any) => acc + Math.ceil(Number(it.quantidade || 0)), 0);

    const numRes = await client.query(
      `SELECT erp_next_doc_number('OS', $1::uuid) AS num`,
      [quote.company_id]
    );
    const numero = numRes.rows[0].num;

    // [#3 crítico] sem interpolação de string — passa como parâmetro
    const diasReq = Math.max(1, parseInt(String(req.body?.dias || quote.validade_dias || 1)) || 1);
    const isDiaria = quote.modalidade === 'diaria';

    const osIns = await client.query(
      `INSERT INTO erp_service_orders
         (numero, quote_id, company_id, customer_id, customer_snapshot,
          modalidade, tipo_locacao, data_inicio, data_fim_prevista, status, valor_total, observacoes,
          data_entrega, limpezas_semanais, endereco_entrega, data_recolhimento, qtd_reservada,
          forma_pagamento, use_new_flow)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,
               CASE WHEN $16::boolean THEN (CURRENT_DATE + ($17::int * INTERVAL '1 day'))::date ELSE NULL END,
               'aberta', $8, $9, $10, $11, $12, $13, $14, $15, TRUE)
       RETURNING id, numero`,
      [numero, quote.id, quote.company_id, quote.customer_id, quote.customer_snapshot,
       quote.modalidade, quote.tipo_locacao, quote.total, quote.observacoes,
       quote.data_entrega || null, quote.limpezas_semanais ?? null,
       quote.endereco_entrega || null, quote.data_recolhimento || null, qtdSanit,
       quote.forma_pagamento || null,
       isDiaria, diasReq]
    );
    const osId = osIns.rows[0].id;

    await client.query(`UPDATE erp_quotes SET status='convertido', updated_at=NOW() WHERE id=$1`, [quote.id]);
    await client.query('COMMIT');
    logger.success('OS', `OS ${numero} gerada a partir do orçamento ${quote.numero} (Sanitários: ${qtdSanit}) por ${user}`);
    res.json({ ok: true, osId, osNumero: numero, sanitariosReservados: qtdSanit });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-quotes convert]', e);
    sendError(res, e);
  } finally { client.release(); }
});


/**
 * Duplica um orçamento: cria um novo registro com numeração nova,
 * status 'rascunho', mesmas informações e itens.
 */
router.post('/:id/duplicate', requireRole('admin','manager'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const q = await client.query('SELECT * FROM erp_quotes WHERE id=$1', [req.params.id]);
    if (!q.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'não encontrado' }); }
    const src = q.rows[0];
    if (!src.company_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Orçamento sem empresa emissora não pode ser duplicado.' });
    }
    const items = await loadItems(req.params.id);

    const numRes = await client.query(
      `SELECT erp_next_doc_number('ORC', $1::uuid) AS num`,
      [src.company_id]
    );
    const numero = numRes.rows[0].num;

    const ins = await client.query(
      `INSERT INTO erp_quotes
         (numero, company_id, customer_id, company_snapshot, customer_snapshot,
          modalidade, tipo_locacao, data_emissao, validade_dias, observacoes, condicoes_pagamento,
          desconto_pct, frete, subtotal, total, status, data_entrega, limpezas_semanais,
          endereco_entrega, data_recolhimento, forma_pagamento,
          responsavel_nome, responsavel_telefone, responsavel_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE,$8,$9,$10,$11,$12,$13,$14,'rascunho',$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id`,
      [numero, src.company_id, src.customer_id, src.company_snapshot, src.customer_snapshot,
       src.modalidade, src.tipo_locacao, src.validade_dias,
       src.observacoes, src.condicoes_pagamento,
       src.desconto_pct, src.frete, src.subtotal, src.total,
       src.data_entrega, src.limpezas_semanais,
       src.endereco_entrega, src.data_recolhimento, src.forma_pagamento,
       src.responsavel_nome, src.responsavel_telefone, src.responsavel_email]
    );
    const newId = ins.rows[0].id;

    for (const it of items) {
      await client.query(
        `INSERT INTO erp_quote_items (quote_id, produto, descricao, quantidade, valor_unitario, valor_total, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [newId, it.produto, it.descricao, it.quantidade, it.valorUnitario, it.valorTotal, it.ordem]
      );
    }
    await client.query('COMMIT');
    res.json({ id: newId, numero });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-quotes duplicate]', e);
    sendError(res, e);
  } finally { client.release(); }
});

// Upload do PDF do orçamento (para gerar link público de compartilhamento).
router.post('/:id/upload-pdf', (req: any, res: any) => {
  quotePdfUpload.single('file')(req, res, async (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Erro no upload' });
    try {
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      const exists = await pool.query('SELECT 1 FROM erp_quotes WHERE id = $1', [req.params.id]);
      if (!exists.rowCount) return res.status(404).json({ error: 'Orçamento não encontrado' });
      const fileUrl = `/uploads/quotes/${req.file.filename}`;
      await pool.query(
        `UPDATE erp_quotes SET pdf_gerado_em = NOW() WHERE id = $1`,
        [req.params.id],
      ).catch(() => {});
      res.json({ ok: true, fileUrl, sizeBytes: req.file.size });
    } catch (e: any) {
      console.error('[erp-quotes upload-pdf]', e);
      sendError(res, e);
    }
  });
});

export default router;
