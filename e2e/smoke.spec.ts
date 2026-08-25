import { test, expect } from '@playwright/test';

/**
 * Smoke tests — garantem que a aplicação sobe e que a tela de login
 * está totalmente acessível e funcional (sem precisar de backend).
 *
 * Mantenha estes testes rápidos: a ideia é falhar cedo em regressões
 * de boot, roteamento ou design system. Cenários de negócio (criar rota,
 * gerar PDF) devem ficar em arquivos próprios sob e2e/.
 */
test.describe('Smoke', () => {
  test('redireciona visitante anônimo para /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveTitle(/Entrar|AlchemyRotas/i);
  });

  test('tela de login é acessível por teclado', async ({ page }) => {
    await page.goto('/login');

    // Estrutura semântica: exatamente um <main> e um <h1>.
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: /AlchemyRotas/i })).toBeVisible();

    // Inputs nomeados.
    const username = page.getByLabel(/usuário/i);
    const password = page.getByLabel(/senha/i);
    await expect(username).toBeVisible();
    await expect(password).toBeVisible();

    // Submit desabilitado enquanto vazio (estado guardião).
    const submit = page.getByRole('button', { name: /entrar no sistema/i });
    await expect(submit).toBeDisabled();

    // Toggle de mostrar/ocultar senha tem nome acessível.
    await expect(page.getByRole('button', { name: /mostrar senha/i })).toBeVisible();

    // Preencheu → habilita.
    await username.fill('demo');
    await password.fill('demo');
    await expect(submit).toBeEnabled();
  });

  test('404 mostra link de retorno', async ({ page }) => {
    await page.goto('/rota-que-nao-existe-123');
    await expect(page.getByRole('link', { name: /voltar|início|home/i }).first()).toBeVisible();
  });
});
