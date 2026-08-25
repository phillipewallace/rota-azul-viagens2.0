# Plano de Refatoração: Visualização de OS e Sincronização de Itens (App Funcionários)

O objetivo é transformar a tela de detalhes da OS no App de Funcionários, tornando-a mais profissional com tons pastéis/claros, e corrigir a falha de sincronização que impede a visualização correta dos sanitários e serviços pedidos.

## 1. Correção da Sincronização (Backend & API)

- **Revisão do Agrupamento**: Garantir que o campo `items` retornado pela rota `GET /app-funcionarios/os` inclua corretamente `isSanitario` e `isGenericService`.
- **Estabilidade na Conversão**: Verificar se a lógica de `isSanitario` no `erp-quotes.ts` (conversão Orçamento -> OS) está salvando os dados corretamente no banco.

## 2. Refatoração Visual (Frontend - App Funcionários)

- **Layout de Detalhes**: Redesenhar a seção de itens com cards de cores pastéis:
  - **Azul Pastel**: Para sanitários.
  - **Verde/Cinza Pastel**: Para serviços genéricos.
- **Visualização Agrupada**: Exibir "5x Sanitário PNE" em vez de linhas repetidas, com ícones claros e tipografia refinada.
- **Ações Rápidas**: Manter botões de Wpp/Maps mas com design integrado à paleta clara.
- **Feedback Visual**: Adicionar skeletons de carregamento para a lista de sanitários vinculados.

## 3. Melhorias na Experiência do Usuário (UX)

- **Status Visível**: Badges translúcidas para indicar se o item já foi entregue ou recolhido dentro do agrupamento.
- **Botões de Ação**: Refinar os modais de "Entrega" e "Recolhimento" para serem mais rápidos e intuitivos.

## Detalhes Técnicos

- **Cores**: Utilizar variantes de `bg-blue-50`, `bg-emerald-50`, `bg-slate-50` com textos em tons mais escuros das mesmas cores.
- **Componentes**: Atualização no `AppFuncionarios.tsx` para implementar a nova estrutura de `selectedOs.items`.
- **Segurança**: Garantir que as fotos continuem sendo vinculadas corretamente no novo layout.
