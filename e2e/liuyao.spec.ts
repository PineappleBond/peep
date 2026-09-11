import { test, expect } from '@playwright/test';

test.describe('六爻起卦', () => {
  test('应显示六爻页面', async ({ page }) => {
    await page.goto('/');
    // 切换到六爻tab
    await page.locator('button', { hasText: '六爻起卦' }).click();
    await expect(page.locator('text=六爻起卦').first()).toBeVisible();
  });

  test('应包含摇卦按钮', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '六爻起卦' }).click();
    await expect(page.getByRole('button', { name: '摇卦' })).toBeVisible();
  });

  test('点击摇卦后应显示起卦信息表单', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '六爻起卦' }).click();

    // 点击摇卦进入编辑模式
    await page.getByRole('button', { name: '摇卦' }).click();

    // 应显示起卦信息区域
    await expect(page.locator('text=起卦信息').first()).toBeVisible({ timeout: 5000 });
  });

  test('应显示日期输入和占事输入', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '六爻起卦' }).click();

    // 先进入编辑模式
    await page.getByRole('button', { name: '摇卦' }).click();

    // 占事输入
    await expect(page.getByPlaceholder('例：近期财运如何？')).toBeVisible({ timeout: 5000 });
  });

  test('应能输入占事问题', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '六爻起卦' }).click();

    // 先进入编辑模式
    await page.getByRole('button', { name: '摇卦' }).click();

    // 填写占事
    await page.getByPlaceholder('例：近期财运如何？').fill('测试占事问题');
    await expect(page.getByPlaceholder('例：近期财运如何？')).toHaveValue('测试占事问题');
  });

  test('应包含用神目标选择', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '六爻起卦' }).click();

    // 先进入编辑模式
    await page.getByRole('button', { name: '摇卦' }).click();

    // 应显示用神目标
    await expect(page.locator('text=用神目标').first()).toBeVisible({ timeout: 5000 });
  });
});
