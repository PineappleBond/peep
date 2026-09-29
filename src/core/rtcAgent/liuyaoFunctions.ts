/**
 * 六爻（LiuYao）Function 定义
 *
 * 起卦与占卜——适合具体事件的占断。
 */
import { withMeta, z } from "@rtc-agent/component";
import {
  CONFIRM_FIELD,
  PERSON_ID_OPTIONAL,
  PERSON_SUMMARY_SCHEMA,
  peepApi,
  createConfirmHandler,
  createBatchViewHandler,
  createMetadataUpdateHandler,
  createPassthroughHandler,
  createListFiltersSchema,
} from "./shared";
import type { SixLines } from "../liuyao/core/types";

/* ---- 共享 Schema ---- */

const _lineSchema = z.object({
  pos: z.number().describe("爻位 1-6"),
  yang: z.boolean().describe("是否阳爻"),
  moving: z.boolean().describe("是否动爻"),
  stem: z.string().describe("天干"),
  branch: z.string().describe("地支"),
  elem: z.string().describe("五行"),
  rel: z.string().describe("六亲（如妻财/官鬼/子孙等）"),
  god: z.string().describe("六神（青龙/朱雀/勾陈/螣蛇/白虎/玄武）"),
  kong: z.boolean().describe("是否旬空"),
  kongState: z.string().nullable().describe("空亡状态描述"),
});

const _changedLineSchema = z.object({
  pos: z.number().describe("爻位 1-6"),
  yang: z.boolean().describe("是否阳爻"),
  stem: z.string().describe("天干"),
  branch: z.string().describe("地支"),
  elem: z.string().describe("五行"),
  rel: z.string().describe("六亲"),
});

const liuyaoChartSchema = z.object({
  name: z.string().describe("卦名（如水天需）"),
  palace: z.string().describe("所属宫位"),
  palaceElem: z.string().describe("宫位五行"),
  type: z.string().describe("卦类型（如游魂/归魂等）"),
  shi: z.number().describe("世爻位"),
  ying: z.number().describe("应爻位"),
  lines: z.array(_lineSchema).describe("六爻数组"),
  changed: z
    .object({
      name: z.string().describe("变卦名"),
      lines: z.array(_changedLineSchema).describe("变卦六爻"),
    })
    .describe("变卦"),
  month: z
    .object({
      branch: z.string().describe("月建地支"),
      elem: z.string().describe("月建五行"),
    })
    .describe("月建"),
  day: z
    .object({
      stem: z.string().describe("日辰天干"),
      branch: z.string().describe("日辰地支"),
      elem: z.string().describe("日辰五行"),
      kong: z.array(z.string()).describe("日空地支数组"),
    })
    .describe("日辰"),
});

const liuyaoYongSchema = z.object({
  rel: z.string().describe("用神六亲"),
  pos: z.number().describe("用神爻位"),
  pickedBy: z.string().nullable().describe("选取方式"),
  hidden: z.string().nullable().describe("伏神信息"),
});

const liuyaoRecordSchema = z.object({
  personId: z.number().describe("命主 ID"),
  divinationTime: z.string().describe("起卦时间"),
  question: z.string().describe("所占问题"),
  background: z.string().describe("背景信息"),
  note: z.string().describe("备注"),
  tags: z.array(z.string()).describe("标签数组"),
  lines: z.array(z.number()).describe("六爻值数组（0-3）"),
  chart: liuyaoChartSchema.describe("卦象"),
  yongTarget: z.string().describe("求测对象"),
  yong: liuyaoYongSchema.describe("用神"),
  savedAt: z.number().describe("保存时间戳"),
  id: z.number().describe("记录 ID"),
});

