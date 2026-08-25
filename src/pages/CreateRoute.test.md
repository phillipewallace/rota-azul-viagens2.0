# Testes de Funcionalidade - Sistema de Rotas Premium

## ✅ TESTE #1: AutoSave
**Objetivo:** Verificar se o sistema salva automaticamente os dados da rota

**Passos:**
1. Acessar `/routes/create`
2. Preencher nome: "Rota Teste AutoSave"
3. Adicionar 3 pontos com endereços válidos
4. Aguardar 6 segundos (tempo do autosave é 5s)
5. Recarregar a página (F5)
6. Verificar se aparece o diálogo perguntando se deseja restaurar o rascunho
7. Clicar em "OK" para restaurar
8. Verificar se todos os dados foram restaurados corretamente

**Resultado Esperado:**
- ✅ Dados salvos e restaurados automaticamente
- ✅ Timestamp de último save aparece no header
- ✅ Todos os pontos preservados

---

## ✅ TESTE #2: Drag & Drop (Modo Fixo)
**Objetivo:** Verificar se é possível reordenar pontos em rotas fixas

**Passos:**
1. Acessar `/routes/create`
2. Selecionar modo "Ordem Fixa"
3. Adicionar 4 pontos com endereços válidos
4. Tentar arrastar o segundo ponto para a última posição
5. Verificar se a ordem foi alterada
6. Gerar preview
7. Salvar rota
8. Verificar na listagem se a ordem foi mantida

**Resultado Esperado:**
- ✅ Ícone de arrastar aparece apenas em modo fixo
- ✅ Pontos podem ser reordenados
- ✅ Origem (primeiro) e destino (último) mantêm suas posições especiais
- ✅ Ordem persiste após salvar

---

## ✅ TESTE #3: Preview em Tempo Real
**Objetivo:** Verificar se o mapa atualiza conforme pontos são adicionados

**Passos:**
1. Acessar `/routes/create`
2. Adicionar primeiro ponto (origem)
3. Buscar CEP válido
4. Clicar em "Visualizar"
5. Verificar se o marcador aparece no mapa
6. Adicionar segundo ponto (destino)
7. Clicar em "Visualizar" novamente
8. Verificar se a rota é traçada entre os dois pontos

**Resultado Esperado:**
- ✅ Mapa aparece no painel direito
- ✅ Marcadores corretos (verde origem, vermelho destino, amarelo intermediários)
- ✅ Linha da rota desenhada
- ✅ Distância e tempo estimado exibidos

---

## ✅ TESTE #4: Badges Premium
**Objetivo:** Verificar visual das badges de status

**Passos:**
1. Acessar `/routes`
2. Criar uma rota com modo "Ordem Fixa"
3. Criar uma rota com modo "Otimizada"
4. Verificar visual das badges nos cards
5. Passar mouse sobre badge de modo (tooltip deve aparecer)

**Resultado Esperado:**
- ✅ Badges translúcidas (20-30% opacidade)
- ✅ Cores suaves e integradas
- ✅ Ícones adequados (🔒 para fixa, ✨ para otimizada)
- ✅ Tooltip explicativo ao passar mouse

---

## ✅ TESTE #5: Integração Mapa - Click no Card
**Objetivo:** Verificar se clicar no card do caminhão centraliza no mapa

**Passos:**
1. Acessar página principal (Dashboard com mapa)
2. Verificar se há caminhões no TrackingPanel
3. Clicar em um card de caminhão
4. Verificar se o mapa centraliza no caminhão
5. Verificar se o ícone do caminhão é destacado
6. Verificar se a rota fica mais destacada

**Resultado Esperado:**
- ✅ Mapa centraliza suavemente no caminhão
- ✅ Zoom aumenta para 15
- ✅ Ícone do caminhão fica maior com glow
- ✅ Rota fica com strokeWeight maior e mais opaca
- ✅ Card usa a cor do caminhão como borda

---

## ✅ TESTE #6: Status do Caminhão no Ícone
**Objetivo:** Verificar indicadores visuais de status

