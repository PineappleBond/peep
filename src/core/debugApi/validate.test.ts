/**
 * 参数验证工具单元测试
 */
import { describe, expect, it } from "vitest";
import {
  validatePersonId,
  validateScope,
  validateRecordId,
  validateDocId,
  validateNonEmptyString,
  validatePagination,
  validateTags,
  validateIdArray,
  VALID_SCOPES,
} from "./validate";
import { ZiWeiError, DaLiuRenError, WikiError, ApiErrorCode } from "./errors";

/* ─────────────── ApiErrorCode ─────────────── */

describe("ApiErrorCode", () => {
  it("所有预定义的错误代码值正确", () => {
    expect(ApiErrorCode.INVALID_INPUT).toBe("INVALID_INPUT");
    expect(ApiErrorCode.NOT_FOUND).toBe("NOT_FOUND");
    expect(ApiErrorCode.TIMEOUT).toBe("TIMEOUT");
    expect(ApiErrorCode.INTERNAL).toBe("INTERNAL");
    expect(ApiErrorCode.NOT_INITIALIZED).toBe("NOT_INITIALIZED");
    expect(ApiErrorCode.PERMISSION_DENIED).toBe("PERMISSION_DENIED");
    expect(ApiErrorCode.CALLBACK_TIMEOUT).toBe("CALLBACK_TIMEOUT");
    expect(ApiErrorCode.NEEDS_CONFIRMATION).toBe("NEEDS_CONFIRMATION");
  });
});

/* ─────────────── VALID_SCOPES ─────────────── */

describe("VALID_SCOPES", () => {
  it("包含所有有效的运限级别", () => {
    expect(VALID_SCOPES).toEqual(["decadal", "yearly", "monthly", "daily", "hourly"]);
  });
});

/* ─────────────── validatePersonId ─────────────── */

