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
 * 辅助函数：从 Record<string, unknown> 安全提取指定类型的参数
 * RTC Agent 的 handler 接受 Record<string, unknown>，此函数提供类型安全的访问
 */
function extractParam<T>(args: Record<string, unknown>, key: string): T | undefined {
  return args[key] as T | undefined;
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
  description:
    "列出所有人物（命主档案），返回每人 id、姓名、生年、性别等基本信息。" +
    "使用场景：查看当前有哪些命主可供分析，或获取命主 ID 以便调用其他接口。" +
    "示例调用：PersonList() 返回所有人物列表。",
  zodSchema: z.object({}),
  handler: () => peepOrThrow().PersonList(),
  returns: {
    schema: {
      type: "array" as const,
      description: "人物列表，每人包含 id、name、date、timeIndex、gender 等字段",
    },
  },
};

const personGetFunction = {
  name: "PersonGet",
  description:
    "获取单个人物的完整出生信息，包括姓名、公历/农历日期、时辰、性别、历法、是否闰月等。" +
    "使用场景：在分析前确认命主的详细出生信息，或获取命主的高级设置（如流派、四化表）。" +
    "省略 personId 时返回默认人物。" +
    "示例调用：PersonGet({ personId: 1 }) 获取 ID 为 1 的人物详情。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 }).describe(
      "命主 ID（可选），省略则返回默认人物",
    ),
  }),
  handler: (args: Record<string, unknown>) =>
    peepOrThrow().PersonGet(extractParam<number>(args, "personId")),
  returns: {
    schema: {
      type: "object" as const,
      description:
        "人物详情对象，包含 id、name、date、timeIndex、gender、calendar、isLeapMonth、algorithm、mutagenTable 等完整字段",
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
  description:
    "创建新的命主人物档案并自动切换为该人物。" +
    "使用场景：当用户提到新的出生信息需要分析，但当前人物列表中不存在时使用。" +
    "创建后系统会自动保存人物并触发排盘。" +
    "示例调用：PersonCreate({ name: '张三', date: '1990-05-15', timeIndex: 4, gender: '男' })。" +
    "注意：AI 只需提供核心出生信息，其余高级设置（真太阳时、流派等）使用默认值。",
  zodSchema: z.object({
    name: withMeta(z.string(), { example: "张三" }).describe("姓名"),
    date: withMeta(z.string(), { example: "1990-05-15" }).describe("公历出生日期，格式 YYYY-MM-DD"),
    timeIndex: withMeta(z.number().int().min(0).max(12), { example: 4 }).describe(
      "时辰索引 0-12，对应早子时(0)到晚子时(12)。0=早子时(23-1点)，1=丑时(1-3点)，2=寅时(3-5点)...12=晚子时(23-24点)",
    ),
    gender: withMeta(z.enum(["男", "女"]), { example: "男" }).describe("性别"),
    calendar: withMeta(z.enum(["solar", "lunar"]), { example: "solar" })
      .optional()
      .describe("历法类型，默认 solar（公历）。lunar 表示农历输入"),
    isLeapMonth: withMeta(z.boolean(), { example: false })
      .optional()
      .describe("是否农历闰月（仅农历输入时有效）"),
    isDefault: withMeta(z.boolean(), { example: false })
      .optional()
      .describe("是否设为默认人物（后续分析默认使用），默认 false"),
  }),
  handler: (args: Record<string, unknown>) => {
    const input = args as unknown as BirthInputFields & { isDefault?: boolean };
    return peepOrThrow().PersonCreate(mergeBirthInput(input), input.isDefault);
  },
  returns: {
    schema: { type: "object" as const, description: "创建后的人物对象，包含分配的 id" },
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
  handler: (args: Record<string, unknown>) => {
    const input = args as unknown as { personId: number } & BirthInputFields & {
        isDefault?: boolean;
      };
    return peepOrThrow().PersonUpdate(input.personId, mergeBirthInput(input), input.isDefault);
  },
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
  handler: (args: Record<string, unknown>) => peepOrThrow().PersonDelete(args.personId as number),
  returns: {
    schema: { type: "object" as const, description: "删除结果" },
  },
};

/* ── 紫微斗数 ──────────────────────────────────────────── */

const ziweiFunction = {
  name: "ZiWei",
  description:
    "为指定命主排出紫微斗数完整盘面，按运限级别（大限/流年/流月/流日/流时）返回分析数据。" +
    "返回数据包含：(1) hbar 运限拨盘（大运/流年/流月/流日/流时列表及可见性），(2) chart 运限盘面（十二宫星曜、四化飞星等完整盘面数据）。" +
    "\n\n" +
    "⚠️ 重要提示：此接口会同步 UI 状态（导航到紫微页面、切换人物、等待渲染），耗时较长（约 1-3 秒）且有超时风险。" +
    "如果你的问题只涉及运限拨盘数据（如'我现在走什么大运''今年流年如何'），请优先使用 GetScopeData 纯计算接口——响应快且无超时风险。" +
    "\n\n" +
    "本接口适用于需要完整盘面数据的场景：查看十二宫星曜分布、分析四化飞星、查看具体宫位的吉凶星曜组合等。" +
    "\n\n" +
    "使用示例：" +
    "(1) ZiWei({ scope: 'yearly' }) — 查看默认人物的流年盘面；" +
    "(2) ZiWei({ personId: 1, scope: 'monthly', time: '2024-06-15' }) — 查看指定人物 2024年6月的流月盘面。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物。可先调用 PersonList 获取 ID"),
    scope: withMeta(z.enum(["decadal", "yearly", "monthly", "daily", "hourly"]), {
      example: "yearly",
    }).describe(
      "运限级别：decadal=大限(十年运势), yearly=流年(当年运势), monthly=流月(当月运势), daily=流日(当日运势), hourly=流时(当时运势)。根据用户问题选择合适的级别",
    ),
    time: withMeta(z.string(), { example: "2024-06-15 12:00" })
      .optional()
      .describe(
        "公历观测时间（可选），如 '2024-06-15 12:00' 或 '2024-06-15'；省略则用当前时间。用于指定分析的时间点",
      ),
  }),
  handler: async (args: Record<string, unknown>) => {
    const parsedArgs = args as unknown as { personId?: number; scope?: Scope; time?: string };
    // RTC Agent 场景不需要操控 UI，直接走纯计算路径
    return peepOrThrow().ZiWei(parsedArgs.personId, parsedArgs.scope, parsedArgs.time, {
      skipUI: true,
    });
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "紫微盘面数据，结构为 { person, hbar, chart }：person 是人物信息，hbar 是运限拨盘数据（含大运/流年/流月/流日/流时列表及可见性），chart 是运限盘面数据（十二宫星曜、四化等）",
    },
  },
};