/** View/BatchView 共用的 computed 扩展 */
const _liuyaoComputed = z
  .object({
    divinationTime: z.string(),
    chart: liuyaoChartSchema,
    yong: liuyaoYongSchema,
    person: PERSON_SUMMARY_SCHEMA,
    hbarData: z.object({
      years: z.array(z.object({ year: z.number(), gz: z.string(), age: z.number() })),
      activeYearIdx: z.number(),
      months: z.array(
        z.object({
          month: z.number(),
          leap: z.boolean(),
          label: z.string(),
          solarLabel: z.string(),
          gz: z.string(),
        }),
      ),
      activeMonthIdx: z.number(),
      days: z.array(
        z.object({
          day: z.number(),
          label: z.string(),
          solarLabel: z.string(),
          gz: z.string(),
        }),
      ),
      activeDayIdx: z.number(),
      hours: z.array(z.object({ hour: z.number(), label: z.string(), gz: z.string() })),
      activeHourIdx: z.number(),
    }),
    vigorColumns: z.object({
      columns: z.array(z.array(z.string())),
      changedColumns: z.array(z.array(z.string())),
      columnBranches: z.array(z.string()),
      columnRoles: z.array(z.string()),
      visible: z.object({
        yearly: z.boolean(),
        monthly: z.boolean(),
        daily: z.boolean(),
        hourly: z.boolean(),
      }),
    }),
  })
  .describe("计算数据");

/* ---- Function 定义 ---- */

/** LiuYaoCreate schema（独立定义，避免 createConfirmHandler 自引用） */
const _liuyaoCreateSchema = z.object({
  personId: PERSON_ID_OPTIONAL,
  question: withMeta(z.string(), { example: "这笔生意能不能做" }).describe(
    "所占问题——用户想要占卜的核心问题，要具体明确",
  ),
  note: withMeta(z.string(), { example: "客户询问合作前景" }).optional().describe("备注——补充说明"),
  background: withMeta(z.string(), { example: "客户与对方已洽谈三月" })
    .optional()
    .describe("背景信息——问题的上下文，有助于更准确的分析"),
  tags: z.array(z.string()).optional().describe("标签——用于分类检索，如 ['求财', '合作']"),
  lines: z
    .array(z.number().int().min(0).max(3))
    .min(6)
    .max(6)
    .optional()
    .describe(
      "六爻值数组（6 个 0-3 的整数），省略则自动摇卦。0=老阴,1=少阳,2=少阴,3=老阳。如：[1,2,3,0,1,2]",
    ),
  yongTarget: withMeta(z.enum(["自占", "父母", "子女", "配偶", "兄弟", "医药"]), {
    example: "自占",
  })
    .optional()
    .describe(
      "求测对象——决定用神选取，默认'自占'。自占=问自己的事，父母=问长辈/文书，子女=问晚辈，配偶=问伴侣，兄弟=问朋友同事，医药=问健康/疾病",
    ),
  confirmed: CONFIRM_FIELD,
});

export const liuyaoCreateFunction = {
  name: "LiuYaoCreate",
  description:
    "为命主起一卦六爻并以当前时间落库保存，返回带 id 的起卦记录。" +
    "\n\n" +
    "⚠️ 安全机制：首次调用会返回操作摘要（不起卦），" +
    "你需要将摘要展示给用户并获得确认后，再次调用并传入 confirmed: true 才会真正起卦。" +
    "\n\n" +
    "使用场景：用户想要占卜某个具体问题（如'这笔生意能不能做''考试能否通过'），需要起一卦六爻进行分析。" +
    "六爻擅长占断具体事件，与大六壬、紫微斗数互补。" +
    "\n\n" +
    "起卦后系统会自动保存记录，后续可通过 LiuYaoList/LiuYaoView 查看。" +
    "\n\n" +
    "使用示例：" +
    "(1) LiuYaoCreate({ question: '这笔生意能不能做？', tags: ['求财', '合作'] }) — 默认人物起卦（自动摇卦）；" +
    "(2) LiuYaoCreate({ personId: 1, question: '考试能否通过？', lines: [1,2,3,0,1,2], yongTarget: '自占' }) — 指定人物 + 手动六爻值；" +
    "(3) LiuYaoCreate({ question: '健康状况如何？', yongTarget: '医药' }) — 指定求测对象。" +
    "\n\n" +
    "注意：起卦时间默认为当前时间，系统自动记录，无需手动指定。" +
    "六爻值数组（lines）可省略，系统会自动摇卦生成。",
  zodSchema: _liuyaoCreateSchema,
  handler: createConfirmHandler(
    _liuyaoCreateSchema,
    "六爻起卦",
    input => {
      const linesInfo = input.lines ? `手动六爻：[${input.lines.join(",")}]` : "自动摇卦";
      return `即将起卦：「${input.question}」（${linesInfo}，求测对象：${input.yongTarget ?? "自占"}）${input.tags?.length ? `，标签：${input.tags.join("、")}` : ""}`;
    },
    params => {
      const createParams = {
        ...params,
        lines: params.lines as SixLines | undefined,
      };
      return peepApi().LiuYaoCreate(createParams);
    },
  ),
  returns: { zodSchema: liuyaoRecordSchema },
};

