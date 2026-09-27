/**
 * rtcAgent 单元测试：mergeBirthInput 等纯函数
 */
import { describe, expect, it, vi } from "vitest";
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

  describe("边缘案例", () => {
    it("timeIndex=0（早子时）正常合并", () => {
      const partial = {
        name: "测试",
        date: "1990-01-01",
        timeIndex: 0,
        gender: "男" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.timeIndex).toBe(0);
    });

    it("timeIndex=12（晚子时）正常合并", () => {
      const partial = {
        name: "测试",
        date: "1990-01-01",
        timeIndex: 12,
        gender: "男" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.timeIndex).toBe(12);
    });

    it("空字符串 name 不崩溃", () => {
      const partial = {
        name: "",
        date: "1990-01-01",
        timeIndex: 0,
        gender: "男" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.name).toBe("");
    });

    it("超长 name 不崩溃", () => {
      const partial = {
        name: "测".repeat(1000),
        date: "1990-01-01",
        timeIndex: 0,
        gender: "男" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.name).toBe("测".repeat(1000));
    });

    it("emoji name 不崩溃", () => {
      const partial = {
        name: "🌟🎉",
        date: "1990-01-01",
        timeIndex: 0,
        gender: "男" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.name).toBe("🌟🎉");
    });

    it("特殊字符 date 不崩溃", () => {
      const partial = {
        name: "测试",
        date: "特殊日期",
        timeIndex: 0,
        gender: "男" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.date).toBe("特殊日期");
    });

    it("gender 为男时正确传递", () => {
      const partial = {
        name: "测试",
        date: "1990-01-01",
        timeIndex: 0,
        gender: "男" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.gender).toBe("男");
    });

    it("gender 为女时正确传递", () => {
      const partial = {
        name: "测试",
        date: "1990-01-01",
        timeIndex: 0,
        gender: "女" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.gender).toBe("女");
    });

    it("calendar=solar 时默认 isLeapMonth 为 false", () => {
      const partial = {
        name: "测试",
        date: "1990-01-01",
        timeIndex: 0,
        gender: "男" as const,
        calendar: "solar" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.isLeapMonth).toBe(false);
    });

    it("calendar=lunar + isLeapMonth=true 同时设置", () => {
      const partial = {
        name: "测试",
        date: "1990-04-15",
        timeIndex: 0,
        gender: "男" as const,
        calendar: "lunar" as const,
        isLeapMonth: true,
      };
      const result = mergeBirthInput(partial);
      expect(result.calendar).toBe("lunar");
      expect(result.isLeapMonth).toBe(true);
    });

    it("所有字段都为默认值时仍能正确合并", () => {
      const partial = {
        name: DEFAULT_BIRTH_INPUT.name,
        date: DEFAULT_BIRTH_INPUT.date,
        timeIndex: DEFAULT_BIRTH_INPUT.timeIndex,
        gender: DEFAULT_BIRTH_INPUT.gender as "男" | "女",
      };
      const result = mergeBirthInput(partial);
      expect(result.name).toBe(DEFAULT_BIRTH_INPUT.name);
    });

    it("algorithm=zhongzhou 被正确覆盖", () => {
      const partial = {
        name: "测试",
        date: "1990-01-01",
        timeIndex: 0,
        gender: "男" as const,
        algorithm: "zhongzhou" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.algorithm).toBe("zhongzhou");
    });

    it("所有默认字段被覆盖", () => {
      const partial = {
        name: "覆盖",
        date: "2000-01-01",
        timeIndex: 6,
        gender: "女" as const,
        calendar: "lunar" as const,
        isLeapMonth: true,
        algorithm: "zhongzhou" as const,
        yearDivide: "exact" as const,
        mutagenTable: "zhongzhou" as const,
        dayDivide: "midnight" as const,
        astroType: "earth" as const,
      };
      const result = mergeBirthInput(partial);
      expect(result.name).toBe("覆盖");
      expect(result.date).toBe("2000-01-01");
      expect(result.timeIndex).toBe(6);
      expect(result.gender).toBe("女");
      expect(result.calendar).toBe("lunar");
      expect(result.isLeapMonth).toBe(true);
      expect(result.algorithm).toBe("zhongzhou");
      expect(result.yearDivide).toBe("exact");
      expect(result.mutagenTable).toBe("zhongzhou");
      expect(result.dayDivide).toBe("midnight");
      expect(result.astroType).toBe("earth");
    });
  });
});
