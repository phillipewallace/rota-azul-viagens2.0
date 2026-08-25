# Plano de Implementação: Edição de CNO e Endereço em Recibos

O usuário deseja a capacidade de editar o **CNO** e o **Endereço da Obra/Evento** (singular por contrato) no momento de gerar ou editar recibos, incluindo o fluxo de **Recibo Unificado**. As alterações devem ser persistidas tanto no recibo (snapshot) quanto no cadastro do contrato.

## Mudanças Técnicas

### 1. Banco de Dados
*   Criar uma migração para garantir que a tabela `erp_receipts` possua os campos necessários para sobrescrever esses dados, ou garantir que o `snapshot` (JSONB) suporte as edições. 
*   *Nota*: A tabela `erp_contracts` já possui `cno` e `endereco_obra`.

### 2. Backend (API)
*   **`PATCH /api/erp/receipts/:id`**: Atualizar para aceitar `cno` e `enderecoObra`. Ao receber esses campos, a rota deve:
    1. Atualizar o `snapshot` do recibo.
    2. Atualizar os campos correspondentes na tabela `erp_contracts` vinculada.
*   **`POST /api/erp/receipts/generate`**: (Se necessário) permitir o envio de `cno` e `enderecoObra` no payload inicial para persistência imediata.

### 3. Frontend (UI)
*   **`ErpFinanceiro.tsx`**:
    *   **EditVencDialog (Edição Individual)**: Adicionar campos de entrada para `CNO` e `Endereço da Obra`. Atualmente o diálogo chama `receiptsExtraService.patch`.
    *   **UnifiedPreviewDialog (Recibo Unificado)**: 
        *   Adicionar campos de `CNO` e `Endereço` em cada item da lista de contratos (já existe o loop de `items`).
        *   Garantir que ao confirmar, esses dados sejam passados para a geração do PDF e salvos (caso os recibos individuais sejam regerados ou atualizados).
*   **`receiptPdf.ts`**:
    *   Garantir que `generateUnifiedReceiptPdf` utilize as propriedades `cno` e `enderecoObra` de cada `UnifiedReceiptItem`.

## User-Facing Changes
*   Novos campos de texto nos modais de faturamento para ajuste fino de endereço e CNO.
*   Sincronização automática: editou no recibo, o contrato "aprende" a nova informação para o próximo mês.

---
**Risco**: O sistema está em uso. Usaremos transações e verificações de existência de coluna para evitar quebras.
