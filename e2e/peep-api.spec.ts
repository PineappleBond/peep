import { test, expect, type Page } from '@playwright/test';

/**
 * window.peep API 自动化测试
 *
 * 覆盖：person / document / folder / tag / bazi / ziwei / liuyao / 工具代理
 */

/** 辅助：在页面上下文中执行 peep API 调用 */
async function evalPeep<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate(fn) as Promise<T>;
}

test.describe('window.peep API 基础', () => {
  test('window.peep 应存在且包含所有分组', async ({ page }) => {
    await page.goto('/');
    const keys = await evalPeep<string[]>(page, 'Object.keys(window.peep)');
    expect(keys).toEqual(
      expect.arrayContaining(['person', 'document', 'folder', 'tag', 'bazi', 'ziwei', 'liuyao', 'iztro', 'lunar', 'calendar', 'analysis', 'utils'])
    );
  });
});

test.describe('peep.person', () => {
  test('create → get → list → update → delete', async ({ page }) => {
    await page.goto('/');

    // create
    const person = await evalPeep<any>(page, `
      window.peep.person.create({
        name: "API测试人物",
        gender: "male",
        birthDate: "1990-05-15",
        birthTime: "14:30",
        isLunar: false,
        note: "通过 API 创建"
      })
    `);
    expect(person).toBeDefined();
    expect(person.id).toBeDefined();
    expect(person.name).toBe('API测试人物');
    const personId = person.id;

    // get
    const fetched = await evalPeep<any>(page, `window.peep.person.get(${personId})`);
    expect(fetched).toBeDefined();
    expect(fetched.name).toBe('API测试人物');
    expect(fetched.birthDate).toBe('1990-05-15');

    // list
    const list = await evalPeep<any[]>(page, 'window.peep.person.list()');
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((p: any) => p.id === personId)).toBe(true);

    // list with search
    const searched = await evalPeep<any[]>(page, `window.peep.person.list({ search: "API测试" })`);
    expect(searched.some((p: any) => p.id === personId)).toBe(true);

    // update
    await evalPeep<void>(page, `window.peep.person.update(${personId}, { name: "已更新人物" })`);
    const updated = await evalPeep<any>(page, `window.peep.person.get(${personId})`);
    expect(updated.name).toBe('已更新人物');

    // delete
    await evalPeep<void>(page, `window.peep.person.delete(${personId})`);
    const deleted = await evalPeep<any>(page, `window.peep.person.get(${personId})`);
    expect(deleted).toBeUndefined();
  });
});

test.describe('peep.document', () => {
  test('notes: create → get → list → edit → replace → delete', async ({ page }) => {
    await page.goto('/');

    // create (使用 document.notes.create, 返回 number id)
    const docId = await evalPeep<number>(page, `
      window.peep.document.notes.create({
        title: "API测试文档",
        content: "第一行\\n第二行\\n第三行\\n第四行\\n第五行",
        tags: ["测试", "API"]
      })
    `);
    expect(docId).toBeDefined();
    expect(typeof docId).toBe('number');

    // get (跨类型通用方法, 参数为 number)
    const doc = await evalPeep<any>(page, `window.peep.document.get(${docId})`);
    expect(doc.title).toBe('API测试文档');
    expect(doc.content).toContain('第一行');

    // list (使用 document.notes.list)
    const list = await evalPeep<any[]>(page, `window.peep.document.notes.list({})`);
    expect(list.some((d: any) => d.id === docId)).toBe(true);

    // edit: 替换第2-3行 (参数为 number id)
    await evalPeep<void>(page, `window.peep.document.edit(${docId}, 2, 3, "替换后的内容")`);
    const edited = await evalPeep<any>(page, `window.peep.document.get(${docId})`);
    expect(edited.content).toContain('替换后的内容');
    expect(edited.content).not.toContain('第二行');
    expect(edited.content).toContain('第一行'); // 未修改的行保留

    // replace: 替换关键字 (参数为 number id)
    const replaceResult = await evalPeep<{ count: number }>(page, `
      window.peep.document.replace(${docId}, "替换后的内容", "新的内容")
    `);
    expect(replaceResult.count).toBeGreaterThan(0);
    const replaced = await evalPeep<any>(page, `window.peep.document.get(${docId})`);
    expect(replaced.content).toContain('新的内容');

    // delete (参数为 number id)
    await evalPeep<void>(page, `window.peep.document.delete(${docId})`);
    const deleted = await evalPeep<any>(page, `window.peep.document.get(${docId})`);
    expect(deleted).toBeUndefined();
  });
});

