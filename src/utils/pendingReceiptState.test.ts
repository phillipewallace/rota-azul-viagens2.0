import { describe, expect, it } from 'vitest';
import type { PendingReceipt } from '@/services/contracts';
import { pendingReceiptKey, removeGeneratedPending } from './pendingReceiptState';

const pending = (contractId: string, competencia?: string): PendingReceipt => ({
  contractId,
  contractNumero: contractId,
  valorMensal: 100,
  diaVencimento: 10,
  dataInicio: '2026-01-01',
  renovacaoAutomatica: true,
  competencia,
});

describe('estado de pendências por contrato e competência', () => {
  it('usa a competência selecionada quando o item não informa outra', () => {
    expect(pendingReceiptKey(pending('c1'), '2026-08')).toBe('c1:2026-08');
  });

  it('remove somente a competência recém-faturada', () => {
    const result = removeGeneratedPending(
      [pending('c1', '2026-08'), pending('c1', '2026-09'), pending('c2', '2026-08')],
      'c1',
      '2026-08',
      '2026-08',
    );

    expect(result.map(item => pendingReceiptKey(item, '2026-08'))).toEqual([
      'c1:2026-09',
      'c2:2026-08',
    ]);
  });

  it('remove uma NF futura sem remover o mesmo contrato no mês selecionado', () => {
    const result = removeGeneratedPending(
      [pending('c1', '2026-08'), pending('c1', '2026-09'), pending('c2', '2026-09')],
      'c1',
      '2026-09',
      '2026-08',
    );

    expect(result.map(item => pendingReceiptKey(item, '2026-08'))).toEqual([
      'c1:2026-08',
      'c2:2026-09',
    ]);
  });
});