**Passos:**
1. Criar/verificar caminhões com diferentes status
2. Status "Em movimento" (in-route)
3. Status "Disponível" (available)
4. Status "Manutenção" (maintenance)
5. Verificar ícones no mapa

**Resultado Esperado:**
- ✅ Em movimento: indicador verde pulsante
- ✅ Disponível: ícone padrão cinza
- ✅ Manutenção: indicador amarelo/laranja

---

## ✅ TESTE #7: Duplicar Ponto
**Objetivo:** Verificar funcionalidade de duplicar ponto

**Passos:**
1. Acessar `/routes/create`
2. Adicionar um ponto com endereço completo
3. Clicar no botão "Duplicar" (ícone Copy)
4. Verificar se novo ponto é criado com mesmos dados

**Resultado Esperado:**
- ✅ Novo ponto criado com dados idênticos
- ✅ ID único gerado
- ✅ Posição correta na lista

---

## ✅ TESTE #8: Limpar Intermediários
**Objetivo:** Verificar botão de limpar pontos intermediários

**Passos:**
1. Acessar `/routes/create`
2. Adicionar 5 pontos
3. Clicar em "Limpar intermediários"
4. Confirmar ação
5. Verificar se apenas origem e destino permanecem

**Resultado Esperado:**
- ✅ Apenas primeiro e último ponto mantidos
- ✅ Pontos intermediários removidos
- ✅ Confirmação solicitada antes da ação

---

## ✅ TESTE #9: Navegação entre Páginas
**Objetivo:** Verificar transições entre listagem e criação/edição

**Passos:**
1. Acessar `/routes`
2. Clicar em "Nova Rota"
3. Verificar se redireciona para `/routes/create`
4. Voltar para `/routes`
5. Clicar em "Editar" em uma rota
6. Verificar se redireciona para `/routes/edit?edit={id}`
7. Verificar se dados da rota são carregados

**Resultado Esperado:**
- ✅ Navegação funciona corretamente
- ✅ Dados carregados na edição
- ✅ Botão voltar retorna para listagem

---

## ✅ TESTE #10: Compatibilidade com APK
**Objetivo:** Garantir que APK dos motoristas não foi afetado

**Verificações:**
1. Endpoints de rotas ainda retornam dados corretos
2. Ordem dos pontos respeitada (fixed vs optimized)
3. Campo `optimization_mode` presente nas respostas
4. Rotas antigas (sem optimization_mode) funcionam com default 'optimized'

**Resultado Esperado:**
- ✅ APK continua funcionando
- ✅ Rotas exibidas corretamente
- ✅ Pontos na ordem certa
- ✅ Sem quebras de contrato da API

---

## 📊 Resumo dos Testes

| # | Teste | Status | Prioridade |
|---|-------|--------|------------|
| 1 | AutoSave | ✅ A testar | Alta |
| 2 | Drag & Drop | ✅ A testar | Alta |
| 3 | Preview Tempo Real | ✅ A testar | Média |
| 4 | Badges Premium | ✅ A testar | Baixa |
| 5 | Click no Card | ✅ A testar | Média |
| 6 | Status no Ícone | ✅ A testar | Média |
| 7 | Duplicar Ponto | ✅ A testar | Baixa |
| 8 | Limpar Intermediários | ✅ A testar | Baixa |
| 9 | Navegação | ✅ A testar | Alta |
| 10 | APK Compatibilidade | ✅ A testar | CRÍTICA |

---

## ⚠️ Pontos de Atenção

1. **AutoSave pode conflitar com navegação rápida** - Testar se ao sair da página o autosave não causa problemas
2. **Drag & Drop não deve aparecer em modo otimizado** - Verificar se condicional funciona
3. **Cores dos caminhões devem ser consistentes** - Mesmo caminhão deve ter mesma cor no mapa e no painel
4. **Rotas antigas devem funcionar** - Testar com rotas criadas antes da atualização

---

## 🔧 Como Executar os Testes

1. Fazer login no sistema
2. Seguir cada teste na ordem
3. Marcar ✅ ou ❌ conforme resultado
4. Reportar qualquer bug encontrado
5. Verificar console do navegador para erros
