/**
 * 大六壬算法回归测试
 *
 * 每个测试钉死一条具体的古法规则或历史 bug 修复，避免后续改动再次踩坑。
 *
 * 测试案例来自真实盘面或古籍记载，断言值经过人工复核。
 */
import { describe, it, expect } from "vitest";
import { calculateDaLiuRen } from "./calculator";

describe("大六壬回归测试", () => {
  // ── 寄宫才见克（2026-10 修复）──────────────────────
  //
  // 历史 bug：四课第一课（干课）下五行曾错误地取天干本身五行（丁=火），
  // 导致本该"上克下"的案例被判为"上生下"，进而一路滑到"遥克蒿矢"分支。
  //
  // 正确规则（古法）：
  //   大六壬地盘纯地支，天干必须通过"十干寄宫"落盘参与生克。
  //   第一课"下"的五行 = 日干寄宫所在地支的五行，
  //   而非天干本身的五行。
  //
  // 本案例：
  //   - 丁巳日，丁寄未（土）。第一课：卯←丁(寄未) → 卯木克未土 = 上克下。
  //   - 按古法第一课即"上克下"，走"元首课"，初传卯。
  //   - 中传=天盘[卯]=亥，末传=天盘[亥]=未。
  //
  // 参考 issue：https://github.com/meixiaoqiu/liuren/issues/17
  it("干课下五行必须走寄宫——丁巳日第一课应见卯木克未土→元首课", () => {
    const r = calculateDaLiuRen("2026-10-10", "16:42");

    // 前置断言：四课第一课的下确实是丁（寄宫未）
    const first = r.fourLessons[0];
    expect(first.upper).toBe(3); // 卯
    expect(first.lowerType).toBe("stem");
    // lower 字段按现有约定存天干索引（丁=3），实际五行判断时应走寄宫未（土）。

    // 关键断言：三传
    expect(r.threeTransmissions.method).toBe("元首");
    expect(r.threeTransmissions.initial).toBe(3); // 卯
    expect(r.threeTransmissions.middle).toBe(11); // 亥
    expect(r.threeTransmissions.final).toBe(7); // 未

    // trace 里应能看到"克(1)"和"元首"字样，便于事后排查
    const trace = r.threeTransmissions.trace.join(" / ");
    expect(trace).toMatch(/克\(1\)/);
    expect(trace).toMatch(/元首/);
  });

  // 反向断言：同样日干如果第一课没有克（按古法），则不应走元首。
  // 这里用一个"四课全无克、走遥克"的案例做兜底，确保寄宫规则
  // 没有把不该见克的案例硬凑成克。
  //
  // TODO：后续补一条"四课无克→遥克"的典型断言（待人工确认案例）。
});
