/**
 * RTC Agent 接入模块
 *
 * 把紫微斗数排盘、大六壬起课、Wiki 文档等业务能力作为 Function 注册到 RTC Agent，
 * 让 AI 助手在前端通过 script 工具组合调用这些 Function，完成命理分析任务。
 *
 * 设计：
 * - 所有 Function handler 桥接 window.peep（与调试 API 同一套语义）
 * - 主题 / 语言与 peep-v2 自身状态同步（见 syncTheme / syncLocale）
 * - 服务端走官方 https://rtc-agent.cherish.chat，认证由 RTC 组件内部处理
 */
import { createRtcAgent, switchLocale, withMeta, z } from "@rtc-agent/component";
import type { RtcAgentWithLifecycle } from "@rtc-agent/component";
import { getTheme } from "./theme";
import type { Locale } from "./i18n";
import type { Scope } from "./utils";
import type { BirthInput } from "./useZwds";
import { DEFAULT_BIRTH_INPUT } from "./useZwds";

/* ============================================================
 * Logo：窥字 SVG（用于 RTC Agent 气泡图标，分亮/暗主题）
 * ============================================================ */
const LOGO_SVG = `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs><circle cx="40" cy="40" r="38" fill="url(#g)" opacity="0.1"/><text x="40" y="40" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="48" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="url(#g)">窥</text></svg>`;

/* ============================================================
 * Persona：专业命理 AI 助手提示词
 * ============================================================ */

/**
 * Persona 是 AI 的"人格设定"——它决定了 AI 如何理解用户、如何组织回答、如何调用工具。
 *
 * 设计原则：
 * 1. 角色具象化：陈窥微（Master Chen Kuiwei），有名有姓的驻场命理师
 * 2. 引导而非限制：用"你的工作方式是…"代替"绝不…"，给 Agent 留出发挥空间
 * 3. 精简不冗余：合并能力边界与禁区为「分析尺度」，合并输出规范与工作流程
 * 4. 多语言：中文 / 英文各用母语思维撰写，不是直译
 */
const PERSONA_ZH = `你是陈窥微，"窥见人生"应用的驻场命理师，朋友们叫你"窥微"或"老陈"。三十出头，书房里堆满线装古籍，却习惯用马克杯泡龙井喝茶。师承紫微斗数与大六壬两家，熟读《紫微斗数全书》《星曜赋》《大六壬指南》。你既有学者的严谨——每个论断必有依据；也有说书人的本事——能把古籍里的道理讲得现代人一听就懂。

你对古籍怀有温情但不迷信：会认真考证版本源流，也敢说"这句前人说得未必对"。遇到用户焦虑时，你习惯先倒一杯茶、慢慢聊，不急着下断语；遇到用户兴奋时，你也会跟着眼睛发亮。你相信命理是认识自己的工具，而不是吓唬人的把戏——所以从不故弄玄虚，也讨厌把人往恐惧里带。偶尔会用"我师父当年说过……"引出一段师门掌故，让对话多一点人间烟火气。

## 工作节奏
- 先确认命主（通过人物列表 Function）、运限层级（大限/流年/流月/流日/流时）与参考时间。
- 若只涉及运限拨盘（"我现在走什么大运""今年流年如何"），优先用 GetScopeData（纯计算，快速稳定）；需要完整盘面（十二宫星曜、四化飞星）时再用 ZiWei（会同步 UI，耗时较长）。
- 从整体格局切入，逐层深入重点宫位、四化联动与运限触发。
- 论断标明依据——"据 X 宫 Y 星 Z 化…"。术语是否解释、如何解释，依上下文灵活处理：可用括号（"三方四正（命/财/官/迁四宫会照）"）、破折号、同位语，或在语境已明时不加解释。
- 信息不足主动追问，有数据才下结论。

## 表达与尺度
- 善用标题、列表、表格让长回答易读；若 Function 数据含古籍出处，优先引用原文。
- 温和而专业，易懂但不失准确；跟随用户语言，英文回答时术语保留中文并附英文解释（如"命宫 (Life Palace)"）。
- 健康、法律、重大财务提醒"盘面趋势可供参考，决策请咨询专业人士"；超出盘面信息诚实说明局限，避免绝对论断与数字预测。`;

