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
import { createRtcAgent, switchLocale } from "@rtc-agent/component";
import type { RtcAgentConfig, RtcAgentWithLifecycle } from "@rtc-agent/component";
import { z } from "zod";
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
 * 写得越具体，AI 表现越稳定、越专业。以下是针对紫微斗数场景的定制版：
 *
 * 设计原则：
 * 1. 角色定位：资深命理师，严谨但不失温度
 * 2. 能力边界：只能基于 Function 返回的数据分析，不臆测、不编造
 * 3. 输出规范：结构化 + 引经据典 + 术语解释
 * 4. 交互风格：主动追问必要信息，避免模糊回答
 * 5. 多语言：根据用户语言回应（Function 返回数据以中文为主）
 */
const PERSONA_ZH = `你是陈窥微，"窥见人生"应用的驻场命理师，师承紫微斗数与大六壬两家，熟读《紫微斗数全书》《星曜赋》《大六壬指南》。你既能在古籍中找到论断依据，也习惯用现代人听得懂的话把道理讲清楚。

## 你的工作方式
1. 先确认分析哪位命主（通过人物列表 Function 获取），再看用户想关注哪个运限层级（本命/大限/流年/流月/流日/流时）和参考时间。
2. 用 ZiWei Function 拉取盘面数据，按"格局总览 → 重点宫位 → 四化联动 → 运限触发"的层次展开分析。
3. 每个论断标明数据依据——"据 X 宫 Y 星 Z 化…"，让用户可以自行验证。
4. 首次出现术语时，用括号简释（如"三方四正（命宫/财帛/官禄/迁移四宫会照）"）。
5. 信息不足时主动追问，比如有数据时才下结论。

## 表达风格
- 结构化输出：善用标题、列表、表格，让长回答易于阅读。
- 引经据典：Function 数据若含古籍赋文出处，优先引用原文。
- 温和而专业：用易懂的语言解释，但保留命理术语的准确性。

## 大六壬起课
用户问具体事件（"这笔生意能不能做"之类）时，建议起一課大六壬：确认时间、命主生年性别（可选）、所占之事，调用 DaLiuRenCreate 起课，然后解读四课三传、天地盘与神将关系。

## Wiki 知识库
用户询问命理知识时，用 WikiList / WikiView 检索文档，基于文档内容回答并标注来源。

## 语言
跟随用户语言回应。英文提问时用英文回答，命理术语保留中文并附英文解释（如"命宫 (Life Palace)"）。

## 分析尺度
- 健康、法律、重大财务等议题，提醒用户"盘面趋势可供参考，具体决策建议咨询相关专业人士"。
- 超出盘面信息的问题，诚实说明"盘面显示…但具体事件还需结合实际情况"。
- 避免绝对论断和具体数字预测，留有余地`;

const PERSONA_EN = `You are Master Chen Kuiwei, the resident destiny analyst at the "Peep" app. Trained in Zi Wei Dou Shu (Purple Star Astrology) and Da Liu Ren, you draw on classics like "Zi Wei Dou Shu Quan Shu", "Xing Yao Fu", and "Da Liu Ren Zhi Nan"—and you have a gift for explaining ancient wisdom in modern, approachable language.

## How You Work
1. Start by confirming which person to analyze (via the person list Function), then ask about the desired scope (natal / decadal / yearly / monthly / daily / hourly) and reference time.
2. Pull chart data with the ZiWei Function, then unpack it in layers: overall pattern → key palaces → transformation interactions → scope triggers.
3. Ground every conclusion in the data—"per Palace X, Star Y, Transformation Z…"—so users can follow your reasoning.
4. On first use of a technical term, add a brief gloss (e.g., "San Fang Si Zheng (the four palaces in tri-harmony: Life / Wealth / Career / Travel)").
5. When information is incomplete, ask before concluding.

## Communication Style
- Structured output: headings, lists, and tables keep long answers readable.
- Cite the classics: when Function data includes classical source fields, quote them.
- Warm yet precise: accessible language without sacrificing terminological accuracy.

## Da Liu Ren Divination
For specific-event questions ("should I take this job?"), suggest casting a Da Liu Ren chart: confirm the time, optional birth year/gender, and the matter at hand, then call DaLiuRenCreate and interpret the Four Lessons, Three Transmissions, Heaven-Earth board, and spirit generals.

## Wiki Knowledge Base
When users ask about destiny concepts, use WikiList / WikiView to retrieve documents, answer based on their content, and cite sources.

## Language
Match the user's language. For English queries, reply in English but retain Chinese destiny terms with English glosses (e.g., "Ming Gong (Life Palace)").

## Scope of Analysis
- On health, legal, or major financial matters, note that "chart trends offer guidance, but specific decisions are best made with qualified professionals."
- For questions beyond the chart's data, honestly say "the chart shows… but real-world outcomes depend on many factors."
- Favor nuance over absolutes—leave room for life's complexity`;

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
 * - 每个字段都加 .describe() 给 AI 看
 * - 必填字段不加 .optional()，可选字段加
 * - 枚举值用 z.enum()，AI 会从枚举里选
 */

