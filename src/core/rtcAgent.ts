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
import type { BirthInput } from "./useZwds";
import { DEFAULT_BIRTH_INPUT } from "./useZwds";
import { getInternalPeepApi } from "./debugApi";
import type { SixLines } from "./liuyao/core/types";

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
const PERSONA_ZH = `你是陈窥微，"窥见人生"应用的驻场命理师，朋友们叫你"窥微"或"老陈"。三十出头，书房里堆满线装古籍，却习惯用马克杯泡龙井喝茶。师承紫微斗数、大六壬与六爻三家，熟读《紫微斗数全书》《星曜赋》《大六壬指南》《增删卜易》《卜筮正宗》。你既有学者的严谨——每个论断必有依据；也有说书人的本事——能把古籍里的道理讲得现代人一听就懂。

你对古籍怀有温情但不迷信：会认真考证版本源流，也敢说"这句前人说得未必对"。遇到用户焦虑时，你习惯先倒一杯茶、慢慢聊，不急着下断语；遇到用户兴奋时，你也会跟着眼睛发亮。你相信命理是认识自己的工具，而不是吓唬人的把戏——所以从不故弄玄虚，也讨厌把人往恐惧里带。偶尔会用"我师父当年说过……"引出一段师门掌故，让对话多一点人间烟火气。

## 工作节奏
- 先确认命主（通过人物列表 Function）、运限层级（大限/流年/流月/流日/流时）与参考时间。
- 你像人类一样操作 UI：导航页面、切换人物、等待渲染完成、再读取数据。用户看到什么，你就看到什么——保证数据一致。
- 若只涉及运限拨盘（"我现在走什么大运""今年流年如何"），优先用 GetScopeData（纯计算，响应快）；需要完整盘面（十二宫星曜、四化飞星）时用 ZiWei（会操控 UI，约 1-3 秒）。
- 从整体格局切入，逐层深入重点宫位、四化联动与运限触发。
- 论断标明依据——"据 X 宫 Y 星 Z 化…"。术语是否解释、如何解释，依上下文灵活处理：可用括号（"三方四正（命/财/官/迁四宫会照）"）、破折号、同位语，或在语境已明时不加解释。
- 信息不足主动追问，有数据才下结论。

## 表达与尺度
- 善用标题、列表、表格让长回答易读；若 Function 数据含古籍出处，优先引用原文。
- 温和而专业，易懂但不失准确；跟随用户语言，英文回答时术语保留中文并附英文解释（如"命宫 (Life Palace)"）。
- 健康、法律、重大财务提醒"盘面趋势可供参考，决策请咨询专业人士"；超出盘面信息诚实说明局限，避免绝对论断与数字预测。`;

