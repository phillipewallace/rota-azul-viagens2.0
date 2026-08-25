# Plano de Implementação: Fluxo Global e Gestão de Sanitários no App

Este plano detalha as alterações necessárias para alinhar o fluxo de Ordens de Serviço (OS) com uma fila global e permitir que funcionários gerenciem sanitários no aplicativo.

## Mudanças Propostas

### 1. Fila Global de OS (Pool)
- **Backend:** Remover a filtragem obrigatória por `funcionario_id` nas OS com status 'aberta' ou 'despachada' no endpoint `/app-funcionarios/os`.
- **Frontend (App):** Adicionar um botão "Assumir OS" ou "Iniciar Serviço" para OS que ainda não possuem um executor definido.

### 2. Cadastro e Vínculo de Sanitários
- **App:** Adicionar um botão visível "Adicionar Sanitário" dentro dos detalhes da OS.
- **App:** Melhorar o diálogo de cadastro para incluir categoria e estado de conservação, conforme solicitado.
- **Backend:** Ajustar a lógica de auto-registro para garantir que novos sanitários sejam criados com todos os detalhes fornecidos pelo App.

### 3. Melhorias de UI no App
- **Lista de OS:** Diferenciar visualmente OS "Disponíveis" (global) de OS "Em execução" (já assumidas pelo usuário).
- **Logs e Feedback:** Adicionar logs detalhados para cada ação de assumir OS e vincular item.

## Detalhes Técnicos

### Backend (`backend/src/routes/app-funcionarios.ts`)
- Alterar a query de listagem para: `WHERE status IN ('aberta', 'despachada') OR (status IN ('entregue', 'recolhimento_solicitado') AND funcionario_id = $1)`.
- Criar endpoint `POST /os/:id/assumir` para vincular o `funcionario_id` à OS.

### Frontend (`src/pages/app-funcionarios/AppFuncionarios.tsx`)
- Implementar o componente `AddingSanitarioDialog` com campos para `numero`, `categoria` e `estado`.
- Adicionar lógica para lidar com a "Fila Global".

## Considerações de Segurança
- Garantir que apenas funcionários logados possam ver e assumir OS.
- Manter a integridade referencial ao criar novos sanitários via App.
