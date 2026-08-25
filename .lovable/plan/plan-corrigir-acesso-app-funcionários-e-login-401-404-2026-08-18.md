# Plan: Corrigir Acesso App Funcionários e Login 401/404

Investigação inicial sugere que o middleware de demonstração ou a ordem das rotas no `backend/src/index.ts` está bloqueando ou redirecionando as requisições do app de funcionários, resultando em 401 (Unauthorized) ou 404.

## Technical Details

- **Backend**: Mover a rota `/api/app-funcionarios` para antes do middleware `restrictDemo` em `backend/src/index.ts`.
- **Login**: Adicionar logs detalhados no backend para verificar se as requisições de login estão chegando e por que falham (CPF não encontrado, senha errada ou erro de token).
- **Filtro de OS**: Refinar o endpoint `GET /os` para que funcionários vejam apenas suas próprias ordens de serviço (baseado no `funcionario_id` do token).
- **Segurança UI**: Adicionar `autocomplete="username"` e `autocomplete="current-password"` no formulário de login para satisfazer os avisos do navegador e melhorar a UX.

## Proposed Changes

### Backend

#### [backend/src/index.ts]
- Mover o registro de `appFuncionariosRoutes` para o topo da lista de APIs, garantindo que não seja afetado por middlewares globais restritivos.

#### [backend/src/routes/erp-funcionarios.ts]
- Implementar logs de sucesso/falha no login para facilitar o debug pelo console do servidor.

#### [backend/src/routes/app-funcionarios.ts]
- Ajustar a query de listagem de OS para respeitar o ID do funcionário logado, garantindo privacidade e organização.

### Frontend

#### [src/pages/app-funcionarios/AppFuncionarios.tsx]
- Atualizar os campos de input do login com atributos de acessibilidade e preenchimento automático.