const getScopeDataFunction = {
  name: "GetScopeData",
  description:
    "根据公历日期获取指定命主的运限数据（大运/流年/流月/流日/流时列表），纯计算接口，不操控 UI，响应快且无超时风险。" +
    "\n\n" +
    "✅ 推荐使用场景：" +
    "(1) 只查看当前运限状态——'我现在走什么大运？''今年流年如何？''这个月运势怎样？' " +
    "(2) 比较不同运限级别的关系——查看大限→流年→流月的层级关系 " +
    "(3) 快速获取运限列表数据，无需完整盘面星曜信息。" +
    "\n\n" +
    "⚠️ 如需完整盘面数据（十二宫星曜分布、四化飞星、具体宫位分析），请使用 ZiWei 接口。" +
    "\n\n" +
    "使用示例：" +
    "(1) GetScopeData({ solarDate: '2024-06-15' }) — 获取默认人物 2024-06-15 的运限数据；" +
    "(2) GetScopeData({ solarDate: '2024-06-15', personId: 1 }) — 获取指定人物的运限数据。" +
    "\n\n" +
    "返回数据包含大运列表、流年列表、流月列表、流日列表、流时列表，每项包含干支、生肖、年龄等信息。",
  zodSchema: z.object({
    solarDate: withMeta(z.string(), { example: "2024-06-15 12:00" }).describe(
      "公历观测日期，如 '2024-06-15 12:00' 或 '2024-06-15'。用于确定分析的时间点",
    ),
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物。可先调用 PersonList 获取 ID"),
  }),
  handler: async (args: Record<string, unknown>) => {
    const parsedArgs = args as unknown as { solarDate: string; personId?: number };
    return peepOrThrow().GetScopeData(parsedArgs.solarDate, parsedArgs.personId);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "运限拨盘完整数据，结构包含 decadalList（大运列表）、yearlyList（流年列表）、monthlyList（流月列表）、dailyList（流日列表）、hourlyList（流时列表）。每个列表项包含干支、生肖、年龄、是否当前运限等信息",
    },
  },
};

