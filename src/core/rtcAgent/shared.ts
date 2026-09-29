/**
 * RTC Agent 共享工具
 *
 * 各业务域 Function 文件共同依赖的辅助函数、常量与 schema 片段。
 *
 * 设计原则：
 * 1. Schema 片段：跨模块复用的字段定义（如 personId）集中管理，避免漂移
 * 2. Handler 工厂：将 parse→call / 确认流程 等重复模式收敛为工厂函数
 * 3. 确认机制：写操作的安全确认流程统一封装
 */
import { withMeta, z } from "@rtc-agent/component";
import type { BirthInput } from "../useZwds";
import { DEFAULT_BIRTH_INPUT } from "../useZwds";
import { getInternalPeepApi } from "../debugApi";

/* ─────────────── API 入口 ─────────────── */

/**
 * 取内部 API 入口——RTC Agent Function handler 通过此函数调用 peep 方法。
 * 走内部通道（getInternalPeepApi），不依赖 window.peep 全局变量，
 * 确保生产环境即使 window.peep 被限制也能正常调用写操作。
 */
export function peepApi(): NonNullable<Window["peep"]> {
  return getInternalPeepApi();
}

/* ─────────────── 出生信息 ─────────────── */

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

/* ─────────────── 共享 Schema 片段 ─────────────── */

/**
 * 可选命主 ID 字段——几乎所有 Function 都用到。
 * 统一 description 文案与验证规则，避免各模块漂移。
 */
export const PERSON_ID_OPTIONAL = withMeta(z.number().int().positive(), { example: 1 })
  .optional()
  .describe("命主 ID（可选）；省略则使用默认人物");

/* ─────────────── 确认机制 ─────────────── */

/**
 * 写操作确认标志：对 Create/Update/Delete 等破坏性操作，
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

/* ─────────────── Handler 工厂函数 ─────────────── */

/**
 * 创建「parse → 调用 peepApi」handler——用于 List/View 等只读函数。
 *
 * 消除重复模式：
 * ```ts
 * // 使用前（每个 handler 都是这个结构）
 * handler: (args: Record<string, unknown>) => {
 *   const parsedArgs = someFunction.zodSchema.parse(args);
 *   return peepApi().SomeApi(parsedArgs);
 * }
 *
 * // 使用后
 * handler: createPassthroughHandler(someFunction.zodSchema, p => peepApi().SomeApi(p))
 * ```
 *
 * @param schema Zod schema 用于解析 AI 传入的参数
 * @param callApi 接收解析后的参数，返回 API 调用结果
 */
export function createPassthroughHandler<TIn, TOut>(
  schema: { parse: (input: unknown) => TIn },
  callApi: (parsed: TIn) => TOut,
): (args: Record<string, unknown>) => TOut {
  return (args: Record<string, unknown>) => callApi(schema.parse(args));
}

/**
 * 创建批量查看 handler——用于 BatchView 类函数。
 *
 * 消除三个模块（大六壬/六爻/Wiki）中完全相同的「循环调用 View → 收集结果」模式。
 *
 * @param schema Zod schema（必须包含 idKey 指定的 ID 数组字段和可选 personId）
 * @param idKey ID 数组字段名（如 "recordIds"、"docIds"）
 * @param singularKey 单条 ID 字段名（如 "recordId"、"docId"）——viewOne 接收的字段名
 * @param viewOne 单条查看函数，接收含 personId + 单条 ID 的参数
 * @param resultKey 返回对象中结果数组的键名（如 "records"、"docs"）
 *
 * @returns handler 函数，接收原始 args 并返回 { [resultKey]: T[], count: number }
 */
export function createBatchViewHandler<TItem>(
  schema: { parse: (input: unknown) => Record<string, unknown> },
  idKey: string,
  singularKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewOne: (params: any) => Promise<TItem>,
  resultKey: string,
): (args: Record<string, unknown>) => Promise<{ count: number } & Record<string, unknown>> {
  return async (args: Record<string, unknown>) => {
    const parsed = schema.parse(args);
    const ids = parsed[idKey] as number[];
    const base = { personId: parsed.personId as number | undefined };
    const results: TItem[] = [];
    for (const id of ids) {
      const item = await viewOne({ ...base, [singularKey]: id });
      results.push(item);
    }
    return { [resultKey]: results, count: results.length } as { count: number } & Record<
      string,
      unknown
    >;
  };
}

/**
 * 创建元数据更新 handler——用于 UpdateTags / UpdateNote 类函数。
 *
 * 注：语义上与 createPassthroughHandler 完全相同（parse → call），
 * 保留此别名仅为保持调用点语义清晰（「透传」vs「更新元数据」）。
 * 实现委托给 createPassthroughHandler，不重复代码。
 *
 * @param schema Zod schema 用于解析参数
 * @param callApi 接收解析后的参数，执行实际更新
 */
export const createMetadataUpdateHandler = createPassthroughHandler;

/* ─────────────── 共享 Schema ─────────────── */