/** LiuYaoList 参数 schema（独立定义，避免重复调用工厂函数） */
const _liuyaoListFiltersSchema = createListFiltersSchema("问题、备注、背景");

export const liuyaoListFunction = {
  name: "LiuYaoList",
  description:
    "列出命主的六爻起卦记录，支持关键字搜索、标签过滤与分页。" +
    "\n\n" +
    "使用场景：" +
    "(1) 查看历史起卦记录；" +
    "(2) 按关键字搜索特定问题——如搜索'合作'找到所有与合作相关的起卦；" +
    "(3) 按标签过滤——如只查看'求财'类起卦。" +
    "\n\n" +
    "返回分页结果，包含记录列表和总数。如需查看某条记录的完整卦象详情，请调用 LiuYaoView。",
  zodSchema: _liuyaoListFiltersSchema,
  handler: createPassthroughHandler(_liuyaoListFiltersSchema, p => peepApi().LiuYaoList(p)),
  returns: {
    zodSchema: z.object({
      records: z.array(liuyaoRecordSchema).describe("起卦记录数组"),
      total: z.number().describe("总数"),
    }),
  },
};

/** LiuYaoView 参数 schema（独立定义，避免 handler 自引用） */
const _liuyaoViewSchema = z.object({
  personId: PERSON_ID_OPTIONAL,
  recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
    "起卦记录 ID——从 LiuYaoList 返回的 records 中获取",
  ),
});

export const liuyaoViewFunction = {
  name: "LiuYaoView",
  description:
    "查看指定六爻起卦记录的完整卦象详情。" +
    "\n\n" +
    "使用场景：从 LiuYaoList 获取记录列表后，想深入分析某条起卦的完整卦象（卦名、宫位、世应、六爻详情、变卦、用神、旺衰等）。" +
    "\n\n" +
    "返回数据包含：" +
    "(1) 起卦基本信息（问题、时间、标签等）；" +
    "(2) 完整排盘结果（卦名、宫位、世应、六爻干支/五行/六亲/六神/旬空、变卦）；" +
    "(3) 用神定位结果（用神六亲、爻位、五行、旺衰状态）；" +
    "(4) hbar 运限拨盘数据（流年/流月/流日/流时列表）；" +
    "(5) 旺衰列数据（太岁/月建/日辰/流时对六爻的旺衰影响）；" +
    "(6) 关联命主信息。" +
    "\n\n" +
    "⚠️ 性能提示：如需查看多个记录，请使用 LiuYaoBatchView 批量查看（减少 UI 操作次数，避免超时）。" +
    "\n\n" +
    "示例：LiuYaoView({ recordId: 123 }) — 查看 ID 为 123 的起卦详情。",
  zodSchema: _liuyaoViewSchema,
  handler: createPassthroughHandler(
    _liuyaoViewSchema,
    (p: { personId?: number; recordId: number }) => peepApi().LiuYaoView(p),
  ),
  returns: {
    zodSchema: liuyaoRecordSchema.extend({ computed: _liuyaoComputed }),
  },
};

/** LiuYaoDelete schema（独立定义，避免 createConfirmHandler 自引用） */
const _liuyaoDeleteSchema = z.object({
  personId: PERSON_ID_OPTIONAL,
  recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
    "起卦记录 ID——从 LiuYaoList 返回的 records 中获取",
  ),
  confirmed: CONFIRM_FIELD,
});

export const liuyaoDeleteFunction = {
  name: "LiuYaoDelete",
  description:
    "删除指定的六爻起卦记录。" +
    "\n\n" +
    "⚠️ 不可逆操作：首次调用会返回操作摘要（不执行删除），" +
    "你必须明确告知用户此操作不可撤销，获得确认后再传入 confirmed: true 调用。" +
    "\n\n" +
    "使用场景：用户要求删除某条起卦记录时使用。" +
    "\n\n" +
    "示例：LiuYaoDelete({ recordId: 123 }) — 删除 ID 为 123 的起卦记录。",
  zodSchema: _liuyaoDeleteSchema,
  handler: createConfirmHandler(
    _liuyaoDeleteSchema,
    "删除六爻起卦记录",
    input => `即将删除起卦记录 #${input.recordId}（此操作不可撤销）`,
    params => peepApi().LiuYaoDelete(params, { skipUI: true }),
    { irreversible: true },
  ),
  returns: { zodSchema: z.void().describe("删除结果：无返回数据") },
};

