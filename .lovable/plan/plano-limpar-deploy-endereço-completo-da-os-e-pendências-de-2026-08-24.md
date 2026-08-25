# Plano: limpar deploy, endereço completo da OS e pendências de recibos

## Objetivo
Remover definitivamente as rotinas antigas de importação/correção de datas do deploy, mostrar o endereço real de entrega no App Funcionários e garantir que um recibo gravado deixe de aparecer como pendente na mesma competência.

## Alterações

### 1. Limpar o `deploy.sh`
- Remover os blocos de execução automática das importações MIC BAN Agosto, DSR Setembro e MIC BAN Setembro, incluindo marcadores e consultas de conferência.
- Remover o bloco que executa `fix-import-competencia-setembro.sql` e sua mensagem de “datas originais preservadas”.
- Remover também a importação/enriquecimento legado DSR + MIC BAN que ainda roda após o build do backend.
- Manter as migrations estruturais, builds, publicação e proteção geral contra comandos destrutivos.
- Não apagar dados já importados nem alterar datas existentes no banco; apenas impedir que próximos deploys executem novamente essas rotinas.

### 2. Endereço completo nos detalhes da OS do App Funcionários
- Ajustar o endpoint da agenda para retornar como endereço principal, nesta ordem:
  1. endereço de entrega salvo na própria OS;
  2. endereço de entrega do orçamento vinculado;
  3. endereço cadastral completo do cliente como fallback.
- Montar o fallback com logradouro, número, bairro, cidade, UF e CEP disponíveis, evitando campos vazios e vírgulas quebradas.
- Usar o mesmo endereço exibido nos detalhes para abrir a rota no Google Maps.
- Atualizar a tipagem do frontend para refletir os dados realmente devolvidos.

### 3. Recibo emitido que permanece em Pendentes
- Rastrear o par `contract_id + competencia` desde a geração no frontend até o registro em `erp_receipts` e a consulta `/pending`.
- Corrigir qualquer caminho individual, por período, em lote ou unificado que grave uma competência diferente da competência real do item.
- Centralizar a regra no backend: um recibo normal ou sem validade gravado para contrato e competência elimina a pendência daquela competência; recibos cancelados continuam seguindo o fluxo explícito de retorno a Pendentes.
- Garantir atualização imediata e sem estado antigo da lista após geração, inclusive quando a “Regra dos 5” mistura meses futuros.
- Diferenciar visualmente/na chave interna o mesmo contrato em competências diferentes, para não confundir um recibo já faturado com a pendência legítima do mês seguinte.
- Se forem encontrados recibos históricos gravados na competência errada, preparar uma correção idempotente e restrita aos registros comprovadamente inconsistentes — sem atualização genérica de datas.

## Validação
- Conferir que o `deploy.sh` não referencia mais arquivos, scripts ou marcadores de importação nem a correção de competência/datas.
- Testar uma OS com `endereco_entrega`, outra com endereço apenas no orçamento e outra usando o cadastro do cliente; conferir texto e link de rota.
- Gerar recibos normal, sem validade, com período personalizado, em lote e unificado; para cada caso, consultar novamente a mesma competência e confirmar que o contrato saiu de Pendentes.
- Confirmar que um contrato pode continuar aparecendo legitimamente no mês seguinte pela Regra dos 5 sem reaparecer no mês já faturado.
