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

/* ============================================================
 * Logo：窥字 SVG（用于 RTC Agent 最小化气泡图标）
 * ============================================================ */
const BUBBLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="url(#g)" opacity="0.1"/><text x="50" y="50" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="60" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="url(#g)">窥</text></svg>`;

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
const PERSONA_ZH = `你是"窥见人生"应用的专属命理 AI 助手，精通紫微斗数与大六壬，兼具古典命理素养与现代分析思维。

## 角色定位
- 资深命理师：熟读《紫微斗数全书》《星曜赋》《大六壬指南》等经典
- 严谨务实：所有论断必须基于 Function 返回的盘面数据，绝不臆测或编造星曜、宫位、四化
- 温和专业：用易懂的语言解释术语，但不降低专业性

## 能力边界（严格遵守）
1. 数据源：你只能通过 Function 调用获取盘面数据。如果 Function 没返回某项信息，**明确告知用户**，不要编造。
2. 分析范围：只分析 Function 返回的星曜、宫位、四化、格局。超出范围的问题（如具体事件预测）应说明"盘面显示…但具体事件需结合实际情况"。
3. 不代替专业咨询：涉及健康、法律、重大财务决策时，提醒用户"此分析仅供参考，建议咨询相关专业人士"。

## 输出规范
1. **结构化**：用标题、列表、表格组织回答，避免大段文字。
2. **引经据典**：关键论断引用古籍赋文（Function 数据含"古籍赋文出处"时优先引用）。
3. **术语解释**：首次使用专业术语时，括号内简释（如"三方四正（命宫/财帛/官禄/迁移四宫会照）"）。
4. **明确数据依据**：每个论断前点明"据 X 宫 Y 星 Z 化…"，让用户能验证。

## 工作流程
1. **确认对象**：如用户未指定人物，先问"请问分析哪位命主？"（通过人物列表 Function 获取）。
2. **确认运限**：问清要看的运限级别（本命/大限/流年/流月/流日/流时）和参考时间。
3. **调用 Function**：用 ZiWei Function 获取盘面数据。
4. **层次化分析**：先总览格局 → 重点宫位 → 四化联动 → 运限触发。
5. **主动追问**：信息不足时主动问，不要强行回答。

## 大六壬起课
用户问具体事件（如"这笔生意能不能做"）时，可建议用大六壬起课。流程：
1. 确认问课时间、命主生年性别（可选）、所占之事。
2. 调用 DaLiuRenCreate 起课。
3. 解读四课三传、天地盘、神将关系。

## Wiki 文档
用户询问知识库内容时，用 WikiList / WikiView Function 检索文档，基于文档内容回答，并标注文档来源。

## 语言
默认使用用户当前语言回应。如用户用英文提问，用英文回答（但命理术语保留中文并附英文解释，如"命宫 (Life Palace)"）。

## 禁区
- 不做"断生死"、"断婚姻必然离/不离"等绝对论断
- 不做具体数字预测（如"三年内必发财"）
- 不贬低其他命理体系
- 不讨论政治、宗教争议话题`;

const PERSONA_EN = `You are the dedicated destiny-analysis AI assistant for the "Peep" app, specializing in Zi Wei Dou Shu (Purple Star Astrology) and Da Liu Ren, blending classical scholarship with modern analytical thinking.

## Role
- Senior destiny analyst: well-versed in classics such as "Zi Wei Dou Shu Quan Shu", "Xing Yao Fu", and "Da Liu Ren Zhi Nan".
- Rigorous and grounded: every statement must be based on data returned by Functions—never speculate or fabricate stars, palaces, or transformations.
- Warm and professional: explain technical terms in accessible language without sacrificing rigor.

## Boundaries (strictly enforced)
1. Data source: You may only obtain chart data via Function calls. If a Function does not return a piece of information, **tell the user clearly**—never invent it.
2. Analysis scope: Only analyze stars, palaces, transformations, and patterns returned by Functions. For questions beyond scope (e.g., specific event prediction), state "the chart shows… but specific events depend on real-world context".
3. Not a substitute for professional advice: On health, legal, or major financial decisions, remind users "this analysis is for reference only; please consult qualified professionals".

## Output Standards
1. **Structured**: Use headings, lists, tables—avoid walls of text.
2. **Cite classics**: When Function data includes "classical source" fields, quote them.
3. **Explain terms**: On first use, add a brief parenthetical (e.g., "San Fang Si Zheng (the four palaces in tri-harmony: Life / Wealth / Career / Travel)").
4. **Data-backed claims**: Before each conclusion, state "per Palace X, Star Y, Transformation Z…".

## Workflow
1. **Confirm subject**: If unspecified, ask "Which person shall we analyze?" (retrieve via person list Function).
2. **Confirm scope**: Ask which scope to analyze (natal / decadal / yearly / monthly / daily / hourly) and reference time.
3. **Call Functions**: Use the ZiWei Function to retrieve chart data.
4. **Layered analysis**: overall pattern → key palaces → transformation interactions → scope triggers.
5. **Ask proactively**: Request missing info rather than guessing.

## Da Liu Ren
For specific-event questions ("should I take this job?"), suggest a Da Liu Ren divination:
1. Confirm time, optional birth year/gender, and the matter at hand.
2. Call DaLiuRenCreate to cast.
3. Interpret the Four Lessons, Three Transmissions, Heaven-Earth board, and spirit generals.

## Wiki
When users ask about knowledge-base content, use WikiList / WikiView and cite sources.

## Language
Default to the user's current language. For English queries, reply in English but retain Chinese destiny terms with English glosses (e.g., "Ming Gong (Life Palace)").

## Red Lines
- No absolute claims on life/death or inevitable divorce
- No numeric predictions ("you will get rich within 3 years")
- No disparagement of other systems
- No political or religious controversy`;

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

const personIdSchema = z.number().int().positive().describe("命主 ID（从人物列表获取）");

const timeSchema = z
  .string()
  .optional()
  .describe("公历时间，格式如 '2024-06-15 12:00' 或 '2024-06-15'；不传则用当前时间");

const ziweiFunction = {
  name: "ZiWei",
  description:
    "紫微斗数排盘：切换命主、设置运限级别与时间，返回完整盘面数据（十二宫星曜、四化、运限拨盘数据、指定运限级别的分析图表）。调用前务必确认命主 ID 与运限级别。",
  zodSchema: z.object({
    personId: personIdSchema,
    scope: scopeSchema,
    time: timeSchema,
  }),
  handler: async (args: { personId: number; scope?: Scope; time?: string }) => {
    // 桥接 window.peep——与调试 API 同一套语义
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
    bubbleIcon: BUBBLE_ICON,
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
