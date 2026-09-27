/**
 * 调试 API 参数验证工具
 *
 * 统一的参数验证函数——为所有 debugApi 函数提供一致的输入校验。
 * 验证失败时抛出对应的错误类（带错误代码 INVALID_INPUT），
 * 前端/AI 可据此自动提示用户修正参数。
 *
 * 设计原则：
 * - 纯函数，无副作用
 * - 验证失败直接抛出，成功静默通过（guard 模式）
 * - 错误消息包含期望格式和具体原因
 */

import { ApiErrorCode } from "./errors";
import { ZiWeiError, DaLiuRenError, WikiError } from "./errors";
import type { Scope } from "./types";

/** 有效的运限级别列表 */
export const VALID_SCOPES: readonly Scope[] = [
  "decadal",
  "yearly",
  "monthly",
  "daily",
  "hourly",
] as const;

/**
 * 验证人物 ID——必须为正整数（或 undefined 表示使用默认人物）。
 *
 * @param personId 待验证的人物 ID
 * @param source 来源标签（用于错误消息）
 * @throws ZiWeiError personId 不是正整数时
 *
 * @example
 * ```typescript
 * validatePersonId(1, "ZiWei");        // 通过
 * validatePersonId(undefined, "ZiWei"); // 通过（使用默认人物）
 * validatePersonId(-1, "ZiWei");        // 抛出 ZiWeiError(INVALID_INPUT)
 * validatePersonId("abc", "ZiWei");     // 抛出 ZiWeiError(INVALID_INPUT)
 * ```
 */
export function validatePersonId(personId: number | undefined, source: string): void {
  if (personId !== undefined) {
    if (!Number.isFinite(personId) || !Number.isInteger(personId) || personId <= 0) {
      throw new ZiWeiError(`personId 无效：${personId}，需为正整数（如 1, 2, 3）`, source, {
        context: { personId, type: typeof personId },
        suggestion:
          "请传入有效的人物 ID（正整数）。可先调用 PersonList() 获取可用的人物 ID 列表，或不传以使用默认人物",
        errorCode: ApiErrorCode.INVALID_INPUT,
      });
    }
  }
}

/**
 * 验证运限级别——必须为 VALID_SCOPES 之一（或 undefined）。
 *
 * @param scope 待验证的运限级别
 * @param source 来源标签
 * @throws ZiWeiError scope 不在有效列表中时
 *
 * @example
 * ```typescript
 * validateScope("yearly", "ZiWei");     // 通过
 * validateScope(undefined, "ZiWei");    // 通过
 * validateScope("invalid", "ZiWei");    // 抛出 ZiWeiError(INVALID_INPUT)
 * ```
 */
export function validateScope(scope: Scope | undefined, source: string): void {
  if (scope !== undefined && !VALID_SCOPES.includes(scope)) {
    throw new ZiWeiError(`scope 无效：${scope}，需为 ${VALID_SCOPES.join("/")} 之一`, source, {
      context: { scope, validScopes: [...VALID_SCOPES] },
      suggestion: `请使用有效的运限级别：${VALID_SCOPES.join("、")}`,
      errorCode: ApiErrorCode.INVALID_INPUT,
    });
  }
}

/**
 * 验证记录 ID——必须为正整数。
 *
 * @param recordId 待验证的记录 ID
 * @param source 来源标签
 * @throws DaLiuRenError recordId 不是正整数时
 */
export function validateRecordId(recordId: number, source: string): void {
  if (!Number.isFinite(recordId) || !Number.isInteger(recordId) || recordId <= 0) {
    throw new DaLiuRenError(`recordId 无效：${recordId}，需为正整数`, source, {
      context: { recordId, type: typeof recordId },
      suggestion: "请传入有效的记录 ID（正整数）。可先调用 DaLiuRenList() 获取可用的记录 ID 列表",
      errorCode: ApiErrorCode.INVALID_INPUT,
    });
  }
}

/**
 * 验证文档 ID——必须为正整数。
 *
 * @param docId 待验证的文档 ID
 * @param source 来源标签
 * @throws WikiError docId 不是正整数时
 */
export function validateDocId(docId: number, source: string): void {
  if (!Number.isFinite(docId) || !Number.isInteger(docId) || docId <= 0) {
    throw new WikiError(`docId 无效：${docId}，需为正整数`, source, {
      context: { docId, type: typeof docId },
      suggestion: "请传入有效的文档 ID（正整数）。可先调用 WikiList() 获取可用的文档 ID 列表",
      errorCode: ApiErrorCode.INVALID_INPUT,
    });
  }
}