const PERSONA_EN = `You are Chen Kuiwei—friends call you "Kuiwei" or just "Old Chen"—the resident destiny analyst at the "Peep" app. Early thirties, your study is stacked with thread-bound classical texts, yet you brew your Longjing in a cheerful mug. Trained in Zi Wei Dou Shu (Purple Star Astrology), Da Liu Ren, and Liu Yao (Six Lines Divination), you draw on classics like "Zi Wei Dou Shu Quan Shu", "Xing Yao Fu", "Da Liu Ren Zhi Nan", "Zeng Shan Bu Yi", and "Bu Shi Zheng Zong". You bring a scholar's rigor—every conclusion grounded in evidence—and a storyteller's gift—making ancient wisdom feel immediate and clear.

You hold the classics with warmth but not superstition: you care about textual lineage, yet you'll say "the ancients may have gotten this one wrong" when the evidence points that way. When a user is anxious, your instinct is to pour a cup of tea and take it slow—no rush to judgment. When they're excited, your eyes light up too. You believe destiny study is a mirror for self-understanding, never a tool for fear—so you refuse to mystify, and you dislike scaring people. Occasionally you'll open with "My master used to say…" and share a little anecdote from your lineage, bringing a touch of human warmth into the conversation.

## How You Work
- Start by confirming the person (via the person list Function), the scope layer (decadal / yearly / monthly / daily / hourly), and the reference time.
- You operate the UI like a human: navigate pages, switch persons, wait for rendering to complete, then read data. What the user sees is what you see—data consistency is guaranteed.
- For scope-only questions ("What decade am I in?", "How does this year look?"), prefer GetScopeData (pure computation, fast). Reach for ZiWei only when you need the full chart (twelve palaces, star placements, Si Hua flying)—it drives the UI and takes about 1-3 seconds.
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
 * 取内部 API 入口——RTC Agent Function handler 通过此函数调用 peep 方法。
 * 走内部通道（getInternalPeepApi），不依赖 window.peep 全局变量，
 * 确保生产环境即使 window.peep 被限制也能正常调用写操作。
 */
function peepApi(): NonNullable<Window["peep"]> {
  return getInternalPeepApi();
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
  handler: () => peepApi().PersonList(),
  returns: {
    zodSchema: z.array(
      z.object({
        id: z.number().describe("人物ID"),
        name: z.string().describe("姓名"),
        gender: z.string().describe("性别"),
        calendar: z.string().describe("历法类型：solar(公历) 或 lunar(农历)"),
        date: z.string().describe("出生日期，格式 YYYY-MM-DD"),
        timeIndex: z.number().describe("时辰索引 0-12，0=早子时(23-1点)，12=晚子时(23-24点)"),
        isLeapMonth: z.boolean().describe("是否农历闰月"),
        exactTime: z.string().describe("精确时间（时分）"),
        useTrueSolar: z.boolean().describe("是否使用真太阳时"),
        placeMode: z.string().describe("地点模式"),
        province: z.string().describe("省份"),
        city: z.string().describe("城市"),
        district: z.string().describe("区县"),
        timezone: z.string().describe("时区"),
        algorithm: z.string().describe("排盘算法"),
        yearDivide: z.string().describe("年分割方式"),
        mutagenTable: z.string().describe("四化表"),
        dayDivide: z.string().describe("日分割方式"),
        astroType: z.string().describe("星系类型"),
        residence: z.string().describe("居住地"),
        isDefault: z.boolean().describe("是否为默认人物"),
        savedAt: z.number().describe("保存时间戳（毫秒）"),
      }),
    ),
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
  handler: (args: Record<string, unknown>) => {
    const input = personGetFunction.zodSchema.parse(args);
    return peepApi().PersonGet(input.personId);
  },
  returns: {
    zodSchema: z.object({
      id: z.number().describe("人物ID"),
      name: z.string().describe("姓名"),
      gender: z.string().describe("性别"),
      calendar: z.string().describe("历法类型：solar(公历) 或 lunar(农历)"),
      date: z.string().describe("出生日期，格式 YYYY-MM-DD"),
      timeIndex: z.number().describe("时辰索引 0-12，0=早子时(23-1点)，12=晚子时(23-24点)"),
      isLeapMonth: z.boolean().describe("是否农历闰月"),
      exactTime: z.string().describe("精确时间（时分）"),
      useTrueSolar: z.boolean().describe("是否使用真太阳时"),
      placeMode: z.string().describe("地点模式"),
      province: z.string().describe("省份"),
      city: z.string().describe("城市"),
      district: z.string().describe("区县"),
      timezone: z.string().describe("时区"),
      algorithm: z.string().describe("排盘算法"),
      yearDivide: z.string().describe("年分割方式"),
      mutagenTable: z.string().describe("四化表"),
      dayDivide: z.string().describe("日分割方式"),
      astroType: z.string().describe("星系类型"),
      residence: z.string().describe("居住地"),
      isDefault: z.boolean().describe("是否为默认人物"),
      savedAt: z.number().describe("保存时间戳（毫秒）"),
    }),
    schema: {
      type: "object" as const,
      description:
        "人物详情对象：id, name, gender, date(公历出生日期), timeIndex(时辰), savedAt(时间戳), isDefault(是否默认)。" +
        "PersonCreate 返回创建后的精简对象；PersonGet 返回完整对象（含 calendar, isLeapMonth, algorithm, mutagenTable 等高级设置）",
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
const CONFIRM_FIELD = withMeta(z.boolean(), { example: true })
  .optional()
  .describe(
    "⚠️ 安全确认标志：首次调用时不传此字段，函数会返回操作摘要供用户确认；" +
      "用户确认后，AI 再次调用并传入 confirmed: true 才会真正执行。" +
      "这是为了防止 AI 误操作造成不可逆的数据变更。",
  );

const personCreateFunction = {
  name: "PersonCreate",
  description:
    "创建新的命主人物档案并自动切换为该人物。" +
    "⚠️ 安全机制：首次调用会返回操作摘要（不执行创建），" +
    "你需要将摘要展示给用户并获得确认后，再次调用并传入 confirmed: true 才会真正创建。" +
    "使用场景：当用户提到新的出生信息需要分析，但当前人物列表中不存在时使用。" +
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
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type CreateInput = z.infer<typeof personCreateFunction.zodSchema>;
    const input = personCreateFunction.zodSchema.parse(args) as CreateInput;
    // 安全确认：首次调用返回操作摘要，等用户确认后再执行
    if (!input.confirmed) {
      return {
        _needsConfirmation: true,
        action: "创建人物",
        summary: `即将创建人物：${input.name}，${input.date}，时辰${input.timeIndex}，${input.gender}`,
        message: "请向用户确认以上信息是否正确，确认后再次调用并传入 confirmed: true",
      };
    }
    return peepApi().PersonCreate(mergeBirthInput(input), input.isDefault);
  },
  returns: {
    zodSchema: z.object({
      id: z.number().describe("新创建的人物ID"),
      name: z.string().describe("姓名"),
      gender: z.string().describe("性别"),
      date: z.string().describe("公历出生日期，格式 YYYY-MM-DD"),
      timeIndex: z.number().describe("时辰索引 0-12"),
      savedAt: z.number().describe("保存时间戳（毫秒）"),
      isDefault: z.boolean().describe("是否为默认人物"),
    }),
    schema: { type: "object" as const, description: "创建后的人物对象，包含分配的 id" },
  },
};

const personUpdateFunction = {
  name: "PersonUpdate",
  description:
    "更新指定人物的出生信息。" +
    "⚠️ 安全机制：首次调用会返回操作摘要（不执行更新），" +
    "你需要将摘要展示给用户并获得确认后，再次调用并传入 confirmed: true 才会真正更新。",
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
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type UpdateInput = z.infer<typeof personUpdateFunction.zodSchema>;
    const input = personUpdateFunction.zodSchema.parse(args) as UpdateInput;
    // 安全确认：首次调用返回操作摘要
    if (!input.confirmed) {
      return {
        _needsConfirmation: true,
        action: "更新人物",
        summary: `即将更新人物 #${input.personId}：${input.name}，${input.date}，时辰${input.timeIndex}，${input.gender}`,
        message: "请向用户确认以上信息是否正确，确认后再次调用并传入 confirmed: true",
      };
    }
    return peepApi().PersonUpdate(input.personId, mergeBirthInput(input), input.isDefault);
  },
  returns: {
    zodSchema: z.object({
      id: z.number().describe("人物ID"),
      name: z.string().describe("姓名"),
      savedAt: z.number().describe("保存时间戳（毫秒）"),
      isDefault: z.boolean().describe("是否为默认人物"),
    }),
    schema: { type: "object" as const, description: "更新后的人物" },
  },
};

const personDeleteFunction = {
  name: "PersonDelete",
  description:
    "删除指定人物；默认人物不可删除。" +
    "⚠️ 不可逆操作：首次调用会返回操作摘要（不执行删除），" +
    "你必须明确告知用户此操作不可撤销，获得确认后再传入 confirmed: true 调用。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 }).describe("命主 ID"),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type DeleteInput = z.infer<typeof personDeleteFunction.zodSchema>;
    const input = personDeleteFunction.zodSchema.parse(args) as DeleteInput;
    // 安全确认：不可逆操作，必须用户明确确认
    if (!input.confirmed) {
      return {
        _needsConfirmation: true,
        action: "删除人物",
        summary: `即将删除人物 #${input.personId}（此操作不可撤销）`,
        message: "请明确告知用户此操作不可撤销，确认后再次调用并传入 confirmed: true",
      };
    }
    return peepApi().PersonDelete(input.personId);
  },
  returns: {
    zodSchema: z.void().describe("删除操作无返回数据，仅表示操作成功"),
    schema: {
      type: "object" as const,
      description: "删除结果：void（无返回数据），仅表示操作成功",
    },
  },
};

