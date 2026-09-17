/**
 * Editor Office (OnlyOffice Document Server) — integração para edição de
 * documentos Word/PPT/etc. dentro do sistema.
 *
 * Variáveis de ambiente (backend/.env):
 *   ONLYOFFICE_PUBLIC_URL — URL pública do OnlyOffice Document Server
 *                           (ex.: https://office.suadominio.com). Se ausente,
 *                           os endpoints respondem { enabled: false } e o
 *                           frontend usa o modo fallback (prévia + baixar/reenviar).
 *   PUBLIC_BASE_URL       — URL pública do próprio backend (ex.: https://api.suadominio.com).
 *                           Usada para montar a URL do arquivo e do callback, que precisam
 *                           ser acessíveis a partir do container do OnlyOffice.
 *   ONLYOFFICE_JWT_SECRET — segredo JWT compartilhado com o OnlyOffice (JWT_ENABLED=true).
 *
 * Fluxo: GET  /api/office/documents/:id/config   → config assinada p/ o editor (requer auth)
 *        POST /api/office/documents/:id/callback → OnlyOffice devolve o arquivo salvo (público,
 *                                                  validado por JWT quando configurado).
 */
import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { logger } from '../utils/logger';
import { fixUploadName } from '../utils/uploadNames';

const router = Router();
const uploadsDir = path.join(__dirname, '../../uploads');

const OFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET;
const ONLYOFFICE_PUBLIC_URL = (process.env.ONLYOFFICE_PUBLIC_URL || '').replace(/\/$/, '');

const str = (v: any): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
};

function backendPublicUrl(req: Request): string {
  const envUrl = process.env.PUBLIC_BASE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const host = req.get('host') || 'localhost:3001';
  const proto = (req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http')) as string;
  return `${proto}://${host}`;
}

/** Mapeia a extensão do arquivo para o documentType do OnlyOffice. */
function officeDocumentType(ext: string): string | null {
  if (['docx', 'doc', 'odt', 'rtf', 'txt'].includes(ext)) return 'word';
  if (['xlsx', 'xls', 'ods', 'csv'].includes(ext)) return 'cell';
  if (['pptx', 'ppt', 'odp'].includes(ext)) return 'slide';
  return null;
}

// ============ CONFIG (para o frontend inicializar o editor) ============
router.get('/documents/:id/config', requireAuth, async (req: any, res: Response) => {
  try {
    if (!ONLYOFFICE_PUBLIC_URL) {
      return res.json({ enabled: false, serverUrl: '', error: 'ONLYOFFICE_PUBLIC_URL não configurada' });
    }
    const r = await pool.query(
      `SELECT id, nome, arquivo_url AS "arquivoUrl", arquivo_nome AS "arquivoNome",
              updated_at AS "updatedAt"
         FROM erp_documents WHERE id = $1`,
      [req.params.id],
    );
    const doc = r.rows[0];
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });
    if (!doc.arquivoUrl || !doc.arquivoNome) {
      return res.status(400).json({ error: 'Documento sem arquivo vinculado' });
    }

    const ext = (String(doc.arquivoNome).split('.').pop() || '').toLowerCase();
    const docType = officeDocumentType(ext);
    if (!docType) return res.status(400).json({ error: `Extensão .${ext} não suportada pelo editor` });

    const base = backendPublicUrl(req);
    // Chave de versão: muda sempre que o documento é atualizado (invalida cache do OnlyOffice).
    const key = crypto
      .createHash('sha1')
      .update(`${doc.id}|${doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt}`)
      .digest('hex');

    const tituloCorrigido = fixUploadName(doc.arquivoNome || doc.id);

    const editorConfig: Record<string, any> = {
      // Configurações que o DocsAPI.DocEditor recebe como 'config' direto.
      documentType: docType,
      document: {
        fileType: ext,
        key,
        title: tituloCorrigido,
        url: `${base}${doc.arquivoUrl}`,
        permissions: { edit: true, download: true, print: true },
      },
      editorConfig: {
        callbackUrl: `${base}/api/office/documents/${doc.id}/callback`,
        mode: 'edit',
        lang: 'pt-BR',
        user: { id: String(req.user?.userId || 'anonymous'), name: req.user?.username || 'Usuário' },
        customization: {
          forcesave: true,
          compactHeader: true,
          hideRightMenu: true,
          uiTheme: 'theme-classic-light',
        },
      },
    };

    if (OFFICE_JWT_SECRET) {
      editorConfig.token = jwt.sign(editorConfig, OFFICE_JWT_SECRET, { algorithm: 'HS256' });
    }

    res.json({ enabled: true, serverUrl: ONLYOFFICE_PUBLIC_URL, editorConfig });
  } catch (e: any) {
    logger.error('OFFICE', 'Erro ao montar config do OnlyOffice', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ============ CALLBACK (OnlyOffice → salvar versão editada) ============
router.post('/documents/:id/callback', async (req: any, res: Response) => {
  try {
    let body = req.body || {};

    // Quando JWT está habilitado, o OnlyOffice envia { token } com o payload assinado.
    if (OFFICE_JWT_SECRET && body.token) {
      try {
        const payload = jwt.verify(body.token, OFFICE_JWT_SECRET);
        body = (payload as any) || {};
      } catch {
        return res.status(401).json({ error: 1, message: 'Token do OnlyOffice inválido' });
      }
    }

    const status = Number(body.status);
    if (status === 1 || status === 4) return res.json({ error: 0 }); // editando / fechado sem alterações
    if (status !== 2 && status !== 6) return res.json({ error: 0 });

    const fileUrl = str(body.url);
    if (!fileUrl) return res.status(400).json({ error: 1, message: 'Callback sem url do arquivo' });

    const d = await pool.query(
      `SELECT id, arquivo_nome AS "arquivoNome" FROM erp_documents WHERE id = $1`,
      [req.params.id],
    );
    const doc = d.rows[0];
    if (!doc) return res.status(404).json({ error: 1, message: 'Documento não encontrado' });

    // Baixa a nova versão e grava com nome único (mesma extensão do original).
    const ext = (String(doc.arquivoNome).split('.').pop() || 'bin').toLowerCase();
    const filename = `${crypto.randomUUID()}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) throw new Error(`Falha ao baixar arquivo do OnlyOffice (HTTP ${fileRes.status})`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    await pool.query(
      `UPDATE erp_documents
          SET arquivo_url = $2, arquivo_tamanho = $3, updated_at = NOW()
        WHERE id = $1`,
      [doc.id, `/uploads/${filename}`, buffer.length],
    );

    logger.info('OFFICE', 'Documento salvo pelo OnlyOffice', { id: doc.id, filename, size: buffer.length });
    res.json({ error: 0 });
  } catch (e: any) {
    logger.error('OFFICE', 'Erro no callback do OnlyOffice', { error: e.message });
    res.status(500).json({ error: 1, message: e.message });
  }
});

export default router;
