/**
 * rtcAgent 单元测试：mergeBirthInput、needsConfirm、extractConfirmed 等纯函数
 */
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_BIRTH_INPUT } from "./useZwds";

// Mock @rtc-agent/component（需要 DOM 环境）
vi.mock("@rtc-agent/component", () => {
  // 创建一个可链式调用的 mock schema
  const createMockSchema = () => ({
    describe: () => createMockSchema(),
    optional: () => createMockSchema(),
    default: () => createMockSchema(),
    int: () => createMockSchema(),
    positive: () => createMockSchema(),
    min: () => createMockSchema(),
    max: () => createMockSchema(),
    extend: () => createMockSchema(),
    nullable: () => createMockSchema(),
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
      void: () => createMockSchema(),
      record: () => createMockSchema(),
      any: () => createMockSchema(),
      union: () => createMockSchema(),
    },
  };
});

// Mock theme
vi.mock("./theme", () => ({
  getTheme: () => "light",
}));

// 延迟导入（mock 生效后再导入）
const { mergeBirthInput, needsConfirm, extractConfirmed } = await import("./rtcAgent");

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

/* ─────────────── needsConfirm ─────────────── */

describe("needsConfirm", () => {
  it("返回标准确认响应结构", () => {
    const result = needsConfirm("创建人物", "即将创建人物：张三");
    expect(result).toEqual({
      _needsConfirmation: true,
      action: "创建人物",
      summary: "即将创建人物：张三",
      message: "请向用户确认以上信息，确认后再次调用并传入 confirmed: true",
    });
  });

  it("支持自定义 message", () => {
    const result = needsConfirm(
      "删除人物",
      "即将删除人物 #1（此操作不可撤销）",
      "请明确告知用户此操作不可撤销，确认后再次调用并传入 confirmed: true",
    );
    expect(result._needsConfirmation).toBe(true);
    expect(result.action).toBe("删除人物");
    expect(result.summary).toContain("不可撤销");
    expect(result.message).toContain("不可撤销");
  });

  it("默认 message 引导用户传入 confirmed: true", () => {
    const result = needsConfirm("测试", "测试摘要");
    expect(result.message).toContain("confirmed: true");
  });

  it("_needsConfirmation 始终为 true", () => {
    const result = needsConfirm("任意操作", "任意摘要");
    expect(result._needsConfirmation).toBe(true);
  });
});

/* ─────────────── extractConfirmed ─────────────── */

describe("extractConfirmed", () => {
  it("去除 confirmed 字段", () => {
    const result = extractConfirmed({ confirmed: true, name: "张三", date: "1990-01-01" });
    expect(result).toEqual({ name: "张三", date: "1990-01-01" });
    expect("confirmed" in result).toBe(false);
  });

  it("confirmed 为 false 时同样去除", () => {
    const result = extractConfirmed({ confirmed: false, id: 1 });
    expect(result).toEqual({ id: 1 });
    expect("confirmed" in result).toBe(false);
  });

  it("confirmed 为 undefined 时同样去除", () => {
    const result = extractConfirmed({ confirmed: undefined, id: 1 });
    expect(result).toEqual({ id: 1 });
    expect("confirmed" in result).toBe(false);
  });

  it("无 confirmed 字段时返回原对象", () => {
    const result = extractConfirmed({ name: "张三", id: 1 } as Record<string, unknown>);
    expect(result).toEqual({ name: "张三", id: 1 });
  });

  it("保留所有非 confirmed 字段（包括 falsy 值）", () => {
    const result = extractConfirmed({
      confirmed: true,
      name: "",
      count: 0,
      flag: false,
      data: null,
    });
    expect(result).toEqual({ name: "", count: 0, flag: false, data: null });
  });

  it("空对象返回空对象", () => {
    const result = extractConfirmed({});
    expect(result).toEqual({});
  });
});