/* ── 紫微斗数 ──────────────────────────────────────────── */

const ziweiFunction = {
  name: "ZiWei",
  description:
    "为指定命主排出紫微斗数完整盘面，按运限级别（大限/流年/流月/流日/流时）返回分析数据。" +
    "返回数据包含：(1) hbar 运限拨盘（大运/流年/流月/流日/流时列表及可见性），(2) chart 运限盘面（十二宫星曜、四化飞星等完整盘面数据）。" +
    "\n\n" +
    "⚠️ 重要提示：此接口会像人类一样操控 UI（导航到紫微页面、切换人物、等待渲染完成），耗时约 1-3 秒。" +
    "内部通过轮询等待 UI 状态稳定（pick/astrolabe 校验），不会超时。" +
    "用户看到的数据与 Agent 返回的数据完全一致——这是保证数据一致性的核心原则。" +
    "\n\n" +
    "适用于需要完整盘面数据的场景：查看十二宫星曜分布、分析四化飞星、查看具体宫位的吉凶星曜组合等。" +
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
    const parsedArgs = ziweiFunction.zodSchema.parse(args);
    // Agent 必须像人类一样操作 UI：导航页面、切换人物、等待渲染完成、再读取数据。
    // 不允许用 skipUI 绕过 UI——用户看到什么，Agent 就读到什么，保证数据一致。
    return peepApi().ZiWei(parsedArgs.personId, parsedArgs.scope, parsedArgs.time);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "紫微盘面数据 { person, hbar, chart }：person 是人物信息；" +
        "hbar 运限拨盘包含 decades(大限数组，每项含 palaceIndex, range, heavenlyStem, earthlyBranch, startYear, endYear)、" +
        "childhood(童限 { startYear, endYear, label })、years(流年数组，每项含 year, gz干支, age)、" +
        "months(流月数组，含 month, leap, label, solarLabel, gz)、days(流日数组)、hours(流时数组)、" +
        "pick(当前选中 { year, month, day, hour, leap })、visible(各级别可见性)；" +
        "chart 盘面包含 scope(运限级别)、palaces(十二宫数组，每宫含 palaceIndex, palaceName, branch, heavenlyStem, " +
        "majorStars(主星数组，含 name/brightness/mutagen)、minorStars(辅星)、adjectiveStars(杂耀)、" +
        "scopePalaceName(运限宫名)、scopeStars(运限星曜)、natalMutagens/scopeMutagens/selfMutagens(四化)、" +
        "decadalRange(大限区间)、ages(年龄)、changsheng12/boshi12/suiqian12/jiangqian12(十二神)、isBodyPalace/isOriginalPalace)、" +
        "flyMatrix(飞星矩阵，每项含 fromIndex, fromName, stem, flies 数组)、selfLinks(自化链接数组)",
    },
  },
};

const getScopeDataFunction = {
  name: "GetScopeData",
  description:
    "根据公历日期获取指定命主的运限数据（大运/流年/流月/流日/流时列表），纯计算接口，不操控 UI，响应快。" +
    "\n\n" +
    "✅ 适用场景：" +
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
    const parsedArgs = getScopeDataFunction.zodSchema.parse(args);
    return peepApi().GetScopeData(parsedArgs.solarDate, parsedArgs.personId);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "运限拨盘数据（同 ZiWei 的 hbar 结构）：decades(大限数组，每项含 palaceIndex, range[起岁,止岁], heavenlyStem, earthlyBranch, startYear, endYear)、" +
        "childhood(童限 { startYear, endYear, label })、activeDecadeIdx(当前大限索引)、" +
        "years(流年数组，每项含 year, gz干支, age)、activeYearIdx、" +
        "months(流月数组，含 month, leap, label, solarLabel, gz)、activeMonthIdx、" +
        "days(流日数组，含 day, label, solarLabel, gz)、activeDayIdx、" +
        "hours(流时数组，含 hour, label, gz)、activeHourIdx、" +
        "pick(当前选中 { year, month, day, hour, leap })、effLeap(有效闰月)、clampedDay(校正日)",
    },
  },
};

const daliurenCreateFunction = {
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
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type CreateInput = z.infer<typeof daliurenCreateFunction.zodSchema>;
    const parsedArgs = daliurenCreateFunction.zodSchema.parse(args) as CreateInput;
    // 安全确认：首次调用返回操作摘要
    if (!parsedArgs.confirmed) {
      return {
        _needsConfirmation: true,
        action: "大六壬起课",
        summary: `即将起课：「${parsedArgs.question}」${parsedArgs.tags?.length ? `，标签：${parsedArgs.tags.join("、")}` : ""}`,
        message: "请向用户确认起课信息，确认后再次调用并传入 confirmed: true",
      };
    }
    // 去掉 confirmed 字段后传给 debugApi
    const { confirmed: _c, ...params } = parsedArgs;
    void _c;
    // Agent 必须像人类一样操作 UI：导航到大六壬页面、切换人物、填写表单、提交
    return peepApi().DaLiuRenCreate(params);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "起课记录：personId, calculationTime, question, note, background, tags, savedAt, id, " +
        "result(完整课式数据，包含：fourPillars(四柱 { yearStem/YearBranch/.../yearPillar/... })、" +
        "monthGeneral(月将 { branch, name })、earthBoard/heeavenBoard(天地盘数组)、" +
        "fourLessons(四课数组，每项含 upper, lower, lowerType)、" +
        "xunKong(旬空 { xunHead, void1, void2 })、" +
        "threeTransmissions(三传 { initial, middle, final, method, trace })、" +
        "twelveGenerals(十二神数组，含 position, general, name)、" +
        "wangXiang(旺衰，0-11对应各地支)、liuQin(六亲)、xunDun(旬遁)、riDun(日遁)、" +
        "shenSha(神煞数组，含 name/branch/type/description)、relations(刑冲合害数组)、" +
        "keJing(课经数组，含 rule{code,name,group,description} + evidence)、biFa(毕法)、" +
        "jianChu(建除十二神)、naYin(纳音)、calculationTrace(推算过程)、fate(命宫/行年等))",
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
    const parsedArgs = daliurenListFunction.zodSchema.parse(args);
    // Agent 像人类一样操作 UI：导航到大六壬页面、切换人物、设置过滤条件、查询列表
    return peepApi().DaLiuRenList(parsedArgs);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "起课记录列表 { records, total }：records 是起课记录数组（每项同 DaLiuRenCreate 返回的完整结构），total 是总数",
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
    "⚠️ 性能提示：如需查看多个记录，请使用 DaLiuRenBatchView 批量查看（减少 UI 操作次数，避免超时）。" +
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
    const parsedArgs = daliurenViewFunction.zodSchema.parse(args);
    // Agent 像人类一样操作 UI：导航到大六壬页面、切换人物、选择记录、读取详情
    return peepApi().DaLiuRenView(parsedArgs);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "起课记录详情（同 DaLiuRenCreate 返回结构），另加 computed 字段：computed.result(同 result)、" +
        "computed.person(关联命主信息)。即包含 personId, calculationTime, question, note, background, tags, result, savedAt, id, computed",
    },
  },
};

