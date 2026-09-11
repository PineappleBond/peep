import { test, expect } from '@playwright/test';

test.describe('文档管理', () => {
  test('应显示文档管理页面', async ({ page }) => {
    await page.goto('/documents');
    await expect(page.locator('h1', { hasText: '笔记' }).first()).toBeVisible();
  });

  test('应显示新建文档按钮', async ({ page }) => {
    await page.goto('/documents');
    await expect(page.getByRole('button', { name: '新建文档' })).toBeVisible();
  });

  test('应显示文档类型标签', async ({ page }) => {
    await page.goto('/documents');
    await expect(page.getByRole('tab', { name: '全部' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '回忆录' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '日记' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '杂记' })).toBeVisible();
  });

  test('点击新建文档应跳转到编辑页', async ({ page }) => {
    await page.goto('/documents');
    await page.getByRole('button', { name: '新建文档' }).click();
    // 应跳转到新建文档页面
    await expect(page).toHaveURL(/\/documents\/new/);
    // 应显示保存按钮（使用 exact 避免匹配"保存后加标签"按钮）
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
    // 应显示标题输入框
    await expect(page.getByPlaceholder('输入标题...')).toBeVisible();
  });

  test('应能创建文档并出现在列表中', async ({ page }) => {
    await page.goto('/documents/new');

    // 填写标题
    await page.getByPlaceholder('输入标题...').fill('E2E测试文档');

    // 保存（使用 exact 避免匹配"保存后加标签"按钮）
    await page.getByRole('button', { name: '保存', exact: true }).click();

    // 应跳转到编辑页面（URL 包含 edit/）
    await expect(page).toHaveURL(/\/documents\/edit\//, { timeout: 5000 });

    // 返回列表查看
    await page.goto('/documents');
    // 应能看到新建的文档
    await expect(page.locator('text=E2E测试文档').first()).toBeVisible({ timeout: 5000 });
  });

  test('文档编辑页应显示类型选择器', async ({ page }) => {
    await page.goto('/documents/new');
    // 类型选择器应显示默认值"杂记"
    await expect(page.locator('text=杂记').first()).toBeVisible();
  });

  test('文档类型标签切换应改变URL', async ({ page }) => {
    await page.goto('/documents');
    // 点击"回忆录"标签
    await page.getByRole('tab', { name: '回忆录' }).click();
    await expect(page).toHaveURL(/\/documents\/recall/);

    // 点击"日记"标签
    await page.getByRole('tab', { name: '日记' }).click();
    await expect(page).toHaveURL(/\/documents\/diary/);

    // 点击"全部"
    await page.getByRole('tab', { name: '全部' }).click();
    await expect(page).toHaveURL(/\/documents\/?$/);
  });

  test('应显示搜索框', async ({ page }) => {
    await page.goto('/documents');
    await expect(page.getByPlaceholder('搜索文档...')).toBeVisible();
  });

  test('编辑页应显示返回按钮', async ({ page }) => {
    await page.goto('/documents/new');
    // 返回按钮（带 ArrowLeft 图标的 button）
    await expect(page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') })).toBeVisible();
  });
});
