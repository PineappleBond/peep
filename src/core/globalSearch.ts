/**
 * 全局搜索核心模块
 *
 * 设计：
 * - 注册/查询模式：各页面/模块注册搜索源，Command Palette 调用 searchAll 查询
 * - 搜索源类型：人物、大六壬记录、Wiki 文档、快捷操作
 * - 最近使用记录：localStorage 持久化，空查询时优先展示
 * - 匹配能力：
 *   - 模糊匹配（大小写不敏感 + 中文字符子串）
 *   - 拼音匹配（全拼 / 首字母，缓存转换结果）
 *   - 正则匹配（`/pattern/flags` 语法）
 * - 搜索语法：
 *   - `type:person|liuren|wiki|action` 限制类型
 *   - `tag:xxx` 限制标签（多次出现取交集）
 *   - `after:YYYY-MM-DD` / `before:YYYY-MM-DD` 限制时间
 *   - `-keyword` 排除关键词
 * - 搜索历史：最近 20 条查询保存至 localStorage
 * - 相关性排序：标题匹配优先，最近使用加权
 */

import { db, type Person } from "./personDb";
import { t } from "./i18n";

/**
 * pinyin-pro 按需加载：
 * 该库 ESM 体积约 624KB，仅在实际需要拼音匹配时才动态导入，
 * 避免将其打入 CommandPalette 首屏 chunk。
 * 使用 Promise 缓存确保只加载一次。
 */
type PinyinFn = typeof import("pinyin-pro").pinyin;
let _pinyinPromise: Promise<PinyinFn> | null = null;
function loadPinyin(): Promise<PinyinFn> {
  if (!_pinyinPromise) {
    _pinyinPromise = import("pinyin-pro").then(m => m.pinyin);
  }
  return _pinyinPromise;
}

/** 搜索结果类型 */
export type SearchResultType = "person" | "liuren" | "wiki" | "action";

/** 单条搜索结果 */
export interface SearchResultItem {
  /** 唯一标识（source:type:id 形式，便于跨源去重） */
  id: string;
  /** 结果类型 */
  type: SearchResultType;
  /** 主标题 */
  title: string;
  /** 副标题/描述 */
  subtitle?: string;
  /** 图标 emoji（可选） */
  icon?: string;
  /** 选中后执行的动作 */
  action: () => void;
  /** 相关性得分（内部排序用，越大越优先） */
  score: number;
  /** 命中标记（高亮用）：标题中的匹配区间 */
  titleMatches?: Array<[number, number]>;
  /** 命中标记：副标题中的匹配区间 */
  subtitleMatches?: Array<[number, number]>;
  /** 关联记录时间戳（用于时间过滤，毫秒） */
  timestamp?: number;
  /** 关联标签 */
  tags?: string[];
}

/** 搜索上下文：由各调用方注入导航、人物选择等回调 */
export interface SearchContext {
  /** 路由导航 */
  navigate: (path: string) => void;
  /** 当前选中人物 ID */
  currentPersonId: number | null;
  /** 选择人物（触发全局 person.changed 事件） */
  onSelectPerson: (person: Person) => void;
  /** 关闭命令面板 */
  onClose: () => void;
  /** 打开导入对话框 */
  onOpenImport?: () => void;
  /** 切换主题 */
  onCycleTheme?: () => void;
  /** 切换语言 */
  onToggleLocale?: () => void;
  /** 显示快捷键帮助 */
  onToggleHelp?: () => void;
}

/** 最近使用记录的 localStorage 键名 */
const RECENT_STORAGE_KEY = "peep-search-recent";

/** 搜索历史的 localStorage 键名 */
const HISTORY_STORAGE_KEY = "peep-search-history";

/** 最近使用记录最大条数 */
const RECENT_MAX = 20;

/** 搜索历史最大条数 */
const HISTORY_MAX = 20;

/** 读取最近使用的结果 ID 列表（新近使用在前） */
function getRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string");
  } catch {
    /* ignore */
  }
  return [];
}

/** 写入最近使用的结果 ID 列表 */
function setRecentIds(ids: string[]): void {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids.slice(0, RECENT_MAX)));
  } catch {
    /* ignore */
  }
}

/** 标记某条结果为"刚刚使用过"（放到最近列表的最前面） */
export function markRecentUsed(id: string): void {
  const ids = getRecentIds().filter(x => x !== id);
  ids.unshift(id);
  setRecentIds(ids);
}

