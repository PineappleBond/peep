/**
 * 大六壬（DaLiuRen）Function 定义
 *
 * 起课与占卜——适合具体事件的占断。
 */
import { withMeta, z } from "@rtc-agent/component";
import {
  CONFIRM_FIELD,
  PERSON_ID_OPTIONAL,
  peepApi,
  needsConfirm,
  extractConfirmed,
  createBatchViewHandler,
  createMetadataUpdateHandler,
} from "./shared";

/* ---- 共享 Schema ---- */

const _fourPillars = z
  .object({
    yearStem: z.number().describe("年干索引（0-9）"),
    yearBranch: z.number().describe("年支索引（0-11）"),
    monthStem: z.number().describe("月干索引"),
    monthBranch: z.number().describe("月支索引"),
    dayStem: z.number().describe("日干索引"),
    dayBranch: z.number().describe("日支索引"),
    hourStem: z.number().describe("时干索引"),
    hourBranch: z.number().describe("时支索引"),
    yearPillar: z.string().describe("年柱干支，如'丙午'"),
    monthPillar: z.string().describe("月柱干支，如'丁酉'"),
    dayPillar: z.string().describe("日柱干支，如'乙巳'"),
    hourPillar: z.string().describe("时柱干支，如'癸未'"),
  })
  .describe("四柱（年月日时干支）");

const _monthGeneral = z
  .object({
    branch: z.number().describe("月将地支索引"),
    name: z.string().describe("月将名称，如'天罡'"),
  })
  .describe("月将");

const _fourLessons = z
  .array(
    z.object({
      upper: z.number().describe("上神地支索引"),
      lower: z.number().describe("下神（地支或天干索引）"),
      lowerType: z.enum(["stem", "branch"]).describe("下神类型：stem=天干, branch=地支"),
    }),
  )
  .describe("四课数组，每课含上神、下神及下神类型");

const _xunKong = z
  .object({
    xunHead: z.number().describe("旬首地支索引"),
    void1: z.number().describe("空亡1 地支索引"),
    void2: z.number().describe("空亡2 地支索引"),
  })
  .describe("旬空（甲旬 head 与两个空亡地支）");

const _threeTransmissions = z
  .object({
    initial: z.number().describe("初传地支索引"),
    middle: z.number().describe("中传地支索引"),
    final: z.number().describe("末传地支索引"),
    method: z.string().describe("三传取法名称，如'重审'/'比用'/'涉害'等"),
    trace: z.array(z.string()).describe("三传推算过程描述"),
  })
  .describe("三传（初/中/末传及取法）");

const _twelveGenerals = z
  .array(
    z.object({
      position: z.number().describe("所在地支位置索引（0-11）"),
      general: z.number().describe("天将编号"),
      name: z.string().describe("天将名称，如'玄武'/'太阴'"),
    }),
  )
  .describe("十二天将数组，含位置、编号、名称");

const _shenSha = z
  .array(
    z.object({
      name: z.string().describe("神煞名称，如'岁破'/'丧门'"),
      branch: z.number().describe("神煞所在地支索引"),
      type: z.enum(["吉", "凶"]).describe("吉凶类型"),
      description: z.string().describe("神煞含义描述"),
    }),
  )
  .describe("神煞数组");

const _relations = z
  .array(
    z.object({
      type: z.string().describe("关系类型：刑/冲/合/害/破等"),
      branches: z.array(z.number()).describe("涉及的地支索引数组"),
      description: z.string().describe("关系描述，如'丑戌恃势之刑'"),
    }),
  )
  .describe("地支刑冲合害破关系数组");

const _keJing = z
  .array(
    z.object({
      rule: z.object({
        code: z.string().describe("课经规则代码，如'chongshen'"),
        name: z.string().describe("课经名称，如'重审课'"),
        group: z.string().describe("规则分组，如'三传'/'四课'"),
        description: z.string().describe("规则详细描述"),
      }),
      evidence: z.array(z.string()).describe("匹配该规则的证据描述"),
    }),
  )
  .describe("课经数组，含规则定义和匹配证据");

const _fate = z
  .object({
    mingGong: z.number().describe("命宫地支索引"),
    xingNian: z.number().describe("行年地支索引"),
    xingNianStem: z.number().describe("行年天干索引"),
    xingNianIndex: z.number().describe("行年索引位置"),
    age: z.number().describe("年龄"),
  })
  .describe("命宫、行年等命运信息");

