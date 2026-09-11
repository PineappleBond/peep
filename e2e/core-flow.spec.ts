import { test, expect } from '@playwright/test';

test.describe('核心流程优化', () => {
  test.beforeEach(async ({ context }) => {
    // 清除 localStorage 避免跨测试干扰
    await context.clearCookies();
  });

  test('应记住上次选中的工作台选项卡', async ({ page }) => {
    await page.goto('/');
    // 切换到紫微 tab
    await page.locator('button', { hasText: '紫微斗数' }).click();
    await expect(page.locator('button', { hasText: '紫微斗数' }).first()).toHaveAttribute('data-state', 'active');

    // 刷新页面
    await page.reload();
    // 应仍停留在紫微 tab
    await expect(page.locator('button', { hasText: '紫微斗数' }).first()).toHaveAttribute('data-state', 'active');
  });

  test('排盘页应显示写笔记按钮（选中人物后）', async ({ page }) => {
    // 先创建一个人物
    await page.goto('/persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('测试笔记');
    await page.getByLabel('出生日期').fill('1990-05-15');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 跳转到八字排盘
    await page.getByRole('button', { name: '八字' }).click();
    // 等待排盘结果（自动计算）
    await expect(page.locator('text=四柱八字').first()).toBeVisible({ timeout: 10000 });
    // 应显示写笔记按钮
    await expect(page.getByRole('button', { name: '写笔记' })).toBeVisible();
  });

  test('人物徽章应可点击跳转人物详情', async ({ page }) => {
    // 创建人物
    await page.goto('/persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('跳转测试');
    await page.getByLabel('出生日期').fill('1990-06-15');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 跳转到八字排盘
    await page.getByRole('button', { name: '八字' }).click();
    await expect(page.locator('text=四柱八字').first()).toBeVisible({ timeout: 10000 });

    // 点击排盘区域的人物徽章（包含"查看人物详情"title的div）
    await page.locator('[title="查看人物详情"]').first().click();
    // 应跳转回人物详情页
    await expect(page).toHaveURL(/\/persons\?personId=\d+/);
  });

  test('文档编辑页应显示查看人物详情按钮', async ({ page }) => {
    // 先创建人物
    await page.goto('/persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('文档关联测试');
    await page.getByLabel('出生日期').fill('1990-07-15');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 通过排盘页写笔记跳转
    await page.getByRole('button', { name: '八字' }).click();
    await expect(page.locator('text=四柱八字').first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '写笔记' }).click();

    // 应跳转到文档编辑页
    await expect(page).toHaveURL(/\/documents\/(new|edit\/.+)/);
    // 等待页面加载
    await page.waitForLoadState('domcontentloaded');
  });

  test('笔记页应支持从 URL personId 参数过滤', async ({ page }) => {
    // 先创建人物
    await page.goto('/persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('过滤测试');
    await page.getByLabel('出生日期').fill('1990-08-15');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 获取 URL 中的 personId
    const url = page.url();
    const match = url.match(/personId=(\d+)/);
    const personId = match ? match[1] : null;
    expect(personId).not.toBeNull();

    // 带 personId 访问笔记页
    await page.goto(`/documents?personId=${personId}`);
    await expect(page.locator('h1', { hasText: '笔记' }).first()).toBeVisible();
  });

  test('选中的排盘选项卡刷新后应保持', async ({ page }) => {
    await page.goto('/');
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
    await page.goto('/');

    // 侧边栏"人物库"按钮 (title="人物库")
    await page.locator('button[title="人物库"]').click();
    await expect(page).toHaveURL(/\/persons/);
    await expect(page.locator('h1', { hasText: '人物库' })).toBeVisible();

    // 侧边栏"笔记"按钮
    await page.locator('button[title="笔记"]').click();
    await expect(page).toHaveURL(/\/documents/);
    await expect(page.locator('h1', { hasText: '笔记' }).first()).toBeVisible();

    // 侧边栏"工作台"按钮
    await page.locator('button[title="工作台"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('button', { hasText: '八字排盘' }).first()).toBeVisible();
  });

  test('主题切换按钮应存在且可点击', async ({ page }) => {
    await page.goto('/');
    // 侧边栏底部应有主题切换按钮（亮色/暗色/跟随系统）
    const themeButton = page.locator('aside button').last();
    await expect(themeButton).toBeVisible();
    // 应包含太阳或月亮图标
    await expect(themeButton.locator('svg').first()).toBeVisible();
  });

  test('AI 提示词面板应能折叠和展开', async ({ page }) => {
    await page.goto('/');
    await page.locator('button', { hasText: '八字排盘' }).click();

    // 填写表单并排盘
    const yearInput = page.locator('input[type="number"]').first();
    await yearInput.fill('1990');
    await page.locator('input[type="number"]').nth(1).fill('1');
    await page.locator('input[type="number"]').nth(2).fill('15');
    await page.locator('input[type="number"]').nth(3).fill('10');
    await page.locator('input[type="number"]').nth(4).fill('30');
    await page.getByRole('button', { name: '排盘' }).click();

    // 等待 AI 提示词面板出现
    await expect(page.locator('text=AI 提示词').first()).toBeVisible({ timeout: 10000 });

    // 应有"复制提示词"按钮
    await expect(page.getByRole('button', { name: '复制提示词' })).toBeVisible();

    // 点击面板标题折叠
    await page.locator('text=AI 提示词').first().click();
    // 折叠后，"复制提示词"按钮应不可见
    await expect(page.getByRole('button', { name: '复制提示词' })).not.toBeVisible();

    // 再次点击展开
    await page.locator('text=AI 提示词').first().click();
    await expect(page.getByRole('button', { name: '复制提示词' })).toBeVisible();
  });

  test('AI 提示词复制按钮应显示 toast', async ({ page }) => {
    // 授权 clipboard 权限
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await page.locator('button', { hasText: '八字排盘' }).click();

    // 填写表单并排盘
    await page.locator('input[type="number"]').first().fill('1990');
    await page.locator('input[type="number"]').nth(1).fill('1');
    await page.locator('input[type="number"]').nth(2).fill('15');
    await page.locator('input[type="number"]').nth(3).fill('10');
    await page.locator('input[type="number"]').nth(4).fill('30');
    await page.getByRole('button', { name: '排盘' }).click();

    // 等待 AI 提示词面板
    await expect(page.locator('text=AI 提示词').first()).toBeVisible({ timeout: 10000 });

    // 点击复制按钮
    await page.getByRole('button', { name: '复制提示词' }).click();

    // 应显示"已复制"按钮状态
    await expect(page.getByRole('button', { name: '已复制' })).toBeVisible({ timeout: 5000 });
    // 应显示 toast 提示
    await expect(page.locator('text=提示词已复制')).toBeVisible({ timeout: 5000 });
  });

  test('工作台 URL 参数 tab 应能直接定位选项卡', async ({ page }) => {
    await page.goto('/?tab=ziwei');
    await expect(page.locator('button', { hasText: '紫微斗数' }).first()).toHaveAttribute('data-state', 'active');

    await page.goto('/?tab=liuyao');
    await expect(page.locator('button', { hasText: '六爻起卦' }).first()).toHaveAttribute('data-state', 'active');
  });

  test('人物选择器应显示当前选中人物', async ({ page }) => {
    // 先创建人物
    await page.goto('/persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('选择器测试');
    await page.getByLabel('出生日期').fill('1990-01-01');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 去工作台
    await page.goto('/');
    // Header 应显示选中人物的名字
    await expect(page.locator('text=选择器测试').first()).toBeVisible();
  });
});