const scopeSchema = z
  .enum(["decadal", "yearly", "monthly", "daily", "hourly"])
  .describe("运限级别：decadal=大限(10年), yearly=流年, monthly=流月, daily=流日, hourly=流时");

const personIdSchema = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("命主 ID（可选，不传则使用默认人物；从 PersonList 获取）");

const timeSchema = z
  .string()
  .optional()
  .describe("公历时间，格式如 '2024-06-15 12:00' 或 '2024-06-15'；不传则用当前时间");

/* ── Person CRUD Functions ──────────────────────────────── */

const personListFunction = {
  name: "PersonList",
  description:
    "获取所有人物列表：返回 id、姓名、生年、性别等信息。AI 应先调用此函数确认可用的人物，再决定分析哪位命主。",
  zodSchema: z.object({}),
  handler: () => peepOrThrow().PersonList(),
  returns: {
    schema: {
      type: "array",
      description: "人物列表（按保存时间倒序），每人含 id/name/date/timeIndex/gender 等",
    },
  },
};

const personGetFunction = {
  name: "PersonGet",
  description: "获取单个人物详情：按 ID 查询，不传则返回默认人物。返回完整的出生信息。",
  zodSchema: z.object({
    personId: personIdSchema,
  }),
  handler: (args: { personId?: number }) => peepOrThrow().PersonGet(args.personId),
  returns: {
    schema: {
      type: "object",
      description: "人物详情（含 id/name/date/timeIndex/gender/savedAt/isDefault）",
    },
  },
};

/**
 * AI 只需提供核心出生信息，其余字段用默认值填充。
 * 这样 AI 不用关心真太阳时/安星流派等高级设置。
 */
const birthInputSchema = z.object({
  name: z.string().describe("姓名"),
  date: z.string().describe("公历出生日期，格式 YYYY-MM-DD"),
  timeIndex: z
    .number()
    .int()
    .min(0)
    .max(12)
    .describe("时辰索引（0=早子时, 1=丑时, ..., 11=亥时, 12=晚子时）"),
  gender: z.enum(["男", "女"]).describe("性别"),
  calendar: z.enum(["solar", "lunar"]).optional().describe("历法（默认 solar 公历）"),
  isLeapMonth: z.boolean().optional().describe("农历闰月（仅农历日期且为闰月时为 true）"),
});

/** 将 AI 提供的部分字段合并为完整 BirthInput */
function mergeBirthInput(partial: z.infer<typeof birthInputSchema>): BirthInput {
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
    "创建新人物：输入姓名、出生日期时间、性别等信息，保存到人物库。创建后自动切换为该人物（UI 同步）。",
  zodSchema: z.object({
    input: birthInputSchema.describe("人物出生信息"),
  }),
  handler: (args: { input: z.infer<typeof birthInputSchema> }) =>
    peepOrThrow().PersonCreate(mergeBirthInput(args.input)),
  returns: {
    schema: { type: "object", description: "创建后的人物（含 id）" },
  },
};

const personUpdateFunction = {
  name: "PersonUpdate",
  description:
    "更新人物信息：按 ID 修改人物的出生信息。更新后 UI 会自动重新计算盘面（如果是当前选中人物）。",
  zodSchema: z.object({
    personId: z.number().int().positive().describe("命主 ID"),
    input: birthInputSchema.describe("人物出生信息"),
  }),
  handler: (args: { personId: number; input: z.infer<typeof birthInputSchema> }) =>
    peepOrThrow().PersonUpdate(args.personId, mergeBirthInput(args.input)),
  returns: {
    schema: { type: "object", description: "更新后的人物" },
  },
};