/* ---------------- 搜索历史 ---------------- */

/** 读取搜索历史（新近在前） */
export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string");
  } catch {
    /* ignore */
  }
  return [];
}

/** 写入搜索历史 */
function setSearchHistory(list: string[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch {
    /* ignore */
  }
}

/** 追加一条搜索历史（去重并置首） */
export function addSearchHistory(query: string): void {
  const q = query.trim();
  if (!q) return;
  const list = getSearchHistory().filter(x => x !== q);
  list.unshift(q);
  setSearchHistory(list);
}

/** 删除单条搜索历史 */
export function removeSearchHistory(query: string): void {
  setSearchHistory(getSearchHistory().filter(x => x !== query));
}

/** 清空搜索历史 */
export function clearSearchHistory(): void {
  setSearchHistory([]);
}

/* ---------------- 拼音匹配 ---------------- */

/** 拼音缓存：原文 → { 全拼字符串，首字母字符串 } */
const pinyinCache = new Map<string, { full: string; initial: string }>();

/** 拼音缓存上限，避免无限膨胀 */
const PINYIN_CACHE_MAX = 2000;

/**
 * 提取文本的拼音表示（仅对含中文字符的文本有效）
 * 返回：{ full: 全拼连写小写, initial: 各字首字母连写小写 }
 * 若文本不含中文，返回空字符串
 * 异步：首次调用时动态加载 pinyin-pro（~624KB ESM）
 */
async function getPinyin(text: string): Promise<{ full: string; initial: string }> {
  if (!text) return { full: "", initial: "" };
  const cached = pinyinCache.get(text);
  if (cached) return cached;
  // 仅对含中文的文本进行转换
  if (!/[一-龥]/.test(text)) {
    const empty = { full: "", initial: "" };
    return empty;
  }
  const pinyin = await loadPinyin();
  const fullArr = pinyin(text, { toneType: "none", type: "array" });
  const initialArr = pinyin(text, { pattern: "first", type: "array" });
  const result = {
    full: fullArr.join("").toLowerCase(),
    initial: initialArr.join("").toLowerCase(),
  };
  if (pinyinCache.size >= PINYIN_CACHE_MAX) {
    // 简单 LRU：清空一半（避免复杂化）
    const keys = Array.from(pinyinCache.keys());
    for (let i = 0; i < keys.length / 2; i++) pinyinCache.delete(keys[i]);
  }
  pinyinCache.set(text, result);
  return result;
}

/** 判断查询串是否为纯英文字母（用于决定是否尝试拼音匹配） */
function isAlpha(s: string): boolean {
  return /^[a-zA-Z]+$/.test(s);
}

/**
 * 拼音匹配：query 为纯字母时，尝试在 text 的拼音表示中查找
 * 返回匹配区间（在原文中的字符区间），或 null
 * 异步：内部按需加载 pinyin-pro
 */
async function matchPinyin(
  text: string,
  query: string,
): Promise<{ range: [number, number]; mode: "full" | "initial" } | null> {
  if (!query || !isAlpha(query)) return null;
  const py = await getPinyin(text);
  if (!py.full) return null;
  const q = query.toLowerCase();
  const fullIdx = py.full.indexOf(q);
  if (fullIdx >= 0) {
    // 反推原文字符区间：根据每个字的拼音长度累计
    const range = await mapPinyinIndexToTextRange(text, fullIdx, q.length);
    if (range) return { range, mode: "full" };
  }
  const initialIdx = py.initial.indexOf(q);
  if (initialIdx >= 0) {
    // 首字母匹配：每个字母对应一个原文字符
    const chars = [...text];
    // 仅对中文字符计数（非中文按占位处理）
    let ci = 0;
    let start = -1;
    let matched = 0;
    for (let i = 0; i < chars.length && matched < q.length; i++) {
      if (/[一-龥]/.test(chars[i])) {
        if (ci === initialIdx) start = i;
        ci++;
        matched++;
      }
    }
    if (start >= 0) {
      return { range: [start, start + matched], mode: "initial" };
    }
  }
  return null;
}

/**
 * 将拼音字符串中的匹配区间映射回原文字符区间
 * full: 全拼连写；每个中文字对应一段拼音
 * 异步：内部按需加载 pinyin-pro
 */
async function mapPinyinIndexToTextRange(
  text: string,
  pinyinStart: number,
  pinyinLen: number,
): Promise<[number, number] | null> {
  const chars = [...text];
  const pinyin = await loadPinyin();
  const pyArr = pinyin(text, { toneType: "none", type: "array" });
  let pinyinOffset = 0;
  let textStart = -1;
  let textEnd = -1;
  const pinyinEnd = pinyinStart + pinyinLen;
  for (let i = 0; i < chars.length; i++) {
    const seg = (pyArr[i] || "").toLowerCase();
    const segEnd = pinyinOffset + seg.length;
    if (textStart < 0 && segEnd > pinyinStart) textStart = i;
    if (segEnd >= pinyinEnd) {
      textEnd = i + 1;
      break;
    }
    pinyinOffset = segEnd;
  }
  if (textStart < 0) return null;
  if (textEnd < 0) textEnd = chars.length;
  return [textStart, textEnd];
}

/* ---------------- 查询语法解析 ---------------- */

/** 解析后的查询结构 */
export interface ParsedQuery {
  /** 剩余主查询（用于匹配标题/内容） */
  main: string;
  /** 类型过滤（空数组表示不过滤） */
  types: SearchResultType[];
  /** 标签过滤（多次出现取并集，这里简化为全部匹配） */
  tags: string[];
  /** after/before 时间过滤（YYYY-MM-DD，包含关系） */
  after?: string;
  before?: string;
  /** 排除关键词列表 */
  excludes: string[];
  /** 是否启用正则模式 */
  regex: RegExp | null;
  /** 原始查询串（用于历史等） */
  raw: string;
}

/**
 * 解析查询字符串，提取语法 token
 * 支持：type:X, tag:X, after:YYYY-MM-DD, before:YYYY-MM-DD, -keyword, /pattern/flags
 */
export function parseQuery(input: string): ParsedQuery {
  const raw = input;
  let s = input;
  const types: SearchResultType[] = [];
  const tags: string[] = [];
  const excludes: string[] = [];
  let after: string | undefined;
  let before: string | undefined;
  let regex: RegExp | null = null;

  // 正则模式：整段匹配 /pattern/flags
  const regexMatch = s.match(/(^|\s)\/((?:\\.|[^/\\])+?)\/([gimsuy]*)\s*$/);
  if (regexMatch) {
    try {
      regex = new RegExp(regexMatch[2], regexMatch[3] || "");
      // 去掉匹配到的部分
      s = s.slice(0, regexMatch.index!) + regexMatch[1];
    } catch {
      // 正则非法，忽略，当作普通字符
      regex = null;
    }
  }

  // 分词：按空格拆分（保留引号内空格简化处理：不支持引号）
  const tokens = s.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const tok of tokens) {
    if (tok.startsWith("type:")) {
      const v = tok.slice(5).toLowerCase();
      const map: Record<string, SearchResultType> = {
        person: "person",
        p: "person",
        liuren: "liuren",
        l: "liuren",
        record: "liuren",
        wiki: "wiki",
        w: "wiki",
        doc: "wiki",
        action: "action",
        a: "action",
      };
      const mapped = map[v];
      if (mapped && !types.includes(mapped)) types.push(mapped);
      continue;
    }
    if (tok.startsWith("tag:")) {
      const v = tok.slice(4);
      if (v && !tags.includes(v)) tags.push(v);
      continue;
    }
    if (tok.startsWith("after:") && /^\d{4}-\d{2}-\d{2}$/.test(tok.slice(6))) {
      after = tok.slice(6);
      continue;
    }
    if (tok.startsWith("before:") && /^\d{4}-\d{2}-\d{2}$/.test(tok.slice(7))) {
      before = tok.slice(7);
      continue;
    }
    if (tok.startsWith("-") && tok.length > 1 && !tok.startsWith("-@")) {
      excludes.push(tok.slice(1));
      continue;
    }
    kept.push(tok);
  }

  return {
    main: kept.join(" "),
    types,
    tags,
    after,
    before,
    excludes,
    regex,
    raw,
  };
}

