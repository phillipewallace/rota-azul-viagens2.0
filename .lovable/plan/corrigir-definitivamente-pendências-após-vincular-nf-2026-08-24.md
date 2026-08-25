# Corrigir definitivamente pendências após vincular NF

## Diagnóstico confirmado
- A lista usa a “Regra dos 10” e pode exibir cobranças de meses futuros.
- Ao clicar **Vincular NF**, a tela envia a competência selecionada no topo, e não a competência real da linha. Exemplo: uma linha de setembro exibida dentro da visão de agosto grava a NF em agosto; por isso setembro continua pendente.
- Recibos já usam a competência real da linha e possuem reconciliação explícita, mas o fluxo de NF não aplica a mesma garantia nem remove otimisticamente a linha após o sucesso.

## Implementação
1. **Corrigir a competência no vínculo de NF**
   - Passar ao diálogo a competência efetiva do item (`item.competencia`, com fallback para a competência selecionada).
   - Fazer a resposta de sucesso carregar contrato + competência confirmados pelo backend, evitando depender de estado visual antigo.

2. **Garantir consistência no backend**
   - Validar rigorosamente contrato e competência antes do upload definitivo.
   - Criar a NF e registrar sua competência faturada de forma transacional/inequívoca, seguindo o mesmo princípio já aplicado aos recibos.
   - Manter cancelamento e exclusão coerentes: NF ativa elimina a pendência; cancelada/excluída devolve a competência aos pendentes.

3. **Corrigir imediatamente a interface**
   - Remover a linha correta de pendentes assim que o backend confirmar o vínculo.
   - Recarregar pendências e notas em seguida, sem permitir que uma resposta antiga recoloque o item.
   - Preservar contratos recorrentes de outros meses: somente `contrato + competência` vinculados somem.

4. **Reconciliar registros que ficaram para trás**
   - Adicionar migration idempotente para registrar/reconciliar NFs ativas existentes nas competências corretas quando houver evidência segura do mês faturado, sem apagar NFs ou recibos.
   - Produzir uma consulta de diagnóstico para casos ambíguos, evitando mover dados automaticamente quando não houver certeza.
   - Fazer o deploy falhar claramente se a estrutura obrigatória de competências faturadas não tiver sido aplicada.

5. **Pente-fino e testes de regressão**
   - Cobrir: mês atual, mês futuro liberado pela Regra dos 10, contrato recorrente em dois meses, Evento, NF cancelada/excluída, recibo normal/SV e recibo unificado.
   - Validar que toda operação de faturamento remove somente a competência correta e que desfazer a operação a torna pendente novamente.
