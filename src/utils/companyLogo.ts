/**
 * Helper para obter a logo da empresa emissora cadastrada em
 * Configurações > Empresas (ERP). Resultado é cacheado em memória
 * para que múltiplas gerações de PDF na mesma sessão não refaçam a
 * requisição. Retorna null silenciosamente se nenhuma empresa ativa
 * com logo for encontrada (PDFs continuam sendo gerados sem logo).
 */
import { erpService } from '@/services/erp';
import { toDataUrl } from '@/utils/receiptPdf';

let cached: string | null | undefined; // undefined = not loaded; null = no logo

export async function getCompanyLogoDataUrl(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    const companies = await erpService.listCompanies();
    const c = (companies || []).find((x) => x.ativo && x.logoUrl) || (companies || []).find((x) => x.logoUrl);
    if (!c || !c.logoUrl) {
      cached = null;
      return null;
    }
    const data = await toDataUrl(c.logoUrl);
    cached = data;
    return data;
  } catch {
    cached = null;
    return null;
  }
}

/** Limpa o cache (ex: quando o usuário troca a logo nas configurações). */
export function resetCompanyLogoCache() {
  cached = undefined;
}
