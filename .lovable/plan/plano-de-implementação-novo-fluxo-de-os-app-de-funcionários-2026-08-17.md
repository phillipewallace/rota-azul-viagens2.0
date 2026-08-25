# Plano de Implementação: Novo Fluxo de OS, App de Funcionários e Gestão de Sanitários

Este plano detalha a modernização do fluxo operacional, integrando um aplicativo para funcionários e uma gestão profissional de sanitários no ERP.

## Alterações Técnicas

### 1. Banco de Dados
- **Tabela `erp_funcionarios`**: Gestão de usuários operacionais com login via CPF e controle de primeiro acesso.
- **Tabela `erp_sanitario_fotos`**: Armazenamento cronológico de fotos por evento (registro, entrega, recolhimento).
- **Tabela `erp_sanitario_tipos`**: Tipos dinâmicos (Comum, PNE, Pia, Luxo, Banho, Rede Esgoto).
- **Extensões**: Adição de campos em `sanitarios` (estado_atual, tipo_locacao_alvo) e `erp_service_orders` (status de entrega/recolhimento).

### 2. Backend (Node.js/Express)
- **Novas Rotas**: `/api/erp/funcionarios` e `/api/erp/sanitarios-new`.
- **Lógica de Fluxo**: Endpoints para "Solicitar Recolhimento" e "Confirmar Entrega/Recolhimento" com validação de fotos.
- **Autenticação**: Suporte a login por CPF para funcionários.

### 3. Frontend ERP (React)
- **Refatoração da Aba Sanitários**:
  - Grid profissional com modais de detalhe.
  - Linha do tempo visual com histórico de fotos.
  - Filtros avançados por tipo e estado de conservação.
- **Ajustes na Aba OS**:
  - Novos botões de controle de fluxo (Solicitar Recolhimento).
  - Visualização de fotos enviadas pelo app.

### 4. App Funcionários (PWA)
- **Interface Mobile-First**: `/app-funcionarios`.
- **Agenda**: Lista de OS pendentes, futuras e atrasadas.
- **Operacional**:
  - Scanner/Input de numeração de sanitário.
  - Câmera integrada para envio obrigatório de fotos.
  - Catalogação rápida de novos sanitários durante a entrega.

## User Experience (UX)
- **Segurança**: Primeiro login exige troca de senha.
- **Agilidade**: Cadastro de sanitário "na hora" se não estiver no sistema.
- **Transparência**: Histórico completo do sanitário acessível por QR Code ou busca.

## Cronograma Sugerido
1. Migração de DB e Rotas Backend.
2. Desenvolvimento do App PWA (Core).
3. Refatoração da UI de Sanitários no ERP.
4. Testes de ponta a ponta e Deploy.