/**
 * 人物基础信息 schema——ziweiFunctions / daliurenFunctions / liuyaoFunctions 的
 * computed.person 字段共用此精简版（7 个核心字段）。
 * 完整版见 personFunctions.ts 的 _personReturnSchema（22 个字段，含高级设置）。
 */
export const PERSON_SUMMARY_SCHEMA = z
  .object({
    id: z.number().describe("人物ID"),
    name: z.string().describe("姓名"),
    gender: z.string().describe("性别"),
    date: z.string().describe("出生日期"),
    timeIndex: z.number().describe("时辰索引"),
    savedAt: z.number().describe("保存时间戳"),
    isDefault: z.boolean().describe("是否默认人物"),
  })
  .describe("人物基础信息");

/**
 * 列表查询 schema 工厂——DaLiuRenList / LiuYaoList / WikiList 共用同构参数：
 * personId(可选) + searchText(可选) + tags(可选) + page(可选) + pageSize(可选)。
 *
 * @param contextLabel 搜索字段的上下文描述（如 "问题、备注、背景" / "标题或正文"）
 */
export function createListFiltersSchema(contextLabel: string) {
  return z.object({
    personId: PERSON_ID_OPTIONAL,
    searchText: withMeta(z.string(), { example: "合作" })
      .optional()
      .describe(`搜索关键字——匹配${contextLabel}`),
    tags: z.array(z.string()).optional().describe("按标签过滤——只返回包含指定标签的记录"),
    page: withMeta(z.number().int().positive(), { example: 1 }).optional().describe("页码，默认 1"),
    pageSize: withMeta(z.number().int().positive(), { example: 20 })
      .optional()
      .describe("每页条数，默认 20"),
  });
}

/* ─────────────── 共享元数据更新 Schema ─────────────── */

/**
 * 更新标签 schema——DaLiuRenUpdateTags / LiuYaoUpdateTags 共用。
 * 记录 ID + 新标签数组，两者结构完全一致。
 *
 * @param recordField 记录 ID 字段名（"recordId" 或 "docId"）
 * @param recordLabel 记录 ID 描述文案（如 "起课记录 ID" / "起卦记录 ID"）
 */
export function createUpdateTagsSchema(recordField: string, recordLabel: string) {
  return z.object({
    [recordField]: withMeta(z.number().int().positive(), { example: 123 }).describe(
      `${recordLabel}——从对应 List 返回的记录中获取`,
    ),
    tags: z.array(z.string()).describe("新的标签列表（会完全替换原有标签）"),
  });
}

/**
 * 更新备注 schema——DaLiuRenUpdateNote / LiuYaoUpdateNote 共用。
 * 记录 ID + 可选 note + 可选 background，两者结构完全一致。
 *
 * @param recordField 记录 ID 字段名
 * @param recordLabel 记录 ID 描述文案
 */
export function createUpdateNoteSchema(recordField: string, recordLabel: string) {
  return z.object({
    [recordField]: withMeta(z.number().int().positive(), { example: 123 }).describe(
      `${recordLabel}——从对应 List 返回的记录中获取`,
    ),
    note: z.string().optional().describe("新的备注（可选）"),
    background: z.string().optional().describe("新的背景信息（可选）"),
  });
}

/* ─────────────── 确认操作工厂函数 ─────────────── */

/**
 * 创建「确认→执行」handler——用于 Create/Update/Delete 等写操作。
 *
 * 消除重复模式：
 * ```ts
 * // 使用前（每个写 handler 都是这个结构）
 * handler: (args) => {
 *   const input = schema.parse(args);
 *   if (!input.confirmed) return needsConfirm(...);
 *   const { confirmed: _, ...params } = input;
 *   return peepApi().SomeApi(params);
 * }
 *
 * // 使用后
 * handler: createConfirmHandler(schema, "操作名", buildSummary, params => peepApi().SomeApi(params))
 * ```
 *
 * @param schema 包含 confirmed 字段的 zodSchema
 * @param action 操作名称（如 "创建人物"、"大六壬起课"）
 * @param buildSummary 从解析后的参数构建操作摘要
 * @param execute 确认后执行的业务逻辑
 * @param options 可选配置（自定义确认消息、是否不可逆）
 */
export function createConfirmHandler<TIn extends { confirmed?: boolean }, TOut>(
  schema: { parse: (input: unknown) => TIn },
  action: string,
  buildSummary: (input: TIn) => string,
  execute: (params: Omit<TIn, "confirmed">) => TOut,
  options?: {
    /** 自定义确认消息（默认引导用户传入 confirmed: true） */
    confirmMessage?: string;
    /** 是否为不可逆操作（影响确认消息措辞） */
    irreversible?: boolean;
  },
): (args: Record<string, unknown>) => TOut | ConfirmResponse {
  return (args: Record<string, unknown>) => {
    const input = schema.parse(args);
    if (!input.confirmed) {
      const message = options?.irreversible
        ? "请明确告知用户此操作不可撤销，确认后再次调用并传入 confirmed: true"
        : undefined;
      return needsConfirm(action, buildSummary(input), message);
    }
    const { confirmed: _c, ...params } = input;
    void _c;
    return execute(params as Omit<TIn, "confirmed">);
  };
}
