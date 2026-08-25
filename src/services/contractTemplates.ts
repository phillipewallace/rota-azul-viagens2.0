/**
 * Serviço de modelos de contrato (Obra / Evento).
 * Os modelos são globais e editáveis pela página de Configurações.
 */
import { API_BASE_URL } from './config';

const headers = () => {
  const t = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(e.error || 'Erro na requisição');
  }
  return r.json();
}

export type ContractTemplateTipo = 'obra' | 'evento';

export interface ContractTemplate {
  tipo: ContractTemplateTipo;
  titulo: string;
  corpoHtml: string;
  atualizadoEm?: string;
}

export const contractTemplatesService = {
  list:  () => req<ContractTemplate[]>('GET', '/erp/contract-templates'),
  get:   (tipo: ContractTemplateTipo) => req<ContractTemplate>('GET', `/erp/contract-templates/${tipo}`),
  save:  (tipo: ContractTemplateTipo, data: { titulo: string; corpoHtml: string }) =>
           req<ContractTemplate>('PUT', `/erp/contract-templates/${tipo}`, data),
  reset: (tipo: ContractTemplateTipo) =>
           req<ContractTemplate>('POST', `/erp/contract-templates/${tipo}/reset`),
};
