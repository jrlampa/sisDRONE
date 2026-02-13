import { test, expect } from '@playwright/test';

test.describe('Work Orders Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to Kanban board and show columns', async ({ page }) => {
    // Navigate to Work Orders tab
    await page.click('button:has-text("Ordens de Serviço")');

    // Verify columns are visible
    await expect(page.getByText('A Fazer')).toBeVisible();
    await expect(page.getByText('Em Andamento')).toBeVisible();
    await expect(page.getByText('Concluído')).toBeVisible();
  });

  test('should open creation modal from pole details', async ({ page }) => {
    // Click on a pole (assuming there's one, or using a known selector)
    // Leaflet markers are usually paths or divs. We'll try to find a marker.
    const marker = page.locator('.leaflet-marker-icon').first();
    await marker.click();

    // Check if PoleDetails is visible and has the "Criar Ordem de Serviço" button
    const createBtn = page.getByRole('button', { name: /Criar Ordem de Serviço/i });
    await expect(createBtn).toBeVisible();

    await createBtn.click();

    // Verify modal is open
    await expect(page.getByText('Nova Ordem de Serviço')).toBeVisible();
    await expect(page.getByLabel('Título')).toBeVisible();
  });
});
