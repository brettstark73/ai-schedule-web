import { test, expect } from '@playwright/test';

test.describe('Schedule Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/edit');
  });

  test('should load editor page', async ({ page }) => {
    await expect(page.getByText('Schedule Editor')).toBeVisible();
  });

  test('should show command input', async ({ page }) => {
    const input = page.locator('input[placeholder*="SW_IMPL"]');
    await expect(input).toBeVisible();
  });

  test('should show example commands', async ({ page }) => {
    await expect(page.getByText('Example Commands:')).toBeVisible();
    await expect(page.getByText(/SW_IMPL is 75%/)).toBeVisible();
  });

  test('should parse progress update command', async ({ page }) => {
    // Type command
    await page.fill('input[placeholder*="SW_IMPL"]', 'SW_IMPL is 75%');

    // Click parse button
    await page.click('button:has-text("Parse Command")');

    // Wait for parsed result
    await expect(page.getByText('Parsed Command')).toBeVisible();
    await expect(page.getByText(/Intent:/)).toBeVisible();
    await expect(page.getByText(/Confidence:/)).toBeVisible();
  });

  test('should show proposed changes after parsing', async ({ page }) => {
    // Enter and parse command
    await page.fill('input[placeholder*="SW_IMPL"]', 'SW_IMPL is 80%');
    await page.click('button:has-text("Parse Command")');

    // Wait for proposed changes
    await expect(page.getByText('Proposed Changes')).toBeVisible();
    await expect(page.getByText(/progress/i)).toBeVisible();
  });

  test('should parse mark complete command', async ({ page }) => {
    await page.fill('input[placeholder*="SW_IMPL"]', 'mark SW_DESIGN complete');
    await page.click('button:has-text("Parse Command")');

    await expect(page.getByText(/mark_complete|complete/i)).toBeVisible();
  });

  test('should parse duration extension command', async ({ page }) => {
    await page.fill('input[placeholder*="SW_IMPL"]', 'extend HW_PROTO by 5 days');
    await page.click('button:has-text("Parse Command")');

    await expect(page.getByText(/extend|duration/i)).toBeVisible();
  });

  test('should show confidence score', async ({ page }) => {
    await page.fill('input[placeholder*="SW_IMPL"]', 'SW_IMPL is 75%');
    await page.click('button:has-text("Parse Command")');

    // Should show confidence percentage
    await expect(page.getByText(/%/)).toBeVisible();
  });

  test('should apply changes', async ({ page }) => {
    // Parse command
    await page.fill('input[placeholder*="SW_IMPL"]', 'SW_IMPL is 85%');
    await page.click('button:has-text("Parse Command")');

    // Wait for proposed changes
    await expect(page.getByText('Proposed Changes')).toBeVisible();

    // Click apply
    await page.click('button:has-text("Apply Changes")');

    // Should show success message
    await expect(page.getByText(/success|applied/i)).toBeVisible();
  });

  test('should clear command after applying', async ({ page }) => {
    // Parse and apply
    await page.fill('input[placeholder*="SW_IMPL"]', 'SW_IMPL is 90%');
    await page.click('button:has-text("Parse Command")');
    await page.click('button:has-text("Apply Changes")');

    // Input should be cleared
    const input = page.locator('input[placeholder*="SW_IMPL"]');
    await expect(input).toHaveValue('');
  });

  test('should handle Enter key to parse', async ({ page }) => {
    await page.fill('input[placeholder*="SW_IMPL"]', 'SW_IMPL is 75%');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Parsed Command')).toBeVisible();
  });

  test('should navigate back to viewer', async ({ page }) => {
    await page.click('text=Back to Viewer');

    await expect(page).toHaveURL('/');
    await expect(page.getByText('Project Schedule')).toBeVisible();
  });

  test('should disable parse button when input is empty', async ({ page }) => {
    const button = page.locator('button:has-text("Parse Command")');
    await expect(button).toBeDisabled();
  });

  test('should show low confidence warning', async ({ page }) => {
    // Use an ambiguous/unclear command
    await page.fill('input[placeholder*="SW_IMPL"]', 'something random');
    await page.click('button:has-text("Parse Command")');

    // Should show error or low confidence message
    const hasError = await page.getByText(/not recognized|low confidence/i).isVisible().catch(() => false);
    expect(hasError).toBeTruthy();
  });

  test('should handle multiple commands in sequence', async ({ page }) => {
    // First command
    await page.fill('input[placeholder*="SW_IMPL"]', 'SW_IMPL is 75%');
    await page.click('button:has-text("Parse Command")');
    await page.click('button:has-text("Apply Changes")');

    // Wait for success
    await expect(page.getByText(/success/i)).toBeVisible();

    // Second command
    await page.fill('input[placeholder*="SW_IMPL"]', 'SW_IMPL is 80%');
    await page.click('button:has-text("Parse Command")');

    // Should show new parsed result
    await expect(page.getByText(/80/)).toBeVisible();
  });
});