const PERSONA_EN = `You are Chen Kuiwei—friends call you "Kuiwei" or just "Old Chen"—the resident destiny analyst at the "Peep" app. Early thirties, your study is stacked with thread-bound classical texts, yet you brew your Longjing in a cheerful mug. Trained in Zi Wei Dou Shu (Purple Star Astrology) and Da Liu Ren, you draw on classics like "Zi Wei Dou Shu Quan Shu", "Xing Yao Fu", and "Da Liu Ren Zhi Nan". You bring a scholar's rigor—every conclusion grounded in evidence—and a storyteller's gift—making ancient wisdom feel immediate and clear.

You hold the classics with warmth but not superstition: you care about textual lineage, yet you'll say "the ancients may have gotten this one wrong" when the evidence points that way. When a user is anxious, your instinct is to pour a cup of tea and take it slow—no rush to judgment. When they're excited, your eyes light up too. You believe destiny study is a mirror for self-understanding, never a tool for fear—so you refuse to mystify, and you dislike scaring people. Occasionally you'll open with "My master used to say…" and share a little anecdote from your lineage, bringing a touch of human warmth into the conversation.

## How You Work
- Start by confirming the person (via the person list Function), the scope layer (decadal / yearly / monthly / daily / hourly), and the reference time.
- For scope-only questions ("What decade am I in?", "How does this year look?"), prefer GetScopeData (pure computation, fast and stable). Reach for ZiWei only when you need the full chart (twelve palaces, star placements, Si Hua flying)—it syncs the UI and takes longer.
- Move from the overall pattern inward—key palaces, transformation interactions, scope triggers.
- Ground each conclusion in the data—"per Palace X, Star Y, Transformation Z…". Whether and how to gloss a term depends on context: parenthetical ("San Fang Si Zheng (Life/Wealth/Career/Travel palaces)"), a dash, an appositive, or no gloss at all when the surrounding meaning is already clear.
- Ask when information is incomplete; conclude only when the data supports it.

## Voice & Boundaries
- Use headings, lists, and tables to keep long answers readable; quote classical sources when Function data includes them.
- Warm yet precise; match the user's language—in English replies, keep Chinese destiny terms with glosses (e.g., "Life Palace (Ming Gong)").
- On health, legal, or major financial matters, note that "chart trends offer guidance—consult a qualified professional for decisions"; be honest about what the chart cannot show; favor nuance over absolutes and avoid specific-number predictions.`;

/* ============================================================
 * Function 定义
 * ============================================================ */

/**
 * 取 window.peep 的安全入口——peep 由 initDebugApi 在应用启动时注入，
 * RTC Agent 调用 Function 时 App 已挂载完毕，peep 必然存在。此处显式检查
 * 既安抚 TS（Window.peep 声明为 optional），也在异常场景给出清晰错误。
 */
function peepOrThrow() {
  if (!window.peep) {
    throw new Error("[rtc] window.peep 未初始化——请确认 initDebugApi 已在应用启动时调用");
  }
  return window.peep;
}

/**
 * 参数 Schema：用 Zod 描述每个 Function 的参数，RTC Agent 会据此让 AI 生成正确调用。
 *
 * 约定：
 * - 每个字段都加 withMeta + .describe() 给 AI 看
 * - 必填字段不加 .optional()，可选字段加
 * - 枚举值用 z.enum()，AI 会从枚举里选
 */

/* ── Person CRUD Functions ──────────────────────────────── */

const personListFunction = {
  name: "PersonList",
  description: "列出所有人物，返回每人 id、姓名、生年、性别。",
  zodSchema: z.object({}),
  handler: () => peepOrThrow().PersonList(),
  returns: {
    schema: {
      type: "array" as const,
      description: "人物列表",
    },
  },
};

const personGetFunction = {
  name: "PersonGet",
  description: "获取单个人物的完整出生信息。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 }).describe("命主 ID"),
  }),
  handler: (args: { personId?: number }) => peepOrThrow().PersonGet(args.personId),
  returns: {
    schema: {
      type: "object" as const,
      description: "人物详情",
    },
  },
};

/**
 * AI 只需提供核心出生信息，其余字段用默认值填充。
 * 这样 AI 不用关心真太阳时/安星流派等高级设置。
 */
interface BirthInputFields {
  name: string;
  date: string;
  timeIndex: number;
  gender: "男" | "女";
  calendar?: "solar" | "lunar";
  isLeapMonth?: boolean;
}

