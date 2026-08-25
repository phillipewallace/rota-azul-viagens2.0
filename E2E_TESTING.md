# Testes E2E (Playwright)

Setup mínimo e isolado — só roda quando explicitamente acionado. Não
participa do build de produção nem do `vitest` de unit tests.

## Instalação (uma vez por máquina)

```bash
bun add -D @playwright/test
bunx playwright install chromium
```

## Rodar os testes

```bash
bun run e2e           # roda todos os specs em e2e/
bun run e2e:ui        # modo interativo (debug visual)
bun run e2e:report    # abre o último relatório HTML
```

O Playwright sobe o Vite (`bun run dev` em `localhost:8080`) automaticamente
antes dos testes. Para apontar para um ambiente já rodando:

```bash
E2E_BASE_URL=https://alchemyrotas.com bun run e2e
```

## O que está coberto

- `e2e/smoke.spec.ts` — boot da app, redirect para `/login`, semântica e
  acessibilidade básica da tela de login, fallback 404.

Adicione novos cenários (criar rota, gerar PDF, etc.) em arquivos
separados sob `e2e/`. Mantenha o smoke rápido — ele deve falhar cedo
em regressões de roteamento ou design system.
