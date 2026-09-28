/**
 * RTC Agent 共享工具
 *
 * 各业务域 Function 文件共同依赖的辅助函数与常量。
 */
import { withMeta, z } from "@rtc-agent/component";
import type { BirthInput } from "../useZwds";
import { DEFAULT_BIRTH_INPUT } from "../useZwds";
import { getInternalPeepApi } from "../debugApi";

/**
 * 取内部 API 入口——RTC Agent Function handler 通过此函数调用 peep 方法。
 * 走内部通道（getInternalPeepApi），不依赖 window.peep 全局变量，
 * 确保生产环境即使 window.peep 被限制也能正常调用写操作。
 */
export function peepApi(): NonNullable<Window["peep"]> {
  return getInternalPeepApi();
}

/**
 * AI 只需提供核心出生信息，其余字段用默认值填充。
 * 这样 AI 不用关心真太阳时/安星流派等高级设置。
 */
export interface BirthInputFields {
  name: string;
  date: string;
  timeIndex: number;
  gender: "男" | "女";
  calendar?: "solar" | "lunar";
  isLeapMonth?: boolean;
}

/**
 * 将 AI 提供的部分字段合并为完整 BirthInput
 */
export function mergeBirthInput(partial: BirthInputFields): BirthInput {
  return {
    ...DEFAULT_BIRTH_INPUT,
    ...partial,
    calendar: partial.calendar ?? "solar",
    isLeapMonth: partial.isLeapMonth ?? false,
  };
}

/**
 * 写操作确认机制：对 Create/Update/Delete 等破坏性操作，
 * handler 先返回操作摘要要求 AI 向用户确认，AI 再次调用时传入 confirmed=true 才真正执行。
 * 这样即使 AI 幻觉或 prompt 注入，也不会直接执行不可逆操作。
 */
export const CONFIRM_FIELD = withMeta(z.boolean(), { example: true })
  .optional()
  .describe(
    "⚠️ 安全确认标志：首次调用时不传此字段，函数会返回操作摘要供用户确认；" +
      "用户确认后，AI 再次调用并传入 confirmed: true 才会真正执行。" +
      "这是为了防止 AI 误操作造成不可逆的数据变更。",
  );

/**
 * 确认响应结构——所有写操作首次调用时返回的统一格式。
 * AI 收到此响应后，应将 summary 展示给用户，获得确认后再调用并传入 confirmed: true。
 */
export interface ConfirmResponse {
  _needsConfirmation: true;
  action: string;
  summary: string;
  message: string;
}

/**
 * 构建确认响应——消除各 handler 中重复的 `{ _needsConfirmation: true, ... }` 对象字面量。
 *
 * 使用前后对比：
 * ```ts
 * // 使用前（每个 handler 都重复此结构）
 * if (!parsedArgs.confirmed) {
 *   return {
 *     _needsConfirmation: true,
 *     action: "创建人物",
 *     summary: `即将创建人物：${parsedArgs.name}`,
 *     message: "请向用户确认以上信息是否正确，确认后再次调用并传入 confirmed: true",
 *   };
 * }
 *
 * // 使用后
 * if (!parsedArgs.confirmed) {
 *   return needsConfirm("创建人物", `即将创建人物：${parsedArgs.name}`);
 * }
 * ```
 *
 * @param action 操作名称（如 "创建人物"、"大六壬起课"）
 * @param summary 操作摘要（展示给用户确认的具体内容）
 * @param message 可选的自定义确认提示（默认引导用户传入 confirmed: true）
 */
export function needsConfirm(action: string, summary: string, message?: string): ConfirmResponse {
  return {
    _needsConfirmation: true,
    action,
    summary,
    message: message ?? "请向用户确认以上信息，确认后再次调用并传入 confirmed: true",
  };
}

/**
 * 从已确认的参数中提取业务参数——去除 confirmed 字段。
 *
 * 与 needsConfirm 配合使用，消除 `{ confirmed: _c, ...params } = parsedArgs; void _c;` 样板。
 *
 * @param args 已解析的参数对象（包含 confirmed 字段）
 * @returns 去除 confirmed 后的纯业务参数
 */
export function extractConfirmed<T extends Record<string, unknown>>(args: T): Omit<T, "confirmed"> {
  const { confirmed: _c, ...params } = args;
  void _c;
  return params;
}