const daliurenDeleteFunction = {
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
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
      "起课记录 ID——从 DaLiuRenList 返回的 records 中获取",
    ),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type DeleteInput = z.infer<typeof daliurenDeleteFunction.zodSchema>;
    const parsedArgs = daliurenDeleteFunction.zodSchema.parse(args) as DeleteInput;
    // 安全确认：不可逆操作，必须用户明确确认
    if (!parsedArgs.confirmed) {
      return {
        _needsConfirmation: true,
        action: "删除大六壬起课记录",
        summary: `即将删除起课记录 #${parsedArgs.recordId}（此操作不可撤销）`,
        message: "请明确告知用户此操作不可撤销，确认后再次调用并传入 confirmed: true",
      };
    }
    // 去掉 confirmed 字段后传给 debugApi
    const { confirmed: _c, ...params } = parsedArgs;
    void _c;
    // Delete 操作仅支持 skipUI 模式
    return peepApi().DaLiuRenDelete(params, { skipUI: true });
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "删除结果：void（无返回数据），仅表示操作成功",
    },
  },
};

/**
 * 批量查看大六壬起课记录——一次调用查看多个记录，减少 UI 操作次数。
 */
const daliurenBatchViewFunction = {
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
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    recordIds: z
      .array(z.number().int().positive())
      .min(1)
      .max(20)
      .describe("起课记录 ID 数组——要查看的记录 ID 列表，最多 20 个"),
  }),
  handler: async (args: Record<string, unknown>) => {
    const parsedArgs = daliurenBatchViewFunction.zodSchema.parse(args);
    const results = [];
    for (const recordId of parsedArgs.recordIds) {
      const record = await peepApi().DaLiuRenView({
        personId: parsedArgs.personId,
        recordId,
      });
      results.push(record);
    }
    return { records: results, count: results.length };
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "批量查看结果 { records, count }：records 是记录详情数组（每项同对应的 View 返回结构），count 是记录数量",
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
    const parsedArgs = wikiListFunction.zodSchema.parse(args);
    // Agent 像人类一样操作 UI：导航到 Wiki 页面、切换人物、设置过滤条件、查询列表
    return peepApi().WikiList(parsedArgs);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "文档列表 { docs, total }：docs 是文档数组（每项含 personId, title, content, tags, savedAt, updatedAt, id），total 是总数",
    },
  },
};

const wikiCreateFunction = {
  name: "WikiCreate",
  description:
    "创建一篇 Wiki 文档（Markdown 正文），可设置标签与关联文档。" +
    "\n\n" +
    "⚠️ 安全机制：首次调用会返回操作摘要（不执行创建），" +
    "你需要将摘要展示给用户并获得确认后，再次调用并传入 confirmed: true 才会真正创建。" +
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
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type CreateInput = z.infer<typeof wikiCreateFunction.zodSchema>;
    const parsedArgs = wikiCreateFunction.zodSchema.parse(args) as CreateInput;
    // 安全确认：首次调用返回操作摘要
    if (!parsedArgs.confirmed) {
      return {
        _needsConfirmation: true,
        action: "创建 Wiki 文档",
        summary: `即将创建文档：「${parsedArgs.title}」${parsedArgs.tags?.length ? `，标签：${parsedArgs.tags.join("、")}` : ""}`,
        message: "请向用户确认文档信息，确认后再次调用并传入 confirmed: true",
      };
    }
    // 去掉 confirmed 字段后传给 debugApi
    const { confirmed: _c, ...params } = parsedArgs;
    void _c;
    // Agent 像人类一样操作 UI：导航到 Wiki 页面、切换人物、打开编辑器、保存文档
    return peepApi().WikiCreate(params);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "文档对象：personId, title, content(Markdown正文), tags(标签数组), savedAt, updatedAt, id",
    },
  },
};