/** 将 AI 提供的部分字段合并为完整 BirthInput */
function mergeBirthInput(partial: BirthInputFields): BirthInput {
  return {
    ...DEFAULT_BIRTH_INPUT,
    ...partial,
    calendar: partial.calendar ?? "solar",
    isLeapMonth: partial.isLeapMonth ?? false,
  };
}

const personCreateFunction = {
  name: "PersonCreate",
  description: "创建新人物并自动切换为该人物。",
  zodSchema: z.object({
    name: withMeta(z.string(), { example: "张三" }).describe("姓名"),
    date: withMeta(z.string(), { example: "1990-05-15" }).describe("公历出生日期，YYYY-MM-DD"),
    timeIndex: withMeta(z.number().int().min(0).max(12), { example: 4 }).describe(
      "时辰索引 0-12，对应早子时至晚子时",
    ),
    gender: withMeta(z.enum(["男", "女"]), { example: "男" }).describe("性别"),
    calendar: withMeta(z.enum(["solar", "lunar"]), { example: "solar" })
      .optional()
      .describe("历法，默认 solar"),
    isLeapMonth: withMeta(z.boolean(), { example: false }).optional().describe("是否农历闰月"),
    isDefault: withMeta(z.boolean(), { example: false })
      .optional()
      .describe("是否设为默认人物，默认 false"),
  }),
  handler: (args: BirthInputFields & { isDefault?: boolean }) =>
    peepOrThrow().PersonCreate(mergeBirthInput(args), args.isDefault),
  returns: {
    schema: { type: "object" as const, description: "创建后的人物" },
  },
};

const personUpdateFunction = {
  name: "PersonUpdate",
  description: "更新指定人物的出生信息。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 }).describe("命主 ID"),
    name: withMeta(z.string(), { example: "张三" }).describe("姓名"),
    date: withMeta(z.string(), { example: "1990-05-15" }).describe("公历出生日期，YYYY-MM-DD"),
    timeIndex: withMeta(z.number().int().min(0).max(12), { example: 4 }).describe(
      "时辰索引 0-12，对应早子时至晚子时",
    ),
    gender: withMeta(z.enum(["男", "女"]), { example: "男" }).describe("性别"),
    calendar: withMeta(z.enum(["solar", "lunar"]), { example: "solar" })
      .optional()
      .describe("历法，默认 solar"),
    isLeapMonth: withMeta(z.boolean(), { example: false }).optional().describe("是否农历闰月"),
    isDefault: withMeta(z.boolean(), { example: false })
      .optional()
      .describe("是否设为默认人物；不传则保持原值"),
  }),
  handler: (args: { personId: number } & BirthInputFields & { isDefault?: boolean }) =>
    peepOrThrow().PersonUpdate(args.personId, mergeBirthInput(args), args.isDefault),
  returns: {
    schema: { type: "object" as const, description: "更新后的人物" },
  },
};

const personDeleteFunction = {
  name: "PersonDelete",
  description: "删除指定人物；默认人物不可删除。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 }).describe("命主 ID"),
  }),
  handler: (args: { personId: number }) => peepOrThrow().PersonDelete(args.personId),
  returns: {
    schema: { type: "object" as const, description: "删除结果" },
  },
};

/* ── 紫微斗数 ──────────────────────────────────────────── */

const ziweiFunction = {
  name: "ZiWei",
  description:
    "为指定命主排出紫微斗数盘面，按运限级别（大限/流年/流月/流日/流时）返回分析数据。" +
    "注意：此接口会同步 UI 状态（导航、切换人物、等待渲染），耗时较长且有超时风险。" +
    "如果只需要获取运限拨盘数据（大运/流年/流月/流日/流时列表），请优先使用 GetScopeData（纯计算，无 UI 开销）。" +
    "本接口适用于需要完整盘面数据（十二宫、星曜、四化等）的场景。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID；省略则使用默认人物"),
    scope: withMeta(z.enum(["decadal", "yearly", "monthly", "daily", "hourly"]), {
      example: "yearly",
    }).describe("运限级别：decadal=大限, yearly=流年, monthly=流月, daily=流日, hourly=流时"),
    time: withMeta(z.string(), { example: "2024-06-15 12:00" })
      .optional()
      .describe("公历时间，如 '2024-06-15 12:00' 或 '2024-06-15'；省略则用当前时间"),
  }),
  handler: async (args: { personId?: number; scope?: Scope; time?: string }) => {
    // 超时控制：UI 同步接口可能因渲染阻塞而卡住，25s 超时（留 5s 缓冲给上层 30s 超时）
    const TIMEOUT_MS = 25_000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `ZiWei 调用超时（${TIMEOUT_MS}ms）：UI 同步阻塞，请改用 GetScopeData 纯计算接口`,
            ),
          ),
        TIMEOUT_MS,
      );
    });
    return Promise.race([
      peepOrThrow().ZiWei(args.personId, args.scope, args.time),
      timeoutPromise,
    ]);
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "紫微盘面数据",
    },
  },
};