/** 大六壬完整课式 result 的 Zod Schema */
const daliurenResultSchema = z
  .object({
    calculationTime: z.string().describe("起课时间字符串"),
    fourPillars: _fourPillars,
    monthGeneral: _monthGeneral,
    earthBoard: z.array(z.number()).describe("地盘数组（地支索引）"),
    heavenBoard: z.array(z.number()).describe("天盘数组（地支索引）"),
    fourLessons: _fourLessons,
    xunKong: _xunKong,
    threeTransmissions: _threeTransmissions,
    twelveGenerals: _twelveGenerals,
    wangXiang: z
      .record(z.string(), z.string())
      .describe("旺相休囚死，键为地支索引(0-11)，值为状态名（旺/相/休/囚/死）"),
    liuQin: z
      .record(z.string(), z.string())
      .describe("六亲，键为地支索引(0-11)，值为六亲名（父母/妻财/兄弟/子孙/官鬼）"),
    xunDun: z.record(z.string(), z.string()).describe("旬遁，键为地支索引，值为天干名"),
    riDun: z.array(z.string()).describe("日遁天干数组"),
    shenSha: _shenSha,
    relations: _relations,
    keJing: _keJing,
    biFa: z
      .array(
        z.object({
          rule: z.object({
            code: z.string().describe("规则代码，如 'bifa.01'"),
            name: z.string().describe("规则名称，如'前后引从升迁吉'"),
            description: z.string().describe("规则描述"),
          }),
          evidence: z.array(z.string()).describe("命中证据（人可读的字符串列表）"),
        }),
      )
      .describe("毕法数组（课体判定结果）"),
    jianChu: z
      .record(z.string(), z.string())
      .describe("建除十二神，键为地支索引，值为建除名（建/除/满/平/定/执/破/危/成/收/开/闭）"),
    naYin: z
      .record(z.string(), z.string())
      .describe("纳音五行，键为地支索引，值为纳音名（如'路旁土'）"),
    calculationTrace: z.array(z.string()).describe("推算过程步骤描述"),
    fate: _fate,
  })
  .describe("大六壬完整课式数据");

/** 起课记录基础 schema（不含 computed） */
const daliurenRecordSchema = z
  .object({
    personId: z.number().describe("命主 ID"),
    calculationTime: z.string().describe("起课时间，格式 'YYYY-MM-DD HH:mm:ss'"),
    question: z.string().describe("所占问题"),
    note: z.string().describe("备注"),
    background: z.string().describe("背景信息"),
    tags: z.array(z.string()).describe("标签数组"),
    result: daliurenResultSchema,
    savedAt: z.number().describe("保存时间戳（毫秒）"),
    id: z.number().describe("起课记录 ID"),
  })
  .describe("大六壬起课记录");

/** View/BatchView 共用的 computed 扩展 */
const _daliurenComputed = z
  .object({
    calculationTime: z.string().describe("起课时间"),
    result: daliurenResultSchema,
    person: z
      .object({
        name: z.string().describe("命主姓名"),
        gender: z.string().describe("性别"),
        date: z.string().describe("出生日期"),
        timeIndex: z.number().describe("时辰索引"),
        savedAt: z.number().describe("保存时间戳"),
        isDefault: z.boolean().describe("是否默认人物"),
        id: z.number().describe("命主 ID"),
      })
      .describe("关联命主信息"),
  })
  .describe("附加计算数据（含 result 副本和关联命主）");

/* ---- Function 定义 ---- */

