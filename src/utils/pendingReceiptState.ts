import type { PendingReceipt } from '@/services/contracts';

export const pendingReceiptKey = (item: PendingReceipt, fallbackCompetencia: string) =>
  `${item.contractId}:${item.competencia || fallbackCompetencia}`;

export const removeGeneratedPending = (
  items: PendingReceipt[],
  contractId: string,
  competencia: string,
  fallbackCompetencia: string,
) => {
  const generatedKey = `${contractId}:${competencia}`;
  return items.filter(item => pendingReceiptKey(item, fallbackCompetencia) !== generatedKey);
};