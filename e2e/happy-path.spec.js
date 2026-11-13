import { test, expect } from '@playwright/test'

test.describe('authentication', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page shows email input', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder('your@email.com')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send link' })).toBeVisible()
  })

  test('send link button is disabled with empty email', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Send link' })).toBeDisabled()
  })
})