/* ---------------- 匹配与得分 ---------------- */

/**
 * 统一匹配函数：根据 ParsedQuery 判断文本是否命中
 * 返回匹配区间列表（用于高亮），空数组表示未命中
 * 异步：拼音匹配分支按需加载 pinyin-pro
 */
async function matchText(
  text: string,
  pq: ParsedQuery,
): Promise<{
  ranges: Array<[number, number]>;
  score: number;
  mode: "exact" | "fuzzy" | "regex" | "pinyin";
} | null> {
  if (!text) return null;

  // 排除检查
  for (const ex of pq.excludes) {
    if (text.toLowerCase().includes(ex.toLowerCase())) return null;
  }

  // 正则模式
  if (pq.regex) {
    // 创建副本避免修改原始 RegExp 对象的 lastIndex
    const re = new RegExp(pq.regex.source, pq.regex.flags);
    const ranges: Array<[number, number]> = [];
    if (re.global) {
      let m: RegExpExecArray | null;
      let safety = 0;
      while ((m = re.exec(text)) !== null && safety < 100) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        ranges.push([m.index, m.index + m[0].length]);
        safety++;
      }
    } else {
      const m = re.exec(text);
      if (m) ranges.push([m.index, m.index + m[0].length]);
    }
    if (ranges.length === 0) return null;
    return { ranges, score: 60 + Math.min(40, ranges.length * 5), mode: "regex" };
  }

  const q = pq.main;
  if (!q) {
    // 无主查询，视为匹配（交给评分/过滤）
    return { ranges: [], score: 0, mode: "fuzzy" };
  }

  // 普通子串匹配
  const ql = q.toLowerCase();
  const tl = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  let idx = tl.indexOf(ql);
  if (idx >= 0) {
    while (idx >= 0 && ranges.length < 20) {
      ranges.push([idx, idx + q.length]);
      const next = tl.indexOf(ql, idx + 1);
      if (next === idx) break;
      idx = next;
    }
    let score = 60;
    if (tl === ql) score = 100;
    else if (tl.startsWith(ql)) score = 80;
    return { ranges, score, mode: ranges.length > 0 ? "exact" : "fuzzy" };
  }

  // 拼音匹配
  const py = await matchPinyin(text, q);
  if (py) {
    return { ranges: [py.range], score: 70, mode: "pinyin" };
  }

  // 分字模糊（按空格拆分主查询的每词，全部要命中）
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const allRanges: Array<[number, number]> = [];
    for (const w of words) {
      const wl = w.toLowerCase();
      const wi = tl.indexOf(wl);
      if (wi < 0) {
        const pyw = await matchPinyin(text, w);
        if (pyw) {
          allRanges.push(pyw.range);
          continue;
        }
        return null;
      }
      allRanges.push([wi, wi + w.length]);
    }
    return { ranges: allRanges, score: 55, mode: "fuzzy" };
  }

  return null;
}

