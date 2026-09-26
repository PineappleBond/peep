/**
 * rtcAgent 单元测试：mergeBirthInput 等纯函数
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_BIRTH_INPUT } from "./useZwds";

// Mock @rtc-agent/component（需要 DOM 环境）
vi.mock("@rtc-agent/component", () => {
  // 创建一个可链式调用的 mock schema
  const createMockSchema = () => ({
    describe: () => createMockSchema(),
    optional: () => createMockSchema(),
    int: () => createMockSchema(),
    positive: () => createMockSchema(),
    min: () => createMockSchema(),
    max: () => createMockSchema(),
    parse: (input: unknown) => input,
  });

  return {
    createRtcAgent: vi.fn(),
    switchLocale: vi.fn(),
    withMeta: () => createMockSchema(),
    z: {
      object: () => createMockSchema(),
      string: () => createMockSchema(),
      number: () => createMockSchema(),
      enum: () => createMockSchema(),
      boolean: () => createMockSchema(),
      array: () => createMockSchema(),
    },
  };
});

// Mock theme
vi.mock("./theme", () => ({
  getTheme: () => "light",
}));

// 延迟导入（mock 生效后再导入）
const { mergeBirthInput } = await import("./rtcAgent");

/* ─────────────── mergeBirthInput ─────────────── */

describe("mergeBirthInput", () => {
  it("核心字段正确合并", () => {
    const partial = {
      name: "张三",
      date: "1990-05-15",
      timeIndex: 4,
      gender: "男" as const,
    };
    const result = mergeBirthInput(partial);

    expect(result.name).toBe("张三");
    expect(result.date).toBe("1990-05-15");
    expect(result.timeIndex).toBe(4);
    expect(result.gender).toBe("男");
  });

  it("默认 calendar 为 solar", () => {
    const partial = {
      name: "李四",
      date: "1990-05-15",
      timeIndex: 4,
      gender: "女" as const,
    };
    const result = mergeBirthInput(partial);
    expect(result.calendar).toBe("solar");
  });

  it("显式指定 calendar 为 lunar", () => {
    const partial = {
      name: "王五",
      date: "1990-04-01",
      timeIndex: 6,
      gender: "男" as const,
      calendar: "lunar" as const,
    };
    const result = mergeBirthInput(partial);
    expect(result.calendar).toBe("lunar");
  });

  it("默认 isLeapMonth 为 false", () => {
    const partial = {
      name: "赵六",
      date: "1990-05-15",
      timeIndex: 4,
      gender: "女" as const,
    };
    const result = mergeBirthInput(partial);
    expect(result.isLeapMonth).toBe(false);
  });

  it("显式指定 isLeapMonth 为 true", () => {
    const partial = {
      name: "孙七",
      date: "1990-05-15",
      timeIndex: 4,
      gender: "男" as const,
      isLeapMonth: true,
    };
    const result = mergeBirthInput(partial);
    expect(result.isLeapMonth).toBe(true);
  });

  it("保留 DEFAULT_BIRTH_INPUT 的其他默认值", () => {
    const partial = {
      name: "周八",
      date: "1990-05-15",
      timeIndex: 4,
      gender: "男" as const,
    };
    const result = mergeBirthInput(partial);

    // 检查 DEFAULT_BIRTH_INPUT 的其他字段被保留
    expect(result.algorithm).toBe(DEFAULT_BIRTH_INPUT.algorithm);
    expect(result.yearDivide).toBe(DEFAULT_BIRTH_INPUT.yearDivide);
    expect(result.mutagenTable).toBe(DEFAULT_BIRTH_INPUT.mutagenTable);
    expect(result.dayDivide).toBe(DEFAULT_BIRTH_INPUT.dayDivide);
    expect(result.astroType).toBe(DEFAULT_BIRTH_INPUT.astroType);
  });

  it("partial 的字段覆盖 DEFAULT_BIRTH_INPUT", () => {
    const partial = {
      name: "吴九",
      date: "1990-05-15",
      timeIndex: 4,
      gender: "女" as const,
      algorithm: "zhongzhou" as const,
    };
    const result = mergeBirthInput(partial);
    expect(result.algorithm).toBe("zhongzhou");
  });
});
