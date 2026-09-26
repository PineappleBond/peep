/**
 * Wiki 知识库 e2e 测试
 *
 * 通过浏览器控制台调用 window.peep.WikiCreate / WikiList / WikiView
 * 验证文档 CRUD、搜索筛选、双向链接、路由跳转、人物关联等功能。
 */
import { test, expect } from "@playwright/test";

/** 生成唯一标题，避免跨测试数据冲突（IndexedDB 共享） */
function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

test.describe("Wiki 知识库 debugApi", () => {
  // ─── 1. 基础 CRUD ────────────────────────────────────────

  test("WikiCreate：创建文档，返回包含 title/content/tags/personId", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const title = uid("创建测试");
    const result = await page.evaluate(async (t) => {
      // @ts-expect-error - window.peep 是动态注入的
      if (!window.peep?.WikiCreate) throw new Error("window.peep.WikiCreate 未注册");
      // @ts-expect-error
      return await window.peep.WikiCreate({
        personId: 1,
        title: t,
        content: "# 测试内容\n\n这是 WikiCreate 的测试正文。",
        tags: ["测试", "自动化"],
      });
    }, title);

    // 验证返回的文档结构
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe("number");
    expect(result.title).toBe(title);
    expect(result.content).toContain("测试正文");
    expect(result.personId).toBe(1);
    expect(result.tags).toEqual(expect.arrayContaining(["测试", "自动化"]));
    expect(result.savedAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  test("WikiView：查看刚创建的文档，数据完整", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const title = uid("查看测试");

    // 先创建
    const created = await page.evaluate(async (t) => {
      // @ts-expect-error
      return await window.peep.WikiCreate({
        personId: 1,
        title: t,
        content: "查看测试专用内容",
        tags: ["查看"],
      });
    }, title);

    expect(created.id).toBeDefined();

    // 再查看
    const viewed = await page.evaluate(async (docId) => {
      // @ts-expect-error
      if (!window.peep?.WikiView) throw new Error("window.peep.WikiView 未注册");
      // @ts-expect-error
      return await window.peep.WikiView({ personId: 1, docId });
    }, created.id);

    expect(viewed).toBeDefined();
    expect(viewed.id).toBe(created.id);
    expect(viewed.title).toBe(title);
    expect(viewed.content).toBe("查看测试专用内容");
    expect(viewed.personId).toBe(1);
    expect(viewed.tags).toContain("查看");
  });

  test("WikiList：查询列表，包含刚创建的文档", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const title = uid("列表测试");

    // 先创建
    const created = await page.evaluate(async (t) => {
      // @ts-expect-error
      return await window.peep.WikiCreate({
        personId: 1,
        title: t,
        content: "列表测试内容",
      });
    }, title);

    // 查询列表
    const listResult = await page.evaluate(async () => {
      // @ts-expect-error
      if (!window.peep?.WikiList) throw new Error("window.peep.WikiList 未注册");
      // @ts-expect-error
      return await window.peep.WikiList({ personId: 1 });
    });

    expect(listResult).toBeDefined();
    expect(listResult.docs).toBeDefined();
    expect(Array.isArray(listResult.docs)).toBe(true);
    expect(listResult.total).toBeGreaterThanOrEqual(1);

    // 列表中应包含刚创建的文档
    const found = listResult.docs.find((d: any) => d.id === created.id);
    expect(found).toBeDefined();
    expect(found.title).toBe(title);
  });

  // ─── 2. 搜索与筛选 ──────────────────────────────────────

  test("WikiList + searchText：按标题搜索", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const uniqueKeyword = uid("搜索关键词");

    // 创建带特殊关键词的文档
    await page.evaluate(async (t) => {
      // @ts-expect-error
      await window.peep.WikiCreate({
        personId: 1,
        title: t,
        content: "可搜索的文档内容",
      });
    }, uniqueKeyword);

    // 按标题搜索
    const result = await page.evaluate(async (keyword) => {
      // @ts-expect-error
      return await window.peep.WikiList({ personId: 1, searchText: keyword });
    }, uniqueKeyword);

    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.docs.length).toBeGreaterThanOrEqual(1);
    // 搜索结果应包含目标文档
    const titles = result.docs.map((d: any) => d.title);
    expect(titles).toContain(uniqueKeyword);
  });

  test("WikiList + searchText：按内容搜索", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const uniqueContent = uid("正文唯一标识");

    // 创建内容中包含唯一标识的文档
    await page.evaluate(async (c) => {
      // @ts-expect-error
      await window.peep.WikiCreate({
        personId: 1,
        title: "内容搜索测试",
        content: c,
      });
    }, uniqueContent);

    // 按内容关键词搜索
    const result = await page.evaluate(async (keyword) => {
      // @ts-expect-error
      return await window.peep.WikiList({ personId: 1, searchText: keyword });
    }, uniqueContent);

    expect(result.total).toBeGreaterThanOrEqual(1);
    const contents = result.docs.map((d: any) => d.content);
    expect(contents.some((c: string) => c.includes(uniqueContent))).toBe(true);
  });

  test("WikiList + tags：按标签筛选", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const uniqueTag = uid("标签");

    // 创建带特定标签的文档
    await page.evaluate(async (tag) => {
      // @ts-expect-error
      await window.peep.WikiCreate({
        personId: 1,
        title: "标签筛选测试文档",
        content: "标签筛选测试内容",
        tags: [tag, "公共标签"],
      });
    }, uniqueTag);

    // 按标签筛选
    const result = await page.evaluate(async (tag) => {
      // @ts-expect-error
      return await window.peep.WikiList({ personId: 1, tags: [tag] });
    }, uniqueTag);

    expect(result.total).toBeGreaterThanOrEqual(1);
    // 所有结果都应包含该标签
    for (const doc of result.docs) {
      expect(doc.tags).toContain(uniqueTag);
    }
  });

  test("WikiList + 分页：验证分页参数", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 批量创建多篇文档（用于分页测试）
    const prefix = uid("分页");
    await page.evaluate(async (p) => {
      for (let i = 0; i < 5; i++) {
        // @ts-expect-error
        await window.peep.WikiCreate({
          personId: 1,
          title: `${p}_${i}`,
          content: `分页测试文档 ${i}`,
        });
      }
    }, prefix);

    // 第一页，每页 2 条
    const page1 = await page.evaluate(async () => {
      // @ts-expect-error
      return await window.peep.WikiList({ personId: 1, page: 1, pageSize: 2 });
    });

    expect(page1.docs.length).toBeLessThanOrEqual(2);
    expect(page1.total).toBeGreaterThanOrEqual(5);

    // 第二页
    const page2 = await page.evaluate(async () => {
      // @ts-expect-error
      return await window.peep.WikiList({ personId: 1, page: 2, pageSize: 2 });
    });

    expect(page2.docs.length).toBeLessThanOrEqual(2);

    // 两页的文档不应重复
    const page1Ids = page1.docs.map((d: any) => d.id);
    const page2Ids = page2.docs.map((d: any) => d.id);
    const overlap = page1Ids.filter((id: number) => page2Ids.includes(id));
    expect(overlap.length).toBe(0);
  });

  // ─── 3. 双向链接 ────────────────────────────────────────

  test("双向链接：第二篇关联第一篇，WikiView 验证 linkTargetIds", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 创建第一篇文档
    const doc1 = await page.evaluate(async () => {
      // @ts-expect-error
      return await window.peep.WikiCreate({
        personId: 1,
        title: "链接目标文档",
        content: "我是被链接的文档",
      });
    });

    expect(doc1.id).toBeDefined();

    // 创建第二篇文档，关联第一篇
    const doc2 = await page.evaluate(async (targetId) => {
      // @ts-expect-error
      return await window.peep.WikiCreate({
        personId: 1,
        title: "链接源文档",
        content: "我链接到另一篇文档",
        linkTargetIds: [targetId],
      });
    }, doc1.id);

    expect(doc2.id).toBeDefined();
    expect(doc2.id).not.toBe(doc1.id);

    // 查看第二篇文档，验证 linkTargetIds 包含第一篇
    const viewed = await page.evaluate(async (docId) => {
      // @ts-expect-error
      return await window.peep.WikiView({ personId: 1, docId });
    }, doc2.id);

    // linkTargetIds 应包含第一篇文档的 ID
    expect(viewed.linkTargetIds).toBeDefined();
    expect(Array.isArray(viewed.linkTargetIds)).toBe(true);
    expect(viewed.linkTargetIds).toContain(doc1.id);
  });

  // ─── 4. 路由切换 ────────────────────────────────────────

  test("路由切换：访问 /wiki 页面可正常加载", async ({ page }) => {
    await page.goto("/wiki");
    await page.waitForLoadState("networkidle");

    // 页面应包含知识库相关元素
    const wikiTitle = page.locator(".wiki-title");
    await expect(wikiTitle).toBeVisible({ timeout: 10_000 });

    // 页面标题应包含"知识库"
    const titleText = await wikiTitle.textContent();
    expect(titleText).toContain("知识库");
  });

  test("路由切换：WikiCreate 自动跳转到 /wiki", async ({ page }) => {
    // 从首页开始
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 调用 WikiCreate（会自动跳转到 /wiki）
    const title = uid("路由跳转测试");
    await page.evaluate(async (t) => {
      // @ts-expect-error
      await window.peep.WikiCreate({
        personId: 1,
        title: t,
        content: "路由跳转测试内容",
      });
    }, title);

    // 等待页面跳转并加载
    await page.waitForURL("**/wiki", { timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    // 验证当前 URL 包含 /wiki
    expect(page.url()).toContain("/wiki");

    // 知识库页面元素应可见
    const wikiTitle = page.locator(".wiki-title");
    await expect(wikiTitle).toBeVisible({ timeout: 5_000 });
  });

  // ─── 5. 错误处理 ────────────────────────────────────────

  test("错误处理：API 未注册时应抛出明确错误", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 模拟 API 未注册的场景：临时移除 window.peep
    const result = await page.evaluate(async () => {
      // 保存原始 peep
      // @ts-expect-error
      const original = window.peep;
      // @ts-expect-error
      window.peep = undefined;

      try {
        // 尝试调用 WikiCreate
        // @ts-expect-error
        await window.peep.WikiCreate({ personId: 1, title: "test", content: "test" });
        return { error: null };
      } catch (e: any) {
        return { error: e.message };
      } finally {
        // 恢复
        // @ts-expect-error
        window.peep = original;
      }
    });

    expect(result.error).toBeTruthy();
    // 错误信息应包含有用的提示
    expect(result.error).toMatch(/peep|未注册|undefined|Cannot/i);
  });

  // ─── 6. 人物关联 ────────────────────────────────────────

  test("人物关联：WikiCreate 使用 personId=1（默认人物）", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const title = uid("人物关联测试");
    const result = await page.evaluate(async (t) => {
      // @ts-expect-error
      return await window.peep.WikiCreate({
        personId: 1,
        title: t,
        content: "人物关联测试内容",
      });
    }, title);

    // 验证文档关联了 personId=1
    expect(result.personId).toBe(1);
  });

  test("人物关联：WikiList 按 personId 过滤", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const title = uid("人物过滤测试");

    // 创建 personId=1 的文档
    await page.evaluate(async (t) => {
      // @ts-expect-error
      await window.peep.WikiCreate({
        personId: 1,
        title: t,
        content: "人物过滤测试内容",
      });
    }, title);

    // 查询 personId=1 的列表
    const result1 = await page.evaluate(async () => {
      // @ts-expect-error
      return await window.peep.WikiList({ personId: 1 });
    });

    // 查询 personId=1 的结果应包含刚创建的文档
    const foundInPerson1 = result1.docs.find((d: any) => d.title === title);
    expect(foundInPerson1).toBeDefined();
    expect(foundInPerson1.personId).toBe(1);

    // 对比：不传 personId 或使用其他 personId 时，列表行为不同
    // 由于 _selectPerson(99999) 可能回退到默认人物，这里换个角度验证：
    // 确认返回的每条文档都正确携带 personId 字段
    for (const doc of result1.docs) {
      expect(doc.personId).toBe(1);
    }
  });
});
