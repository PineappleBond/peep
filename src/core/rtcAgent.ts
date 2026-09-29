/**
 * RTC Agent 接入模块
 *
 * 把紫微斗数排盘、大六壬起课、Wiki 文档等业务能力作为 Function 注册到 RTC Agent，
 * 让 AI 助手在前端通过 script 工具组合调用这些 Function，完成命理分析任务。
 *
 * 设计：
 * - 所有 Function handler 桥接 window.peep（与调试 API 同一套语义）
 * - 主题 / 语言与 peep-v2 自身状态同步（见 syncTheme / syncLocale）
 * - 认证使用 AuthProvider 模式（模式 3），完全委托给 peep-v2 的 AuthContext
 *
 * 文件组织：
 * - Function 定义按业务域拆分到 rtcAgent/ 子目录下的独立文件
 * - 本文件仅负责聚合 Function Groups、创建 Agent 实例、主题/语言同步
 */
import { createRtcAgent, switchLocale } from "@rtc-agent/component";
import type { RtcAgentWithLifecycle } from "@rtc-agent/component";
import { getTheme } from "./theme";
import type { Locale } from "./i18n";
import { getTokens, clearTokens, isTokenExpired, saveTokens } from "./auth/authStorage";
import { refreshAccessToken, getOrCreateDeviceIdSync } from "./auth/authApi";

// 各业务域 Function
import {
  personListFunction,
  personGetFunction,
  personCreateFunction,
  personUpdateFunction,
  personDeleteFunction,
  personSetDefaultFunction,
} from "./rtcAgent/personFunctions";
import {
  ziweiFunction,
  getScopeDataFunction,
  setHoroscopeTimeFunction,
} from "./rtcAgent/ziweiFunctions";
import {
  daliurenCreateFunction,
  daliurenListFunction,
  daliurenViewFunction,
  daliurenDeleteFunction,
  daliurenBatchViewFunction,
  daliurenUpdateTagsFunction,
  daliurenUpdateNoteFunction,
} from "./rtcAgent/daliurenFunctions";
import {
  liuyaoCreateFunction,
  liuyaoListFunction,
  liuyaoViewFunction,
  liuyaoDeleteFunction,
  liuyaoBatchViewFunction,
  liuyaoUpdateTagsFunction,
  liuyaoUpdateNoteFunction,
} from "./rtcAgent/liuyaoFunctions";
import {
  wikiListFunction,
  wikiCreateFunction,
  wikiUpdateFunction,
  wikiViewFunction,
  wikiBatchViewFunction,
  wikiReplaceContentFunction,
  wikiInsertContentFunction,
} from "./rtcAgent/wikiFunctions";
import {
  solarToLunarFunction,
  lunarToSolarFunction,
  getEightCharactersFunction,
  getSolarTermsFunction,
  getCurrentSolarTermFunction,
  getChineseCalendarFunction,
  getDailyInfoFunction,
  getZodiacFunction,
  getConstellationFunction,
} from "./rtcAgent/lunarFunctions";

// 导出 mergeBirthInput 供外部使用（测试文件 import）
export { mergeBirthInput, needsConfirm } from "./rtcAgent/shared";
export type { BirthInputFields, ConfirmResponse } from "./rtcAgent/shared";

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
 * Function 分组：按业务域划分，AI 据此理解能力边界
 * ============================================================ */

/**
 * 分组策略：
 * - person：命主档案管理，是所有分析的前提
 * - ziwei：紫微斗数排盘，GetScopeData 为纯计算接口（优先使用），ZiWei 会同步 UI（耗时较长）
 * - daliuren：大六壬起课占卜，适合具体事件的占断
 * - liuyao：六爻起卦占卜，适合具体事件的占断
 * - wiki：命理知识库，存储学习笔记和参考资料
 * - lunar：时间/日历计算
 */
