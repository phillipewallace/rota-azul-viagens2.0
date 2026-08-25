import { sendError } from '../utils/apiError';
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import {
  TEMPLATE_OBRA_PADRAO, TEMPLATE_EVENTO_PADRAO,
  TITULO_OBRA_PADRAO, TITULO_EVENTO_PADRAO,
} from '../utils/contractTemplatesDefaults';

const router = Router();
router.use(requireAuth);

const TIPOS = ['obra', 'evento'] as const;
type Tipo = typeof TIPOS[number];

const DEFAULTS: Record<Tipo, { titulo: string; corpo_html: string }> = {
  obra:   { titulo: TITULO_OBRA_PADRAO,   corpo_html: TEMPLATE_OBRA_PADRAO },
  evento: { titulo: TITULO_EVENTO_PADRAO, corpo_html: TEMPLATE_EVENTO_PADRAO },
};

async function ensureSeed(tipo: Tipo) {
  await pool.query(
    `INSERT INTO erp_contract_templates(tipo, titulo, corpo_html)
       VALUES ($1, $2, $3)
       ON CONFLICT (tipo) DO NOTHING`,
    [tipo, DEFAULTS[tipo].titulo, DEFAULTS[tipo].corpo_html]
  );
}

router.get('/', async (_req, res) => {
  try {
    await Promise.all(TIPOS.map(ensureSeed));
    const r = await pool.query(
      `SELECT tipo, titulo, corpo_html AS "corpoHtml", atualizado_em AS "atualizadoEm"
         FROM erp_contract_templates
        ORDER BY CASE tipo WHEN 'obra' THEN 1 WHEN 'evento' THEN 2 ELSE 3 END`
    );
    res.json(r.rows);
  } catch (e: any) { sendError(res, e); }
});

router.get('/:tipo', async (req, res) => {
  try {
    const tipo = req.params.tipo as Tipo;
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });
    await ensureSeed(tipo);
    const r = await pool.query(
      `SELECT tipo, titulo, corpo_html AS "corpoHtml", atualizado_em AS "atualizadoEm"
         FROM erp_contract_templates WHERE tipo = $1`,
      [tipo]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.put('/:tipo', async (req, res) => {
  try {
    const tipo = req.params.tipo as Tipo;
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });
    const titulo = String(req.body?.titulo || '').trim() || DEFAULTS[tipo].titulo;
    const corpo  = String(req.body?.corpoHtml || '').trim();
    if (!corpo) return res.status(400).json({ error: 'corpoHtml vazio' });
    const r = await pool.query(
      `INSERT INTO erp_contract_templates(tipo, titulo, corpo_html, atualizado_em)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (tipo) DO UPDATE SET
           titulo = EXCLUDED.titulo,
           corpo_html = EXCLUDED.corpo_html,
           atualizado_em = NOW()
         RETURNING tipo, titulo, corpo_html AS "corpoHtml", atualizado_em AS "atualizadoEm"`,
      [tipo, titulo, corpo]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.post('/:tipo/reset', async (req, res) => {
  try {
    const tipo = req.params.tipo as Tipo;
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });
    const r = await pool.query(
      `INSERT INTO erp_contract_templates(tipo, titulo, corpo_html, atualizado_em)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (tipo) DO UPDATE SET
           titulo = EXCLUDED.titulo,
           corpo_html = EXCLUDED.corpo_html,
           atualizado_em = NOW()
         RETURNING tipo, titulo, corpo_html AS "corpoHtml", atualizado_em AS "atualizadoEm"`,
      [tipo, DEFAULTS[tipo].titulo, DEFAULTS[tipo].corpo_html]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

export default router;