test.describe('peep.folder', () => {
  test('create → list → tree → delete', async ({ page }) => {
    await page.goto('/');

    // create root folder (返回 { id: number, title, parentId, ... })
    const root = await evalPeep<any>(page, `window.peep.folder.create("根文件夹")`);
    expect(root).toBeDefined();
    expect(typeof root.id).toBe('number');
    const rootId = root.id;

    // create child folder (parentId 为 number)
    const child = await evalPeep<any>(page, `window.peep.folder.create("子文件夹", ${rootId})`);
    expect(child).toBeDefined();
    const childId = child.id;

    // list
    const list = await evalPeep<any[]>(page, 'window.peep.folder.list()');
    expect(list.length).toBeGreaterThanOrEqual(2);

    // tree
    const tree = await evalPeep<any[]>(page, 'window.peep.folder.tree()');
    expect(tree.length).toBeGreaterThan(0);
    const treeNode = tree.find((n: any) => n.id === rootId);
    expect(treeNode).toBeDefined();
    expect(treeNode.children.some((c: any) => c.id === childId)).toBe(true);

    // cleanup (参数为 number id)
    await evalPeep<void>(page, `window.peep.folder.delete(${childId})`);
    await evalPeep<void>(page, `window.peep.folder.delete(${rootId})`);
  });
});

test.describe('peep.tag', () => {
  test('add → list → remove', async ({ page }) => {
    await page.goto('/');

    // create a document first (返回 number id)
    const docId = await evalPeep<number>(page, `
      window.peep.document.notes.create({
        title: "标签测试文档",
        content: "测试内容",
        tags: []
      })
    `);

    // add tag (docId 为 number)
    await evalPeep<void>(page, `window.peep.tag.add(${docId}, "新标签")`);
    const doc = await evalPeep<any>(page, `window.peep.document.get(${docId})`);
    expect(doc.tags).toContain('新标签');

    // list tags
    const tags = await evalPeep<any[]>(page, 'window.peep.tag.list()');
    expect(tags.some((t: any) => t.name === '新标签')).toBe(true);

    // remove tag (docId 为 number)
    await evalPeep<void>(page, `window.peep.tag.remove(${docId}, "新标签")`);
    const updated = await evalPeep<any>(page, `window.peep.document.get(${docId})`);
    expect(updated.tags).not.toContain('新标签');

    // cleanup
    await evalPeep<void>(page, `window.peep.document.delete(${docId})`);
  });
});

test.describe('peep.bazi', () => {
  test('chart() 应返回完整八字数据', async ({ page }) => {
    await page.goto('/');

    // 先创建测试人物
    const person = await evalPeep<any>(page, `
      window.peep.person.create({
        name: "八字测试",
        gender: "male",
        birthDate: "1990-01-15",
        birthTime: "10:00"
      })
    `);

    // 排盘（scope: { level, datetime }）
    const result = await evalPeep<any>(page, `
      window.peep.bazi.chart(${person.id}, {
        level: "dayun",
        datetime: "2026-01-01H00"
      })
    `);

    // 验证返回结构：{ 图表, 运势路径 }
    expect(result.图表).toBeDefined();
    const cd = result.图表;

    // 日主
    expect(cd.dayMaster).toBeDefined();

    // columns
    expect(cd.columns).toBeDefined();
    expect(Array.isArray(cd.columns)).toBe(true);
    expect(cd.columns.length).toBeGreaterThanOrEqual(4);

    // 清理
    await evalPeep<void>(page, `window.peep.person.delete(${person.id})`);
  });
});

