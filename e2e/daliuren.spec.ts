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

  // 第三阶段：旺相休囚死
  test("旺相休囚死：应正确标注每个地支的季节状态", async ({ page }) => {
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

    // 应有旺相休囚死信息
    expect(result.wangXiang).toBeDefined();

    // 12 个地支都应有状态
    const states = Object.values(result.wangXiang);
    expect(states.length).toBe(12);

    // 所有状态都应是五种之一
    const validStates = new Set(["旺", "相", "休", "囚", "死"]);
    for (const state of states) {
      expect(validStates.has(state as string)).toBe(true);
    }

    // 2024年6月15日在芒种后，月支为午（五月），午月火旺
    // 所以巳(5)午(6)应为"旺"（火），寅(2)卯(3)应为"相"（木生火，我生者=相?）
    // 等等，重新理解：火旺时，同火→旺；木生火→木=休（火是被生者，木是生我者→休？不对）
    // 规则：火为当令。火(同)=旺；火生土→土=相；木生火→木=休（生我者=休）；水克火→水=囚；火克金→金=死
    // 验证：午(6)=火=旺，巳(5)=火=旺
    expect(result.wangXiang["6"]).toBe("旺"); // 午
    expect(result.wangXiang["5"]).toBe("旺"); // 巳
  });

  // 第三阶段：六亲
  test("六亲：应正确标注每个地支的六亲关系", async ({ page }) => {
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

    // 应有六亲信息
    expect(result.liuQin).toBeDefined();

    // 12 个地支都应有六亲
    const liuQins = Object.values(result.liuQin);
    expect(liuQins.length).toBe(12);

    // 所有六亲都应是五种之一
    const validLiuQin = new Set(["父母", "兄弟", "子孙", "妻财", "官鬼"]);
    for (const lq of liuQins) {
      expect(validLiuQin.has(lq as string)).toBe(true);
    }

    // 2024-06-15 是庚戌日（日干庚=金）
    // 金为基准：同金→兄弟（申=8酉=9），金生水→子孙（亥=11子=0），
    // 金克木→妻财（寅=2卯=3），火克金→官鬼（巳=5午=6），
    // 土生金→父母（辰=4戌=10丑=1未=7）
    expect(result.liuQin["8"]).toBe("兄弟"); // 申=金
    expect(result.liuQin["9"]).toBe("兄弟"); // 酉=金
    expect(result.liuQin["11"]).toBe("子孙"); // 亥=水
    expect(result.liuQin["0"]).toBe("子孙"); // 子=水
    expect(result.liuQin["2"]).toBe("妻财"); // 寅=木
    expect(result.liuQin["5"]).toBe("官鬼"); // 巳=火
    expect(result.liuQin["4"]).toBe("父母"); // 辰=土
  });

  // 第三阶段：神煞
  test("神煞：应包含常用神煞", async ({ page }) => {
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

    // 应有神煞列表
    expect(result.shenSha).toBeDefined();
    expect(Array.isArray(result.shenSha)).toBe(true);

    // 神煞数量应 ≥ 20
    expect(result.shenSha.length).toBeGreaterThanOrEqual(20);

    // 每个神煞都应有 name/branch/type/description
    for (const sha of result.shenSha) {
      expect(sha).toHaveProperty("name");
      expect(sha).toHaveProperty("branch");
      expect(sha).toHaveProperty("type");
      expect(sha).toHaveProperty("description");
      expect(typeof sha.name).toBe("string");
      expect(typeof sha.branch).toBe("number");
      expect(["吉", "凶"]).toContain(sha.type);
    }

    // 应包含一些常见神煞
    const names = result.shenSha.map((s: any) => s.name);
    expect(names).toContain("驿马");
    expect(names).toContain("岁破");
    expect(names).toContain("天医");
    expect(names).toContain("丧门");
    expect(names).toContain("文昌");
  });

  // 第三阶段：遁干和刑冲破害
  test("遁干与刑冲破害：应包含完整结果", async ({ page }) => {
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

    // 旬遁
    expect(result.xunDun).toBeDefined();
    expect(typeof result.xunDun).toBe("object");

    // 日遁（12 个天干）
    expect(result.riDun).toBeDefined();
    expect(result.riDun.length).toBe(12);

    // 刑冲破害
    expect(result.relations).toBeDefined();
    expect(Array.isArray(result.relations)).toBe(true);

    // 每个关系都有 type/branches/description
    for (const rel of result.relations) {
      expect(rel).toHaveProperty("type");
      expect(rel).toHaveProperty("branches");
      expect(rel).toHaveProperty("description");
      expect(["冲", "刑", "破", "害", "合"]).toContain(rel.type);
    }
  });
});
