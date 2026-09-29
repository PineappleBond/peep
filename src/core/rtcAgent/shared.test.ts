/**
 * rtcAgent/shared 单元测试：handler 工厂函数、共享 schema 片段
 */
import { describe, expect, it, vi } from "vitest";

// Mock @rtc-agent/component（与 rtcAgent.test.ts 一致）
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
vi.mock("../debugApi", () => ({
  getInternalPeepApi: () => vi.fn(),
}));

const {
  createPassthroughHandler,
  createBatchViewHandler,
  createMetadataUpdateHandler,
  createUpdateTagsSchema,
  createUpdateNoteSchema,
  needsConfirm,
  mergeBirthInput,
} = await import("./shared");

/* ─────────────── createPassthroughHandler ─────────────── */

describe("createPassthroughHandler", () => {
  it("解析参数并调用 API 函数", () => {
    const parseSpy = vi.fn((input: unknown) => ({ ...(input as object), parsed: true }));
    const mockSchema = { parse: parseSpy };
    const mockApi = vi.fn((p: Record<string, unknown>) => ({ result: p }));

    const handler = createPassthroughHandler(mockSchema, mockApi);
    const result = handler({ foo: "bar" });

    expect(parseSpy).toHaveBeenCalledWith({ foo: "bar" });
    expect(mockApi).toHaveBeenCalledWith({ foo: "bar", parsed: true });
    expect(result).toEqual({ result: { foo: "bar", parsed: true } });
  });

  it("返回值直接透传", () => {
    const schema = { parse: (input: unknown) => input };
    const api = vi.fn(() => 42);

    const handler = createPassthroughHandler(schema, api);
    expect(handler({})).toBe(42);
  });

  it("空参数也能正常工作", () => {
    const schema = { parse: (input: unknown) => input };
    const api = vi.fn((p: unknown) => p);

    const handler = createPassthroughHandler(schema, api);
    expect(handler({})).toEqual({});
  });

  it("支持返回 Promise", async () => {
    const schema = { parse: (input: unknown) => input };
    const api = vi.fn(async () => "async-result");

    const handler = createPassthroughHandler(schema, api);
    const result = await handler({ id: 1 });
    expect(result).toBe("async-result");
  });
});

/* ─────────────── createBatchViewHandler ─────────────── */