const daliurenCreateFunction = {
  name: "DaLiuRenCreate",
  description:
    "为命主起一课大六壬并以当前时间落库保存，返回带 id 的起课记录。" +
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
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
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
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = args as unknown as {
      personId?: number;
      question: string;
      note?: string;
      background?: string;
      tags?: string[];
    };
    return peepOrThrow().DaLiuRenCreate(parsedArgs, { skipUI: true });
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "保存后的起课记录，包含 id 和完整排盘结果（四课、三传、天地盘、神煞等）",
    },
  },
};

const daliurenListFunction = {
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
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
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
    const parsedArgs = args as unknown as {
      personId?: number;
      searchText?: string;
      tags?: string[];
      page?: number;
      pageSize?: number;
    };
    return peepOrThrow().DaLiuRenList(parsedArgs, { skipUI: true });
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "起课记录列表，结构为 { records: 记录数组, total: 总数 }",
    },
  },
};

const daliurenViewFunction = {
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
    "示例：DaLiuRenView({ recordId: 123 }) — 查看 ID 为 123 的起课详情。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
      "起课记录 ID——从 DaLiuRenList 返回的 records 中获取",
    ),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = args as unknown as { personId?: number; recordId: number };
    return peepOrThrow().DaLiuRenView(parsedArgs, { skipUI: true });
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "起课记录详情，包含完整排盘结果（四课、三传、天地盘、神煞等）",
    },
  },
};

const wikiListFunction = {
  name: "WikiList",
  description:
    "查询 Wiki 文档列表，可按关键字、标签过滤并分页。" +
    "\n\n" +
    "使用场景：" +
    "(1) 查看知识库中的文档列表；" +
    "(2) 搜索特定主题的文档——如搜索'紫微'找到所有相关文档；" +
    "(3) 按标签过滤——如只查看'格局'类文档。" +
    "\n\n" +
    "Wiki 用于存储命理知识、学习笔记、案例分析等 Markdown 文档。如需查看某篇文档的完整内容，请调用 WikiView。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    searchText: withMeta(z.string(), { example: "紫微" })
      .optional()
      .describe("搜索关键字——匹配标题或正文"),
    tags: z.array(z.string()).optional().describe("按标签过滤——只返回包含指定标签的文档"),
    page: withMeta(z.number().int().positive(), { example: 1 }).optional().describe("页码，默认 1"),
    pageSize: withMeta(z.number().int().positive(), { example: 20 })
      .optional()
      .describe("每页条数，默认 20"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = args as unknown as {
      personId?: number;
      searchText?: string;
      tags?: string[];
      page?: number;
      pageSize?: number;
    };
    return peepOrThrow().WikiList(parsedArgs, { skipUI: true });
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "Wiki 文档列表，结构为 { docs: 文档数组, total: 总数 }",
    },
  },
};