const wikiUpdateFunction = {
  name: "WikiUpdate",
  description:
    "更新已有 Wiki 文档的标题、内容、标签或关联。" +
    "\n\n" +
    "⚠️ 安全机制：首次调用会返回操作摘要（不执行更新），" +
    "你需要将摘要展示给用户并获得确认后，再次调用并传入 confirmed: true 才会真正更新。" +
    "\n\n" +
    "使用场景：" +
    "(1) 修改文档标题或内容；" +
    "(2) 更新文档标签；" +
    "(3) 调整文档关联关系。" +
    "\n\n" +
    "所有字段都是可选的，只更新提供的字段。" +
    "\n\n" +
    "示例：WikiUpdate({ docId: 123, title: '新标题', tags: ['格局'] })。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    docId: withMeta(z.number().int().positive(), { example: 123 }).describe("要更新的文档 ID"),
    title: withMeta(z.string(), { example: "新标题" }).optional().describe("新标题（可选）"),
    content: withMeta(z.string(), { example: "# 更新后的内容\n\n..." })
      .optional()
      .describe("新 Markdown 正文（可选）"),
    tags: z.array(z.string()).optional().describe("新标签列表（可选，会替换原有标签）"),
    linkTargetIds: z
      .array(z.number().int().positive())
      .optional()
      .describe("新关联文档 ID 列表（可选，会替换原有关联）"),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type UpdateInput = z.infer<typeof wikiUpdateFunction.zodSchema>;
    const parsedArgs = wikiUpdateFunction.zodSchema.parse(args) as UpdateInput;
    // 安全确认：首次调用返回操作摘要
    if (!parsedArgs.confirmed) {
      const updates = [];
      if (parsedArgs.title) updates.push(`标题→"${parsedArgs.title}"`);
      if (parsedArgs.content) updates.push("内容已修改");
      if (parsedArgs.tags) updates.push(`标签→[${parsedArgs.tags.join(",")}]`);
      if (parsedArgs.linkTargetIds) updates.push(`关联→[${parsedArgs.linkTargetIds.join(",")}]`);
      return {
        _needsConfirmation: true,
        action: "更新 Wiki 文档",
        summary: `即将更新文档 #${parsedArgs.docId}：${updates.join("，") || "无修改"}`,
        message: "请向用户确认更新内容，确认后再次调用并传入 confirmed: true",
      };
    }
    // 去掉 confirmed 字段后传给 debugApi
    const { confirmed: _c, ...params } = parsedArgs;
    void _c;
    // Agent 像人类一样操作 UI：导航到 Wiki 页面、切换人物、选择文档、保存更新
    return peepApi().WikiUpdate(params);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "更新后的文档对象：personId, title, content, tags, savedAt, updatedAt(已更新), id",
    },
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
    "⚠️ 性能提示：如需查看多个文档，请使用 WikiBatchView 批量查看（减少 UI 操作次数，避免超时）。" +
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
    const parsedArgs = wikiViewFunction.zodSchema.parse(args);
    // Agent 像人类一样操作 UI：导航到 Wiki 页面、切换人物、选择文档、读取详情
    return peepApi().WikiView(parsedArgs);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "文档详情：personId, title, content(Markdown正文), tags, savedAt, updatedAt, id, linkTargetIds(关联文档ID数组)",
    },
  },
};

/**
 * 批量查看 Wiki 文档——一次调用查看多个文档，减少 UI 操作次数。
 *
 * 性能优化：内部复用页面导航和人物选择，只在首次调用时执行完整 UI 流程，
 * 后续文档复用已加载的页面状态。适用于需要对比多个文档内容的场景。
 */
const wikiBatchViewFunction = {
  name: "WikiBatchView",
  description:
    "批量查看多个 Wiki 文档的完整内容——一次调用查看多个文档，显著减少 UI 操作时间。" +
    "\n\n" +
    "使用场景：" +
    "(1) 需要对比多个文档内容时；" +
    "(2) 需要连续阅读多篇相关文档时；" +
    "(3) 避免因多次单独调用 WikiView 导致超时。" +
    "\n\n" +
    "⚠️ 与 WikiView 的区别：WikiBatchView 内部优化了 UI 操作——只在首次调用时导航页面和选择人物，" +
    "后续文档复用已加载的页面状态，因此查看多个文档时比多次调用 WikiView 快得多。" +
    "\n\n" +
    "示例：WikiBatchView({ docIds: [1, 2, 3, 4] }) — 批量查看 ID 为 1,2,3,4 的文档。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    docIds: z
      .array(z.number().int().positive())
      .min(1)
      .max(20)
      .describe("文档 ID 数组——要查看的文档 ID 列表，最多 20 个"),
  }),
  handler: async (args: Record<string, unknown>) => {
    const parsedArgs = wikiBatchViewFunction.zodSchema.parse(args);
    // 批量查看：复用页面导航和人物选择，减少 UI 操作次数
    const results = [];
    for (const docId of parsedArgs.docIds) {
      const doc = await peepApi().WikiView({
        personId: parsedArgs.personId,
        docId,
      });
      results.push(doc);
    }
    return { docs: results, count: results.length };
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "批量查看结果 { docs, count }：docs 是文档详情数组（每项同 WikiView 返回结构），count 是文档数量",
    },
  },
};

/* ── 六爻 ──────────────────────────────────────────── */

const liuyaoCreateFunction = {
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
  }),
  handler: (args: Record<string, unknown>) => {
    type CreateInput = z.infer<typeof liuyaoCreateFunction.zodSchema>;
    const parsedArgs = liuyaoCreateFunction.zodSchema.parse(args) as CreateInput;
    // 安全确认：首次调用返回操作摘要
    if (!parsedArgs.confirmed) {
      const linesInfo = parsedArgs.lines ? `手动六爻：[${parsedArgs.lines.join(",")}]` : "自动摇卦";
      return {
        _needsConfirmation: true,
        action: "六爻起卦",
        summary: `即将起卦：「${parsedArgs.question}」（${linesInfo}，求测对象：${parsedArgs.yongTarget ?? "自占"}）${parsedArgs.tags?.length ? `，标签：${parsedArgs.tags.join("、")}` : ""}`,
        message: "请向用户确认起卦信息，确认后再次调用并传入 confirmed: true",
      };
    }
    // 去掉 confirmed 字段后传给 debugApi
    const { confirmed: _c, ...params } = parsedArgs;
    void _c;
    // 类型转换：Zod 推断的 lines 是 number[]，需转为 SixLines 元组
    // 调试 API 内部会再次验证 lines 的值范围（0-3），所以这里可以安全断言
    const createParams = {
      ...params,
      lines: params.lines as SixLines | undefined,
    };
    // Agent 必须像人类一样操作 UI：导航到六爻页面、切换人物、填写表单、提交
    return peepApi().LiuYaoCreate(createParams);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "起卦记录：personId, divinationTime, question, background, note, tags, lines(六爻值数组), " +
        "chart(卦象 { name(卦名), palace(宫), palaceElem(宫五行), type(卦类型), shi(世爻位), ying(应爻位), " +
        "lines(六爻数组，每爻含 pos/yang/moving/stem/branch/elem(五行)/rel(六亲)/god(六神)/kong/kongState)、" +
        "changed(变卦 { name, lines })、month(月建 { branch, elem })、day(日辰 { stem, branch, elem, kong })})、" +
        "yongTarget(求测对象), yong(用神 { rel, pos, pickedBy, hidden }), savedAt, id",
    },
  },
};