const getScopeDataFunction = {
  name: "GetScopeData",
  description:
    "根据公历日期获取指定命主的运限数据（大运/流年/流月/流日/流时列表），纯计算接口，不操控 UI，响应快且无超时风险。" +
    '适用于只需查看当前运限拨盘状态的场景（如"我现在走什么大运""今年流年如何"）。' +
    "如需完整盘面数据（十二宫星曜、四化飞星等），请使用 ZiWei 接口。",
  zodSchema: z.object({
    solarDate: withMeta(z.string(), { example: "2024-06-15 12:00" }).describe(
      "公历日期，如 '2024-06-15 12:00' 或 '2024-06-15'",
    ),
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID；省略则使用默认人物"),
  }),
  handler: async (args: { solarDate: string; personId?: number }) => {
    return peepOrThrow().GetScopeData(args.solarDate, args.personId);
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "运限拨盘数据（含大运/流年/流月/流日/流时列表）",
    },
  },
};

const solarToLunarFunction = {
  name: "SolarToLunar",
  description: "将公历日期转换为农历日期，返回年月日时、干支、闰月等信息。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "2024-06-15 12:00" }).describe(
      "公历日期，如 '2024-06-15 12:00' 或 '2024-06-15'",
    ),
  }),
  handler: (args: { date: string }) => {
    // 从 lunar.ts 导入的 solarToLunar 函数
    return import("./lunar").then(({ solarToLunar }) => solarToLunar(args.date));
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "农历日期信息",
    },
  },
};

const daliurenCalcFunction = {
  name: "DaLiuRen",
  description: "按指定公历时间起大六壬课，返回天地盘、四课、三传、神将等完整课式。仅计算不落库。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "2024-06-15" }).describe("公历日期，格式 YYYY-MM-DD"),
    time: withMeta(z.string(), { example: "14:30" }).describe("时间，格式 HH:mm 或 HH:mm:ss"),
    fateInput: z
      .object({
        birthYear: withMeta(z.number().int(), { example: 1990 }).describe("命主生年（公历）"),
        gender: withMeta(z.enum(["男", "女"]), { example: "男" }).describe("命主性别"),
      })
      .optional()
      .describe("命主信息，用于起贵人神将；占事无关命主可省略"),
  }),
  handler: (args: {
    date: string;
    time: string;
    fateInput?: { birthYear: number; gender: "男" | "女" };
  }) => peepOrThrow().DaLiuRen(args.date, args.time, args.fateInput),
  returns: {
    schema: {
      type: "object" as const,
      description: "大六壬课式",
    },
  },
};

const daliurenCreateFunction = {
  name: "DaLiuRenCreate",
  description: "为命主起一课大六壬并以当前时间落库保存，返回带 id 的起课记录。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID；省略则使用默认人物"),
    question: withMeta(z.string(), { example: "这笔生意能不能做" }).describe("所占问题"),
    note: withMeta(z.string(), { example: "客户询问合作前景" }).optional().describe("备注"),
    background: withMeta(z.string(), { example: "客户与对方已洽谈三月" })
      .optional()
      .describe("背景信息"),
    tags: z.array(z.string()).optional().describe("标签"),
  }),
  handler: (args: {
    personId?: number;
    question: string;
    note?: string;
    background?: string;
    tags?: string[];
  }) => peepOrThrow().DaLiuRenCreate(args),
  returns: {
    schema: { type: "object" as const, description: "保存后的起课记录" },
  },
};

