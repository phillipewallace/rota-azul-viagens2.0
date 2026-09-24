/**
 * Validação end-to-end temporária da regra de sub-pastas em ERP → Documentos.
 * Roda contra um banco DESCARTÁVEL (DB_NAME=erp_docs_val), sobe as rotas reais
 * via express e exercita os cenários com HTTP. Não toca em dados reais.
 *
 * Uso:
 *   $env:DB_NAME='erp_docs_val'; $env:JWT_SECRET='teste'; npx ts-node --transpile-only src/validate-erp-docs-e2e.ts
 */
import { Client } from 'pg';
import jwt from 'jsonwebtoken';
import express from 'express';
import fs from 'fs';
import path from 'path';

const SCRATCH_DB = process.env.DB_NAME || 'erp_docs_val';
const HOST = process.env.DB_HOST || 'localhost';
const PORT_DB = parseInt(process.env.DB_PORT || '5432');
const USER = process.env.DB_USER || 'postgres';
const PASS = process.env.DB_PASSWORD || 'postgres';
const SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret';

let failures = 0;
const check = (cond: boolean, label: string, extra?: any) => {
  if (cond) console.log(`  PASS  ${label}`);
  else { failures++; console.log(`  FAIL  ${label}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ''}`); }
};

async function preparar(): Promise<{ server: any; base: string; api: any; upload: any; db: any }> {
  const admin = new Client({ host: HOST, port: PORT_DB, user: USER, password: PASS, database: 'postgres' });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [SCRATCH_DB]);
  if (!exists.rows.length) await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
  await admin.end();
  console.log(`Banco de teste: ${SCRATCH_DB}`);

  const db = await import('./config/database');
  await db.setupDatabase();
  console.log('setupDatabase() executado sem erros');

  fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });

  const app = express();
  app.use(express.json());
  app.use('/api/erp/documents', (await import('./routes/erp-documents')).default);
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}/api/erp/documents`;
  const token = jwt.sign({ userId: 'u1', username: 'tester', role: 'admin' }, SECRET);
  const auth = { Authorization: `Bearer ${token}` };

  const api = async (method: string, url: string, body?: any) => {
    const r = await fetch(url, {
      method,
      headers: body instanceof FormData ? auth : { ...auth, 'Content-Type': 'application/json' },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: r.status, json };
  };

  const upload = async (docId: string, name: string) => {
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from('conteudo de teste')], { type: 'application/pdf' }), name);
    return api('POST', `${base}/${docId}/files`, fd);
  };

  return { server, base, api, upload, db };
}

async function cenarios(ctx: any) {
  const { base, api, upload } = ctx;

  // ── Cenário 1: criação com 1 arquivo vinculado → registro simples ─────────
  console.log('\n[1] Documento com 1 arquivo vinculado é registro simples');
  const c1 = await api('POST', base, {
    nome: 'Documento simples', tipo: 'Contrato', numeracao: '001',
    empresaEmissora: 'Rota Azul', arquivoUrl: '/uploads/a.pdf', arquivoNome: 'a.pdf',
    arquivoTamanho: 10, arquivoTipo: 'application/pdf',
  });
  check(c1.status === 201, 'POST / cria documento (201)', c1);
  const docA = c1.json;
  check((docA?.arquivosCount ?? -1) === 0, 'arquivosCount = 0 (não é sub-pasta)', docA?.arquivosCount);
  check(docA?.arquivoNome === 'a.pdf', 'arquivo vinculado preservado', docA?.arquivoNome);
  check(Array.isArray(docA?.arquivosNomes) && docA.arquivosNomes.length === 0, 'arquivosNomes vazio', docA?.arquivosNomes);

  // ── Cenário 2: sobe 1 arquivo na sub-pasta → agora são 2 arquivos ────────
  console.log('\n[2] 2º arquivo transforma o documento em sub-pasta (2 arquivos)');
  const up1 = await upload(docA.id, 'ORÇAMENTO AMM - CENTRO.pdf');
  check(up1.status === 201, 'POST /:id/files insere arquivo (201)', up1);
  check((up1.json?.arquivosCount ?? -1) === 2, 'arquivosCount = 2', up1.json?.arquivosCount);
  check(!up1.json?.arquivoUrl, 'arquivo vinculado migrado para a sub-pasta', up1.json?.arquivoUrl);
  check(up1.json?.id === docA.id, 'RETURNING devolve o id do DOCUMENTO (alias d)', { ret: up1.json?.id, esperado: docA.id });

  // ── Cenário 3: busca geral encontra arquivo dentro da sub-pasta ──────────
  console.log('\n[3] Busca por nome de arquivo abrange a sub-pasta');
  for (const termo of ['ORÇAMENTO AMM - CENTRO.pdf', 'orçamento', 'CENTRO.pdf', 'a.pdf']) {
    const r = await api('GET', `${base}?search=${encodeURIComponent(termo)}`);
    const list = r.json?.data ?? r.json;
    check(r.status === 200 && Array.isArray(list) && list.some((d: any) => d.id === docA.id),
      `busca "${termo}" retorna o documento`, { status: r.status, list: list?.length });
  }

  // ── Cenário 4: remover 1 arquivo volta a ser registro simples ─────────────
  console.log('\n[4] Sub-pasta com 1 arquivo restante volta a registro simples');
  const filesA = await api('GET', `${base}/${docA.id}/files`);
  check(filesA.status === 200 && filesA.json.length === 2, 'GET /:id/files devolve 2 arquivos', filesA.json?.length);
  const del = await api('DELETE', `${base}/${docA.id}/files/${filesA.json[0].id}`);
  check(del.status === 200, 'DELETE arquivo da sub-pasta (200)', del);
  const afterDel = await api('GET', `${base}/${docA.id}`);
  check((afterDel.json?.arquivosCount ?? -1) === 0, 'arquivosCount volta a 0', afterDel.json?.arquivosCount);
  check(!!afterDel.json?.arquivoUrl, 'arquivo remanescente promovido a vinculado', afterDel.json?.arquivoUrl);
  check((afterDel.json?.arquivosNomes || []).length === 0, 'arquivosNomes limpo', afterDel.json?.arquivosNomes);

  return { docA, afterDel };
}

async function cenarios2(ctx: any, docA: any, afterDel: any) {
  const { base, api, upload } = ctx;

  // ── Cenário 5: criação com 2 arquivos (sub-pasta real) ────────────────────
  console.log('\n[5] Sub-pasta com 2+ arquivos mantém a regra');
  const c2 = await api('POST', base, { nome: 'Documento com pacote', tipo: 'Planilha' });
  const docB = c2.json;
  await upload(docB.id, 'planilha-1.xlsx');
  const up2 = await upload(docB.id, 'planilha-2.xlsx');
  check((up2.json?.arquivosCount ?? -1) === 2, 'arquivosCount = 2 após 2 uploads', up2.json?.arquivosCount);
  check((up2.json?.arquivosNomes || []).length === 2, 'arquivosNomes lista os 2 arquivos', up2.json?.arquivosNomes);

  // ── Cenário 6: edição (PUT) não quebra o RETURNING nem o invariante ───────
  console.log('\n[6] PUT (edição) preserva o invariante e o id do documento');
  const put = await api('PUT', `${base}/${docB.id}`, {
    nome: 'Documento com pacote (editado)', arquivoUrl: '/uploads/extra.pdf',
    arquivoNome: 'extra.pdf', arquivoTamanho: 5, arquivoTipo: 'application/pdf',
  });
  check(put.status === 200, 'PUT /:id (200)', put);
  check(put.json?.id === docB.id, 'id do documento correto no PUT', put.json?.id);
  check(put.json?.nome === 'Documento com pacote (editado)', 'nome atualizado', put.json?.nome);
  check((put.json?.arquivosCount ?? -1) === 3, 'arquivo vinculado migrou para a sub-pasta (3)', put.json?.arquivosCount);

  // ── Cenário 7: busca + paginação e demais campos ─────────────────────────
  console.log('\n[7] Listagem paginada e filtros continuam funcionando');
  const pg1 = await api('GET', `${base}?page=1&pageSize=10`);
  check(pg1.status === 200, 'GET / paginado (200)', pg1.status);
  check(Array.isArray(pg1.json?.data) && typeof pg1.json?.total === 'number', 'resposta paginada {data,total}', Object.keys(pg1.json || {}));
  const byTipo = await api('GET', `${base}?tipo=Planilha`);
  const byTipoList = byTipo.json?.data ?? byTipo.json;
  check(Array.isArray(byTipoList) && byTipoList.every((d: any) => d.tipo === 'Planilha'), 'filtro por tipo', byTipoList?.length);
  const meta = await api('GET', `${base}/tipos`);
  check(meta.status === 200 && Array.isArray(meta.json?.tipos), 'GET /tipos', meta.status);

  // ── Cenário 8: busca por nome do documento e por vinculado ───────────────
  console.log('\n[8] Busca por nome do documento e por arquivo vinculado');
  const s1 = await api('GET', `${base}?search=pacote`);
  check((s1.json?.data ?? s1.json).some((d: any) => d.id === docB.id), 'busca pelo nome do documento');
  const s2 = await api('GET', `${base}?search=nadaaqui`);
  check(((s2.json?.data ?? s2.json) || []).length === 0, 'termo inexistente retorna vazio');
  const s3 = await api('GET', `${base}?search=${encodeURIComponent(afterDel.json?.arquivoNome)}`);
  check((s3.json?.data ?? s3.json).some((d: any) => d.id === docA.id), 'busca por arquivo vinculado simples');
}

async function limpar(db: any, server: any) {
  server.close();
  await db.pool.end();
  const admin = new Client({ host: HOST, port: PORT_DB, user: USER, password: PASS, database: 'postgres' });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
  await admin.end();
}

(async () => {
  const ctx = await preparar();
  const { docA, afterDel } = await cenarios(ctx);
  await cenarios2(ctx, docA, afterDel);
  await limpar(ctx.db, ctx.server);
  console.log(`\n${failures === 0 ? 'TODOS OS CENÁRIOS PASSARAM' : `${failures} CENÁRIO(S) FALHARAM`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ERRO NA VALIDAÇÃO:', e);
  process.exit(1);
});