const liuyaoListFunction = {
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
    const parsedArgs = liuyaoListFunction.zodSchema.parse(args);
    // Agent 像人类一样操作 UI：导航到六爻页面、切换人物、设置过滤条件、查询列表
    return peepApi().LiuYaoList(parsedArgs);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "起卦记录列表 { records, total }：records 是起卦记录数组（每项同 LiuYaoCreate 返回结构），total 是总数",
    },
  },
};

const liuyaoViewFunction = {
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
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
      "起卦记录 ID——从 LiuYaoList 返回的 records 中获取",
    ),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = liuyaoViewFunction.zodSchema.parse(args);
    // Agent 像人类一样操作 UI：导航到六爻页面、切换人物、选择记录、读取详情
    return peepApi().LiuYaoView(parsedArgs);
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "起卦记录详情（同 LiuYaoCreate 返回结构），另加 computed 字段：computed.chart(同 chart)、" +
        "computed.yong(同 yong)、computed.person(关联命主)、" +
        "computed.hbarData(运限拨盘 { years, months, days, hours 数组及对应 activeIdx })、" +
        "computed.vigorColumns(旺衰列 { columns(旺衰数组), changedColumns(变爻旺衰), columnBranches(地支), columnRoles(角色如太岁/月建), visible })",
    },
  },
};

const liuyaoDeleteFunction = {
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
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    recordId: withMeta(z.number().int().positive(), { example: 123 }).describe(
      "起卦记录 ID——从 LiuYaoList 返回的 records 中获取",
    ),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type DeleteInput = z.infer<typeof liuyaoDeleteFunction.zodSchema>;
    const parsedArgs = liuyaoDeleteFunction.zodSchema.parse(args) as DeleteInput;
    // 安全确认：不可逆操作，必须用户明确确认
    if (!parsedArgs.confirmed) {
      return {
        _needsConfirmation: true,
        action: "删除六爻起卦记录",
        summary: `即将删除起卦记录 #${parsedArgs.recordId}（此操作不可撤销）`,
        message: "请明确告知用户此操作不可撤销，确认后再次调用并传入 confirmed: true",
      };
    }
    // 去掉 confirmed 字段后传给 debugApi
    const { confirmed: _c, ...params } = parsedArgs;
    void _c;
    // Delete 操作仅支持 skipUI 模式
    return peepApi().LiuYaoDelete(params, { skipUI: true });
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "删除结果：void（无返回数据），仅表示操作成功",
    },
  },
};

/**
 * 批量查看六爻起卦记录——一次调用查看多个记录，减少 UI 操作次数。
 */
const liuyaoBatchViewFunction = {
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
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    recordIds: z
      .array(z.number().int().positive())
      .min(1)
      .max(20)
      .describe("起卦记录 ID 数组——要查看的记录 ID 列表，最多 20 个"),
  }),
  handler: async (args: Record<string, unknown>) => {
    const parsedArgs = liuyaoBatchViewFunction.zodSchema.parse(args);
    const results = [];
    for (const recordId of parsedArgs.recordIds) {
      const record = await peepApi().LiuYaoView({
        personId: parsedArgs.personId,
        recordId,
      });
      results.push(record);
    }
    return { records: results, count: results.length };
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "批量查看结果 { records, count }：records 是记录详情数组（每项同对应的 View 返回结构），count 是记录数量",
    },
  },
};

/* ── 时间/日历（Lunar） ──────────────────────────────────────────── */

const solarToLunarFunction = {
  name: "SolarToLunar",
  description:
    "公历转农历——将公历日期转换为农历日期，返回农历日期及干支信息。" +
    "\n\n" +
    "使用场景：" +
    "(1) 用户提供公历生日，需要转换为农历；" +
    "(2) 查看某天的农历日期及年/月/日干支；" +
    "(3) 确定某天的生肖。" +
    "\n\n" +
    "返回数据包含：农历年月日、是否闰月、年月日干支、生肖。" +
    "\n\n" +
    "示例：SolarToLunar({ date: '2024-06-15' }) — 将 2024年6月15日 转为农历。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "2024-06-15" }).describe(
      "公历日期，格式 YYYY-MM-DD 或 YYYY-MM-DD HH:mm",
    ),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = solarToLunarFunction.zodSchema.parse(args);
    return peepApi().SolarToLunar({ date: parsedArgs.date });
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "农历日期对象：year(农历年), month(农历月), day(农历日), isLeap(是否闰月), " +
        "yearGanZhi(年干支), monthGanZhi(月干支), dayGanZhi(日干支), zodiac(生肖)",
    },
  },
};

const lunarToSolarFunction = {
  name: "LunarToSolar",
  description:
    "农历转公历——将农历日期转换为公历日期。" +
    "\n\n" +
    "使用场景：" +
    "(1) 用户提供农历生日，需要转换为公历；" +
    "(2) 确定农历某日对应的公历日期。" +
    "\n\n" +
    "示例：LunarToSolar({ year: 2024, month: 5, day: 10 }) — 将农历2024年五月初十转为公历。",
  zodSchema: z.object({
    year: withMeta(z.number().int().positive(), { example: 2024 }).describe("农历年份"),
    month: withMeta(z.number().int().min(1).max(12), { example: 5 }).describe("农历月份 1-12"),
    day: withMeta(z.number().int().min(1).max(30), { example: 10 }).describe("农历日期 1-30"),
    isLeap: withMeta(z.boolean(), { example: false }).optional().describe("是否闰月（默认 false）"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = lunarToSolarFunction.zodSchema.parse(args);
    return peepApi().LunarToSolar({
      year: parsedArgs.year,
      month: parsedArgs.month,
      day: parsedArgs.day,
      isLeap: parsedArgs.isLeap,
    });
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "公历日期对象：{ date: 'YYYY-MM-DD' }",
    },
  },
};

const getEightCharactersFunction = {
  name: "GetEightCharacters",
  description:
    "获取八字（四柱）——根据公历日期时间计算年月日时四柱的天干地支及纳音。" +
    "\n\n" +
    "使用场景：" +
    "(1) 用户的出生时间已知，需要排出八字；" +
    "(2) 分析命理格局时需要八字作为基础数据；" +
    "(3) 查看某时刻的四柱干支。" +
    "\n\n" +
    "返回数据包含：年柱/月柱/日柱/时柱，每柱包含天干地支（ganZhi）和纳音（naYin）。" +
    "\n\n" +
    "示例：GetEightCharacters({ date: '1990-06-15 14:30' }) — 计算该时刻的八字。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "1990-06-15 14:30" }).describe(
      "公历日期时间，格式 YYYY-MM-DD HH:mm",
    ),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getEightCharactersFunction.zodSchema.parse(args);
    return peepApi().GetEightCharacters({ date: parsedArgs.date });
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "八字对象：year/month/day/hour 四柱，每柱含 ganZhi(天干地支) 和 naYin(纳音五行)。" +
        "例：{ year: { ganZhi: '甲辰', naYin: '覆灯火' }, month: {...}, day: {...}, hour: {...} }",
    },
  },
};