test.describe('peep.ziwei', () => {
  test('chart() 应返回完整紫微数据', async ({ page }) => {
    await page.goto('/');

    const person = await evalPeep<any>(page, `
      window.peep.person.create({
        name: "紫微测试",
        gender: "male",
        birthDate: "1992-03-08",
        birthTime: "16:00"
      })
    `);

    // scope: { level, datetime }
    const result = await evalPeep<any>(page, `
      window.peep.ziwei.chart(${person.id}, {
        level: "dayun",
        datetime: "2026-01-01H00"
      })
    `);

    // 返回结构：{ 星盘: Astrolabe }
    expect(result.星盘).toBeDefined();

    await evalPeep<void>(page, `window.peep.person.delete(${person.id})`);
  });
});

test.describe('peep.liuyao', () => {
  test('tossHexagram → create → get → list → delete', async ({ page }) => {
    await page.goto('/');

    // 随机起卦
    const lines = await evalPeep<number[]>(page, 'window.peep.liuyao.tossHexagram()');
    expect(lines).toHaveLength(6);

    // create (返回 number id)
    const recordId = await evalPeep<number>(page, `
      window.peep.liuyao.create({
        lines: [1, 1, 1, 0, 0, 0],
        question: "API测试问题",
        background: "测试背景"
      })
    `);
    expect(recordId).toBeDefined();
    expect(typeof recordId).toBe('number');

    // get（返回六爻结果 chart, 不是 raw record）
    const chart = await evalPeep<any>(page, `window.peep.liuyao.get(${recordId})`);
    expect(chart).toBeDefined();

    // list (返回 raw records)
    const list = await evalPeep<any[]>(page, 'window.peep.liuyao.list()');
    expect(list.some((r: any) => r.id === recordId)).toBe(true);

    // update (参数为 number id)
    await evalPeep<void>(page, `window.peep.liuyao.update(${recordId}, { question: "已更新问题" })`);

    // delete (参数为 number id)
    await evalPeep<void>(page, `window.peep.liuyao.delete(${recordId})`);
    const deleted = await evalPeep<any>(page, `window.peep.liuyao.get(${recordId})`);
    expect(deleted).toBeUndefined();
  });

  test('buildChart 应返回完整卦象', async ({ page }) => {
    await page.goto('/');

    const chart = await evalPeep<any>(page, `
      window.peep.liuyao.buildChart({
        lines: [1, 1, 1, 0, 0, 0],
        date: "2024-01-15"
      })
    `);

    expect(chart).toBeDefined();
    expect(chart.name).toBeDefined();
    expect(chart.palace).toBeDefined();
    expect(chart.lines).toBeDefined();
    expect(chart.changed).toBeDefined();
  });

  test('scenarios 应返回场景列表', async ({ page }) => {
    await page.goto('/');

    const scenarios = await evalPeep<any[]>(page, 'window.peep.liuyao.scenarios()');
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios[0].id).toBeDefined();
    expect(scenarios[0].title).toBeDefined();
  });
});

test.describe('工具代理', () => {
  test('peep.iztro 应暴露核心 namespace', async ({ page }) => {
    await page.goto('/');

    const keys = await evalPeep<string[]>(page, 'Object.keys(window.peep.iztro)');
    expect(keys).toContain('astro');
    expect(keys).toContain('util');
    expect(keys).toContain('star');

    // astro.bySolar 应可用
    const hasBySolar = await evalPeep<boolean>(page, 'typeof window.peep.iztro.astro.bySolar === "function"');
    expect(hasBySolar).toBe(true);
  });

  test('peep.lunar 应提供农历工具', async ({ page }) => {
    await page.goto('/');

    // solar2lunar
    const lunar = await evalPeep<any>(page, `window.peep.lunar.solar2lunar(new Date("2024-02-10"))`);
    expect(lunar).toBeDefined();
  });
});
