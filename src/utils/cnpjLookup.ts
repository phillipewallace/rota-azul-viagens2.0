/**
 * Consulta de CNPJ com fallback entre múltiplos provedores gratuitos.
 *
 * Ordem de tentativa:
 *  1) BrasilAPI      — https://brasilapi.com.br/api/cnpj/v1/{cnpj}
 *  2) CNPJ.ws Publica — https://publica.cnpj.ws/cnpj/{cnpj}
 *  3) ReceitaWS      — https://receitaws.com.br/v1/cnpj/{cnpj}
 *
 * Todos são públicos e CORS-friendly. Retorna um objeto normalizado
 * com o mesmo shape do BrasilAPI (para não quebrar quem já consome).
 */

export interface CnpjLookupResult {
  razao_social?: string;
  nome_fantasia?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  ddd_telefone_1?: string;
  email?: string;
  _source: 'brasilapi' | 'cnpjws' | 'receitaws';
}

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function tryBrasilApi(cnpj: string): Promise<CnpjLookupResult | null> {
  try {
    const r = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !d.razao_social) return null;
    return {
      razao_social: d.razao_social,
      nome_fantasia: d.nome_fantasia,
      cep: d.cep,
      logradouro: d.logradouro,
      numero: d.numero ? String(d.numero) : undefined,
      complemento: d.complemento,
      bairro: d.bairro,
      municipio: d.municipio,
      uf: d.uf,
      ddd_telefone_1: d.ddd_telefone_1,
      email: d.email,
      _source: 'brasilapi',
    };
  } catch {
    return null;
  }
}

async function tryCnpjWs(cnpj: string): Promise<CnpjLookupResult | null> {
  try {
    const r = await fetchWithTimeout(`https://publica.cnpj.ws/cnpj/${cnpj}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !d.razao_social) return null;
    const est = d.estabelecimento || {};
    const tel = Array.isArray(est.telefones) && est.telefones[0]
      ? `${est.telefones[0].ddd || ''}${est.telefones[0].numero || ''}`
      : undefined;
    const email = Array.isArray(est.emails) && est.emails[0] ? est.emails[0].email : undefined;
    return {
      razao_social: d.razao_social,
      nome_fantasia: est.nome_fantasia,
      cep: est.cep,
      logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(' ').trim() || undefined,
      numero: est.numero ? String(est.numero) : undefined,
      complemento: est.complemento,
      bairro: est.bairro,
      municipio: est.cidade?.nome,
      uf: est.estado?.sigla,
      ddd_telefone_1: tel,
      email,
      _source: 'cnpjws',
    };
  } catch {
    return null;
  }
}

async function tryReceitaWs(cnpj: string): Promise<CnpjLookupResult | null> {
  try {
    const r = await fetchWithTimeout(`https://receitaws.com.br/v1/cnpj/${cnpj}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || d.status === 'ERROR' || !d.nome) return null;
    return {
      razao_social: d.nome,
      nome_fantasia: d.fantasia,
      cep: d.cep,
      logradouro: d.logradouro,
      numero: d.numero ? String(d.numero) : undefined,
      complemento: d.complemento,
      bairro: d.bairro,
      municipio: d.municipio,
      uf: d.uf,
      ddd_telefone_1: d.telefone ? String(d.telefone).replace(/\D/g, '') : undefined,
      email: d.email,
      _source: 'receitaws',
    };
  } catch {
    return null;
  }
}

/**
 * Consulta CNPJ tentando os 3 provedores em sequência.
 * Lança erro apenas se todos falharem.
 */
export async function lookupCnpj(cnpjRaw: string): Promise<CnpjLookupResult> {
  const cnpj = String(cnpjRaw || '').replace(/\D/g, '');
  if (cnpj.length !== 14) throw new Error('CNPJ inválido');

  const providers = [tryBrasilApi, tryCnpjWs, tryReceitaWs];
  for (const p of providers) {
    const res = await p(cnpj);
    if (res) return res;
  }
  throw new Error('CNPJ não encontrado em nenhum provedor');
}