/** matchText 返回的匹配结果类型 */
type MatchResult = Awaited<ReturnType<typeof matchText>>;

/**
 * 计算综合得分
 * - 标题/副标题命中加权
 * - 最近使用加分
 */
function computeScore(
  titleMatch: MatchResult,
  subtitleMatch: MatchResult,
  recentRank: number, // -1 表示不在列表
): number {
  let score = 0;
  if (titleMatch) score += titleMatch.score;
  if (subtitleMatch) score += Math.max(10, subtitleMatch.score - 20);
  if (recentRank >= 0) score += Math.max(0, 25 - recentRank * 5);
  return score;
}

/** 格式化人物姓名（未命名则显示 ID） */
function personName(p: Person): string {
  return p.name?.trim() || `${t("common.unnamed")} #${p.id}`;
}

/** YYYY-MM-DD 转时间戳（本地时区 0 点） */
function dateToTs(d: string): number {
  return new Date(d + "T00:00:00").getTime();
}

/** 时间过滤：记录时间戳是否在 [after, before] 区间内 */
function passTimeFilter(ts: number | undefined, pq: ParsedQuery): boolean {
  if (ts === undefined) {
    // 没有时间的记录：仅在无时间过滤时通过
    return !pq.after && !pq.before;
  }
  if (pq.after && ts < dateToTs(pq.after)) return false;
  if (pq.before && ts > dateToTs(pq.before) + 86400000 - 1) return false;
  return true;
}

