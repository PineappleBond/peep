import { test, expect } from '@playwright/test';

test.describe('紫微斗数', () => {
  test('应显示紫微页面', async ({ page }) => {
    await page.goto('/');
    // 切换到紫微tab
    await page.locator('button', { hasText: '紫微斗数' }).click();
    // 无选中人物时应显示输入面板（起盘按钮）
    await expect(page.getByRole('button', { name: '起 盘' })).toBeVisible();
  });

  test('应包含起盘按钮', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '紫微斗数' }).click();
    await expect(page.getByRole('button', { name: '起 盘' })).toBeVisible();
  });

  test('排盘后应显示AI提示词面板（多种类型）', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '紫微斗数' }).click();
    // 点击起盘按钮（使用默认值）
    await page.getByRole('button', { name: '起 盘' }).click();
    // 检查AI提示词面板（默认展开）
    await expect(page.locator('text=AI 提示词').first()).toBeVisible({ timeout: 10000 });
    // 检查多种提示词类型
    await expect(page.getByRole('tab', { name: '命盘解读' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '运限分析' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '事件预测' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '关系对比' })).toBeVisible();
  });

  test('紫微排盘后应能复制提示词', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.locator('button', { hasText: '紫微斗数' }).click();
    await page.getByRole('button', { name: '起 盘' }).click();

    await expect(page.locator('text=AI 提示词').first()).toBeVisible({ timeout: 10000 });

    // 点击复制按钮
    await page.getByRole('button', { name: '复制提示词' }).click();
    await expect(page.getByRole('button', { name: '已复制' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=提示词已复制')).toBeVisible({ timeout: 5000 });
  });
});
