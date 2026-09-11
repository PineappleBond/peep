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
  test('create → get → list → edit → replace → delete', async ({ page }) => {
    await page.goto('/');

    // create
    const docId = await evalPeep<string>(page, `
      window.peep.document.create({
        type: "notes",
        title: "API测试文档",
        content: "第一行\\n第二行\\n第三行\\n第四行\\n第五行",
        tags: ["测试", "API"]
      })
    `);
    expect(docId).toBeDefined();

    // get
    const doc = await evalPeep<any>(page, `window.peep.document.get("${docId}")`);
    expect(doc.title).toBe('API测试文档');
    expect(doc.content).toContain('第一行');

    // list
    const list = await evalPeep<any[]>(page, `window.peep.document.list({ type: "notes" })`);
    expect(list.some((d: any) => d.id === docId)).toBe(true);

    // edit: 替换第2-3行
    await evalPeep<void>(page, `window.peep.document.edit("${docId}", 2, 3, "替换后的内容")`);
    const edited = await evalPeep<any>(page, `window.peep.document.get("${docId}")`);
    expect(edited.content).toContain('替换后的内容');
    expect(edited.content).not.toContain('第二行');
    expect(edited.content).toContain('第一行'); // 未修改的行保留

    // replace: 替换关键字
    const replaceResult = await evalPeep<{ count: number }>(page, `
      window.peep.document.replace("${docId}", "替换后的内容", "新的内容")
    `);
    expect(replaceResult.count).toBeGreaterThan(0);
    const replaced = await evalPeep<any>(page, `window.peep.document.get("${docId}")`);
    expect(replaced.content).toContain('新的内容');

    // delete
    await evalPeep<void>(page, `window.peep.document.delete("${docId}")`);
    const deleted = await evalPeep<any>(page, `window.peep.document.get("${docId}")`);
    expect(deleted).toBeUndefined();
  });
});

test.describe('peep.folder', () => {
  test('create → list → tree → delete', async ({ page }) => {
    await page.goto('/');

    // create root folder
    const rootId = await evalPeep<string>(page, `window.peep.folder.create("根文件夹")`);
    expect(rootId).toBeDefined();

    // create child folder
    const childId = await evalPeep<string>(page, `window.peep.folder.create("子文件夹", "${rootId}")`);
    expect(childId).toBeDefined();

    // list
    const list = await evalPeep<any[]>(page, 'window.peep.folder.list()');
    expect(list.length).toBeGreaterThanOrEqual(2);

    // tree
    const tree = await evalPeep<any[]>(page, 'window.peep.folder.tree()');
    expect(tree.length).toBeGreaterThan(0);
    const root = tree.find((n: any) => n.id === rootId);
    expect(root).toBeDefined();
    expect(root.children.some((c: any) => c.id === childId)).toBe(true);

    // cleanup
    await evalPeep<void>(page, `window.peep.folder.delete("${childId}")`);
    await evalPeep<void>(page, `window.peep.folder.delete("${rootId}")`);
  });
});