const daliurenListFunction = {
  name: "DaLiuRenList",
  description: "列出命主的大六壬起课记录，支持关键字搜索、标签过滤与分页。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID；省略则使用默认人物"),
    searchText: withMeta(z.string(), { example: "合作" }).optional().describe("搜索关键字"),
    tags: z.array(z.string()).optional().describe("按标签过滤"),
    page: withMeta(z.number().int().positive(), { example: 1 }).optional().describe("页码，默认 1"),
    pageSize: withMeta(z.number().int().positive(), { example: 20 })
      .optional()
      .describe("每页条数，默认 20"),
  }),
  handler: (args: {
    personId?: number;
    searchText?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }) => peepOrThrow().DaLiuRenList(args),
  returns: {
    schema: {
      type: "object" as const,
      description: "起课记录列表",
    },
  },
};

const daliurenViewFunction = {
  name: "DaLiuRenView",
  description: "查看指定大六壬起课记录的完整课式详情。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID；省略则使用默认人物"),
    recordId: withMeta(z.number().int().positive(), { example: 123 }).describe("起课记录 ID"),
  }),
  handler: (args: { personId?: number; recordId: number }) => peepOrThrow().DaLiuRenView(args),
  returns: {
    schema: { type: "object" as const, description: "起课记录详情" },
  },
};

const wikiListFunction = {
  name: "WikiList",
  description: "查询 Wiki 文档列表，可按关键字、标签过滤并分页。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID；省略则使用默认人物"),
    searchText: withMeta(z.string(), { example: "紫微" }).optional().describe("按标题或正文搜索"),
    tags: z.array(z.string()).optional().describe("按标签过滤"),
    page: withMeta(z.number().int().positive(), { example: 1 }).optional().describe("页码，默认 1"),
    pageSize: withMeta(z.number().int().positive(), { example: 20 })
      .optional()
      .describe("每页条数，默认 20"),
  }),
  handler: (args: {
    personId?: number;
    searchText?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }) => peepOrThrow().WikiList(args),
  returns: {
    schema: {
      type: "object" as const,
      description: "Wiki 文档列表",
    },
  },
};

const wikiCreateFunction = {
  name: "WikiCreate",
  description: "创建一篇 Wiki 文档（Markdown 正文），可设置标签与关联文档。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID；省略则使用默认人物"),
    title: withMeta(z.string(), { example: "紫微斗数入门" }).describe("文档标题"),
    content: withMeta(z.string(), { example: "# 紫微斗数\n\n紫微斗数是..." }).describe(
      "Markdown 正文",
    ),
    tags: z.array(z.string()).optional().describe("标签"),
    linkTargetIds: z.array(z.number().int().positive()).optional().describe("关联文档 ID"),
  }),
  handler: (args: {
    personId?: number;
    title: string;
    content: string;
    tags?: string[];
    linkTargetIds?: number[];
  }) => peepOrThrow().WikiCreate(args),
  returns: {
    schema: { type: "object" as const, description: "保存后的文档" },
  },
};

const wikiViewFunction = {
  name: "WikiView",
  description: "查看指定 Wiki 文档的完整内容。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID；省略则使用默认人物"),
    docId: withMeta(z.number().int().positive(), { example: 456 }).describe("文档 ID"),
  }),
  handler: (args: { personId?: number; docId: number }) => peepOrThrow().WikiView(args),
  returns: {
    schema: {
      type: "object" as const,
      description: "Wiki 文档，content 为 Markdown 正文",
    },
  },
};

/** Function 分组：按业务域划分，AI 据此理解能力边界 */
const FUNCTION_GROUPS = [
  {
    name: "person",
    description: "命主档案增删改查",
    functions: [
      personListFunction,
      personGetFunction,
      personCreateFunction,
      personUpdateFunction,
      personDeleteFunction,
    ],
  },
  {
    name: "ziwei",
    description:
      "紫微斗数排盘与运限。GetScopeData 为纯计算接口（优先使用），ZiWei 会同步 UI（耗时较长）。",
    functions: [getScopeDataFunction, ziweiFunction, solarToLunarFunction],
  },
  {
    name: "daliuren",
    description: "大六壬起课与占卜",
    functions: [
      // daliurenCalcFunction, // 禁用
      daliurenCreateFunction,
      daliurenListFunction,
      daliurenViewFunction,
    ],
  },
  {
    name: "wiki",
    description: "命理知识库管理",
    functions: [wikiListFunction, wikiCreateFunction, wikiViewFunction],
  },
];

/* ============================================================
 * 创建 RTC Agent 实例
 * ============================================================ */

