# Plano: Implementação do Histórico Completo de OS com Fotos e Auditoria

Este plano descreve a criação de um sistema de histórico detalhado para as Ordens de Serviço (OS) no ERP administrativo. O objetivo é permitir que gestores visualizem fotos, logs de status, geolocalização e adicionem notas internas em um modal centralizado.

## Objetivos
- Criar um modal de "Histórico da OS" acessível diretamente pelo card/tabela da OS no ERP.
- Exibir uma linha do tempo (Timeline) com auditoria completa: quem fez, o quê, quando e onde (GPS).
- Permitir visualização em tela cheia e download das fotos capturadas pelos funcionários no App.
- Implementar um sistema de notas internas para anotações administrativas na OS.

## Detalhes Técnicos

### Backend (Node.js/TypeScript)
- **Novo Endpoint**: `GET /api/erp/service-orders/:id/history` para buscar todos os eventos relacionados (mudanças de status, fotos enviadas, comentários).
- **Novo Endpoint**: `POST /api/erp/service-orders/:id/notes` para salvar notas internas.
- **Banco de Dados**: 
  - As fotos já estão sendo salvas em `erp_os_sanitarios`, mas vamos consolidar a leitura.
  - Utilizaremos a tabela `audit_logs` (ou uma nova `erp_os_history` se necessário para performance) para registrar as mudanças de estado e GPS.

### Frontend (React/Tailwind)
- **Componente `OSHistoryModal`**:
  - Exibição em Timeline (vertical).
  - Galeria de imagens com suporte a Zoom (lightbox) e botão de download.
  - Exibição de mapas (estático ou link) para as coordenadas GPS registradas.
  - Campo de texto para "Nova Nota Interna".
- **Integração**: Adicionar o botão de ícone (ex: `ClockCounterClockwise` ou `History`) no componente `ServiceOrders.tsx`.

### Armazenamento de Fotos
- As fotos continuarão sendo armazenadas via Lovable Cloud Storage (Supabase Storage sob o capô), garantindo persistência e acesso seguro.

## Próximos Passos
1. Criar a estrutura de dados para o histórico e notas se ainda não existirem.
2. Desenvolver os endpoints de busca e inserção de notas.
3. Criar a interface do Modal no ERP Administrativo.
4. Testar o fluxo completo desde o upload no App até a visualização no ERP.
