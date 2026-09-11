import { test, expect } from '@playwright/test';

test.describe('八字排盘', () => {
  test('应显示八字选项卡', async ({ page }) => {
    await page.goto('/');
    // 工作台页面应包含八字选项卡
    await expect(page.locator('button', { hasText: '八字排盘' })).toBeVisible();
  });

  test('八字选项卡应可选中', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '八字排盘' }).click();
    await expect(page.locator('button', { hasText: '八字排盘' }).first()).toHaveAttribute('data-state', 'active');
  });

  test('无选中人物时应显示提示', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '八字排盘' }).click();
    // 无选中人物时, GlobalHoroscopeSelector 显示提示
    await expect(page.locator('text=请先选择或录入人物信息').first()).toBeVisible();
  });

  test('选中人物后应自动排盘并显示结果', async ({ page }) => {
    // 先通过 API 创建人物
    await page.goto('/');
    const personId = await page.evaluate(async () => {
      const p = await (window as any).peep.person.create({
        name: '八字测试', gender: 'male', birthDate: '1990-01-15', birthTime: '10:00'
      });
      return p.id;
    });

    // 带 personId 访问工作台
    await page.goto(`/?personId=${personId}`);
    // 等待排盘结果出现
    await expect(page.locator('text=详细命盘').first()).toBeVisible({ timeout: 10000 });
  });

  test('排盘后应显示详细命盘卡片', async ({ page }) => {
    await page.goto('/');
    const personId = await page.evaluate(async () => {
      const p = await (window as any).peep.person.create({
        name: '命盘测试', gender: 'female', birthDate: '1985-06-20', birthTime: '14:30'
      });
      return p.id;
    });

    await page.goto(`/?personId=${personId}`);
    await expect(page.locator('text=详细命盘').first()).toBeVisible({ timeout: 10000 });
  });
});
