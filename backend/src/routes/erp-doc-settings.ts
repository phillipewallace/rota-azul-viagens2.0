import { sendError } from '../utils/apiError';
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const DOCS = ['ORC', 'OS', 'CTR', 'REC', 'REC_SV', 'MED'];

function defaultDocSetting(doc: string) {
  return {
    doc,
    startNumber: 0,
    includeYear: doc === 'ORC' || doc === 'OS' || doc === 'MED',
    padding: 4,
    prefix: doc === 'REC_SV' ? null : doc,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validatePayload(body: any): { ok: true; data: any } | { ok: false; error: string } {
  const startNumber = Number(body?.startNumber);
  const padding = Number(body?.padding);
  if (!Number.isFinite(startNumber) || startNumber < 0 || startNumber > 9_999_999) {
    return { ok: false, error: 'startNumber inválido (0 a 9.999.999)' };
  }
  if (!Number.isFinite(padding) || padding < 1 || padding > 10) {
    return { ok: false, error: 'padding inválido (1 a 10)' };
  }
  const prefix = body?.prefix == null || body?.prefix === '' ? null : String(body.prefix).trim();
  if (prefix != null && !/^[A-Za-z0-9_-]{1,10}$/.test(prefix)) {
    return { ok: false, error: 'prefix inválido (até 10 caracteres, letras/números/-/_ )' };
  }
  return {
    ok: true,
    data: {
      startNumber: Math.floor(startNumber),
      padding: Math.floor(padding),
      includeYear: !!body?.includeYear,
      prefix,
    },
  };
}

// ============================================================
// Numeração GLOBAL (mantida — comportamento atual)
// ============================================================
router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT doc, start_number AS "startNumber", include_year AS "includeYear",
              padding, prefix, updated_at AS "updatedAt"
         FROM erp_doc_settings ORDER BY doc`
    );
    const map = new Map(r.rows.map((x: any) => [x.doc, x]));
    const rows = DOCS.map((d) => map.get(d) || {
      doc: d, startNumber: 0, includeYear: d === 'ORC' || d === 'OS', padding: 4, prefix: d === 'REC_SV' ? null : d,
    });
    res.json(rows);
  } catch (e: any) { sendError(res, e); }
});

router.put('/:doc', async (req, res) => {
  try {
    const { doc } = req.params;
    if (!DOCS.includes(doc)) return res.status(400).json({ error: 'doc inválido' });
    const v = validatePayload(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });
    await pool.query(
      `INSERT INTO erp_doc_settings(doc, start_number, include_year, padding, prefix, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (doc) DO UPDATE SET
         start_number = EXCLUDED.start_number,
         include_year = EXCLUDED.include_year,
         padding = EXCLUDED.padding,
         prefix = EXCLUDED.prefix,
         updated_at = NOW()`,
      [doc, v.data.startNumber, v.data.includeYear, v.data.padding, v.data.prefix]
    );
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

// ============================================================
// Numeração POR EMPRESA
// ============================================================

// Lista config efetiva por empresa: se não houver configuração própria,
// usa defaults fixos do documento — sem fallback de numeração global.
router.get('/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!UUID_RE.test(companyId)) return res.status(400).json({ error: 'companyId inválido' });

    const compQ = await pool.query(
      `SELECT doc, start_number AS "startNumber", include_year AS "includeYear",
              padding, prefix, updated_at AS "updatedAt"
         FROM erp_doc_settings_company WHERE company_id = $1`,
      [companyId]
    );
    const compMap = new Map(compQ.rows.map((x: any) => [x.doc, x]));

    const rows = DOCS.map((d) => {
      const custom = compMap.get(d);
      const eff = custom || defaultDocSetting(d);
      return {
        doc: d,
        hasOverride: !!custom,
        startNumber: Number(eff.startNumber) || 0,
        includeYear: !!eff.includeYear,
        padding: Number(eff.padding) || 4,
        prefix: eff.prefix ?? null,
      };
    });
    res.json(rows);
  } catch (e: any) { sendError(res, e); }
});

router.put('/company/:companyId/:doc', async (req, res) => {
  try {
    const { companyId, doc } = req.params;
    if (!UUID_RE.test(companyId)) return res.status(400).json({ error: 'companyId inválido' });
    if (!DOCS.includes(doc)) return res.status(400).json({ error: 'doc inválido' });
    const exists = await pool.query('SELECT 1 FROM erp_companies WHERE id=$1', [companyId]);
    if (!exists.rows[0]) return res.status(404).json({ error: 'empresa não encontrada' });

    const v = validatePayload(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.error });

    await pool.query(
      `INSERT INTO erp_doc_settings_company
         (company_id, doc, start_number, include_year, padding, prefix, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (company_id, doc) DO UPDATE SET
         start_number = EXCLUDED.start_number,
         include_year = EXCLUDED.include_year,
         padding = EXCLUDED.padding,
         prefix = EXCLUDED.prefix,
         updated_at = NOW()`,
      [companyId, doc, v.data.startNumber, v.data.includeYear, v.data.padding, v.data.prefix]
    );
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

// ---- Contador atual (ultimo emitido) por empresa/doc/ano ----
// GET → devolve o "ultimo" e "proximo" do ano corrente por doc.
router.get('/company/:companyId/counters', async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!UUID_RE.test(companyId)) return res.status(400).json({ error: 'companyId inválido' });
    const anoQ = Number(req.query.ano);
    const settings = await pool.query(
      `SELECT c.doc,
              COALESCE(cs.include_year, c.doc IN ('ORC','OS','MED')) AS include_year,
              COALESCE(cs.padding, 4) AS padding,
              COALESCE(cs.prefix, CASE WHEN c.doc = 'REC_SV' THEN NULL ELSE c.doc END) AS prefix
         FROM (SELECT unnest($1::text[]) AS doc) c
          LEFT JOIN erp_doc_settings_company cs ON cs.doc = c.doc AND cs.company_id = $2`,
      [DOCS, companyId]
    );
    const anoBase = Number.isFinite(anoQ) && anoQ > 0 ? Math.floor(anoQ) : new Date().getFullYear();
    const out = await Promise.all(settings.rows.map(async (s: any) => {
      const ano = s.include_year ? anoBase : 0;
      const r = await pool.query(
        `SELECT ultimo FROM erp_doc_counters
          WHERE company_id = $1 AND doc = $2 AND ano = $3`,
        [companyId, s.doc, ano]
      );
      return { doc: s.doc, ano, ultimo: r.rows[0]?.ultimo ?? 0, includeYear: !!s.include_year };
    }));
    res.json(out);
  } catch (e: any) { sendError(res, e); }
});

// PUT → força o "próximo" número (ex.: retomar de onde parou).
router.put('/company/:companyId/:doc/counter', async (req, res) => {
  try {
    const { companyId, doc } = req.params;
    if (!UUID_RE.test(companyId)) return res.status(400).json({ error: 'companyId inválido' });
    if (!DOCS.includes(doc)) return res.status(400).json({ error: 'doc inválido' });
    const proximo = Number(req.body?.proximo);
    if (!Number.isFinite(proximo) || proximo < 1 || proximo > 9_999_999) {
      return res.status(400).json({ error: 'proximo inválido (1 a 9.999.999)' });
    }
    const exists = await pool.query('SELECT 1 FROM erp_companies WHERE id=$1', [companyId]);
    if (!exists.rows[0]) return res.status(404).json({ error: 'empresa não encontrada' });

    // Resolve include_year efetivo p/ decidir o "ano" do contador
    const eff = await pool.query(
      `SELECT COALESCE(cs.include_year, c.doc IN ('ORC','OS','MED')) AS include_year
         FROM (SELECT $1::text AS doc) c
          LEFT JOIN erp_doc_settings_company cs ON cs.doc = c.doc AND cs.company_id = $2`,
      [doc, companyId]
    );
    const includeYear = !!eff.rows[0]?.include_year;
    const anoBody = Number(req.body?.ano);
    const ano = includeYear
      ? (Number.isFinite(anoBody) && anoBody > 0 ? Math.floor(anoBody) : new Date().getFullYear())
      : 0;

    // ultimo = proximo - 1 (a próxima emissão retornará proximo)
    const ultimo = Math.floor(proximo) - 1;
    // UPDATE-then-INSERT: evita depender de inferência de índice parcial no ON CONFLICT
    // (o índice único é parcial: WHERE company_id IS NOT NULL) e elimina 409 espúrio.
    const upd = await pool.query(
      `UPDATE erp_doc_counters
          SET ultimo = $4
        WHERE company_id = $1 AND doc = $2 AND ano = $3`,
      [companyId, doc, ano, ultimo]
    );
    if (upd.rowCount === 0) {
      try {
        await pool.query(
          `INSERT INTO erp_doc_counters(company_id, doc, ano, ultimo)
           VALUES ($1,$2,$3,$4)`,
          [companyId, doc, ano, ultimo]
        );
      } catch (err: any) {
        // corrida: alguém inseriu entre UPDATE e INSERT — refaz o UPDATE.
        if (err?.code === '23505') {
          await pool.query(
            `UPDATE erp_doc_counters
                SET ultimo = $4
              WHERE company_id = $1 AND doc = $2 AND ano = $3`,
            [companyId, doc, ano, ultimo]
          );
        } else { throw err; }
      }
    }
    res.json({ ok: true, ano, ultimo, proximo: ultimo + 1 });
  } catch (e: any) { sendError(res, e); }
});

// Remove configuração personalizada → volta aos defaults por empresa/documento
router.delete('/company/:companyId/:doc', async (req, res) => {
  try {
    const { companyId, doc } = req.params;
    if (!UUID_RE.test(companyId)) return res.status(400).json({ error: 'companyId inválido' });
    if (!DOCS.includes(doc)) return res.status(400).json({ error: 'doc inválido' });
    await pool.query(
      `DELETE FROM erp_doc_settings_company WHERE company_id=$1 AND doc=$2`,
      [companyId, doc]
    );
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

export default router;