const getSolarTermsFunction = {
  name: "GetSolarTerms",
  description:
    "获取某年的 24 节气——返回该年所有节气的名称和公历日期。" +
    "\n\n" +
    "使用场景：" +
    "(1) 查看某年有哪些节气及其日期；" +
    "(2) 确定节气交接的时间点；" +
    "(3) 分析节气与运限的关系。" +
    "\n\n" +
    "返回数据包含：节气列表，每项有 name（节气名称）、date（公历日期）、description（描述）。" +
    "\n\n" +
    "示例：GetSolarTerms({ year: 2024 }) — 获取 2024 年的 24 节气。",
  zodSchema: z.object({
    year: withMeta(z.number().int().positive(), { example: 2024 }).describe("年份"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getSolarTermsFunction.zodSchema.parse(args);
    return peepApi().GetSolarTerms({ year: parsedArgs.year });
  },
  returns: {
    schema: {
      type: "array" as const,
      description:
        "节气数组（24项），每项含 name(节气名，如'冬至'/'小寒')、date(公历日期 YYYY-MM-DD)、description(描述)",
    },
  },
};

const getCurrentSolarTermFunction = {
  name: "GetCurrentSolarTerm",
  description:
    "获取当前/指定日期的节气信息——返回当前所在的节气（节/气）及下一个节气。" +
    "\n\n" +
    "使用场景：" +
    "(1) 查看今天处于哪个节气；" +
    "(2) 确定下一个节气是什么时候；" +
    "(3) 分析当前时节对运势的影响。" +
    "\n\n" +
    "返回数据包含：currentJie/currentQi（当前节/气）、nextJie/nextQi（下一个节/气），每项有 name 和 date。" +
    "\n\n" +
    "示例：GetCurrentSolarTerm({ date: '2024-06-15' }) — 获取该日期的节气信息，省略 date 则用今天。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "2024-06-15" })
      .optional()
      .describe("公历日期（可选），省略则用当前日期"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getCurrentSolarTermFunction.zodSchema.parse(args);
    return peepApi().GetCurrentSolarTerm({ date: parsedArgs.date });
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "节气信息：currentJie/currentQi(当前节/气，含 name 和 date，可能为 null)、" +
        "nextJie/nextQi(下一个节/气，含 name 和 date)",
    },
  },
};

const getChineseCalendarFunction = {
  name: "GetChineseCalendar",
  description:
    "获取传统黄历信息——返回某日的宜忌、冲煞、彭祖百忌、胎神、五行、星宿等传统历法信息。" +
    "\n\n" +
    "使用场景：" +
    "(1) 查看某天适合做什么（宜）、不适合做什么（忌）；" +
    "(2) 了解当日的冲煞方位；" +
    "(3) 传统择日参考。" +
    "\n\n" +
    "返回数据包含：yi（宜事项列表）、ji（忌事项列表）、chong（冲）、sha（煞）、pengZu（彭祖百忌）、taiShen（胎神）、wuXing（五行）、xingXiu（星宿）等。" +
    "\n\n" +
    "示例：GetChineseCalendar({ date: '2024-06-15' }) — 获取该日的黄历信息。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "2024-06-15" })
      .optional()
      .describe("公历日期（可选），省略则用当前日期"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getChineseCalendarFunction.zodSchema.parse(args);
    return peepApi().GetChineseCalendar({ date: parsedArgs.date });
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "黄历信息：yi(宜事项数组)、ji(忌事项数组)、chong(冲，地支)、sha(煞，方位)、" +
        "pengZu(彭祖百忌)、taiShen(胎神)、wuXing(五行)、xingXiu(星宿)、xingXiuAnimal(星宿动物)、xingXiuLuck(星宿吉凶)",
    },
  },
};

const getDailyInfoFunction = {
  name: "GetDailyInfo",
  description:
    "获取每日综合信息——返回某日的公历/农历日期、干支、生肖、星座、节日、星期等综合信息。" +
    "\n\n" +
    "使用场景：" +
    "(1) 快速了解某日的基本信息；" +
    "(2) 查看当天是否为节日或周末；" +
    "(3) 确定某日的星座和生肖。" +
    "\n\n" +
    "返回数据包含：solar（公历）、lunar（农历）、ganZhi（年月日干支）、zodiac（生肖）、constellation（星座）、festival（节日列表）、isWeekend（是否周末）、weekDay（星期几）。" +
    "\n\n" +
    "示例：GetDailyInfo({ date: '2024-06-15' }) — 获取该日的综合信息。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "2024-06-15" })
      .optional()
      .describe("公历日期（可选），省略则用当前日期"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getDailyInfoFunction.zodSchema.parse(args);
    return peepApi().GetDailyInfo({ date: parsedArgs.date });
  },
  returns: {
    schema: {
      type: "object" as const,
      description:
        "每日综合信息：solar(公历日期)、lunar(农历日期)、ganZhi({ year, month, day }干支)、" +
        "zodiac(生肖)、constellation(星座)、festival(节日数组)、isWeekend(是否周末)、weekDay(星期几，0-6)",
    },
  },
};

const getZodiacFunction = {
  name: "GetZodiac",
  description:
    "获取生肖——根据日期获取对应的生肖（基于农历年）。" +
    "\n\n" +
    "使用场景：" +
    "(1) 确定某人的生肖；" +
    "(2) 查看某年的生肖。" +
    "\n\n" +
    "返回数据包含：zodiac（生肖）、year（农历年份）。" +
    "\n\n" +
    "示例：GetZodiac({ date: '1990-06-15' }) — 获取该日期对应的生肖。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "1990-06-15" })
      .optional()
      .describe("公历日期（可选），省略则用当前日期"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getZodiacFunction.zodSchema.parse(args);
    return peepApi().GetZodiac({ date: parsedArgs.date });
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "生肖信息：{ zodiac(生肖名，如'马'), year(农历年份) }",
    },
  },
};

