import { test, expect } from '@playwright/test';

test('login page loads', async ({ page }) => {
  await page.goto('/');
  // Basic check for SPARK branding or login elements
  await expect(page).toHaveTitle(/SPARK/);
  const loginButton = page.getByRole('button', { name: /Login/i });
  await expect(loginButton).toBeVisible();
});
