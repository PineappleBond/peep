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

  it("条件满足 + 仅空白字符串 => 返回错误", () => {
    expect(rule.validate("   ", { useFeature: true, config: "   " })).toBe("err.needConfig");
  });

  it("条件满足 + 值为 null => 返回错误", () => {
    expect(rule.validate(null, { useFeature: true, config: null as unknown as string })).toBe(
      "err.needConfig",
    );
  });

  it("条件满足 + 值为 undefined => 返回错误", () => {
    expect(
      rule.validate(undefined, { useFeature: true, config: undefined as unknown as string }),
    ).toBe("err.needConfig");
  });

  it("条件满足 + 数字 0 => 通过", () => {
    expect(rule.validate(0 as unknown as string, { useFeature: true, config: "" })).toBeNull();
  });
});

/* ── 边缘案例测试 ── */

describe("requiredRule 边缘案例", () => {
  const rule = requiredRule("err.required");

  it("各种空白字符组成的字符串返回错误", () => {
    expect(rule.validate("\t\n\r")).toBe("err.required");
    expect(rule.validate("     ")).toBe("err.required");
  });

  it("布尔值 true 通过", () => {
    expect(rule.validate(true)).toBeNull();
  });

  it("布尔值 false 通过", () => {
    expect(rule.validate(false)).toBeNull();
  });

  it("空数组通过", () => {
    expect(rule.validate([])).toBeNull();
  });

  it("空对象通过", () => {
    expect(rule.validate({})).toBeNull();
  });

  it("NaN 通过（非 null/undefined）", () => {
    expect(rule.validate(NaN)).toBeNull();
  });

  it("Infinity 通过", () => {
    expect(rule.validate(Infinity)).toBeNull();
  });

  it("emoji 字符串通过", () => {
    expect(rule.validate("🎉")).toBeNull();
  });
});

describe("patternRule 边缘案例", () => {
  it("unicode 字符串匹配正则", () => {
    const rule = patternRule(/^[一-龥]+$/, "err.chinese_only");
    expect(rule.validate("中文测试")).toBeNull();
    expect(rule.validate("abc中文")).toBe("err.chinese_only");
  });

  it("多行字符串匹配", () => {
    const rule = patternRule(/^hello/, "err.noMatch");
    expect(rule.validate("hello\nworld")).toBeNull();
  });

  it("非字符串值返回 null（跳过检查）", () => {
    const rule = patternRule(/test/, "err.noMatch");
    expect(rule.validate(123 as unknown as string)).toBeNull();
    expect(rule.validate(null as unknown as string)).toBeNull();
    expect(rule.validate(undefined as unknown as string)).toBeNull();
  });

  it("空正则匹配所有字符串", () => {
    const rule = patternRule(/(?:)/, "err.noMatch");
    expect(rule.validate("anything")).toBeNull();
  });
});

describe("rangeRule 边缘案例", () => {
  it("Infinity 超出范围", () => {
    const rule = rangeRule(0, 100, "err.range");
    expect(rule.validate(Infinity)).toBe("err.range");
  });

  it("-Infinity 超出范围", () => {
    const rule = rangeRule(0, 100, "err.range");
    expect(rule.validate(-Infinity)).toBe("err.range");
  });

  it("极大安全整数超出小范围", () => {
    const rule = rangeRule(0, 100, "err.range");
    expect(rule.validate(Number.MAX_SAFE_INTEGER)).toBe("err.range");
  });

  it("极小安全整数超出小范围", () => {
    const rule = rangeRule(0, 100, "err.range");
    expect(rule.validate(Number.MIN_SAFE_INTEGER)).toBe("err.range");
  });

  it("字符串数字可以转换并比较", () => {
    const rule = rangeRule(0, 100, "err.range");
    expect(rule.validate("50" as unknown as number)).toBeNull();
    expect(rule.validate("200" as unknown as number)).toBe("err.range");
  });

  it("非数字字符串返回错误", () => {
    const rule = rangeRule(0, 100, "err.range");
    expect(rule.validate("abc" as unknown as number)).toBe("err.range");
  });

  it("大范围边界值", () => {
    const rule = rangeRule(-1e10, 1e10, "err.range");
    expect(rule.validate(0)).toBeNull();
    expect(rule.validate(1e10)).toBeNull();
    expect(rule.validate(-1e10)).toBeNull();
    expect(rule.validate(1e10 + 1)).toBe("err.range");
  });

  it("min=max 时只有精确值通过", () => {
    const rule = rangeRule(5, 5, "err.range");
    expect(rule.validate(5)).toBeNull();
    expect(rule.validate(4)).toBe("err.range");
    expect(rule.validate(6)).toBe("err.range");
  });
});

describe("maxLengthRule 边缘案例", () => {
  it("emoji 字符占用多字节但长度按 code unit 计算", () => {
    const rule = maxLengthRule(2, "err.tooLong");
    // emoji "🎉" 是 2 个 code unit（代理对），所以长度为 2
    expect(rule.validate("🎉")).toBeNull();
  });

  it("多个 emoji 超过限制", () => {
    const rule = maxLengthRule(3, "err.tooLong");
    expect(rule.validate("🎉🎉")).toBe("err.tooLong"); // 4 code units
  });

  it("换行符计入长度", () => {
    const rule = maxLengthRule(5, "err.tooLong");
    expect(rule.validate("a\nb\nc")).toBeNull(); // 5 chars
    expect(rule.validate("a\nb\nc\n")).toBe("err.tooLong"); // 6 chars
  });

  it("中文字符每字长度 1", () => {
    const rule = maxLengthRule(3, "err.tooLong");
    expect(rule.validate("中文字")).toBeNull();
    expect(rule.validate("中文字符")).toBe("err.tooLong");
  });

  it("非字符串值跳过检查", () => {
    const rule = maxLengthRule(5, "err.tooLong");
    expect(rule.validate(123 as unknown as string)).toBeNull();
    expect(rule.validate(null as unknown as string)).toBeNull();
  });

  it("maxLength=0 时非空字符串都超长", () => {
    const rule = maxLengthRule(0, "err.tooLong");
    expect(rule.validate("")).toBeNull();
    expect(rule.validate("a")).toBe("err.tooLong");
  });
});
