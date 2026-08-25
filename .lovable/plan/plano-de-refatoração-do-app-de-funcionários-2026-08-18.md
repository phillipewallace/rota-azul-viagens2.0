# Plano de Refatoração do App de Funcionários

Este plano visa corrigir o erro crítico "C.filter is not a function", implementar logs centralizados e melhorar a UX com suporte a fotos (câmera/galeria) e histórico de serviços.

## Mudanças Técnicas

### Backend
- **Logs Centralizados**: Criar rota `POST /api/logs/client` para receber logs do frontend e salvá-los no `backend/src/utils/logger.ts`.
- **Robustez de Dados**: Garantir que as rotas de OS em `/api/app-funcionarios/os` sempre retornem arrays vazios em vez de `null` ou erros não tratados.
- **Histórico**: Adicionar filtro de status ou rota dedicada para serviços concluídos.

### Frontend
- **Isolamento de Estado**: Refatorar `AppFuncionarios.tsx` para usar sub-componentes e hooks dedicados.
- **Logger Integrado**: Atualizar `src/lib/logger.ts` para enviar erros para o servidor se estiver no modo centralizado.
- **UI/UX**:
  - Adicionar aba "Histórico" no menu inferior.
  - Implementar seletor de origem de foto (Câmera vs Galeria).
  - Corrigir a lógica de filtro de status que causa o crash.

## Detalhes de Implementação

```text
- backend/src/index.ts: Adicionar rota de logs.
- backend/src/routes/app-funcionarios.ts: Ajustar retornos para garantir arrays.
- src/pages/app-funcionarios/AppFuncionarios.tsx: Refatoração completa.
```

O sistema será mantido funcional durante a transição, sem perda de dados, focando na estabilidade do PWA que já está em uso.