const FUNCTION_GROUPS = [
  {
    name: "person",
    description:
      "命主档案增删改查——分析前必须先确认命主。" +
      "典型流程：先 PersonList 查看有哪些命主，再 PersonGet 获取详情，" +
      "如需新建则 PersonCreate。" +
      "\n\n支持的操作：List（列表）、Get（详情）、Create（创建）、Update（更新）、Delete（删除）、SetDefault（设置默认人物）。",
    functions: [
      personListFunction,
      personGetFunction,
      personCreateFunction,
      personUpdateFunction,
      personDeleteFunction,
      personSetDefaultFunction,
    ],
  },
  {
    name: "ziwei",
    description:
      "紫微斗数排盘与运限分析。" +
      "ZiWei 会像人类一样操控 UI（导航、切换人物、等待渲染），返回完整盘面数据；" +
      "GetScopeData 为纯计算接口，响应快，适合仅查看运限拨盘的场景；" +
      "SetHoroscopeTime 可直接设置运限拨盘的年月日时（纯计算，不操控 UI）。" +
      "\n\n支持的操作：排盘查看（只读）、运限时间设置。",
    functions: [getScopeDataFunction, ziweiFunction, setHoroscopeTimeFunction],
  },
  {
    name: "daliuren",
    description:
      "大六壬起课与占卜——适合具体事件的占断（如'这笔生意能不能做''考试能否通过'）。" +
      "典型流程：DaLiuRenCreate 起课 → DaLiuRenList 查看列表 → DaLiuRenView 查看详情。" +
      "\n\n支持的操作：Create（起课）、List（列表）、View（详情）、Delete（删除）、BatchView（批量查看详情）、UpdateTags（更新标签）、UpdateNote（更新备注）。" +
      "\n⚠️ 注意：卦象数据不可修改——起课记录一旦创建不可更改排盘结果，但可以更新标签和备注。",
    functions: [
      daliurenCreateFunction,
      daliurenListFunction,
      daliurenViewFunction,
      daliurenDeleteFunction,
      daliurenBatchViewFunction,
      daliurenUpdateTagsFunction,
      daliurenUpdateNoteFunction,
    ],
  },
  {
    name: "liuyao",
    description:
      "六爻起卦与占卜——适合具体事件的占断（如'这笔生意能不能做''考试能否通过'）。" +
      "六爻以铜钱摇卦得出六爻值，通过纳甲、五行、六亲、六神等分析吉凶。" +
      "典型流程：LiuYaoCreate 起卦 → LiuYaoList 查看列表 → LiuYaoView 查看详情。" +
      "\n\n支持的操作：Create（起卦）、List（列表）、View（详情）、Delete（删除）、BatchView（批量查看详情）、UpdateTags（更新标签）、UpdateNote（更新备注）。" +
      "\n⚠️ 注意：卦象数据不可修改——起卦记录一旦创建不可更改排盘结果，但可以更新标签和备注。",
    functions: [
      liuyaoCreateFunction,
      liuyaoListFunction,
      liuyaoViewFunction,
      liuyaoDeleteFunction,
      liuyaoBatchViewFunction,
      liuyaoUpdateTagsFunction,
      liuyaoUpdateNoteFunction,
    ],
  },
  {
    name: "wiki",
    description:
      "命理知识库管理——存储学习笔记、格局解析、案例分析等 Markdown 文档。" +
      "典型流程：WikiList 搜索文档 → WikiView 查看详情 → WikiCreate 新建笔记 → WikiUpdate 修改文档。" +
      "\n\n支持的操作：List（列表）、View（详情）、Create（创建）、Update（更新）、BatchView（批量查看详情）、ReplaceContent（内容替换）、InsertContent（内容插入）。" +
      "\n⚠️ 注意：不支持 Delete（删除）——文档一旦创建不可删除（可更新内容）。" +
      "\n💡 性能提示：查看多个文档时请使用 BatchView，比多次调用 View 更快（减少 UI 操作次数）。",
    functions: [
      wikiListFunction,
      wikiViewFunction,
      wikiCreateFunction,
      wikiUpdateFunction,
      wikiBatchViewFunction,
      wikiReplaceContentFunction,
      wikiInsertContentFunction,
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
    theme: getTheme(),
    lang: (document.documentElement.lang as "zh-CN" | "en-US") || "zh-CN",
    databaseName: "peep-rtc",
    server: {
      url: "https://rtc-agent.cherish.chat",
      redirectUri: `${import.meta.env.BASE_URL}auth/callback.html`,
    },
    // AuthProvider 模式（模式 3）：完全委托给 peep-v2 的认证系统
    auth: {
      getToken: async () => {
        const tokens = getTokens();
        if (!tokens) {
          throw new Error("Not authenticated");
        }
        return tokens.access_token;
      },
      refreshToken: async () => {
        const tokens = getTokens();
        if (!tokens) {
          throw new Error("Not authenticated");
        }
        const newTokens = await refreshAccessToken(tokens.refresh_token);
        saveTokens(newTokens);
        return {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          expiresIn: Math.floor((newTokens.expires_at - Date.now()) / 1000),
        };
      },
      isLoggedIn: () => {
        const tokens = getTokens();
        if (!tokens) return false;
        // 检查 token 是否过期（提前 5 分钟）
        return !isTokenExpired(tokens, 5 * 60 * 1000);
      },
      logout: async () => {
        clearTokens();
        // 注意：这里不能直接调用 AuthContext 的 logout，因为 rtcAgent.ts 不是 React 组件
        // 登出后，App.tsx 中的 AuthContext 会检测到 token 被清除，自动跳转到登录页
      },
      getUserId: () => {
        const tokens = getTokens();
        if (!tokens) {
          throw new Error("Not authenticated");
        }
        return tokens.user_id;
      },
      deviceId: getOrCreateDeviceIdSync(),
    },
    scenariosUrl: `${import.meta.env.BASE_URL}scenarios/`,
    workerUrl: `${import.meta.env.BASE_URL}rtc-agent/shared-worker.js`,
    agentName: "PeepAstro",
    agentDescription: "紫微斗数 · 大六壬 · 六爻 · 知识库 —— 命理分析 AI 助手",
    persona: document.documentElement.lang === "en-US" ? PERSONA_EN : PERSONA_ZH,
    groups: FUNCTION_GROUPS,
    window: {
      embedded: true,
      defaultMode: "maximized" as const,
      draggable: false,
      resizable: false,
      showMinimize: false,
      showMaximize: false,
      showClose: false,
    },
    activityBar: {
      disabledActivities: ["files", "settings"] as ("files" | "settings")[],
    },
    on: {
      ready: () => {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log(
            "%c[rtc]%c Agent 已就绪（embedded 模式，AuthProvider 认证）",
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
  await switchLocale(locale);
}

/**
 * 启动主题同步轮询——每 500ms 检查 peep-v2 的主题是否变化，变化则同步给 RTC
 *
 * 返回值：清理函数（调用后停止轮询）。App 卸载时调用。
 */
export function startThemeSync(): () => void {
  let lastTheme = getTheme();
  const timer = setInterval(() => {
    const current = getTheme();
    if (current !== lastTheme) {
      lastTheme = current;
      syncTheme();
    }
  }, 500);
  return () => clearInterval(timer);
}
