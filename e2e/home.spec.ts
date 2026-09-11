import { test, expect } from '@playwright/test';

test.describe('工作台', () => {
  test('应显示工作台页面', async ({ page }) => {
    await page.goto('/');
    // 工作台页面应包含排盘选项卡
    await expect(page.locator('button', { hasText: '八字排盘' }).first()).toBeVisible();
  });

  test('应显示排盘选项卡', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button', { hasText: '八字排盘' })).toBeVisible();
    await expect(page.locator('button', { hasText: '紫微斗数' })).toBeVisible();
    await expect(page.locator('button', { hasText: '六爻起卦' })).toBeVisible();
  });

  test('应显示人物选择器（在顶部）', async ({ page }) => {
    await page.goto('/');
    // 人物选择器已移到顶部Header
    await expect(page.locator('text=当前研究').first()).toBeVisible();
  });
});
