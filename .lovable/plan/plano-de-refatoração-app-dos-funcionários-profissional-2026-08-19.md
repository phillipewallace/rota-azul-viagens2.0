# Plano de Refatoração: App dos Funcionários Profissional

O objetivo é transformar o App dos Funcionários em uma ferramenta robusta e visualmente moderna (PWA), unificando a agenda, gestão de sanitários e integração com checklists de veículos.

## Melhorias de UI/UX (Frontend)
- **Design Moderno e Limpo**: Implementação de uma interface focada em cartões (Cards) com sombras suaves, tipografia legível e navegação intuitiva.
- **Navegação Inferior (Bottom Bar)**: Barra de navegação fixa para acesso rápido à "Agenda", "Histórico", "Checklist" e "Perfil".
- **Calendário Interativo**: Adição de um cabeçalho de calendário semanal/mensal para facilitar a visualização de prazos.
- **Feedback Visual de Status**: Badges coloridos e ícones dinâmicos para diferenciar OS Abertas, Despachadas, Entregues e Recolhimento.
- **Integração com Checklist**: Adição de atalho direto para o sistema de checklist de caminhões já existente, integrando-o ao fluxo de trabalho do motorista.

## Regras de Negócio e Backend
- **Filtro de Data Retroativa**: Ajuste na API para exibir OS abertas apenas a partir de **19/08/2026**.
- **Gestão de Funcionários (Admin)**: O botão de "Adicionar Funcionário" será mantido ou reforçado no Painel Admin (Settings/Funcionários), mantendo o foco do App na operação.
- **Cadastro Dinâmico de Sanitários**: Fluxo simplificado no App para cadastrar novos números de série no estoque via foto e numeração durante a entrega.
- **Fluxo de Serviço Genérico**: Refinamento da interface para serviços que não envolvem sanitários (limpezas, manutenções), exigindo relato e foto.

## Detalhes Técnicos
- **Frontend**: Atualização de `src/pages/app-funcionarios/AppFuncionarios.tsx` com novos componentes ShadcnUI (Calendar, Tabs, Bottom Nav).
- **Backend**: Modificação em `backend/src/routes/app-funcionarios.ts` para aplicar o filtro de data `o.data_entrega >= '2026-08-19'`.
- **Logs Operacionais**: Integração do sistema de logs detalhados para cada ação realizada pelo funcionário no App.
- **Integração Checklist**: Redirecionamento via rota `/checklist` integrada ao menu do App.

## Verificação
- Teste de login com CPF/Senha.
- Verificação da fila global de OS pós-19/08.
- Teste de fluxo completo: Assumir OS -> Checklist Caminhão -> Entrega Sanitário -> Foto -> Conclusão.