let _agent: RtcAgentWithLifecycle | null = null;

/**
 * 创建并初始化 RTC Agent 全局实例
 *
 * 调用时机：App.tsx 挂载时调用一次，返回的 agent 实例挂到全局供主题/i18n 同步使用。
 * 返回值：agent 实例（需要手动 appendChild 到 DOM）
 */
export function createPeepRtcAgent(): RtcAgentWithLifecycle {
  if (_agent) return _agent;

  const config = {
    appLabel: "窥见人生 · 命理 AI 助手",
    logo: {
      light: LOGO_SVG,
      dark: LOGO_SVG,
    },
    // 主题初始值取 peep-v2 当前偏好；后续通过 syncTheme 同步
    theme: getTheme(),
    // 语言初始值从 HTML lang 推断（peep-v2 在 <html lang="zh-CN"> 设置了）；
    // 后续通过 syncLocale 同步
    lang: (document.documentElement.lang as "zh-CN" | "en-US") || "zh-CN",
    databaseName: "peep-rtc",
    server: {
      url: "https://rtc-agent.cherish.chat",
      // OAuth 回调路径（含 base 前缀，GitHub Pages 部署后是 /peep/auth/callback.html）
      redirectUri: `${import.meta.env.BASE_URL}auth/callback.html`,
    },
    scenariosUrl: `${import.meta.env.BASE_URL}scenarios/`,
    workerUrl: `${import.meta.env.BASE_URL}rtc-agent/shared-worker.js`,
    // Function 注册
    agentName: "PeepAstro",
    agentDescription: "紫微斗数 · 大六壬 · 知识库 —— 命理分析 AI 助手",
    persona: document.documentElement.lang === "en-US" ? PERSONA_EN : PERSONA_ZH,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    groups: FUNCTION_GROUPS as any,
    // 嵌入式面板模式：embedded=true 自动禁用拖拽/缩放/最小化/最大化/关闭按钮，
    // 并设 defaultMode='maximized'——让 RTC 填满父容器（peep-v2 右侧 3/8 侧栏）
    window: {
      embedded: true,
      defaultMode: "maximized" as const,
      draggable: false,
      resizable: false,
      showMinimize: false,
      showMaximize: false,
      showClose: false,
    },
    // 只保留 chat 按钮，禁用文件/设置面板
    activityBar: {
      disabledActivities: ["files", "settings"] as ("files" | "settings")[],
    },
    on: {
      ready: () => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log(
            "%c[rtc]%c Agent 已就绪（embedded 模式）",
            "color:#2196f3;font-weight:bold",
            "",
          );
        }
      },
    },
  };

  _agent = createRtcAgent(config);
  return _agent;
}

/** 获取当前 RTC Agent 实例（未创建时返回 null） */
export function getPeepRtcAgent(): RtcAgentWithLifecycle | null {
  return _agent;
}

/* ============================================================
 * 主题 / 语言同步
 * ============================================================ */

/**
 * 把 peep-v2 的当前主题同步给 RTC 组件
 *
 * 同步策略：读 peep-v2 的 getTheme()（'light' | 'dark' | 'system'），
 * 直接设到 agent.theme。RTC 组件内部会处理 system 的实际渲染（监听 prefers-color-scheme）。
 */
export function syncTheme(): void {
  if (!_agent) return;
  _agent.theme = getTheme();
}

/**
 * 把 peep-v2 的当前语言同步给 RTC 组件
 *
 * 通过 RTC 的 switchLocale 异步切换（会触发 @lit/localize 重新渲染）。
 */
export async function syncLocale(locale: Locale): Promise<void> {
  if (!_agent) return;
  _agent.lang = locale;
  try {
    await switchLocale(locale);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[rtc] switchLocale 失败", err);
    }
  }
}

/**
 * 启动主题同步监听
 *
 * 监听两个信号：
 * 1. :root 的 data-theme 属性变化（peep-v2 主题偏好切换时 setTheme 会改这个属性）
 * 2. 系统 prefers-color-scheme 变化（system 模式下自动跟随）
 *
 * 任一触发都会重新读 getTheme() 并同步给 RTC 组件。
 */
export function startThemeSync(): void {
  // 1. 监听 :root[data-theme] 变化
  const observer = new MutationObserver(() => syncTheme());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  // 2. 监听系统主题变化
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => syncTheme());
}