export const daliurenCreateFunction = {
  name: "DaLiuRenCreate",
  description:
    "为命主起一课大六壬并以当前时间落库保存，返回带 id 的起课记录。" +
    "\n\n" +
    "⚠️ 安全机制：首次调用会返回操作摘要（不执行起课），" +
    "你需要将摘要展示给用户并获得确认后，再次调用并传入 confirmed: true 才会真正起课。" +
    "\n\n" +
    "使用场景：用户想要占卜某个具体问题（如'这笔生意能不能做''考试能否通过'），需要起一课大六壬进行分析。" +
    "大六壬擅长占断具体事件，与紫微斗数看人生整体格局互补。" +
    "\n\n" +
    "起课后系统会自动保存记录，后续可通过 DaLiuRenList/DaLiuRenView 查看。" +
    "\n\n" +
    "使用示例：" +
    "(1) DaLiuRenCreate({ question: '这笔生意能不能做？', tags: ['求财', '合作'] }) — 默认人物起课；" +
    "(2) DaLiuRenCreate({ personId: 1, question: '考试能否通过？', background: '准备了三个月' }) — 指定人物起课。" +
    "\n\n" +
    "注意：起课时间默认为当前时间，系统自动记录，无需手动指定。",
  zodSchema: z.object({
    personId: PERSON_ID_OPTIONAL,
    question: withMeta(z.string(), { example: "这笔生意能不能做" }).describe(
      "所占问题——用户想要占卜的核心问题，要具体明确",
    ),
    note: withMeta(z.string(), { example: "客户询问合作前景" })
      .optional()
      .describe("备注——补充说明"),
    background: withMeta(z.string(), { example: "客户与对方已洽谈三月" })
      .optional()
      .describe("背景信息——问题的上下文，有助于更准确的分析"),
    tags: z.array(z.string()).optional().describe("标签——用于分类检索，如 ['求财', '合作']"),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type CreateInput = z.infer<typeof daliurenCreateFunction.zodSchema>;
    const parsedArgs = daliurenCreateFunction.zodSchema.parse(args) as CreateInput;
    if (!parsedArgs.confirmed) {
      return needsConfirm(
        "大六壬起课",
        `即将起课：「${parsedArgs.question}」${parsedArgs.tags?.length ? `，标签：${parsedArgs.tags.join("、")}` : ""}`,
      );
    }
    const params = extractConfirmed(parsedArgs);
    return peepApi().DaLiuRenCreate(params);
  },
  returns: { zodSchema: daliurenRecordSchema },
};

export const daliurenListFunction = {
  name: "DaLiuRenList",
  description:
    "列出命主的大六壬起课记录，支持关键字搜索、标签过滤与分页。" +
    "\n\n" +
    "使用场景：" +
    "(1) 查看历史起课记录；" +
    "(2) 按关键字搜索特定问题——如搜索'合作'找到所有与合作相关的起课；" +
    "(3) 按标签过滤——如只查看'求财'类起课。" +
    "\n\n" +
    "返回分页结果，包含记录列表和总数。如需查看某条记录的完整课式详情，请调用 DaLiuRenView。",
  zodSchema: z.object({
    personId: PERSON_ID_OPTIONAL,
    searchText: withMeta(z.string(), { example: "合作" })
      .optional()
      .describe("搜索关键字——匹配问题、备注、背景"),
    tags: z.array(z.string()).optional().describe("按标签过滤——只返回包含指定标签的记录"),
    page: withMeta(z.number().int().positive(), { example: 1 }).optional().describe("页码，默认 1"),
    pageSize: withMeta(z.number().int().positive(), { example: 20 })
      .optional()
      .describe("每页条数，默认 20"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = daliurenListFunction.zodSchema.parse(args);
    return peepApi().DaLiuRenList(parsedArgs);
  },
  returns: {
    zodSchema: z.object({
      records: z
        .array(daliurenRecordSchema)
        .describe("起课记录数组（每项同 DaLiuRenCreate 返回结构）"),
      total: z.number().describe("记录总数"),
    }),
  },
};

export const daliurenViewFunction = {
  name: "DaLiuRenView",
  description:
    "查看指定大六壬起课记录的完整课式详情。" +
    "\n\n" +
    "使用场景：从 DaLiuRenList 获取记录列表后，想深入分析某条起课的完整课式（四课、三传、天地盘、神煞等）。" +
    "\n\n" +
    "返回数据包含：" +
    "(1) 起课基本信息（问题、时间、标签等）；" +
    "(2) 完整排盘结果（四课、三传、天地盘、神煞、六亲等）；" +
    "(3) 关联命主信息。" +
    "\n\n" +
    "⚠️ 性能提示：如需查看多个记录，请使用 DaLiuRenBatchView 批量查看（减少 UI 操作次数，避免超时）。" +
    "\n\n" +
    "示例：DaLiuRenView({ recordId: 123 }) — 查看 ID 为 123 的起课详情。",
  zodSchema: z.object({
    personId: PERSON_ID_OPTIONAL,
    recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
      "起课记录 ID——从 DaLiuRenList 返回的 records 中获取",
    ),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = daliurenViewFunction.zodSchema.parse(args);
    return peepApi().DaLiuRenView(parsedArgs);
  },
  returns: {
    zodSchema: daliurenRecordSchema
      .extend({ computed: _daliurenComputed })
      .describe("起课记录详情（含 computed 字段）"),
  },
};

export const daliurenDeleteFunction = {
  name: "DaLiuRenDelete",
  description:
    "删除指定的大六壬起课记录。" +
    "\n\n" +
    "⚠️ 不可逆操作：首次调用会返回操作摘要（不执行删除），" +
    "你必须明确告知用户此操作不可撤销，获得确认后再传入 confirmed: true 调用。" +
    "\n\n" +
    "使用场景：用户要求删除某条起课记录时使用。" +
    "\n\n" +
    "示例：DaLiuRenDelete({ recordId: 123 }) — 删除 ID 为 123 的起课记录。",
  zodSchema: z.object({
    personId: PERSON_ID_OPTIONAL,
    recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
      "起课记录 ID——从 DaLiuRenList 返回的 records 中获取",
    ),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type DeleteInput = z.infer<typeof daliurenDeleteFunction.zodSchema>;
    const parsedArgs = daliurenDeleteFunction.zodSchema.parse(args) as DeleteInput;
    if (!parsedArgs.confirmed) {
      return needsConfirm(
        "删除大六壬起课记录",
        `即将删除起课记录 #${parsedArgs.recordId}（此操作不可撤销）`,
        "请明确告知用户此操作不可撤销，确认后再次调用并传入 confirmed: true",
      );
    }
    const params = extractConfirmed(parsedArgs);
    return peepApi().DaLiuRenDelete(params, { skipUI: true });
  },
  returns: { zodSchema: z.void().describe("删除成功无返回数据") },
};

/** BatchView 参数 schema（独立定义，避免循环引用） */
const _daliurenBatchViewSchema = z.object({
  personId: PERSON_ID_OPTIONAL,
  recordIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(20)
    .describe("起课记录 ID 数组——要查看的记录 ID 列表，最多 20 个"),
});

export const daliurenBatchViewFunction = {
  name: "DaLiuRenBatchView",
  description:
    "批量查看多个大六壬起课记录的完整详情——一次调用查看多个记录，显著减少 UI 操作时间。" +
    "\n\n" +
    "使用场景：" +
    "(1) 需要对比多个起课记录时；" +
    "(2) 需要连续分析多个相关问题时；" +
    "(3) 避免因多次单独调用 DaLiuRenView 导致超时。" +
    "\n\n" +
    "示例：DaLiuRenBatchView({ recordIds: [1, 2, 3] }) — 批量查看 ID 为 1,2,3 的起课记录。",
  zodSchema: _daliurenBatchViewSchema,
  handler: createBatchViewHandler(
    _daliurenBatchViewSchema,
    "recordIds",
    "recordId",
    (params: { personId?: number; recordId: number }) => peepApi().DaLiuRenView(params),
    "records",
  ),
  returns: {
    zodSchema: z.object({
      records: z
        .array(daliurenRecordSchema.extend({ computed: _daliurenComputed }))
        .describe("起课记录详情数组（每项同 DaLiuRenView 返回结构）"),
      count: z.number().describe("实际返回的记录数量"),
    }),
  },
};

/** UpdateTags 参数 schema（独立定义，避免循环引用） */
const _daliurenUpdateTagsSchema = z.object({
  recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
    "起课记录 ID——从 DaLiuRenList 返回的 records 中获取",
  ),
  tags: z.array(z.string()).describe("新的标签列表（会完全替换原有标签）"),
});

/** 更新大六壬起课记录的标签 */
export const daliurenUpdateTagsFunction = {
  name: "DaLiuRenUpdateTags",
  description:
    "更新大六壬起课记录的标签（仅修改元数据，不修改卦象数据）。" +
    "\n\n" +
    "使用场景：用户要求为起课记录添加/修改/删除标签时使用。" +
    "\n\n" +
    "示例：DaLiuRenUpdateTags({ recordId: 123, tags: ['财运', '合作'] }) — 更新记录标签。",
  zodSchema: _daliurenUpdateTagsSchema,
  handler: createMetadataUpdateHandler(
    _daliurenUpdateTagsSchema,
    (params: { recordId: number; tags: string[] }) => peepApi().DaLiuRenUpdateTags(params),
  ),
  returns: { zodSchema: daliurenRecordSchema.describe("更新后的起课记录") },
};

/** UpdateNote 参数 schema（独立定义，避免循环引用） */
const _daliurenUpdateNoteSchema = z.object({
  recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
    "起课记录 ID——从 DaLiuRenList 返回的 records 中获取",
  ),
  note: z.string().optional().describe("新的备注（可选）"),
  background: z.string().optional().describe("新的背景信息（可选）"),
});

/** 更新大六壬起课记录的备注和背景 */
export const daliurenUpdateNoteFunction = {
  name: "DaLiuRenUpdateNote",
  description:
    "更新大六壬起课记录的备注和背景信息（仅修改元数据，不修改卦象数据）。" +
    "\n\n" +
    "使用场景：用户要求为起课记录添加/修改备注或背景信息时使用。" +
    "\n\n" +
    "示例：DaLiuRenUpdateNote({ recordId: 123, note: '后续反馈：准确' }) — 更新备注。",
  zodSchema: _daliurenUpdateNoteSchema,
  handler: createMetadataUpdateHandler(
    _daliurenUpdateNoteSchema,
    (params: { recordId: number; note?: string; background?: string }) =>
      peepApi().DaLiuRenUpdateNote(params),
  ),
  returns: { zodSchema: daliurenRecordSchema.describe("更新后的起课记录") },
};