test.describe('peep.tag', () => {
  test('add → list → remove', async ({ page }) => {
    await page.goto('/');

    // create a document first
    const docId = await evalPeep<string>(page, `
      window.peep.document.create({
        type: "notes",
        title: "标签测试文档",
        content: "测试内容",
        tags: []
      })
    `);

    // add tag
    await evalPeep<void>(page, `window.peep.tag.add("${docId}", "新标签")`);
    const doc = await evalPeep<any>(page, `window.peep.document.get("${docId}")`);
    expect(doc.tags).toContain('新标签');

    // list tags
    const tags = await evalPeep<any[]>(page, 'window.peep.tag.list()');
    expect(tags.some((t: any) => t.name === '新标签')).toBe(true);

    // remove tag
    await evalPeep<void>(page, `window.peep.tag.remove("${docId}", "新标签")`);
    const updated = await evalPeep<any>(page, `window.peep.document.get("${docId}")`);
    expect(updated.tags).not.toContain('新标签');

    // cleanup
    await evalPeep<void>(page, `window.peep.document.delete("${docId}")`);
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

    // 排盘（scope 必传）
    const result = await evalPeep<any>(page, `
      window.peep.bazi.chart(${person.id}, {
        startLevel: "dayun",
        endLevel: "dayun",
        startValue: "0-9",
        endValue: "0-9"
      })
    `);

    // 验证返回结构：{ 图表, 运势路径 }
    expect(result.图表).toBeDefined();
    const cd = result.图表;

    // 日主
    expect(cd.dayMaster).toBeDefined();
    expect(typeof cd.dayMaster).toBe("string");

    // 五行缺失
    expect(cd.wuXingLack).toBeDefined();

    // columns: 四柱（年柱, 月柱, 日柱, 时柱），可能还有大运、流年
    expect(cd.columns).toBeDefined();
    expect(Array.isArray(cd.columns)).toBe(true);
    expect(cd.columns.length).toBeGreaterThanOrEqual(4);

    // 找到年柱（天干地支都有的是四柱）
    const yearPillar = cd.columns.find((c: any) => c.label === "年柱") || cd.columns[cd.columns.length - 4];
    expect(yearPillar).toBeDefined();
    expect(yearPillar.tianGan).toBeDefined();
    expect(yearPillar.diZhi).toBeDefined();

    // 清理
    await evalPeep<void>(page, `window.peep.person.delete(${person.id})`);
  });

  test('chart() scope: dayun -> dayun', async ({ page }) => {
    await page.goto('/');

    const person = await evalPeep<any>(page, `
      window.peep.person.create({
        name: "大运测试",
        gender: "female",
        birthDate: "1985-06-20",
        birthTime: "08:30"
      })
    `);

    const result = await evalPeep<any>(page, `
      window.peep.bazi.chart(${person.id}, {
        startLevel: "dayun",
        endLevel: "dayun",
        startValue: "20-29",
        endValue: "20-29"
      })
    `);

    expect(result.运势路径).toBeDefined();
    expect(Array.isArray(result.运势路径)).toBe(true);

    await evalPeep<void>(page, `window.peep.person.delete(${person.id})`);
  });

  test('chart() scope: dayun -> liunian', async ({ page }) => {
    await page.goto('/');

    const person = await evalPeep<any>(page, `
      window.peep.person.create({
        name: "流年测试",
        gender: "male",
        birthDate: "1990-03-15",
        birthTime: "14:00"
      })
    `);

    const result = await evalPeep<any>(page, `
      window.peep.bazi.chart(${person.id}, {
        startLevel: "dayun",
        endLevel: "liunian",
        startValue: "30-39",
        endValue: "2024"
      })
    `);

    expect(result.运势路径).toBeDefined();
    expect(Array.isArray(result.运势路径)).toBe(true);
    // 大运到流年应该有多条路径信息
    expect(result.运势路径.length).toBeGreaterThan(0);

    await evalPeep<void>(page, `window.peep.person.delete(${person.id})`);
  });

  test('chart() scope: liunian -> liuyue', async ({ page }) => {
    await page.goto('/');

    const person = await evalPeep<any>(page, `
      window.peep.person.create({
        name: "流月测试",
        gender: "male",
        birthDate: "1988-08-08",
        birthTime: "08:00"
      })
    `);

    const result = await evalPeep<any>(page, `
      window.peep.bazi.chart(${person.id}, {
        startLevel: "liunian",
        endLevel: "liuyue",
        startValue: "2024",
        endValue: "6"
      })
    `);

    expect(result.运势路径).toBeDefined();
    expect(Array.isArray(result.运势路径)).toBe(true);

    await evalPeep<void>(page, `window.peep.person.delete(${person.id})`);
  });

  test('chart() scope: liuyue -> liuri', async ({ page }) => {
    await page.goto('/');

    const person = await evalPeep<any>(page, `
      window.peep.person.create({
        name: "流日测试",
        gender: "female",
        birthDate: "1995-12-25",
        birthTime: "12:00"
      })
    `);

    const result = await evalPeep<any>(page, `
      window.peep.bazi.chart(${person.id}, {
        startLevel: "liuyue",
        endLevel: "liuri",
        startValue: "1",
        endValue: "15"
      })
    `);

    expect(result.运势路径).toBeDefined();
    expect(Array.isArray(result.运势路径)).toBe(true);

    await evalPeep<void>(page, `window.peep.person.delete(${person.id})`);
  });

  test('chart() scope: liuri -> liushi', async ({ page }) => {
    await page.goto('/');

    const person = await evalPeep<any>(page, `
      window.peep.person.create({
        name: "流时测试",
        gender: "male",
        birthDate: "2000-01-01",
        birthTime: "06:00"
      })
    `);

    const result = await evalPeep<any>(page, `
      window.peep.bazi.chart(${person.id}, {
        startLevel: "liuri",
        endLevel: "liushi",
        startValue: "1",
        endValue: "6"
      })
    `);

    expect(result.运势路径).toBeDefined();
    expect(Array.isArray(result.运势路径)).toBe(true);

    await evalPeep<void>(page, `window.peep.person.delete(${person.id})`);
  });

  test('chart() scope 使用 ganzhi 参数', async ({ page }) => {
    await page.goto('/');

    const person = await evalPeep<any>(page, `
      window.peep.person.create({
        name: "干支测试",
        gender: "male",
        birthDate: "1992-05-20",
        birthTime: "10:30"
      })
    `);

    // 使用干支而非数值
    const result = await evalPeep<any>(page, `
      window.peep.bazi.chart(${person.id}, {
        startLevel: "dayun",
        endLevel: "liunian",
        startValue: "",
        endValue: "",
        ganzhi: "甲子"
      })
    `);

    expect(result.运势路径).toBeDefined();

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

    // scope 必传
    const result = await evalPeep<any>(page, `
      window.peep.ziwei.chart(${person.id}, {
        startLevel: "dayun",
        endLevel: "dayun",
        startValue: "20-29",
        endValue: "20-29"
      })
    `);

    // 返回结构：{ 星盘: Astrolabe }
    expect(result.星盘).toBeDefined();

    await evalPeep<void>(page, `window.peep.person.delete(${person.id})`);
  });

  test('chart() scope: liunian -> liuyue', async ({ page }) => {
    await page.goto('/');

    const person = await evalPeep<any>(page, `
      window.peep.person.create({
        name: "紫微流月测试",
        gender: "female",
        birthDate: "1988-11-15",
        birthTime: "09:30"
      })
    `);

    const result = await evalPeep<any>(page, `
      window.peep.ziwei.chart(${person.id}, {
        startLevel: "liunian",
        endLevel: "liuyue",
        startValue: "2024",
        endValue: "6"
      })
    `);

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
    expect(lines.every((v: number) => [0, 1, 2, 3].includes(v))).toBe(true);

    // create
    const recordId = await evalPeep<string>(page, `
      window.peep.liuyao.create({
        lines: [1, 1, 1, 0, 0, 0],
        question: "API测试问题",
        background: "测试背景"
      })
    `);
    expect(recordId).toBeDefined();

    // get（含 chartJSON）
    const record = await evalPeep<any>(page, `window.peep.liuyao.get("${recordId}")`);
    expect(record.question).toBe('API测试问题');
    expect(record.chartJSON).toBeDefined();

    // list
    const list = await evalPeep<any[]>(page, 'window.peep.liuyao.list()');
    expect(list.some((r: any) => r.id === recordId)).toBe(true);

    // update
    await evalPeep<void>(page, `window.peep.liuyao.update("${recordId}", { question: "已更新问题" })`);
    const updated = await evalPeep<any>(page, `window.peep.liuyao.get("${recordId}")`);
    expect(updated.question).toBe('已更新问题');

    // delete
    await evalPeep<void>(page, `window.peep.liuyao.delete("${recordId}")`);
    const deleted = await evalPeep<any>(page, `window.peep.liuyao.get("${recordId}")`);
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
    // ChartJSON 结构: name, palace, palaceElem, type, shi, ying, lines, changed, month, day
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
    expect(lunar.lunarYear).toBeDefined();
    expect(lunar.lunarMonth).toBeDefined();
    expect(lunar.lunarDay).toBeDefined();

    // dayGanZhi
    const ganZhi = await evalPeep<string>(page, `window.peep.lunar.dayGanZhi("2024-01-15")`);
    expect(ganZhi).toBeDefined();
    expect(ganZhi.length).toBe(2); // 天干 + 地支

    // 常量
    const timeOptions = await evalPeep<any[]>(page, 'window.peep.lunar.timeOptions');
    expect(timeOptions.length).toBe(13); // 早子到晚子
  });

  test('peep.calendar 应提供历法计算', async ({ page }) => {
    await page.goto('/');

    const keys = await evalPeep<string[]>(page, 'Object.keys(window.peep.calendar)');
    expect(keys).toContain('TIAN_GAN');
    expect(keys).toContain('DI_ZHI');
    expect(keys).toContain('calculateDaYun');
    expect(keys).toContain('calculateLiuNian');

    const tianGan = await evalPeep<string[]>(page, 'window.peep.calendar.TIAN_GAN');
    expect(tianGan).toEqual(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);
  });

  test('peep.utils 应提供通用工具', async ({ page }) => {
    await page.goto('/');

    // 地支关系
    const chong = await evalPeep<string>(page, `window.peep.utils.branchChong["子"]`);
    expect(chong).toBe('午');

    const liuhe = await evalPeep<string>(page, `window.peep.utils.branchLiuHe["子"]`);
    expect(liuhe).toBe('丑');

    // 常量
    const stems = await evalPeep<string[]>(page, 'window.peep.utils.STEMS');
    expect(stems).toContain('甲');

    const branches = await evalPeep<string[]>(page, 'window.peep.utils.BRANCHES');
    expect(branches).toContain('子');
  });

  test('peep.analysis 应提供紫微分析工具', async ({ page }) => {
    await page.goto('/');

    const keys = await evalPeep<string[]>(page, 'Object.keys(window.peep.analysis)');
    expect(keys).toContain('detectPatterns');
    expect(keys).toContain('getSanfangSnapshots');
    expect(keys).toContain('getBorrowedStars');
    expect(keys).toContain('buildChartIndex');
    expect(keys).toContain('analyzeChart');
  });
});