/**
 * 验证字符串非空——用于必填字符串字段（如 question、title、content）。
 *
 * @param value 待验证的字符串值
 * @param fieldName 字段名称（用于错误消息）
 * @param source 来源标签
 * @param ErrorClass 用于抛出错误的错误类构造函数
 * @throws Error value 为空字符串时
 */
export function validateNonEmptyString(
  value: string,
  fieldName: string,
  source: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ErrorClass: new (message: string, src: string, options?: any) => Error,
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ErrorClass(`${fieldName} 不能为空`, source, {
      context: { fieldName, value: typeof value === "string" ? value : typeof value },
      suggestion: `请传入非空的 ${fieldName} 字符串`,
      errorCode: ApiErrorCode.INVALID_INPUT,
    });
  }
}

/**
 * 验证分页参数——page 和 pageSize 必须为正整数（如果提供）。
 *
 * @param params 包含 page/pageSize 的对象
 * @param source 来源标签
 * @param ErrorClass 用于抛出错误的错误类构造函数
 * @returns 修正后的分页参数（无效值替换为默认值）
 */
export function validatePagination<T extends { page?: number; pageSize?: number }>(
  params: T,
  source: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ErrorClass: new (message: string, src: string, options?: any) => Error,
): T {
  const result = { ...params };

  if (result.page !== undefined) {
    if (!Number.isInteger(result.page) || result.page < 1) {
      throw new ErrorClass(`page 无效：${result.page}，需为正整数（从 1 开始）`, source, {
        context: { page: result.page },
        suggestion: "page 为页码，从 1 开始的正整数",
        errorCode: ApiErrorCode.INVALID_INPUT,
      });
    }
  }

  if (result.pageSize !== undefined) {
    if (!Number.isInteger(result.pageSize) || result.pageSize < 1 || result.pageSize > 100) {
      throw new ErrorClass(`pageSize 无效：${result.pageSize}，需为 1-100 之间的正整数`, source, {
        context: { pageSize: result.pageSize },
        suggestion: "pageSize 为每页条数，范围 1-100",
        errorCode: ApiErrorCode.INVALID_INPUT,
      });
    }
  }

  return result;
}

/**
 * 验证标签数组——每个标签必须为非空字符串。
 *
 * @param tags 待验证的标签数组
 * @param source 来源标签
 * @param ErrorClass 用于抛出错误的错误类构造函数
 */
export function validateTags(
  tags: string[] | undefined,
  source: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ErrorClass: new (message: string, src: string, options?: any) => Error,
): void {
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      throw new ErrorClass(`tags 必须为字符串数组，实际类型为 ${typeof tags}`, source, {
        context: { tags: String(tags) },
        suggestion: "tags 应为字符串数组，如 ['格局', '紫微']",
        errorCode: ApiErrorCode.INVALID_INPUT,
      });
    }
    for (let i = 0; i < tags.length; i++) {
      if (typeof tags[i] !== "string" || tags[i].trim().length === 0) {
        throw new ErrorClass(`tags[${i}] 必须为非空字符串`, source, {
          context: { index: i, value: tags[i] },
          suggestion: "每个标签必须为非空字符串",
          errorCode: ApiErrorCode.INVALID_INPUT,
        });
      }
    }
  }
}

/**
 * 验证 ID 数组——每个元素必须为正整数。
 * 用于 linkTargetIds 等 ID 列表参数。
 *
 * @param ids 待验证的 ID 数组
 * @param fieldName 字段名称
 * @param source 来源标签
 * @param ErrorClass 用于抛出错误的错误类构造函数
 */
export function validateIdArray(
  ids: number[] | undefined,
  fieldName: string,
  source: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ErrorClass: new (message: string, src: string, options?: any) => Error,
): void {
  if (ids !== undefined) {
    if (!Array.isArray(ids)) {
      throw new ErrorClass(`${fieldName} 必须为数字数组，实际类型为 ${typeof ids}`, source, {
        context: { fieldName, value: String(ids) },
        suggestion: `${fieldName} 应为正整数数组`,
        errorCode: ApiErrorCode.INVALID_INPUT,
      });
    }
    for (let i = 0; i < ids.length; i++) {
      if (!Number.isInteger(ids[i]) || ids[i] <= 0) {
        throw new ErrorClass(`${fieldName}[${i}] 无效：${ids[i]}，需为正整数`, source, {
          context: { fieldName, index: i, value: ids[i] },
          suggestion: `${fieldName} 中的每个元素必须为正整数`,
          errorCode: ApiErrorCode.INVALID_INPUT,
        });
      }
    }
  }
}
