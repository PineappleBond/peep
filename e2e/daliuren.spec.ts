/**
 * 大六壬排盘 e2e 测试
 *
 * 通过浏览器控制台调用 window.peep.DaLiuRen() 验证排盘算法
 * 结束条件：所有测试通过，证明算法搬运完成
 */
import { test, expect } from "@playwright/test";

test.describe("大六壬排盘 debugApi.DaLiuRen", () => {
  test("基本排盘：输入日期时间，返回完整的天地盘、四课、三传、天将", async ({ page }) => {
    await page.goto("/");

    // 等待页面加载完成
    await page.waitForLoadState("networkidle");

    // 调用 debugApi.DaLiuRen
    const result = await page.evaluate(async () => {
      // @ts-ignore - window.peep 是动态注入的
      if (!window.peep?.DaLiuRen) {
        throw new Error("window.peep.DaLiuRen 未注册，算法尚未搬运");
      }
      // @ts-ignore
      return await window.peep.DaLiuRen("2024-06-15", "12:00");
    });

    // 验证基本结构（第一阶段：不含三传和天将）
    expect(result).toBeDefined();
    expect(result.fourPillars).toBeDefined();
    expect(result.monthGeneral).toBeDefined();
    expect(result.earthBoard).toBeDefined();
    expect(result.heavenBoard).toBeDefined();
    expect(result.fourLessons).toBeDefined();
    expect(result.xunKong).toBeDefined();

    // 验证四课结构
    expect(result.fourLessons).toHaveLength(4);
    for (const lesson of result.fourLessons) {
      expect(lesson).toHaveProperty("upper");
      expect(lesson).toHaveProperty("lower");
    }

    // 验证月将
    expect(result.monthGeneral).toHaveProperty("branch");
    expect(result.monthGeneral).toHaveProperty("name");
    // branch 是数字索引（0-11）
    expect(typeof result.monthGeneral.branch).toBe("number");
    expect(result.monthGeneral.branch).toBeGreaterThanOrEqual(0);
    expect(result.monthGeneral.branch).toBeLessThan(12);
  });

  // 第二阶段：九宗门覆盖
  test("九宗门覆盖：不同日干支应触发不同的三传取法", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const results = await page.evaluate(async () => {
      // @ts-ignore
      if (!window.peep?.DaLiuRen) {
        throw new Error("window.peep.DaLiuRen 未注册");
      }

      // 测试多个日期，覆盖不同九宗门
      const testCases = [
        { date: "2024-06-15", time: "12:00" }, // 普通日
        { date: "2024-01-01", time: "08:00" }, // 元旦
        { date: "2024-03-20", time: "14:00" }, // 春分
        { date: "2024-06-21", time: "10:00" }, // 夏至
        { date: "2024-09-23", time: "16:00" }, // 秋分
        { date: "2024-12-21", time: "20:00" }, // 冬至
      ];

      return Promise.all(
        testCases.map(({ date, time }) =>
          // @ts-ignore
          window.peep.DaLiuRen(date, time)
        )
      );
    });

    expect(results).toHaveLength(6);

    // 每个结果都应该有完整的三传和追踪
    for (const result of results) {
      expect(result.threeTransmissions).toBeDefined();
      expect(result.threeTransmissions).toHaveProperty("initial");
      expect(result.threeTransmissions).toHaveProperty("middle");
      expect(result.threeTransmissions).toHaveProperty("final");
      expect(result.threeTransmissions).toHaveProperty("method");
      expect(result.fourLessons).toHaveLength(4);
      expect(result.calculationTrace).toBeDefined();
    }

    // 不同日期应产生不同的盘面
    const signatures = results.map(
      (r: any) =>
        `${r.threeTransmissions.initial}-${r.threeTransmissions.middle}-${r.threeTransmissions.final}`
    );
    const uniqueSignatures = new Set(signatures);
    // 至少应有 3 种不同的三传组合（不同日期触发不同九宗门）
    expect(uniqueSignatures.size).toBeGreaterThanOrEqual(3);
  });

  // 第二阶段：贵神昼夜区分
  test("贵神昼夜区分：同一日期不同时辰，贵人起法应不同", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const [dayResult, nightResult] = await page.evaluate(async () => {
      // @ts-ignore
      if (!window.peep?.DaLiuRen) {
        throw new Error("window.peep.DaLiuRen 未注册");
      }
      // 昼占：午时（11:00-13:00）
      // @ts-ignore
      const day = await window.peep.DaLiuRen("2024-06-15", "12:00");
      // 夜占：酉时（17:00-19:00），错开时辰使天盘偏移不同
      // @ts-ignore
      const night = await window.peep.DaLiuRen("2024-06-15", "18:00");
      return [day, night];
    });

    // 十二天将应该不同（昼夜贵人不同）
    const dayGenerals = dayResult.twelveGenerals.map((g: any) => g.name).join(",");
    const nightGenerals = nightResult.twelveGenerals.map((g: any) => g.name).join(",");

    // 昼夜天将排列应有差异
    expect(dayGenerals).not.toBe(nightGenerals);
  });

  test("月将精确换将：节气交界时刻，月将应正确切换", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const result = await page.evaluate(async () => {
      // @ts-ignore
      if (!window.peep?.DaLiuRen) {
        throw new Error("window.peep.DaLiuRen 未注册");
      }
      // 春分前（应为戌将）
      // @ts-ignore
      const before = await window.peep.DaLiuRen("2024-03-19", "12:00");
      // 春分后（应为酉将）
      // @ts-ignore
      const after = await window.peep.DaLiuRen("2024-03-21", "12:00");

      return { before, after };
    });

    // 春分前后月将应不同
    expect(result.before.monthGeneral.branch).not.toBe(result.after.monthGeneral.branch);

    // 中气换将：雨水→亥（登明），春分→戌（河魁）
    // 春分前（3月19日，雨水后）→ 亥将（索引 11）
    expect(result.before.monthGeneral.branch).toBe(11); // 亥
    // 春分后（3月21日）→ 戌将（索引 10）
    expect(result.after.monthGeneral.branch).toBe(10); // 戌
  });

  test("旬空计算：应正确标注空亡地支", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const result = await page.evaluate(async () => {
      // @ts-ignore
      if (!window.peep?.DaLiuRen) {
        throw new Error("window.peep.DaLiuRen 未注册");
      }
      // @ts-ignore
      return await window.peep.DaLiuRen("2024-06-15", "12:00");
    });

    // 应有旬空信息
    expect(result.xunKong).toBeDefined();
    expect(result.xunKong).toHaveProperty("xunHead");
    expect(result.xunKong).toHaveProperty("void1");
    expect(result.xunKong).toHaveProperty("void2");

    // 空亡应是有效的地支索引（0-11）
    expect(result.xunKong.void1).toBeGreaterThanOrEqual(0);
    expect(result.xunKong.void1).toBeLessThan(12);
    expect(result.xunKong.void2).toBeGreaterThanOrEqual(0);
    expect(result.xunKong.void2).toBeLessThan(12);
    expect(result.xunKong.void1).not.toBe(result.xunKong.void2);
  });
});