describe("validatePersonId", () => {
  it("正整数通过验证", () => {
    expect(() => validatePersonId(1, "test")).not.toThrow();
    expect(() => validatePersonId(100, "test")).not.toThrow();
  });

  it("undefined 通过验证（使用默认人物）", () => {
    expect(() => validatePersonId(undefined, "test")).not.toThrow();
  });

  it("0 抛出 INVALID_INPUT 错误", () => {
    try {
      validatePersonId(0, "test");
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
      expect((err as ZiWeiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("负数抛出 INVALID_INPUT 错误", () => {
    try {
      validatePersonId(-1, "test");
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
      expect((err as ZiWeiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("浮点数抛出 INVALID_INPUT 错误", () => {
    try {
      validatePersonId(1.5, "test");
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
      expect((err as ZiWeiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("NaN 抛出 INVALID_INPUT 错误", () => {
    try {
      validatePersonId(NaN, "test");
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
      expect((err as ZiWeiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("Infinity 抛出 INVALID_INPUT 错误", () => {
    try {
      validatePersonId(Infinity, "test");
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
      expect((err as ZiWeiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });
});

/* ─────────────── validateScope ─────────────── */

describe("validateScope", () => {
  it("有效的 scope 通过验证", () => {
    for (const scope of VALID_SCOPES) {
      expect(() => validateScope(scope, "test")).not.toThrow();
    }
  });

  it("undefined 通过验证", () => {
    expect(() => validateScope(undefined, "test")).not.toThrow();
  });

  it("无效的 scope 抛出 INVALID_INPUT 错误", () => {
    try {
      validateScope("invalid" as never, "test");
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
      expect((err as ZiWeiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });
});

/* ─────────────── validateRecordId ─────────────── */

describe("validateRecordId", () => {
  it("正整数通过验证", () => {
    expect(() => validateRecordId(1, "test")).not.toThrow();
  });

  it("0 抛出 INVALID_INPUT 错误", () => {
    try {
      validateRecordId(0, "test");
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(DaLiuRenError);
      expect((err as DaLiuRenError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("负数抛出 INVALID_INPUT 错误", () => {
    try {
      validateRecordId(-5, "test");
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(DaLiuRenError);
    }
  });
});

/* ─────────────── validateDocId ─────────────── */

describe("validateDocId", () => {
  it("正整数通过验证", () => {
    expect(() => validateDocId(42, "test")).not.toThrow();
  });

  it("0 抛出 INVALID_INPUT 错误", () => {
    try {
      validateDocId(0, "test");
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(WikiError);
      expect((err as WikiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });
});

/* ─────────────── validateNonEmptyString ─────────────── */

describe("validateNonEmptyString", () => {
  it("非空字符串通过验证", () => {
    expect(() => validateNonEmptyString("测试", "field", "test", ZiWeiError)).not.toThrow();
  });

  it("空字符串抛出 INVALID_INPUT 错误", () => {
    try {
      validateNonEmptyString("", "field", "test", ZiWeiError);
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
      expect((err as ZiWeiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("仅空白字符串抛出 INVALID_INPUT 错误", () => {
    try {
      validateNonEmptyString("   ", "field", "test", ZiWeiError);
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
    }
  });
});

/* ─────────────── validatePagination ─────────────── */

describe("validatePagination", () => {
  it("有效分页参数通过验证", () => {
    expect(() => validatePagination({ page: 1, pageSize: 20 }, "test", ZiWeiError)).not.toThrow();
  });

  it("undefined 分页参数通过验证", () => {
    expect(() => validatePagination({}, "test", ZiWeiError)).not.toThrow();
  });

  it("page=0 抛出 INVALID_INPUT 错误", () => {
    try {
      validatePagination({ page: 0 }, "test", ZiWeiError);
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
      expect((err as ZiWeiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("pageSize=101 抛出 INVALID_INPUT 错误（上限 100）", () => {
    try {
      validatePagination({ pageSize: 101 }, "test", ZiWeiError);
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
    }
  });

  it("pageSize=0 抛出 INVALID_INPUT 错误", () => {
    try {
      validatePagination({ pageSize: 0 }, "test", ZiWeiError);
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
    }
  });
});

/* ─────────────── validateTags ─────────────── */

describe("validateTags", () => {
  it("有效标签数组通过验证", () => {
    expect(() => validateTags(["格局", "紫微"], "test", ZiWeiError)).not.toThrow();
  });

  it("undefined 通过验证", () => {
    expect(() => validateTags(undefined, "test", ZiWeiError)).not.toThrow();
  });

  it("空数组通过验证", () => {
    expect(() => validateTags([], "test", ZiWeiError)).not.toThrow();
  });

  it("包含空字符串的标签抛出 INVALID_INPUT 错误", () => {
    try {
      validateTags(["有效", ""], "test", ZiWeiError);
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
      expect((err as ZiWeiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });
});

/* ─────────────── validateIdArray ─────────────── */

describe("validateIdArray", () => {
  it("有效 ID 数组通过验证", () => {
    expect(() => validateIdArray([1, 2, 3], "ids", "test", ZiWeiError)).not.toThrow();
  });

  it("undefined 通过验证", () => {
    expect(() => validateIdArray(undefined, "ids", "test", ZiWeiError)).not.toThrow();
  });

  it("包含 0 的数组抛出 INVALID_INPUT 错误", () => {
    try {
      validateIdArray([1, 0, 3], "ids", "test", ZiWeiError);
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
      expect((err as ZiWeiError).errorCode).toBe(ApiErrorCode.INVALID_INPUT);
    }
  });

  it("包含负数的数组抛出 INVALID_INPUT 错误", () => {
    try {
      validateIdArray([1, -1], "ids", "test", ZiWeiError);
      expect.fail("应该抛出错误");
    } catch (err) {
      expect(err).toBeInstanceOf(ZiWeiError);
    }
  });
});

/* ─────────────── BaseDebugError.toJSON ─────────────── */

describe("BaseDebugError.toJSON", () => {
  it("序列化包含核心字段", () => {
    const err = new ZiWeiError("测试错误", "test", {
      errorCode: ApiErrorCode.INVALID_INPUT,
      context: { foo: "bar" },
    });
    const json = err.toJSON();
    expect(json.name).toBe("ZiWeiError");
    expect(json.source).toBe("test");
    expect(json.errorCode).toBe("INVALID_INPUT");
    // 开发环境下包含上下文
    expect(json.message).toContain("测试错误");
  });

  it("无 errorCode 时序列化不包含该字段", () => {
    const err = new ZiWeiError("测试错误", "test", {});
    const json = err.toJSON();
    expect(json.errorCode).toBeUndefined();
  });
});