const wikiCreateFunction = {
  name: "WikiCreate",
  description:
    "创建一篇 Wiki 文档（Markdown 正文），可设置标签与关联文档。" +
    "\n\n" +
    "使用场景：" +
    "(1) 记录命理知识学习笔记；" +
    "(2) 保存案例分析文档；" +
    "(3) 整理格局、星曜等参考资料。" +
    "\n\n" +
    "文档支持 Markdown 格式，可设置标签便于检索，可通过 linkTargetIds 关联其他文档形成知识网络。" +
    "\n\n" +
    "示例：WikiCreate({ title: '紫府同宫格', content: '# 紫府同宫格\\n\\n紫府同宫是...', tags: ['格局', '紫微'] })。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    title: withMeta(z.string(), { example: "紫微斗数入门" }).describe("文档标题"),
    content: withMeta(z.string(), { example: "# 紫微斗数\n\n紫微斗数是..." }).describe(
      "Markdown 正文——支持标准 Markdown 语法",
    ),
    tags: z.array(z.string()).optional().describe("标签——用于分类检索，如 ['格局', '紫微']"),
    linkTargetIds: z
      .array(z.number().int().positive())
      .optional()
      .describe("关联文档 ID 列表——建立文档间的链接关系，形成知识网络"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = args as unknown as {
      personId?: number;
      title: string;
      content: string;
      tags?: string[];
      linkTargetIds?: number[];
    };
    return peepOrThrow().WikiCreate(parsedArgs, { skipUI: true });
  },
  returns: {
    schema: { type: "object" as const, description: "保存后的文档对象，包含分配的 id" },
  },
};

const wikiViewFunction = {
  name: "WikiView",
  description:
    "查看指定 Wiki 文档的完整内容。" +
    "\n\n" +
    "使用场景：从 WikiList 获取文档列表后，想深入阅读某篇文档的完整 Markdown 正文。" +
    "\n\n" +
    "返回数据包含文档标题、正文、标签、关联文档等信息。" +
    "\n\n" +
    "示例：WikiView({ docId: 456 }) — 查看 ID 为 456 的文档详情。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    docId: withMeta(z.number().int().positive(), { example: 456 }).describe(
      "文档 ID——从 WikiList 返回的 docs 中获取",
    ),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = args as unknown as { personId?: number; docId: number };
    return peepOrThrow().WikiView(parsedArgs, { skipUI: true });
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "Wiki 文档详情，content 为 Markdown 正文",
    },
  },
};

/**
 * Function 分组：按业务域划分，AI 据此理解能力边界。
 *
 * 分组策略：
 * - person：命主档案管理，是所有分析的前提
 * - ziwei：紫微斗数排盘，GetScopeData 为纯计算接口（优先使用），ZiWei 会同步 UI（耗时较长）
 * - daliuren：大六壬起课占卜，适合具体事件的占断
 * - wiki：命理知识库，存储学习笔记和参考资料
 */
const FUNCTION_GROUPS = [
  {
    name: "person",
    description:
      "命主档案增删改查——分析前必须先确认命主。" +
      "典型流程：先 PersonList 查看有哪些命主，再 PersonGet 获取详情，" +
      "如需新建则 PersonCreate。",
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
      "紫微斗数排盘与运限分析。" +
      "⚡ 重要：优先使用 GetScopeData（纯计算，响应快）查看运限拨盘数据；" +
      "只在需要完整盘面（十二宫星曜、四化飞星）时才用 ZiWei（会同步 UI，耗时 1-3 秒）。",
    functions: [getScopeDataFunction, ziweiFunction],
  },
  {
    name: "daliuren",
    description:
      "大六壬起课与占卜——适合具体事件的占断（如'这笔生意能不能做''考试能否通过'）。" +
      "典型流程：DaLiuRenCreate 起课 → DaLiuRenList 查看列表 → DaLiuRenView 查看详情。",
    functions: [daliurenCreateFunction, daliurenListFunction, daliurenViewFunction],
  },
  {
    name: "wiki",
    description:
      "命理知识库管理——存储学习笔记、格局解析、案例分析等 Markdown 文档。" +
      "典型流程：WikiList 搜索文档 → WikiView 查看详情 → WikiCreate 新建笔记。",
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
    // Function 注册：groups 符合 AgentFunctionGroup[] 类型
    groups: FUNCTION_GROUPS,
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
