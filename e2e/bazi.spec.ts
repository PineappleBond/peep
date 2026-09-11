import { test, expect } from '@playwright/test';

test.describe('八字排盘', () => {
  test('应显示排盘表单', async ({ page }) => {
    await page.goto('/');
    // 工作台页面应包含八字选项卡
    await expect(page.locator('button', { hasText: '八字排盘' })).toBeVisible();
    // 切换到八字tab
    await page.locator('button', { hasText: '八字排盘' }).click();
    // 应显示出生信息表单
    await expect(page.locator('text=出生信息').first()).toBeVisible();
  });

  test('应包含排盘按钮', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '八字排盘' }).click();
    await expect(page.getByRole('button', { name: '排盘' })).toBeVisible();
  });

  test('应包含AI提示词面板（排盘后）', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '八字排盘' }).click();
    // 填写表单 - 使用placeholder定位器
    const yearInput = page.locator('input[type="number"]').first();
    const monthInput = page.locator('input[type="number"]').nth(1);
    const dayInput = page.locator('input[type="number"]').nth(2);
    const hourInput = page.locator('input[type="number"]').nth(3);
    const minuteInput = page.locator('input[type="number"]').nth(4);

    await yearInput.fill('1990');
    await monthInput.fill('1');
    await dayInput.fill('15');
    await hourInput.fill('10');
    await minuteInput.fill('30');
    // 点击排盘
    await page.getByRole('button', { name: '排盘' }).click();
    // 检查AI提示词面板（默认展开）
    await expect(page.locator('text=AI 提示词').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: '命盘解读' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '流年分析' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '事件预测' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '关系对比' })).toBeVisible();
  });

  test('应显示四柱八字结果', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '八字排盘' }).click();
    // 填写表单
    const yearInput = page.locator('input[type="number"]').first();
    const monthInput = page.locator('input[type="number"]').nth(1);
    const dayInput = page.locator('input[type="number"]').nth(2);
    const hourInput = page.locator('input[type="number"]').nth(3);
    const minuteInput = page.locator('input[type="number"]').nth(4);

    await yearInput.fill('1990');
    await monthInput.fill('1');
    await dayInput.fill('15');
    await hourInput.fill('10');
    await minuteInput.fill('30');
    await page.getByRole('button', { name: '排盘' }).click();
    await expect(page.locator('text=四柱八字').first()).toBeVisible({ timeout: 10000 });
  });

  test('排盘后应能复制AI提示词', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.locator('button', { hasText: '八字排盘' }).click();

    await page.locator('input[type="number"]').first().fill('1990');
    await page.locator('input[type="number"]').nth(1).fill('1');
    await page.locator('input[type="number"]').nth(2).fill('15');
    await page.locator('input[type="number"]').nth(3).fill('10');
    await page.locator('input[type="number"]').nth(4).fill('30');
    await page.getByRole('button', { name: '排盘' }).click();

    await expect(page.locator('text=AI 提示词').first()).toBeVisible({ timeout: 10000 });

    // 点击复制
    await page.getByRole('button', { name: '复制提示词' }).click();
    // 应显示已复制状态
    await expect(page.getByRole('button', { name: '已复制' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=提示词已复制')).toBeVisible({ timeout: 5000 });
  });

  test('应显示出生信息标签', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '八字排盘' }).click();
    await expect(page.locator('text=出生信息').first()).toBeVisible();
  });
});
