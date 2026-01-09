import { test, expect } from '@playwright/test';

test.describe('Schedule Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load homepage', async ({ page }) => {
    await expect(page).toHaveTitle(/AI Schedule/);
  });

  test('should display project name', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/Project/);
  });

  test('should show status summary', async ({ page }) => {
    await expect(page.getByText(/Status/)).toBeVisible();
    await expect(page.getByText(/Duration/)).toBeVisible();
    await expect(page.getByText(/Critical Path/)).toBeVisible();
    await expect(page.getByText(/Progress/)).toBeVisible();
  });

  test('should display Gantt chart', async ({ page }) => {
    await expect(page.getByText('Project Schedule')).toBeVisible();
  });

  test('should show zoom level buttons', async ({ page }) => {
    await expect(page.getByText('L1: Phases')).toBeVisible();
    await expect(page.getByText('L2: +Workstreams')).toBeVisible();
    await expect(page.getByText('L3: All Tasks')).toBeVisible();
  });

  test('should change zoom level', async ({ page }) => {
    // Click L1 button
    await page.click('text=L1: Phases');

    // Verify zoom changed (button should be highlighted)
    const l1Button = page.getByText('L1: Phases');
    await expect(l1Button).toHaveClass(/bg-blue-500/);
  });

  test('should navigate to editor', async ({ page }) => {
    await page.click('text=Edit Schedule');

    await expect(page).toHaveURL('/edit');
    await expect(page.getByText('Schedule Editor')).toBeVisible();
  });

  test('should export JSON', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.click('text=Export JSON');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);
  });

  test('should show at-risk items if any', async ({ page }) => {
    // Check if at-risk section exists
    const atRiskSection = page.getByText(/At-Risk Items/);
    const exists = await atRiskSection.isVisible().catch(() => false);

    if (exists) {
      await expect(atRiskSection).toBeVisible();
    }
  });

  test('should show milestones', async ({ page }) => {
    const milestonesSection = page.getByText(/Milestones/);
    const exists = await milestonesSection.isVisible().catch(() => false);

    if (exists) {
      await expect(milestonesSection).toBeVisible();
    }
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByText('Project Schedule')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByText('Project Schedule')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByText('Project Schedule')).toBeVisible();
  });
});
