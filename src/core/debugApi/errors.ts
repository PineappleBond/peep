/**
 * 调试 API 错误类定义
 *
 * 结构化错误：带上下文信息、错误链、恢复建议。
 * 生产环境通过 import.meta.env.DEV 控制是否输出敏感细节。
 *
 * 基类 BaseDebugError 封装 fullMessage 拼接、captureStackTrace 等共享逻辑；
 * ZiWeiError / DaLiuRenError / WikiError 只需指定 name，不再重复构造函数样板。
 */

/**
 * 调试 API 错误的私有基类：封装 fullMessage 拼接 + captureStackTrace 等共享逻辑。
 * ZiWeiError / DaLiuRenError / WikiError 共享此类，避免构造函数重复。
 *
 * 注：source/context/suggestion/cause 在基类统一初始化，
 * 子类只需 `this.name = "XxxError"` 一行即可。
 */
export class BaseDebugError extends Error {
  /** 错误来源标签（如 "ZiWei"、"DaLiuRenCreate"） */
  public readonly source: string;
  /** 上下文信息：输入参数、中间状态等（仅 DEV 环境包含完整数据） */
  public readonly context: Record<string, unknown>;
  /** 恢复建议（对开发者友好的调试提示） */
  public readonly suggestion?: string;
  /** 原始错误（错误链） */
  public readonly cause?: unknown;

  constructor(
    message: string,
    source: string,
    options?: {
      context?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    // 开发环境：消息包含完整上下文；生产环境：仅包含概要消息
    const fullMessage =
      import.meta.env.DEV && options?.context
        ? `${message}\n  来源: ${source}\n  上下文: ${JSON.stringify(options.context, null, 2)}${options?.suggestion ? `\n  建议: ${options.suggestion}` : ""}`
        : message;
    super(fullMessage);
    this.source = source;
    // 生产环境清空 context，防止敏感人物数据通过错误序列化泄露给 AI
    this.context = import.meta.env.DEV ? (options?.context ?? {}) : {};
    this.suggestion = import.meta.env.DEV ? options?.suggestion : undefined;
    this.cause = import.meta.env.DEV ? options?.cause : undefined;
    // 确保堆栈追踪可用（V8 引擎）
    // captureStackTrace 是 Node.js/V8 特有的 API，标准 TypeScript 类型定义中未包含
    // 使用 never 类型避免严格的构造函数签名检查
    const ErrCtor = Error as unknown as {
      captureStackTrace?: (target: object, ctor?: never) => void;
    };
    if (typeof ErrCtor.captureStackTrace === "function") {
      ErrCtor.captureStackTrace(this, new.target as never);
    }
  }
}

/**
 * 紫微斗数基础错误类：所有 debugApi 紫微相关错误的基类。
 * 包含上下文信息（输入参数、中间状态）和恢复建议。
 *
 * @example
 * ```typescript
 * try {
 *   await window.peep.ZiWei(1, "yearly");
 * } catch (err) {
 *   if (err instanceof ZiWeiError) {
 *     console.error("来源:", err.source);
 *     console.error("上下文:", err.context);
 *     console.error("建议:", err.suggestion);
 *     console.error("原始错误:", err.cause);
 *   }
 * }
 * ```
 */
export class ZiWeiError extends BaseDebugError {
  constructor(
    message: string,
    source: string,
    options?: {
      context?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    super(message, source, options);
    this.name = "ZiWeiError";
  }
}

/**
 * 日期解析错误：包含原始输入、尝试的格式列表和失败原因。
 */
export class ParseDateError extends ZiWeiError {
  /** 原始输入值 */
  public readonly rawInput: Date | number | string;
  /** 尝试过的格式列表 */
  public readonly attemptedFormats: string[];

  constructor(
    rawInput: Date | number | string,
    attemptedFormats: string[],
    reason: string,
    cause?: unknown,
  ) {
    const formatsDesc =
      attemptedFormats.length > 0 ? `尝试的格式: ${attemptedFormats.join(", ")}` : "未尝试任何格式";
    super(
      `日期解析失败: "${String(rawInput)}" (${typeof rawInput})\n  原因: ${reason}\n  ${formatsDesc}`,
      "parseDate",
      {
        context: { rawInput: String(rawInput), inputType: typeof rawInput, attemptedFormats },
        suggestion:
          "支持的格式: ISO 8601 (2024-06-15T12:00:00)、YYYY-MM-DD HH:mm、YYYY-MM-DD、时间戳 (毫秒)",
        cause,
      },
    );
    this.name = "ParseDateError";
    this.rawInput = rawInput;
    this.attemptedFormats = attemptedFormats;
  }
}

/**
 * 运限计算错误：包含人物信息和日期等上下文。
 */
export class ComputeScopeError extends ZiWeiError {
  constructor(
    message: string,
    options?: {
      personId?: number;
      personName?: string;
      solarDate?: string;
      context?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    super(message, "computeScopeData", {
      context: {
        personId: options?.personId,
        personName: options?.personName,
        solarDate: options?.solarDate,
        ...options?.context,
      },
      suggestion: options?.suggestion ?? "请检查人物数据是否完整（出生年月日时、性别、历法）",
      cause: options?.cause,
    });
    this.name = "ComputeScopeError";
  }
}

/**
 * 大六壬错误类：DaLiuRen 系列调试接口的专用错误。
 * 包含上下文信息（输入参数、回调状态）和恢复建议。
 */
export class DaLiuRenError extends BaseDebugError {
  constructor(
    message: string,
    source: string,
    options?: {
      context?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    super(message, source, options);
    this.name = "DaLiuRenError";
  }
}

/**
 * Wiki 错误类：Wiki 系列调试接口的专用错误。
 * 包含上下文信息（输入参数、数据库操作状态）和恢复建议。
 */
export class WikiError extends BaseDebugError {
  constructor(
    message: string,
    source: string,
    options?: {
      context?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    super(message, source, options);
    this.name = "WikiError";
  }
}

/**
 * 包装错误：确保所有错误都有统一的来源标签和格式。
 * 已经是 BaseDebugError 子类时直接返回；原生 Error 附加标签；非 Error 值包装为指定错误类。
 *
 * @param label 来源标签（如 "ZiWei"、"DaLiuRenCreate"）
 * @param err 原始错误
 * @param ErrorClass 用于包装非 Error 值的错误类构造函数
 */
export function wrapError<T extends BaseDebugError>(
  label: string,
  err: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ErrorClass: new (message: string, source: string, options?: any) => T,
): Error {
  // 已经是 BaseDebugError 子类（ZiWeiError / DaLiuRenError / WikiError 等），直接返回
  if (err instanceof BaseDebugError) {
    return err;
  }

  // 原生 Error：附加来源标签，保留原始堆栈
  if (err instanceof Error) {
    if (!err.message.startsWith(`[${label}]`)) {
      err.message = `[${label}] ${err.message}`;
    }
    return err;
  }

  // 非 Error 值（string、number、object 等）：包装为指定错误类
  // 使用安全序列化：JSON.stringify 遇到循环引用会抛错，用 try-catch 兜底
  let rawErrorStr: string;
  if (typeof err === "object") {
    try {
      rawErrorStr = JSON.stringify(err);
    } catch {
      rawErrorStr = String(err);
    }
  } else {
    rawErrorStr = String(err);
  }
  return new ErrorClass(`${label} 执行失败：${String(err)}`, label, {
    context: { rawError: rawErrorStr },
    suggestion: "此错误不是标准 Error 实例，请检查是否有地方 throw 了非 Error 值",
    cause: err,
  });
}