describe("createBatchViewHandler", () => {
  it("循环调用 viewOne 并收集结果", async () => {
    const schema = {
      parse: (input: unknown) => ({
        personId: (input as { personId?: number }).personId,
        recordIds: (input as { recordIds: number[] }).recordIds,
      }),
    };
    const viewOne = vi.fn(async (params: { personId?: number; recordId: number }) => ({
      id: params.recordId,
      personId: params.personId,
    }));

    const handler = createBatchViewHandler(schema, "recordIds", "recordId", viewOne, "records");
    const result = await handler({ personId: 1, recordIds: [10, 20, 30] });

    expect(viewOne).toHaveBeenCalledTimes(3);
    expect(viewOne).toHaveBeenNthCalledWith(1, { personId: 1, recordId: 10 });
    expect(viewOne).toHaveBeenNthCalledWith(2, { personId: 1, recordId: 20 });
    expect(viewOne).toHaveBeenNthCalledWith(3, { personId: 1, recordId: 30 });
    expect(result.records).toEqual([
      { id: 10, personId: 1 },
      { id: 20, personId: 1 },
      { id: 30, personId: 1 },
    ]);
    expect(result.count).toBe(3);
  });

  it("支持不同的 ID 键名和结果键名", async () => {
    const schema = {
      parse: (input: unknown) => ({
        personId: (input as { personId?: number }).personId,
        docIds: (input as { docIds: number[] }).docIds,
      }),
    };
    const viewOne = vi.fn(async (params: { personId?: number; docId: number }) => ({
      title: `doc-${params.docId}`,
    }));

    const handler = createBatchViewHandler(schema, "docIds", "docId", viewOne, "docs");
    const result = await handler({ docIds: [1, 2] });

    expect(result.docs).toEqual([{ title: "doc-1" }, { title: "doc-2" }]);
    expect(result.count).toBe(2);
  });

  it("personId 为 undefined 时正确传递", async () => {
    const schema = { parse: (input: unknown) => input as Record<string, unknown> };
    const viewOne = vi.fn(async (params: { personId?: number; recordId: number }) => params);

    const handler = createBatchViewHandler(schema, "recordIds", "recordId", viewOne, "records");
    await handler({ recordIds: [5] });

    expect(viewOne).toHaveBeenCalledWith({ personId: undefined, recordId: 5 });
  });

  it("空 ID 数组返回空结果", async () => {
    const schema = { parse: () => ({ recordIds: [] }) };
    const viewOne = vi.fn();

    const handler = createBatchViewHandler(schema, "recordIds", "recordId", viewOne, "records");
    const result = await handler({ recordIds: [] });

    expect(viewOne).not.toHaveBeenCalled();
    expect(result.records).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("viewOne 抛出异常时 handler 也抛出", async () => {
    const schema = { parse: () => ({ recordIds: [1] }) };
    const viewOne = vi.fn(async () => {
      throw new Error("查看失败");
    });

    const handler = createBatchViewHandler(schema, "recordIds", "recordId", viewOne, "records");
    await expect(handler({ recordIds: [1] })).rejects.toThrow("查看失败");
  });
});

/* ─────────────── createMetadataUpdateHandler ─────────────── */

describe("createMetadataUpdateHandler", () => {
  it("解析参数并调用更新函数", () => {
    const schema = {
      parse: (input: unknown) => input as { recordId: number; tags: string[] },
    };
    const updateApi = vi.fn((params: { recordId: number; tags: string[] }) => ({
      ...params,
      updatedAt: Date.now(),
    }));

    const handler = createMetadataUpdateHandler(schema, updateApi);
    const result = handler({ recordId: 1, tags: ["test"] });

    expect(updateApi).toHaveBeenCalledWith({ recordId: 1, tags: ["test"] });
    expect(result).toHaveProperty("recordId", 1);
    expect(result).toHaveProperty("tags", ["test"]);
    expect(result).toHaveProperty("updatedAt");
  });

  it("支持可选字段", () => {
    const schema = {
      parse: (input: unknown) => input as { recordId: number; note?: string; background?: string },
    };
    const updateApi = vi.fn(
      (params: { recordId: number; note?: string; background?: string }) => params,
    );

    const handler = createMetadataUpdateHandler(schema, updateApi);

    // 只传 note
    handler({ recordId: 1, note: "新备注" });
    expect(updateApi).toHaveBeenCalledWith({ recordId: 1, note: "新备注", background: undefined });

    // 只传 background
    handler({ recordId: 1, background: "背景" });
    expect(updateApi).toHaveBeenCalledWith({
      recordId: 1,
      note: undefined,
      background: "背景",
    });
  });

  it("返回值直接透传", () => {
    const schema = { parse: (input: unknown) => input };
    const api = vi.fn(() => "updated");

    const handler = createMetadataUpdateHandler(schema, api);
    expect(handler({})).toBe("updated");
  });
});

/* ─────────────── 已有功能回归测试 ─────────────── */

describe("needsConfirm", () => {
  it("默认 message 包含 confirmed 提示", () => {
    const result = needsConfirm("测试操作", "测试摘要");
    expect(result._needsConfirmation).toBe(true);
    expect(result.action).toBe("测试操作");
    expect(result.summary).toBe("测试摘要");
    expect(result.message).toContain("confirmed: true");
  });

  it("自定义 message 覆盖默认", () => {
    const result = needsConfirm("操作", "摘要", "自定义提示");
    expect(result.message).toBe("自定义提示");
  });
});

describe("mergeBirthInput", () => {
  it("核心字段正确合并", () => {
    const result = mergeBirthInput({
      name: "测试",
      date: "1990-01-01",
      timeIndex: 0,
      gender: "男",
    });
    expect(result.name).toBe("测试");
    expect(result.calendar).toBe("solar");
    expect(result.isLeapMonth).toBe(false);
  });

  it("显式 calendar 覆盖默认", () => {
    const result = mergeBirthInput({
      name: "测试",
      date: "1990-01-01",
      timeIndex: 0,
      gender: "男",
      calendar: "lunar",
    });
    expect(result.calendar).toBe("lunar");
  });

  it("显式 isLeapMonth 覆盖默认", () => {
    const result = mergeBirthInput({
      name: "测试",
      date: "1990-01-01",
      timeIndex: 0,
      gender: "女",
      isLeapMonth: true,
    });
    expect(result.isLeapMonth).toBe(true);
  });
});

/* ─────────────── createMetadataUpdateHandler 别名验证 ─────────────── */

describe("createMetadataUpdateHandler 是 createPassthroughHandler 的别名", () => {
  it("两者引用同一函数", () => {
    expect(createMetadataUpdateHandler).toBe(createPassthroughHandler);
  });

  it("通过别名调用也能正常工作", () => {
    const schema = { parse: (input: unknown) => input as { id: number } };
    const api = vi.fn((p: { id: number }) => ({ updated: true, ...p }));

    const handler = createMetadataUpdateHandler(schema, api);
    const result = handler({ id: 42 });

    expect(api).toHaveBeenCalledWith({ id: 42 });
    expect(result).toEqual({ updated: true, id: 42 });
  });
});

/* ─────────────── PERSON_ID_OPTIONAL 共享 schema ─────────────── */

describe("PERSON_ID_OPTIONAL", () => {
  it("定义存在且可被导入", async () => {
    const mod = await import("./shared");
    expect(mod.PERSON_ID_OPTIONAL).toBeDefined();
  });
});

/* ─────────────── createUpdateTagsSchema ─────────────── */

describe("createUpdateTagsSchema", () => {
  it("生成的 schema 包含 parse 方法（是有效的 zod schema）", () => {
    const schema = createUpdateTagsSchema("recordId", "起课记录 ID");
    expect(schema).toBeDefined();
    expect(typeof schema.parse).toBe("function");
  });

  it("不同 recordField 生成不同 schema 对象", () => {
    const schema1 = createUpdateTagsSchema("recordId", "起课记录 ID");
    const schema2 = createUpdateTagsSchema("docId", "文档 ID");
    expect(schema1).not.toBe(schema2);
  });
});

/* ─────────────── createUpdateNoteSchema ─────────────── */

describe("createUpdateNoteSchema", () => {
  it("生成的 schema 包含 parse 方法", () => {
    const schema = createUpdateNoteSchema("recordId", "起卦记录 ID");
    expect(schema).toBeDefined();
    expect(typeof schema.parse).toBe("function");
  });

  it("与 createUpdateTagsSchema 生成不同对象", () => {
    const tagsSchema = createUpdateTagsSchema("recordId", "测试");
    const noteSchema = createUpdateNoteSchema("recordId", "测试");
    expect(tagsSchema).not.toBe(noteSchema);
  });
});
