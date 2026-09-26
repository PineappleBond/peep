/**
 * useFormValidation 统一表单验证 hook 测试
 *
 * 采用 renderToString 方式测试（项目未安装 @testing-library/react），
 * 同时直接测试纯验证规则工厂函数。
 */
import { describe, it, expect } from "vitest";
import {
  requiredRule,
  patternRule,
  rangeRule,
  maxLengthRule,
  conditionalRequiredRule,
} from "./useFormValidation";

/* ── 纯验证规则工厂测试 ── */

describe("requiredRule", () => {
  const rule = requiredRule("err.required");

  it("空字符串返回错误", () => {
    expect(rule.validate("")).toBe("err.required");
  });

  it("仅空白字符串返回错误", () => {
    expect(rule.validate("   ")).toBe("err.required");
  });

  it("null/undefined 返回错误", () => {
    expect(rule.validate(null)).toBe("err.required");
    expect(rule.validate(undefined)).toBe("err.required");
  });

  it("非空字符串通过", () => {
    expect(rule.validate("abc")).toBeNull();
  });

  it("数字 0 通过（非 null/undefined）", () => {
    expect(rule.validate(0)).toBeNull();
  });
});

describe("patternRule", () => {
  const rule = patternRule(/^[^@]+@[^@]+$/, "err.invalid");

  it("匹配失败返回错误", () => {
    expect(rule.validate("not-email")).toBe("err.invalid");
  });

  it("匹配成功返回 null", () => {
    expect(rule.validate("a@b.com")).toBeNull();
  });

  it("空值跳过检查（返回 null）", () => {
    expect(rule.validate("")).toBeNull();
  });
});

describe("rangeRule", () => {
  const rule = rangeRule(0, 12, "err.outOfRange");

  it("数值在范围内通过", () => {
    expect(rule.validate(5)).toBeNull();
    expect(rule.validate(0)).toBeNull();
    expect(rule.validate(12)).toBeNull();
  });

  it("数值超范围返回错误", () => {
    expect(rule.validate(-1)).toBe("err.outOfRange");
    expect(rule.validate(13)).toBe("err.outOfRange");
  });

  it("非数字返回错误", () => {
    expect(rule.validate(NaN)).toBe("err.outOfRange");
  });
});

describe("maxLengthRule", () => {
  const rule = maxLengthRule(10, "err.tooLong");

  it("短于限制通过", () => {
    expect(rule.validate("hello")).toBeNull();
  });

  it("恰好等于限制通过", () => {
    expect(rule.validate("1234567890")).toBeNull();
  });

  it("超过限制返回错误", () => {
    expect(rule.validate("12345678901")).toBe("err.tooLong");
  });

  it("空值跳过检查", () => {
    expect(rule.validate("")).toBeNull();
  });
});

describe("conditionalRequiredRule", () => {
  interface TestVals {
    useFeature: boolean;
    config: string;
  }
  const rule = conditionalRequiredRule<TestVals>(vals => vals.useFeature, "err.needConfig");

  it("条件满足 + 值为空 => 返回错误", () => {
    expect(rule.validate("", { useFeature: true, config: "" })).toBe("err.needConfig");
  });

  it("条件满足 + 有值 => 通过", () => {
    expect(rule.validate("something", { useFeature: true, config: "something" })).toBeNull();
  });

  it("条件不满足 + 值为空 => 通过", () => {
    expect(rule.validate("", { useFeature: false, config: "" })).toBeNull();
  });

  it("条件不满足 + 有值 => 通过", () => {
    expect(rule.validate("val", { useFeature: false, config: "val" })).toBeNull();
  });
});
