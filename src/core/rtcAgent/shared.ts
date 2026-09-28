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
