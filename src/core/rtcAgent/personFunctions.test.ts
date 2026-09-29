/**
 * rtcAgent/personFunctions 单元测试
 *
 * 验证人物库 Function 定义：schema 结构、handler 工厂使用、返回值描述。
 */
import { describe, expect, it, vi } from "vitest";

// Mock @rtc-agent/component
vi.mock("@rtc-agent/component", () => {
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

// Mock debugApi
const mockPersonList = vi.fn();
const mockPersonGet = vi.fn();
const mockPersonCreate = vi.fn();
const mockPersonUpdate = vi.fn();
const mockPersonDelete = vi.fn();
const mockPersonSetDefault = vi.fn();

vi.mock("../debugApi", () => ({
  getInternalPeepApi: () => ({
    PersonList: mockPersonList,
    PersonGet: mockPersonGet,
    PersonCreate: mockPersonCreate,
    PersonUpdate: mockPersonUpdate,
    PersonDelete: mockPersonDelete,
    PersonSetDefault: mockPersonSetDefault,
  }),
}));

const {
  personListFunction,
  personGetFunction,
  personCreateFunction,
  personUpdateFunction,
  personDeleteFunction,
  personSetDefaultFunction,
} = await import("./personFunctions");

/* ─────────────── 基本结构验证 ─────────────── */

describe("personFunctions 基本结构", () => {
  it("所有 Function 都有 name/description/zodSchema/handler/returns", () => {
    const functions = [
      personListFunction,
      personGetFunction,
      personCreateFunction,
      personUpdateFunction,
      personDeleteFunction,
      personSetDefaultFunction,
    ];
    for (const fn of functions) {
      expect(fn).toHaveProperty("name");
      expect(fn).toHaveProperty("description");
      expect(fn).toHaveProperty("zodSchema");
      expect(fn).toHaveProperty("handler");
      expect(fn).toHaveProperty("returns");
      expect(typeof fn.handler).toBe("function");
    }
  });

  it("Function 名称正确", () => {
    expect(personListFunction.name).toBe("PersonList");
    expect(personGetFunction.name).toBe("PersonGet");
    expect(personCreateFunction.name).toBe("PersonCreate");
    expect(personUpdateFunction.name).toBe("PersonUpdate");
    expect(personDeleteFunction.name).toBe("PersonDelete");
    expect(personSetDefaultFunction.name).toBe("PersonSetDefault");
  });
});

/* ─────────────── handler 工厂使用验证（无自引用） ─────────────── */

describe("handler 无自引用模式", () => {
  it("personGetFunction.handler 不使用自引用", () => {
    // 重构后 handler 应该通过工厂函数创建，不引用 personGetFunction.zodSchema
    const handlerStr = personGetFunction.handler.toString();
    expect(handlerStr).not.toContain("personGetFunction.zodSchema");
  });

  it("personSetDefaultFunction.handler 不使用自引用", () => {
    const handlerStr = personSetDefaultFunction.handler.toString();
    expect(handlerStr).not.toContain("personSetDefaultFunction.zodSchema");
  });
});

/* ─────────────── returns 结构验证 ─────────────── */

describe("returns.zodSchema 存在", () => {
  it("每个 Function 都有 returns.zodSchema", () => {
    const functions = [
      personListFunction,
      personGetFunction,
      personCreateFunction,
      personUpdateFunction,
      personDeleteFunction,
      personSetDefaultFunction,
    ];
    for (const fn of functions) {
      expect(fn.returns).toHaveProperty("zodSchema");
    }
  });
});

/* ─────────────── description 内容验证 ─────────────── */

describe("description 包含关键信息", () => {
  it("PersonCreate 描述包含安全机制提示", () => {
    expect(personCreateFunction.description).toContain("安全机制");
    expect(personCreateFunction.description).toContain("confirmed");
  });

  it("PersonDelete 描述包含不可逆操作警告", () => {
    expect(personDeleteFunction.description).toContain("不可逆");
    expect(personDeleteFunction.description).toContain("confirmed");
  });

  it("PersonSetDefault 描述包含唯一默认人物约束", () => {
    expect(personSetDefaultFunction.description).toContain("只能有一个默认人物");
  });

  it("PersonList 描述包含分析前提提示", () => {
    expect(personListFunction.description).toContain("分析前必须先确认命主");
  });
});