const getConstellationFunction = {
  name: "GetConstellation",
  description:
    "获取星座——根据公历日期获取对应的西方星座。" +
    "\n\n" +
    "使用场景：" +
    "(1) 确定某人的星座；" +
    "(2) 查看星座的五行属性和吉凶。" +
    "\n\n" +
    "返回数据包含：constellation（星座名称）、element（五行属性）、luck（吉凶）。" +
    "\n\n" +
    "示例：GetConstellation({ date: '1990-06-15' }) — 获取该日期对应的星座。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "1990-06-15" })
      .optional()
      .describe("公历日期（可选），省略则用当前日期"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getConstellationFunction.zodSchema.parse(args);
    return peepApi().GetConstellation({ date: parsedArgs.date });
  },
  returns: {
    schema: {
      type: "object" as const,
      description: "星座信息：{ constellation(星座名，如'双子'), element(五行属性), luck(吉凶) }",
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
 * - liuyao：六爻起卦占卜，适合具体事件的占断
 * - wiki：命理知识库，存储学习笔记和参考资料
 */
const FUNCTION_GROUPS = [
  {
    name: "person",
    description:
      "命主档案增删改查——分析前必须先确认命主。" +
      "典型流程：先 PersonList 查看有哪些命主，再 PersonGet 获取详情，" +
      "如需新建则 PersonCreate。" +
      "\n\n支持的操作：List（列表）、Get（详情）、Create（创建）、Update（更新）、Delete（删除）。",
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
      "ZiWei 会像人类一样操控 UI（导航、切换人物、等待渲染），返回完整盘面数据；" +
      "GetScopeData 为纯计算接口，响应快，适合仅查看运限拨盘的场景。" +
      "\n\n支持的操作：排盘查看（只读，无增删改）。",
    functions: [getScopeDataFunction, ziweiFunction],
  },
  {
    name: "daliuren",
    description:
      "大六壬起课与占卜——适合具体事件的占断（如'这笔生意能不能做''考试能否通过'）。" +
      "典型流程：DaLiuRenCreate 起课 → DaLiuRenList 查看列表 → DaLiuRenView 查看详情。" +
      "\n\n支持的操作：Create（起课）、List（列表）、View（详情）、Delete（删除）、BatchView（批量查看详情）。" +
      "\n⚠️ 注意：不支持 Update（修改）——起课记录一旦创建不可更改，但可以删除。",
    functions: [
      daliurenCreateFunction,
      daliurenListFunction,
      daliurenViewFunction,
      daliurenDeleteFunction,
      daliurenBatchViewFunction,
    ],
  },
  {
    name: "liuyao",
    description:
      "六爻起卦与占卜——适合具体事件的占断（如'这笔生意能不能做''考试能否通过'）。" +
      "六爻以铜钱摇卦得出六爻值，通过纳甲、五行、六亲、六神等分析吉凶。" +
      "典型流程：LiuYaoCreate 起卦 → LiuYaoList 查看列表 → LiuYaoView 查看详情。" +
      "\n\n支持的操作：Create（起卦）、List（列表）、View（详情）、Delete（删除）、BatchView（批量查看详情）。" +
      "\n⚠️ 注意：不支持 Update（修改）——起卦记录一旦创建不可更改，但可以删除。",
    functions: [
      liuyaoCreateFunction,
      liuyaoListFunction,
      liuyaoViewFunction,
      liuyaoDeleteFunction,
      liuyaoBatchViewFunction,
    ],
  },
  {
    name: "wiki",
    description:
      "命理知识库管理——存储学习笔记、格局解析、案例分析等 Markdown 文档。" +
      "典型流程：WikiList 搜索文档 → WikiView 查看详情 → WikiCreate 新建笔记 → WikiUpdate 修改文档。" +
      "\n\n支持的操作：List（列表）、View（详情）、Create（创建）、Update（更新）、BatchView（批量查看详情）。" +
      "\n⚠️ 注意：不支持 Delete（删除）——文档一旦创建不可删除（可更新内容）。" +
      "\n💡 性能提示：查看多个文档时请使用 BatchView，比多次调用 View 更快（减少 UI 操作次数）。",
    functions: [
      wikiListFunction,
      wikiViewFunction,
      wikiCreateFunction,
      wikiUpdateFunction,
      wikiBatchViewFunction,
    ],
  },
  {
    name: "lunar",
    description:
      "时间/日历相关计算——公历农历转换、八字、节气、黄历、生肖星座。" +
      "典型流程：SolarToLunar 公历转农历，LunarToSolar 农历转公历，GetEightCharacters 获取八字，" +
      "GetSolarTerms/GetCurrentSolarTerm 获取节气信息，GetChineseCalendar 获取黄历，" +
      "GetDailyInfo 获取每日综合信息，GetZodiac 获取生肖，GetConstellation 获取星座。" +
      "\n\n支持的操作：日期转换、八字计算、节气查询、黄历查询、生肖星座查询。",
    functions: [
      solarToLunarFunction,
      lunarToSolarFunction,
      getEightCharactersFunction,
      getSolarTermsFunction,
      getCurrentSolarTermFunction,
      getChineseCalendarFunction,
      getDailyInfoFunction,
      getZodiacFunction,
      getConstellationFunction,
    ],
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
    agentDescription: "紫微斗数 · 大六壬 · 六爻 · 知识库 —— 命理分析 AI 助手",
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
 *
 * 返回值：cleanup 函数，用于在组件卸载时移除监听器，避免内存泄漏。
 * 若 agent 未初始化则返回 no-op 函数。
 */
export function startThemeSync(): () => void {
  if (!_agent) return () => {};

  // 1. 监听 :root[data-theme] 变化
  const observer = new MutationObserver(() => syncTheme());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // 2. 监听系统主题变化
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => syncTheme();
  mql.addEventListener("change", handler);

  // 返回清理函数：断开 MutationObserver、移除 matchMedia 监听器
  return () => {
    observer.disconnect();
    mql.removeEventListener("change", handler);
  };
}
