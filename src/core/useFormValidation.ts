/**
 * 统一表单验证 hook
 *
 * 设计目标：
 * - 统一管理字段级错误（errors）和已触碰字段（touched）
 * - 支持 onBlur 时实时验证单个字段
 * - 支持 onSubmit 时验证全部字段
 * - 错误信息支持 i18n（通过翻译函数 t）
 * - 轻量：不引入 schema 库，用声明式的 rules 配置
 */
import { useCallback, useState } from "react";

/** 单条验证规则 */
export type ValidationRule<T> = {
  /** 规则名称（用于调试） */
  name: string;
  /** 验证函数：返回错误翻译键，无错误返回 null */
  validate: (value: T[keyof T], allValues: T) => string | null;
};

/** 字段验证配置：字段名 -> 规则列表 */
export type ValidationRules<T> = {
  [K in keyof T]?: ValidationRule<T>[];
};

/** useFormValidation 返回值 */
export interface FormValidationResult<T> {
  /** 当前字段错误映射 */
  errors: Partial<Record<keyof T, string>>;
  /** 已触碰过的字段集合（用于决定是否显示错误） */
  touched: Partial<Record<keyof T, boolean>>;
  /** 设置某个字段的错误（用于服务端返回的错误） */
  setFieldError: (field: keyof T, error: string | null) => void;
  /** 标记字段已触碰（通常绑定到 onBlur） */
  touchField: (field: keyof T) => void;
  /** 验证单个字段并更新错误 */
  validateField: (field: keyof T, values: T) => string | null;
  /** 验证所有字段，返回是否全部通过 */
  validateAll: (values: T) => boolean;
  /** 清除所有错误和触碰状态 */
  reset: () => void;
  /** 判断某个字段当前是否应显示错误（已触碰且有错误） */
  shouldShowError: (field: keyof T) => boolean;
}

/**
 * 统一表单验证 hook
 *
 * @param rules 各字段的验证规则
 * @returns 验证状态与操作方法
 *
 * @example
 * ```ts
 * const rules: ValidationRules<MyForm> = {
 *   name: [{
 *     name: "required",
 *     validate: (v) => (!String(v).trim() ? "validation.required" : null),
 *   }],
 * };
 * const { errors, touched, touchField, validateField, validateAll, shouldShowError } = useFormValidation(rules);
 * ```
 */
export function useFormValidation<T extends object>(
  rules: ValidationRules<T>,
): FormValidationResult<T> {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  /** 对单个字段执行所有规则，返回第一条错误（翻译键）或 null */
  const runRules = useCallback(
    (field: keyof T, value: T[keyof T], allValues: T): string | null => {
      const fieldRules = rules[field];
      if (!fieldRules) return null;
      for (const rule of fieldRules) {
        const err = rule.validate(value, allValues);
        if (err) return err;
      }
      return null;
    },
    [rules],
  );

  /** 验证单个字段并更新 errors 状态 */
  const validateField = useCallback(
    (field: keyof T, values: T): string | null => {
      const err = runRules(field, values[field], values);
      setErrors(prev => {
        const next = { ...prev };
        if (err) {
          next[field] = err;
        } else {
          delete next[field];
        }
        return next;
      });
      return err;
    },
    [runRules],
  );

  /** 标记字段已触碰 */
  const touchField = useCallback((field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  /** 验证所有字段，返回是否全部通过 */
  const validateAll = useCallback(
    (values: T): boolean => {
      const newErrors: Partial<Record<keyof T, string>> = {};
      const newTouched: Partial<Record<keyof T, boolean>> = {};
      let hasError = false;

      for (const field of Object.keys(rules) as (keyof T)[]) {
        newTouched[field] = true;
        const err = runRules(field, values[field], values);
        if (err) {
          newErrors[field] = err;
          hasError = true;
        }
      }

      setErrors(newErrors);
      setTouched(newTouched);
      return !hasError;
    },
    [rules, runRules],
  );

  /** 设置某个字段的错误（用于服务端返回的错误等场景） */
  const setFieldError = useCallback((field: keyof T, error: string | null) => {
    setErrors(prev => {
      const next = { ...prev };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      return next;
    });
    // 同时标记为已触碰，确保错误可见
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  /** 清除所有错误和触碰状态 */
  const reset = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  /** 判断某个字段当前是否应显示错误 */
  const shouldShowError = useCallback(
    (field: keyof T): boolean => {
      return !!touched[field] && !!errors[field];
    },
    [touched, errors],
  );

  return {
    errors,
    touched,
    setFieldError,
    touchField,
    validateField,
    validateAll,
    reset,
    shouldShowError,
  };
}

/* ── 通用验证规则工厂 ── */

/** 必填（非空字符串） */
export function requiredRule(errorKey: string) {
  return {
    name: "required",
    validate: (v: unknown) => {
      if (typeof v === "string" && !v.trim()) return errorKey;
      if (v == null) return errorKey;
      return null;
    },
  };
}

/** 正则匹配 */
export function patternRule(pattern: RegExp, errorKey: string) {
  return {
    name: "pattern",
    validate: (v: unknown) => {
      if (typeof v !== "string" || !v) return null;
      return pattern.test(v) ? null : errorKey;
    },
  };
}

/** 最大长度 */
export function maxLengthRule(max: number, errorKey: string) {
  return {
    name: "maxLength",
    validate: (v: unknown) => {
      if (typeof v !== "string" || !v) return null;
      return v.length > max ? errorKey : null;
    },
  };
}

/** 数值范围 */
export function rangeRule(min: number, max: number, errorKey: string) {
  return {
    name: "range",
    validate: (v: unknown) => {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return errorKey;
      return n >= min && n <= max ? null : errorKey;
    },
  };
}

/** 条件必填：当某个条件满足时字段必填 */
export function conditionalRequiredRule<T extends object>(
  condition: (allValues: T) => boolean,
  errorKey: string,
) {
  return {
    name: "conditionalRequired",
    validate: (v: unknown, allValues: T) => {
      if (!condition(allValues)) return null;
      if (typeof v === "string" && !v.trim()) return errorKey;
      if (v == null) return errorKey;
      return null;
    },
  };
}
