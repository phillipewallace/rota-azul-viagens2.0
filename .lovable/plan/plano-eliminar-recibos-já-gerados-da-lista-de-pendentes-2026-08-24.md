# Plano: eliminar recibos já gerados da lista de Pendentes

## Objetivo
Garantir que, ao gerar qualquer recibo, a pendência exata daquele contrato e competência desapareça imediatamente, e reconciliar recibos antigos que ficaram associados à competência errada sem excluir nem gerar documentos novamente.

## Diagnóstico confirmado
- O backend considera uma pendência concluída somente quando encontra o mesmo par `contract_id + competencia` em `erp_receipts` (`backend/src/routes/erp-receipts.ts`, rota `/pending`).
- As gerações atuais enviam a competência explícita nos fluxos individual, com período, lote e unificado, mas recibos históricos podem ter sido gravados pelo mês de `periodo_inicio`; em ciclos que atravessam meses, isso deixa o recibo emitido em um mês e a pendência no outro.
- Após uma geração, a “Regra dos 10” pode liberar imediatamente a competência seguinte e mostrar o mesmo contrato novamente. Hoje o mês futuro aparece apenas como informação secundária, podendo parecer que a cobrança recém-gerada não saiu.
- A busca do PDF após gerar por período ainda consulta `periodoInicio.slice(0, 7)`, embora o recibo seja salvo com a competência explícita. Esse ponto será alinhado para não manter duas interpretações de competência.
- Não há acesso ao banco de produção nesta sessão; portanto, a validação dos registros reais será executada de forma segura no deploy, com diagnóstico antes da reconciliação.

## Implementação

### 1. Tornar a competência faturada explícita e auditável
- Criar uma migration idempotente com uma tabela de vínculo entre recibo, contrato e competência faturada.
- Preencher esse vínculo automaticamente para todos os recibos existentes usando primeiro a competência já gravada, sem alterar ou apagar os recibos originais.
- Registrar o vínculo dentro da mesma transação que cria ou regera um recibo, tanto normal quanto sem validade e tanto individual quanto unificado.
- Manter unicidade por `contract_id + competencia`, permitindo que qualquer recibo válido daquela competência encerre a pendência uma única vez.

### 2. Reconciliar somente os históricos comprovadamente inconsistentes
- A migration identificará recibos antigos gerados antes da correção que possuem período atravessando meses e cuja competência gravada corresponde ao início do período, embora o ciclo termine na competência faturada.
- Para esses casos, criar o vínculo da competência correta sem excluir, renumerar ou recriar o recibo.
- Não usar uma regra ampla que considere indiscriminadamente início e fim do período, pois isso poderia esconder uma cobrança legítima do mês seguinte.
- Emitir no log do deploy a quantidade de vínculos históricos reconciliados e manter a migration segura para repetição.

### 3. Centralizar a consulta de Pendentes
- Alterar `/erp/receipts/pending` para consultar o vínculo explícito de faturamento, com compatibilidade para recibos ainda não vinculados.
- Considerar recibos normais e sem validade como faturamento concluído, conforme a regra atual.
- Preservar a regra de notas fiscais ativas e o fluxo explícito de retorno para Pendentes.
- Garantir que cancelamento/reabertura atualize ou remova o vínculo de forma transacional, evitando divergência entre recibo e pendência.

### 4. Garantir remoção imediata na interface
- Depois de uma geração confirmada pelo backend, retirar imediatamente do estado local a chave exata `contractId + competencia` e então recarregar os dados para confirmação.
- Aplicar isso aos fluxos individual, período personalizado, lote, unificado comum e unificado sem validade.
- Se a Regra dos 10 liberar o mesmo contrato no mês seguinte, exibir a competência futura com destaque suficiente para deixar claro que é outra cobrança, não a recém-gerada.
- Corrigir a busca pós-geração do PDF para usar a competência retornada/enviada, nunca o mês derivado de `periodoInicio`.

### 5. Proteções e testes de regressão
- Adicionar testes do backend para confirmar que cada forma de geração remove exatamente a pendência correspondente.
- Cobrir ciclo no mesmo mês, ciclo atravessando meses, recibo normal, sem validade, lote, unificado e contrato reaparecendo apenas na competência seguinte pela Regra dos 10.
- Testar reconciliação de um recibo histórico inconsistente e confirmar que ele some de Pendentes sem alteração de número, PDF, valor ou status.
- Validar que um recibo de setembro não elimina indevidamente a pendência legítima de outubro.

## Resultado esperado
- Todo recibo gerado deixa de aparecer em Pendentes na mesma competência imediatamente.
- Os recibos antigos afetados são reconhecidos automaticamente, sem exclusão ou nova emissão.
- O mesmo contrato só poderá continuar visível quando representar outra competência, claramente identificada na tela.