/** 标签过滤：记录必须包含所有指定标签 */
function passTagFilter(recordTags: string[] | undefined, pq: ParsedQuery): boolean {
  if (pq.tags.length === 0) return true;
  const rt = (recordTags || []).map(x => x.toLowerCase());
  return pq.tags.every(tag => rt.includes(tag.toLowerCase()));
}

/* ---------------- 各数据源搜索 ---------------- */

async function searchPersons(pq: ParsedQuery, ctx: SearchContext): Promise<SearchResultItem[]> {
  if (pq.types.length > 0 && !pq.types.includes("person")) return [];
  const persons = await db.persons.toArray();
  const recentIds = getRecentIds();
  const result: SearchResultItem[] = [];
  for (const p of persons) {
    const name = personName(p);
    const subtitle = p.date
      ? `${p.date} ${p.timeIndex >= 0 ? `时序${p.timeIndex}` : ""}`
      : undefined;
    const tm = await matchText(name, pq);
    const sm = subtitle ? await matchText(subtitle, pq) : null;
    if (!tm && !sm) continue;
    const recentRank = recentIds.indexOf(`person:${p.id}`);
    const item: SearchResultItem = {
      id: `person:${p.id}`,
      type: "person",
      title: name,
      subtitle,
      icon: "👤",
      action: () => {
        if (p.id) {
          ctx.onSelectPerson(p);
          ctx.navigate("/");
        }
        markRecentUsed(`person:${p.id}`);
        ctx.onClose();
      },
      score: computeScore(tm, sm, recentRank),
      titleMatches: tm?.ranges,
      subtitleMatches: sm?.ranges,
      timestamp: p.savedAt,
    };
    result.push(item);
  }
  return result;
}

async function searchLiuren(pq: ParsedQuery, ctx: SearchContext): Promise<SearchResultItem[]> {
  if (pq.types.length > 0 && !pq.types.includes("liuren")) return [];
  if (!ctx.currentPersonId) return [];
  const records = await db.liurenRecords.where("personId").equals(ctx.currentPersonId).toArray();
  const recentIds = getRecentIds();
  const result: SearchResultItem[] = [];
  for (const r of records) {
    if (!passTagFilter(r.tags, pq)) continue;
    if (!passTimeFilter(r.savedAt, pq)) continue;
    const title = r.question || t("common.unnamed");
    const subtitle = `${r.calculationTime}${r.note ? ` · ${r.note}` : ""}`;
    const tm = await matchText(title, pq);
    const sm = await matchText(subtitle, pq);
    if (!tm && !sm) continue;
    const recentRank = recentIds.indexOf(`liuren:${r.id}`);
    result.push({
      id: `liuren:${r.id}`,
      type: "liuren",
      title,
      subtitle,
      icon: "☰",
      action: () => {
        ctx.navigate(`/liuren?record=${r.id}`);
        markRecentUsed(`liuren:${r.id}`);
        ctx.onClose();
      },
      score: computeScore(tm, sm, recentRank),
      titleMatches: tm?.ranges,
      subtitleMatches: sm?.ranges,
      timestamp: r.savedAt,
      tags: r.tags,
    });
  }
  return result;
}

async function searchWiki(pq: ParsedQuery, ctx: SearchContext): Promise<SearchResultItem[]> {
  if (pq.types.length > 0 && !pq.types.includes("wiki")) return [];
  if (!ctx.currentPersonId) return [];
  const docs = await db.wikiDocs.where("personId").equals(ctx.currentPersonId).toArray();
  const recentIds = getRecentIds();
  const result: SearchResultItem[] = [];
  for (const d of docs) {
    if (!passTagFilter(d.tags, pq)) continue;
    if (!passTimeFilter(d.updatedAt || d.savedAt, pq)) continue;
    const title = d.title || t("common.unnamed");
    const preview = d.content.slice(0, 200).replace(/\n/g, " ").trim();
    const tm = await matchText(title, pq);
    const sm = await matchText(preview, pq);
    if (!tm && !sm) continue;
    const recentRank = recentIds.indexOf(`wiki:${d.id}`);
    result.push({
      id: `wiki:${d.id}`,
      type: "wiki",
      title,
      subtitle: preview.slice(0, 80) || undefined,
      icon: "📖",
      action: () => {
        ctx.navigate(`/wiki?doc=${d.id}`);
        markRecentUsed(`wiki:${d.id}`);
        ctx.onClose();
      },
      score: computeScore(tm, sm, recentRank),
      titleMatches: tm?.ranges,
      subtitleMatches: sm?.ranges,
      timestamp: d.updatedAt || d.savedAt,
      tags: d.tags,
    });
  }
  return result;
}

