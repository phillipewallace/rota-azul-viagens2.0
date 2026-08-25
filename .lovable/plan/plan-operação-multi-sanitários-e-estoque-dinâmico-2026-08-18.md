# Plan: Operação Multi-Sanitários e Estoque Dinâmico

Melhorar a gestão de sanitários em orçamentos, estoque e operação de campo, permitindo locações de múltiplos itens com rastreamento individual e auto-catálogo.

## Design e UX

### ERP: Orçamentos (ErpQuotes.tsx)
- Adicionar um botão de alternância (toggle) ao lado de cada item de orçamento.
- Quando ativado, o campo "Produto" torna-se um menu suspenso (SearchableSelect) filtrado por sanitários disponíveis no estoque.
- Ao selecionar um sanitário, o campo "Descrição" é preenchido automaticamente com os detalhes técnicos do ativo.

### ERP: Gestão de Sanitários (Sanitarios.tsx)
- Adicionar interface de Cadastro Manual: botão "Novo Sanitário" para alimentar o estoque sem depender de uma OS.
- Implementar edição e exclusão de ativos diretamente na tabela de inventário.
- Listagem dos tipos de sanitários ativos no sistema: Comum, PNE, Pia, Luxo, Cabine de Banho.

### Mobile: App Funcionários (AppFuncionarios.tsx)
- **Entrega Multi-Item**: Em OS com múltiplos sanitários, exibir uma lista de campos para preenchimento.
- **Auto-Registro**: Se o número digitado pelo funcionário não existir no estoque, abrir modal de "Novo Ativo" para capturar fotos de registro, estado e tipo.
- **Ação Rápida**: Novo botão "Registrar Sanitário" no menu principal para catalogar ativos avulsos encontrados em campo.
- **Fotos Individuais**: Exigir obrigatoriamente uma foto para cada unidade entregue ou recolhida.

## Detalhes Técnicos

### Backend e Banco de Dados
- Criar endpoint `GET /api/erp/sanitarios-new/tipos` para listar categorias (já existe parcial).
- Ajustar `POST /api/sanitarios` para suportar criação/atualização atômica com fotos de registro.
- Implementar `GET /api/sanitarios/available` para alimentar o dropdown de orçamentos.
- Garantir que a tabela `erp_sanitarios_new` suporte o histórico de "Estado de Conservação".

### Frontend
- Criar hook `useSanitarios` para gerenciar o estado global de ativos disponíveis.
- Refatorar o componente de itens em `ErpQuotes.tsx` para suportar o modo "Seleção de Ativo".
- Atualizar `AppFuncionarios.tsx` com o fluxo de validação de número de série e registro em tempo real.
- Padronizar o componente de upload de fotos no Mobile para suportar múltiplas capturas vinculadas a IDs de ativos diferentes.

## Segurança e Performance
- Cache local de tipos de sanitários para carregamento instantâneo.
- Validação de unicidade de número de sanitário no backend com tratamento de erro amigável no Mobile.
- Logs de auditoria para cada novo ativo registrado manualmente.
