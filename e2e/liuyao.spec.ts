import { test, expect } from '@playwright/test';

test.describe('六爻起卦', () => {
  test('应显示六爻页面', async ({ page }) => {
    await page.goto('/');
    // 切换到六爻tab
    await page.locator('button', { hasText: '六爻起卦' }).click();
    await expect(page.locator('text=六爻起卦').first()).toBeVisible();
    await expect(page.locator('text=起卦设置').first()).toBeVisible();
  });

  test('应包含摇卦按钮', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '六爻起卦' }).click();
    await expect(page.getByRole('button', { name: '摇卦' })).toBeVisible();
  });

  test('应包含用神目标选择', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '六爻起卦' }).click();
    await expect(page.locator('text=用神目标').first()).toBeVisible();
  });

  test('摇卦后应显示卦象面板和AI提示词', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '六爻起卦' }).click();

    // 点击摇卦
    await page.getByRole('button', { name: '摇卦' }).click();

    // 摇卦后应显示 AI 提示词面板
    await expect(page.locator('text=AI 提示词').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '复制提示词' })).toBeVisible();
  });

  test('应显示日期输入和占事输入', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '六爻起卦' }).click();

    // 日期输入
    await expect(page.locator('input[type="date"]')).toBeVisible();
    // 占事输入
    await expect(page.getByPlaceholder('例：近期财运如何？')).toBeVisible();
  });

  test('应能输入占事问题', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '六爻起卦' }).click();

    // 填写占事
    await page.getByPlaceholder('例：近期财运如何？').fill('测试占事问题');
    await expect(page.getByPlaceholder('例：近期财运如何？')).toHaveValue('测试占事问题');
  });
});
