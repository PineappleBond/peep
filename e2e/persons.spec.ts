import { test, expect } from '@playwright/test';

test.describe('人物库', () => {
  test('应显示人物库页面', async ({ page }) => {
    await page.goto('persons');
    // 左侧面板的标题
    await expect(page.locator('h1', { hasText: '人物库' })).toBeVisible();
  });

  test('应显示新建人物按钮（空状态）', async ({ page }) => {
    await page.goto('persons');
    // 空状态下会显示"新建人物"按钮
    await expect(page.getByRole('button', { name: '新建人物' }).first()).toBeVisible();
  });

  test('应能点击新建进入编辑模式', async ({ page }) => {
    await page.goto('persons');
    // 点击空状态或工具栏的新建按钮
    await page.getByRole('button', { name: '新建人物' }).first().click();
    // 右侧应显示编辑表单标题
    await expect(page.locator('h2', { hasText: '新建人物' })).toBeVisible();
    // 应显示姓名输入框
    await expect(page.getByLabel('姓名')).toBeVisible();
    // 应显示出生日期输入框
    await expect(page.getByLabel('出生日期')).toBeVisible();
  });

  test('应显示搜索框', async ({ page }) => {
    await page.goto('persons');
    await expect(page.getByPlaceholder('搜索...')).toBeVisible();
  });

  test('应能创建并选中人物', async ({ page }) => {
    await page.goto('persons');

    // 点击新建
    await page.getByRole('button', { name: '新建人物' }).first().click();

    // 填写表单
    await page.getByLabel('姓名').fill('测试人物');
    await page.getByLabel('出生日期').fill('1990-01-15');

    // 保存
    await page.getByRole('button', { name: '保存' }).click();

    // 等待 toast 提示
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 左侧列表应显示新建的人物
    await expect(page.locator('.truncate', { hasText: '测试人物' }).first()).toBeVisible();
  });

  test('应显示设为当前按钮', async ({ page }) => {
    await page.goto('persons');

    // 先创建一个
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('测试人物2');
    await page.getByLabel('出生日期').fill('1990-01-15');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 创建后自动选中，右侧应显示"设为当前"按钮
    await expect(page.getByRole('button', { name: '设为当前' })).toBeVisible();
  });

  test('应显示排盘快捷按钮', async ({ page }) => {
    await page.goto('persons');

    // 先创建一个
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('测试人物3');
    await page.getByLabel('出生日期').fill('1990-01-15');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 创建后自动选中，应显示排盘快捷按钮
    await expect(page.getByRole('button', { name: '八字' })).toBeVisible();
    await expect(page.getByRole('button', { name: '紫微' })).toBeVisible();
    await expect(page.getByRole('button', { name: '六爻' })).toBeVisible();
  });

  test('应支持农历/公历切换', async ({ page }) => {
    await page.goto('persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();

    // 应显示历法选项
    await expect(page.getByLabel('公历')).toBeVisible();
    await expect(page.getByLabel('农历')).toBeVisible();
  });

  test('应能编辑已有人物', async ({ page }) => {
    await page.goto('persons');

    // 先创建一个人物
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('待编辑人物');
    await page.getByLabel('出生日期').fill('1985-03-20');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 点击编辑按钮（带 Pencil 图标的按钮, title="编辑"）
    await page.locator('button[title="编辑"]').click();

    // 应进入编辑模式
    await expect(page.locator('h2', { hasText: '编辑人物' })).toBeVisible();
    // 姓名输入框应包含之前的值
    await expect(page.getByLabel('姓名')).toHaveValue('待编辑人物');

    // 修改姓名
    await page.getByLabel('姓名').fill('已更新人物');
    await page.getByRole('button', { name: '保存' }).click();

    // 保存成功后应退出编辑模式，列表中应显示新名字
    await expect(page.locator('.truncate', { hasText: '已更新人物' }).first()).toBeVisible({ timeout: 5000 });
    // 编辑表单应消失（不再显示"编辑人物"标题）
    await expect(page.locator('h2', { hasText: '编辑人物' })).not.toBeVisible();
  });

  test('应能删除人物（带确认对话框）', async ({ page }) => {
    await page.goto('persons');

    // 先创建一个人物
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('待删除人物');
    await page.getByLabel('出生日期').fill('1995-06-10');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 点击删除按钮（title="删除"）
    await page.locator('button[title="删除"]').click();

    // 应弹出确认对话框
    await expect(page.locator('text=确认删除')).toBeVisible();
    await expect(page.locator('text=待删除人物').last()).toBeVisible();

    // 点击确认删除
    await page.getByRole('button', { name: '删除' }).click();

    // 应显示已删除提示
    await expect(page.locator('text=已移至垃圾篓')).toBeVisible({ timeout: 5000 });
    // 人物不应再出现在列表中
    await expect(page.locator('.truncate', { hasText: '待删除人物' })).not.toBeVisible();
  });

  test('应能取消删除操作', async ({ page }) => {
    await page.goto('persons');

    // 创建人物
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('取消删除测试');
    await page.getByLabel('出生日期').fill('1992-04-05');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 点击删除
    await page.locator('button[title="删除"]').click();
    await expect(page.locator('text=确认删除')).toBeVisible();

    // 点击取消
    await page.getByRole('button', { name: '取消' }).click();

    // 对话框应消失，人物仍在
    await expect(page.locator('.truncate', { hasText: '取消删除测试' }).first()).toBeVisible();
  });

  test('设为当前应跳转到工作台', async ({ page }) => {
    await page.goto('persons');

    // 创建人物
    await page.getByRole('button', { name: '新建人物' }).first().click();
    await page.getByLabel('姓名').fill('工作台测试');
    await page.getByLabel('出生日期').fill('1988-11-20');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('text=已创建')).toBeVisible({ timeout: 5000 });

    // 点击"设为当前"
    await page.getByRole('button', { name: '设为当前' }).click();

    // 应跳转到工作台并带 personId 参数
    await expect(page).toHaveURL(/\?personId=\d+/);
  });

  test('空姓名保存应显示错误提示', async ({ page }) => {
    await page.goto('persons');
    await page.getByRole('button', { name: '新建人物' }).first().click();

    // 不填姓名，直接保存
    await page.getByLabel('出生日期').fill('1990-01-01');
    await page.getByRole('button', { name: '保存' }).click();

    // 应显示错误提示
    await expect(page.locator('text=姓名不能为空')).toBeVisible({ timeout: 5000 });
  });
});