async function searchActions(pq: ParsedQuery, ctx: SearchContext): Promise<SearchResultItem[]> {
  if (pq.types.length > 0 && !pq.types.includes("action")) return [];
  const recentIds = getRecentIds();

  const actions: { id: string; titleKey: string; icon: string; action: () => void }[] = [
    {
      id: "action:navigate:ziwei",
      titleKey: "nav.ziwei",
      icon: "✦",
      action: () => {
        ctx.navigate("/");
        markRecentUsed("action:navigate:ziwei");
        ctx.onClose();
      },
    },
    {
      id: "action:navigate:liuren",
      titleKey: "nav.daliuren",
      icon: "☰",
      action: () => {
        ctx.navigate("/liuren");
        markRecentUsed("action:navigate:liuren");
        ctx.onClose();
      },
    },
    {
      id: "action:navigate:wiki",
      titleKey: "nav.wiki",
      icon: "📖",
      action: () => {
        ctx.navigate("/wiki");
        markRecentUsed("action:navigate:wiki");
        ctx.onClose();
      },
    },
    {
      id: "action:toggleTheme",
      titleKey: "shortcut.toggleTheme",
      icon: "◐",
      action: () => {
        ctx.onCycleTheme?.();
        markRecentUsed("action:toggleTheme");
        ctx.onClose();
      },
    },
    {
      id: "action:showHelp",
      titleKey: "shortcut.showHelp",
      icon: "⌨",
      action: () => {
        ctx.onToggleHelp?.();
        markRecentUsed("action:showHelp");
        ctx.onClose();
      },
    },
  ];

  if (ctx.onOpenImport) {
    actions.push({
      id: "action:import",
      titleKey: "import.title",
      icon: "📥",
      action: () => {
        ctx.onOpenImport?.();
        markRecentUsed("action:import");
        ctx.onClose();
      },
    });
  }

  const currentLocale = (document.documentElement.lang || "zh-CN") as "zh-CN" | "en-US";
  const localeTitleKey =
    currentLocale === "zh-CN" ? "common.switchToEnglish" : "common.switchToChinese";
  actions.push({
    id: "action:toggleLocale",
    titleKey: localeTitleKey,
    icon: "🌐",
    action: () => {
      ctx.onToggleLocale?.();
      markRecentUsed("action:toggleLocale");
      ctx.onClose();
    },
  });

  const result: SearchResultItem[] = [];
  for (const a of actions) {
    const title = t(a.titleKey);
    const tm = await matchText(title, pq);
    if (!tm) continue;
    result.push({
      id: a.id,
      type: "action",
      title,
      icon: a.icon,
      action: a.action,
      score: computeScore(tm, null, recentIds.indexOf(a.id)),
      titleMatches: tm.ranges,
    });
  }
  return result;
}

/** 分类标签 i18n 键 */
export const CATEGORY_LABELS: Record<SearchResultType, string> = {
  person: "search.category.person",
  liuren: "search.category.liuren",
  wiki: "search.category.wiki",
  action: "search.category.action",
};

/** 分类显示顺序 */
export const CATEGORY_ORDER: SearchResultType[] = ["action", "person", "liuren", "wiki"];

/**
 * 综合搜索：解析查询语法，查询所有数据源，按相关性排序
 * 返回 ParsedQuery 供 UI 展示过滤 chip
 */
export async function searchAll(
  query: string,
  ctx: SearchContext,
): Promise<{ items: SearchResultItem[]; parsed: ParsedQuery }> {
  const parsed = parseQuery(query);
  const [persons, liuren, wiki, actions] = await Promise.all([
    searchPersons(parsed, ctx),
    searchLiuren(parsed, ctx),
    searchWiki(parsed, ctx),
    searchActions(parsed, ctx),
  ]);

  const all = [...actions, ...persons, ...liuren, ...wiki];

  const typeOrder: Record<SearchResultType, number> = {
    action: 0,
    person: 1,
    liuren: 2,
    wiki: 3,
  };
  all.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return typeOrder[a.type] - typeOrder[b.type];
  });

  return { items: all, parsed };
}
