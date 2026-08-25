# Plano de Correção Crítica: Infraestrutura VPS e Banco de Dados

O usuário relatou falhas críticas no deploy devido a incompatibilidades entre o ambiente de desenvolvimento (Supabase-like) e a VPS privada. O plano foca em remover dependências de schemas externos, padronizar permissões e unificar a gestão de ativos.

## Ações Planejadas

### 1. Backend e Scripts (Correção dotenv)
- Corrigir o erro `Cannot find package 'dotenv'` no script `import-agosto-micban.ts` garantindo que o `ts-node` ou `bun` consiga resolver as dependências a partir da raiz do projeto.
- Ajustar o caminho de carregamento do `.env`.

### 2. Migrações do Banco de Dados (Correção de Erros SQL)
- **migration-sanitarios-types.sql**: Corrigir a coluna `slug` que está violando a restrição NOT NULL (adicionar valor padrão ou tornar opcional).
- **migration-photos-refinement.sql**: Substituir a role `authenticated` (inexistente na VPS) pela role `public` ou pelo usuário `lipe`.
- **migration-os-history.sql**: Remover referências ao schema `auth.users` (exclusivo do Supabase) e apontar para `public.users`.
- **migration-os-status-refinement.sql**: Corrigir a referência de `erp_sanitarios` para a tabela unificada `sanitarios`.

### 3. Unificação de Ativos (Sanitários)
- Consolidar as tabelas `erp_sanitarios`, `erp_sanitarios_new` e `sanitarios` em uma única tabela `public.sanitarios` no arquivo `ensure-schema.sql`.
- Garantir que todos os campos necessários para o ERP e para as Rotas estejam presentes na tabela unificada.

### 4. Ajustes Visuais (Text Edits)
- Substituir o texto de regras do sistema conforme solicitado na mensagem original.

## Detalhes Técnicos
- O usuário `lipe` será o proprietário dos objetos na VPS.
- As restrições de `FOREIGN KEY` serão migradas de `auth.users(id)` para `public.users(id)`.
- O script de importação será testado para garantir que encontra as bibliotecas necessárias.

## Verificação
- Rodar verificação de sintaxe SQL nas migrations alteradas.
- Simular a execução do script de importação com as novas correções de caminho.
