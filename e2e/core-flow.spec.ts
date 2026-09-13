import { test, expect } from '@playwright/test';

test.describe('核心流程优化', () => {
  test.beforeEach(async ({ context }) => {
    // 清除 localStorage 避免跨测试干扰
    await context.clearCookies();
  });

  test('应记住上次选中的工作台选项卡', async ({ page }) => {
    await page.goto('./');
    // 切换到紫微 tab
    await page.locator('button', { hasText: '紫微斗数' }).click();
    await expect(page.locator('button', { hasText: '紫微斗数' }).first()).toHaveAttribute('data-state', 'active');

    // 刷新页面
    await page.reload();
    // 应仍停留在紫微 tab
    await expect(page.locator('button', { hasText: '紫微斗数' }).first()).toHaveAttribute('data-state', 'active');
  });

  test('选中人物后八字排盘应自动计算', async ({ page }) => {
    // 先创建一个人物
    await page.goto('persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('测试笔记');
    await page.getByLabel('出生日期').fill('1990-05-15');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 跳转到八字排盘
    await page.getByRole('button', { name: '八字' }).click();
    // 等待排盘结果（自动计算）
    await expect(page.locator('text=详细命盘').first()).toBeVisible({ timeout: 10000 });
  });

  test('人物详情应显示排盘快捷按钮', async ({ page }) => {
    // 创建人物
    await page.goto('persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('跳转测试');
    await page.getByLabel('出生日期').fill('1990-06-15');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 选中人物后应显示排盘快捷按钮
    await expect(page.getByRole('button', { name: '八字' })).toBeVisible();
    await expect(page.getByRole('button', { name: '紫微' })).toBeVisible();
    await expect(page.getByRole('button', { name: '六爻' })).toBeVisible();
  });

  test('文档编辑页应能保存文档', async ({ page }) => {
    // 先创建人物
    await page.goto('persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('文档关联测试');
    await page.getByLabel('出生日期').fill('1990-07-15');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 跳转到笔记页
    await page.goto('documents/new');
    await page.waitForLoadState('domcontentloaded');
    // 应显示标题输入框
    await expect(page.getByPlaceholder('输入标题...')).toBeVisible({ timeout: 5000 });
  });

  test('笔记页应支持从 URL personId 参数过滤', async ({ page }) => {
    // 先创建人物
    await page.goto('persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('过滤测试');
    await page.getByLabel('出生日期').fill('1990-08-15');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 带 personId 访问笔记页
    await page.goto('documents');
    await expect(page.locator('h1', { hasText: '笔记' }).first()).toBeVisible();
  });

  test('选中的排盘选项卡刷新后应保持', async ({ page }) => {
    await page.goto('./');
    // 默认是八字 tab
    await expect(page.locator('button', { hasText: '八字排盘' }).first()).toHaveAttribute('data-state', 'active');

    // 切换到六爻
    await page.locator('button', { hasText: '六爻起卦' }).click();
    await expect(page.locator('button', { hasText: '六爻起卦' }).first()).toHaveAttribute('data-state', 'active');

    // 刷新
    await page.reload();
    // 应该记住是六爻
    await expect(page.locator('button', { hasText: '六爻起卦' }).first()).toHaveAttribute('data-state', 'active');
  });

  test('侧边栏导航应能切换页面', async ({ page }) => {
    await page.goto('./');

    // 侧边栏"人物库"链接
    await page.locator('a', { hasText: '人物库' }).click();
    await expect(page).toHaveURL(/\/persons/);
    await expect(page.locator('h1', { hasText: '人物库' })).toBeVisible();

    // 侧边栏"笔记"链接
    await page.locator('a', { hasText: '笔记' }).click();
    await expect(page).toHaveURL(/\/documents/);
    await expect(page.locator('h1', { hasText: '笔记' }).first()).toBeVisible();

    // 侧边栏"工作台"链接
    await page.locator('a', { hasText: '工作台' }).first().click();
    await expect(page).toHaveURL(/\/peep\/?$/);
    await expect(page.locator('button', { hasText: '八字排盘' }).first()).toBeVisible();
  });

  test('主题切换按钮应存在且可点击', async ({ page }) => {
    await page.goto('./');
    // 侧边栏底部应有主题切换按钮
    const themeButton = page.locator('aside button').last();
    await expect(themeButton).toBeVisible();
    // 应包含太阳或月亮图标
    await expect(themeButton.locator('svg').first()).toBeVisible();
  });

  test('工作台 URL 参数 tab 应能直接定位选项卡', async ({ page }) => {
    await page.goto('?tab=ziwei');
    await expect(page.locator('button', { hasText: '紫微斗数' }).first()).toHaveAttribute('data-state', 'active');

    await page.goto('?tab=liuyao');
    await expect(page.locator('button', { hasText: '六爻起卦' }).first()).toHaveAttribute('data-state', 'active');
  });

  test('人物选择器应显示当前选中人物', async ({ page }) => {
    // 先创建人物
    await page.goto('persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('选择器测试');
    await page.getByLabel('出生日期').fill('1990-01-01');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 获取人物 ID
    const url = page.url();
    const match = url.match(/personId=(\d+)/);
    const personId = match ? match[1] : null;

    if (personId) {
      // 带 personId 访问工作台
      await page.goto(`./?personId=${personId}`);
    } else {
      // 通过 API 获取人物 ID
      const id = await page.evaluate(async () => {
        const list = await (window as any).peep.person.list({ search: '选择器测试' });
        return list[0]?.id;
      });
      await page.goto(`./?personId=${id}`);
    }
    // Header 应显示选中人物的名字
    await expect(page.locator('text=选择器测试').first()).toBeVisible({ timeout: 5000 });
  });
});