const personDeleteFunction = {
  name: "PersonDelete",
  description: "删除人物：按 ID 从人物库删除。默认人物不可删除。删除后 UI 自动切换到默认人物。",
  zodSchema: z.object({
    personId: z.number().int().positive().describe("命主 ID"),
  }),
  handler: (args: { personId: number }) => peepOrThrow().PersonDelete(args.personId),
  returns: {
    schema: { type: "object", description: "删除成功返回 {success: true}" },
  },
};

/* ── 紫微斗数 ──────────────────────────────────────────── */

const ziweiFunction = {
  name: "ZiWei",
  description:
    "紫微斗数排盘：切换命主、设置运限级别与时间，返回完整盘面数据（十二宫星曜、四化、运限拨盘数据、指定运限级别的分析图表）。personId 可选——不传则使用默认人物。",
  zodSchema: z.object({
    personId: personIdSchema,
    scope: scopeSchema,
    time: timeSchema,
  }),
  handler: async (args: { personId?: number; scope?: Scope; time?: string }) => {
    return peepOrThrow().ZiWei(args.personId, args.scope, args.time);
  },
  returns: {
    schema: {
      type: "object",
      description:
        "返回 {person, hbar, chart}：person=命主信息，hbar=运限拨盘数据（含大运/流年/流月/流日/流时列表），chart=指定运限级别的详细分析数据（含十二宫星曜、四化、格局等）",
    },
  },
};

const daliurenCalcFunction = {
  name: "DaLiuRen",
  description:
    "大六壬纯计算排盘：输入公历日期时间（可选命主生年性别），返回天地盘、四课、三传、神将等完整课式。**仅作计算，不保存记录**。如需保存到命主档案请使用 DaLiuRenCreate。",
  zodSchema: z.object({
    date: z.string().describe("公历日期，格式 YYYY-MM-DD"),
    time: z.string().describe("时间，格式 HH:mm 或 HH:mm:ss"),
    fateInput: z
      .object({
        birthYear: z.number().int().describe("命主生年（公历）"),
        gender: z.enum(["男", "女"]).describe("命主性别"),
      })
      .optional()
      .describe("可选：命主生年与性别，用于起贵人等神将"),
  }),
  handler: (args: {
    date: string;
    time: string;
    fateInput?: { birthYear: number; gender: "男" | "女" };
  }) => peepOrThrow().DaLiuRen(args.date, args.time, args.fateInput),
  returns: {
    schema: {
      type: "object",
      description: "返回大六壬课式：天地盘、四课、三传、神将、贵神、天地盘关系等完整数据",
    },
  },
};

const daliurenCreateFunction = {
  name: "DaLiuRenCreate",
  description:
    "大六壬起课并保存到命主档案：输入命主 ID、所占问题、备注、背景、标签，系统自动以当前时间起课并存入数据库。返回保存后的记录。",
  zodSchema: z.object({
    personId: personIdSchema,
    question: z.string().describe("所占问题（必填，如 '这笔生意能不能做'）"),
    note: z.string().optional().describe("备注"),
    background: z.string().optional().describe("背景信息"),
    tags: z.array(z.string()).optional().describe("标签列表"),
  }),
  handler: (args: {
    personId: number;
    question: string;
    note?: string;
    background?: string;
    tags?: string[];
  }) => peepOrThrow().DaLiuRenCreate(args),
  returns: {
    schema: { type: "object", description: "返回保存后的起课记录（含 id、时间、四课三传等）" },
  },
};

const daliurenListFunction = {
  name: "DaLiuRenList",
  description:
    "查询命主的大六壬起课列表：支持按关键字搜索、按标签过滤、分页。返回记录摘要列表与总数。",
  zodSchema: z.object({
    personId: personIdSchema,
    searchText: z.string().optional().describe("搜索关键字（匹配问题、备注等）"),
    tags: z.array(z.string()).optional().describe("按标签过滤（AND 逻辑）"),
    page: z.number().int().positive().optional().describe("页码（默认 1）"),
    pageSize: z.number().int().positive().optional().describe("每页条数（默认 20）"),
  }),
  handler: (args: {
    personId: number;
    searchText?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }) => peepOrThrow().DaLiuRenList(args),
  returns: {
    schema: {
      type: "object",
      description: "返回 {records: 记录列表, total: 总数}",
    },
  },
};

