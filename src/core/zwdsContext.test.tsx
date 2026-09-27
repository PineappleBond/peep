/**
 * ZwdsContext 上下文测试：
 * 验证 Provider / useZwdsContext / useZwdsSelector / useZwdsRef 的正确性
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { astro } from "iztro";
import { analyzeChart } from "../core/analysis";
import type { Zwds } from "../core/useZwds";
import { ZwdsProvider, useZwdsContext, useZwdsSelector, useZwdsRef } from "../core/zwdsContext";

function makeZ(): Zwds {
  const a = astro.withOptions({
    type: "solar",
    dateStr: "2000-08-16",
    timeIndex: 2,
    gender: "男" as never,
    isLeapMonth: false,
    fixLeap: true,
    language: "zh-CN",
    config: { algorithm: "default", yearDivide: "normal", horoscopeDivide: "normal" },
  });
  return { astrolabe: a, analysis: analyzeChart(a) } as unknown as Zwds;
}

describe("ZwdsContext", () => {
  it("useZwdsContext 在 Provider 内返回 z 对象", () => {
    const z = makeZ();
    function Consumer() {
      const ctx = useZwdsContext();
      return <div data-testid="result">{ctx.astrolabe?.solarDate ?? "no-astrolabe"}</div>;
    }
    const html = renderToString(
      <ZwdsProvider z={z}>
        <Consumer />
      </ZwdsProvider>,
    );
    expect(html).toContain("2000-08-16");
  });

  it("useZwdsSelector 可提取特定字段", () => {
    const z = makeZ();
    function Consumer() {
      const solarDate = useZwdsSelector(ctx => ctx.astrolabe?.solarDate ?? "");
      return <div>{solarDate}</div>;
    }
    const html = renderToString(
      <ZwdsProvider z={z}>
        <Consumer />
      </ZwdsProvider>,
    );
    expect(html).toContain("2000-08-16");
  });

  it("useZwdsRef 返回稳定引用", () => {
    const z = makeZ();
    function Consumer() {
      const ref = useZwdsRef();
      return <div>{ref.current?.astrolabe?.solarDate ?? "no-ref"}</div>;
    }
    const html = renderToString(
      <ZwdsProvider z={z}>
        <Consumer />
      </ZwdsProvider>,
    );
    expect(html).toContain("2000-08-16");
  });
});