/** BatchView 参数 schema（独立定义，避免 TypeScript 推断循环引用） */
const _liuyaoBatchViewSchema = z.object({
  personId: PERSON_ID_OPTIONAL,
  recordIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(20)
    .describe("起卦记录 ID 数组——要查看的记录 ID 列表，最多 20 个"),
});

export const liuyaoBatchViewFunction = {
  name: "LiuYaoBatchView",
  description:
    "批量查看多个六爻起卦记录的完整详情——一次调用查看多个记录，显著减少 UI 操作时间。" +
    "\n\n" +
    "使用场景：" +
    "(1) 需要对比多个起卦记录时；" +
    "(2) 需要连续分析多个相关问题时；" +
    "(3) 避免因多次单独调用 LiuYaoView 导致超时。" +
    "\n\n" +
    "示例：LiuYaoBatchView({ recordIds: [1, 2, 3] }) — 批量查看 ID 为 1,2,3 的起卦记录。",
  zodSchema: _liuyaoBatchViewSchema,
  handler: createBatchViewHandler(
    _liuyaoBatchViewSchema,
    "recordIds",
    "recordId",
    (params: { personId?: number; recordId: number }) => peepApi().LiuYaoView(params),
    "records",
  ),
  returns: {
    zodSchema: z.object({
      records: z
        .array(liuyaoRecordSchema.extend({ computed: _liuyaoComputed }))
        .describe("起卦记录详情数组"),
      count: z.number().describe("记录数量"),
    }),
  },
};

/** UpdateTags 参数 schema（独立定义，避免 TypeScript 推断循环引用） */
const _liuyaoUpdateTagsSchema = z.object({
  recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
    "起卦记录 ID——从 LiuYaoList 返回的 records 中获取",
  ),
  tags: z.array(z.string()).describe("新的标签列表（会完全替换原有标签）"),
});

/** 更新六爻起卦记录的标签 */
export const liuyaoUpdateTagsFunction = {
  name: "LiuYaoUpdateTags",
  description:
    "更新六爻起卦记录的标签（仅修改元数据，不修改卦象数据）。" +
    "\n\n" +
    "使用场景：用户要求为起卦记录添加/修改/删除标签时使用。" +
    "\n\n" +
    "示例：LiuYaoUpdateTags({ recordId: 123, tags: ['财运', '合作'] }) — 更新记录标签。",
  zodSchema: _liuyaoUpdateTagsSchema,
  handler: createMetadataUpdateHandler(
    _liuyaoUpdateTagsSchema,
    (params: { recordId: number; tags: string[] }) => peepApi().LiuYaoUpdateTags(params),
  ),
  returns: { zodSchema: liuyaoRecordSchema.describe("更新后的起卦记录") },
};

/** UpdateNote 参数 schema（独立定义，避免 TypeScript 推断循环引用） */
const _liuyaoUpdateNoteSchema = z.object({
  recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
    "起卦记录 ID——从 LiuYaoList 返回的 records 中获取",
  ),
  note: z.string().optional().describe("新的备注（可选）"),
  background: z.string().optional().describe("新的背景信息（可选）"),
});

/** 更新六爻起卦记录的备注和背景 */
export const liuyaoUpdateNoteFunction = {
  name: "LiuYaoUpdateNote",
  description:
    "更新六爻起卦记录的备注和背景信息（仅修改元数据，不修改卦象数据）。" +
    "\n\n" +
    "使用场景：用户要求为起卦记录添加/修改备注或背景信息时使用。" +
    "\n\n" +
    "示例：LiuYaoUpdateNote({ recordId: 123, note: '后续反馈：准确' }) — 更新备注。",
  zodSchema: _liuyaoUpdateNoteSchema,
  handler: createMetadataUpdateHandler(
    _liuyaoUpdateNoteSchema,
    (params: { recordId: number; note?: string; background?: string }) =>
      peepApi().LiuYaoUpdateNote(params),
  ),
  returns: { zodSchema: liuyaoRecordSchema.describe("更新后的起卦记录") },
};