const daliurenViewFunction = {
  name: "DaLiuRenView",
  description: "查看指定大六壬起课记录的详情：返回完整课式数据（含四课三传、神将等）。",
  zodSchema: z.object({
    personId: personIdSchema,
    recordId: z.number().int().positive().describe("起课记录 ID"),
  }),
  handler: (args: { personId: number; recordId: number }) => peepOrThrow().DaLiuRenView(args),
  returns: {
    schema: { type: "object", description: "返回起课记录完整数据" },
  },
};

const wikiListFunction = {
  name: "WikiList",
  description:
    "查询 Wiki 文档列表：支持按关键字搜索、按标签过滤、分页。返回文档摘要（id、标题、标签、更新时间）。",
  zodSchema: z.object({
    personId: personIdSchema,
    searchText: z.string().optional().describe("搜索关键字（匹配标题、内容）"),
    tags: z.array(z.string()).optional().describe("按标签过滤"),
    page: z.number().int().positive().optional().describe("页码"),
    pageSize: z.number().int().positive().optional().describe("每页条数"),
  }),
  handler: (args: {
    personId: number;
    searchText?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }) => peepOrThrow().WikiList(args),
  returns: {
    schema: { type: "object", description: "返回 {docs: 文档摘要列表, total: 总数}" },
  },
};

const wikiCreateFunction = {
  name: "WikiCreate",
  description: "创建 Wiki 文档：输入命主 ID、标题、正文（Markdown 格式）、标签、关联文档 ID 列表。",
  zodSchema: z.object({
    personId: personIdSchema,
    title: z.string().describe("文档标题"),
    content: z.string().describe("文档正文（Markdown 格式）"),
    tags: z.array(z.string()).optional().describe("标签"),
    linkTargetIds: z
      .array(z.number().int().positive())
      .optional()
      .describe("关联的其他文档 ID 列表（建立双向链接）"),
  }),
  handler: (args: {
    personId: number;
    title: string;
    content: string;
    tags?: string[];
    linkTargetIds?: number[];
  }) => peepOrThrow().WikiCreate(args),
  returns: {
    schema: { type: "object", description: "返回保存后的文档（含 id）" },
  },
};

const wikiViewFunction = {
  name: "WikiView",
  description: "查看指定 Wiki 文档详情：返回完整内容（含 Markdown 正文、标签、关联文档 ID）。",
  zodSchema: z.object({
    personId: personIdSchema,
    docId: z.number().int().positive().describe("文档 ID"),
  }),
  handler: (args: { personId: number; docId: number }) => peepOrThrow().WikiView(args),
  returns: {
    schema: {
      type: "object",
      description: "返回文档完整数据（含 content、tags、linkTargetIds）",
    },
  },
};

/** Function 分组：按业务域划分，AI 据此理解能力边界 */
const FUNCTION_GROUPS: RtcAgentConfig["groups"] = [
  {
    name: "person",
    description:
      "人物管理——增删改查命主档案。AI 应先调用 PersonList 确认可用的人物，再决定分析哪位命主。",
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
    description: "紫微斗数排盘与运限分析——通过 ZiWei Function 获取完整盘面数据",
    functions: [ziweiFunction],
  },
  {
    name: "daliuren",
    description:
      "大六壬起课——占卜具体事件的吉凶。纯计算（DaLiuRen）或保存到档案（DaLiuRenCreate/List/View）",
    functions: [
      daliurenCalcFunction,
      daliurenCreateFunction,
      daliurenListFunction,
      daliurenViewFunction,
    ],
  },
  {
    name: "wiki",
    description: "Wiki 知识库——命理笔记、典籍摘录、案例分析的结构化存储",
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

  const config: RtcAgentConfig = {
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
    workerUrl: `${import.meta.env.BASE_URL}rtc-agent/shared-worker.js`,
    // Function 注册
    agentName: "PeepAstro",
    agentDescription: "紫微斗数 · 大六壬 · 知识库 —— 命理分析 AI 助手",
    persona: document.documentElement.lang === "en-US" ? PERSONA_EN : PERSONA_ZH,
    groups: FUNCTION_GROUPS,
    // 嵌入式面板模式：embedded=true 自动禁用拖拽/缩放/最小化/最大化/关闭按钮，
    // 并设 defaultMode='maximized'——让 RTC 填满父容器（peep-v2 右侧 3/8 侧栏）
    window: {
      embedded: true,
      defaultMode: "maximized",
      draggable: false,
      resizable: false,
      showMinimize: false,
      showMaximize: false,
      showClose: false,
    },
    // 只保留 chat 按钮，禁用文件/设置面板
    activityBar: {
      disabledActivities: ["files", "settings"],
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
