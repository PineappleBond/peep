/**
 * 紫微斗数排盘 e2e 测试
 *
 * 通过浏览器控制台调用 window.peep.ZiWei() 验证排盘、运限拨盘、
 * 数据完整性等功能。
 */
import { test, expect } from "@playwright/test";

test.describe("紫微斗数排盘 debugApi.ZiWei", () => {
  test("基本排盘：切换人物后返回完整的盘面数据", async ({ page }) => {
    await page.goto("/peep/");
    await page.waitForLoadState("networkidle");

    // 先确认调试 API 已注册
    const result = await page.evaluate(async () => {
      // @ts-expect-error
      if (!window.peep?.ZiWei) {
        throw new Error("window.peep.ZiWei 未注册");
      }
      // @ts-expect-error - 查询默认人物
      return await window.peep.ZiWei(1);
    });

    // 应返回 person / hbar / chart 三个字段
    expect(result).toBeDefined();
    expect(result).toHaveProperty("person");
    expect(result).toHaveProperty("hbar");
    expect(result).toHaveProperty("chart");

    // 人物数据完整
    if (result.person) {
      expect(result.person.id).toBe(1);
      expect(result.person.name).toBeTruthy();
    }

    // hbar（运限拨盘）非空时含完整结构
    if (result.hbar) {
      expect(result.hbar.decades).toBeDefined();
      expect(result.hbar.years).toBeDefined();
      expect(result.hbar.months).toBeDefined();
      expect(result.hbar.days).toBeDefined();
      expect(result.hbar.hours).toBeDefined();
      expect(result.hbar.visible).toBeDefined();
    }
  });

  test("运限级别切换：传入 scope 参数，返回对应运限数据", async ({ page }) => {
    await page.goto("/peep/");
    await page.waitForLoadState("networkidle");

    const scopes = ["decadal", "yearly", "monthly", "daily", "hourly"] as const;
    for (const scope of scopes) {
      const result = await page.evaluate(async (s) => {
        // @ts-expect-error
        return await window.peep.ZiWei(1, s);
      }, scope);

      expect(result).toBeDefined();
      // chart 在有 scope 时应返回数据
      if (result.chart) {
        expect(result.chart.scope).toBe(scope);
        expect(result.chart.palaces).toBeDefined();
      }
    }
  });

  test("时间参数：传入 Date 时间应正确切换运限", async ({ page }) => {
    await page.goto("/peep/");
    await page.waitForLoadState("networkidle");

    const result = await page.evaluate(async () => {
      // @ts-expect-error
      return await window.peep.ZiWei(1, "yearly", "2030-06-15");
    });

    expect(result).toBeDefined();
    // 应不抛错
    expect(result.hbar).toBeDefined();
  });

  test("错误处理：无效 personId 应抛出错误", async ({ page }) => {
    await page.goto("/peep/");
    await page.waitForLoadState("networkidle");

    // personId = 0 应报错
    const result1 = await page.evaluate(async () => {
      try {
        // @ts-expect-error
        await window.peep.ZiWei(0);
        return { error: null };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    expect(result1.error).toBeTruthy();

    // personId 负数
    const result2 = await page.evaluate(async () => {
      try {
        // @ts-expect-error
        await window.peep.ZiWei(-1);
        return { error: null };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    expect(result2.error).toBeTruthy();

    // personId NaN
    const result3 = await page.evaluate(async () => {
      try {
        // @ts-expect-error
        await window.peep.ZiWei(NaN);
        return { error: null };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    expect(result3.error).toBeTruthy();
  });

  test("错误处理：无效 scope 应抛出错误", async ({ page }) => {
    await page.goto("/peep/");
    await page.waitForLoadState("networkidle");

    const result = await page.evaluate(async () => {
      try {
        // @ts-expect-error
        await window.peep.ZiWei(1, "invalid_scope");
        return { error: null };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/scope/);
  });

  test("页面跳转：ZiWei 调用后自动跳转到首页", async ({ page }) => {
    // 从 /wiki 页面开始
    await page.goto("/peep/wiki");
    await page.waitForLoadState("networkidle");

    // 调用 ZiWei（应自动跳转到 /）
    await page.evaluate(async () => {
      // @ts-expect-error
      await window.peep.ZiWei(1);
    });

    // 应跳转回首页
    await page.waitForURL("**/", { timeout: 10_000 });
    expect(page.url()).toMatch(/\/$/);
  });
});
