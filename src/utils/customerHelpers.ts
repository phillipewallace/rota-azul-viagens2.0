/**
 * Helpers puros para validação e detecção de duplicatas de clientes.
 * Sem dependência de React/UI — fácil de testar.
 */
import { Customer } from '@/hooks/useCustomers';
import { isValidDocument, onlyDigits } from '@/utils/brazilianDocs';

export type DocType = 'PF' | 'PJ';

export function getPersonType(c: Pick<Customer, 'personType'> | null | undefined): DocType {
  return (c?.personType || 'PJ') as DocType;
}

/** Retorna mensagem de erro do documento, ou null se válido / vazio. */
export function validateCustomerDoc(c: Customer | null | undefined): string | null {
  if (!c?.document) return null;
  const type = getPersonType(c);
  return isValidDocument(c.document, type)
    ? null
    : `${type === 'PF' ? 'CPF' : 'CNPJ'} inválido`;
}

/** Procura outro cliente com o mesmo documento (ignora o próprio id). */
export function findDuplicateByDocument(
  candidate: Customer,
  all: Customer[]
): Customer | null {
  const doc = onlyDigits(candidate.document || '');
  if (!doc) return null;
  return (
    all.find(x => x.id !== candidate.id && onlyDigits(x.document || '') === doc) ||
    null
  );
}

export interface DuplicateInfo {
  /** Conjunto de ids que são duplicatas (por documento ou nome). */
  dupIds: Set<string>;
  /** Razão por id (ex.: "Documento repetido (123…)"). */
  dupReason: Map<string, string>;
}

/** Mapa de duplicatas existentes na lista atual — para destaque visual. */
export function getDuplicateInfo(customers: Customer[]): DuplicateInfo {
  const byDoc = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  for (const c of customers) {
    const doc = onlyDigits(c.document || '');
    if (doc) {
      if (!byDoc.has(doc)) byDoc.set(doc, []);
      byDoc.get(doc)!.push(c.id);
    } else {
      const n = (c.customerName || '').trim().toLowerCase();
      if (n) {
        if (!byName.has(n)) byName.set(n, []);
        byName.get(n)!.push(c.id);
      }
    }
  }
  const dupIds = new Set<string>();
  const dupReason = new Map<string, string>();
  byDoc.forEach((ids, doc) => {
    if (ids.length > 1) ids.forEach(id => {
      dupIds.add(id);
      dupReason.set(id, `Documento repetido (${doc})`);
    });
  });
  byName.forEach(ids => {
    if (ids.length > 1) ids.forEach(id => {
      dupIds.add(id);
      dupReason.set(id, 'Nome repetido');
    });
  });
  return { dupIds, dupReason };
}
