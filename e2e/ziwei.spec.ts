import { test, expect } from '@playwright/test';

test.describe('紫微斗数', () => {
  test('应显示紫微选项卡', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('button', { hasText: '紫微斗数' })).toBeVisible();
  });

  test('紫微选项卡应可选中', async ({ page }) => {
    await page.goto('./');
    await page.locator('button', { hasText: '紫微斗数' }).click();
    await expect(page.locator('button', { hasText: '紫微斗数' }).first()).toHaveAttribute('data-state', 'active');
  });

  test('无选中人物时应显示演示盘', async ({ page }) => {
    await page.goto('./');
    await page.locator('button', { hasText: '紫微斗数' }).click();
    // 紫微页面使用默认参数显示演示盘, 应显示 Chart 组件
    // Chart 组件包含命盘表格
    await expect(page.locator('.zwds-theme').first()).toBeVisible({ timeout: 5000 });
  });

  test('选中人物后应加载人物信息', async ({ page }) => {
    // 先创建人物
    await page.goto('./');
    const personId = await page.evaluate(async () => {
      const p = await (window as any).peep.person.create({
        name: '紫微测试', gender: 'male', birthDate: '1990-03-15', birthTime: '08:00'
      });
      return p.id;
    });

    // 带 personId 访问工作台并切换到紫微 tab
    await page.goto(`./?personId=${personId}&tab=ziwei`);
    // 应显示 toast 提示已加载人物信息
    await expect(page.locator('text=已加载').first()).toBeVisible({ timeout: 10000 });
  });
});
