/**
 * 全局搜索核心模块
 *
 * 设计：
 * - 注册/查询模式：各页面/模块注册搜索源，Command Palette 调用 searchAll 查询
 * - 搜索源类型：人物、大六壬记录、Wiki 文档、快捷操作
 * - 最近使用记录：localStorage 持久化，空查询时优先展示
 * - 模糊匹配：大小写不敏感 + 中文字符子串匹配
 * - 相关性排序：标题匹配优先，最近使用加权
 */

import { db, type Person, type LiurenRecord, type WikiDocument } from "./personDb";
import { t } from "./i18n";

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

/** 最近使用记录最大条数 */
const RECENT_MAX = 20;

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

/**
 * 模糊匹配：判断文本是否包含查询字符串（大小写不敏感）
 * 空查询视为匹配（用于展示默认列表）
 */
function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * 计算匹配得分
 * - 标题完全匹配查询：+100
 * - 标题以查询开头：+80
 * - 标题包含查询：+60
 * - 副标题包含查询：+30
 * - 最近使用加分：每条最近使用 +5（最多 +25）
 */
function computeScore(
  title: string,
  subtitle: string | undefined,
  query: string,
  recentRank: number, // -1 表示不在最近列表；0 表示最新
): number {
  const q = query.toLowerCase();
  const tl = title.toLowerCase();
  let score = 0;
  if (q && tl === q) score += 100;
  else if (q && tl.startsWith(q)) score += 80;
  else if (q && tl.includes(q)) score += 60;
  if (q && subtitle) {
    const sl = subtitle.toLowerCase();
    if (sl.includes(q)) score += 30;
  }
  if (recentRank >= 0) {
    // 越靠前加分越多
    score += Math.max(0, 25 - recentRank * 5);
  }
  return score;
}

/** 格式化人物姓名（未命名则显示 ID） */
function personName(p: Person): string {
  return p.name?.trim() || `${t("common.unnamed")} #${p.id}`;
}

/**
 * 搜索人物列表
 */
async function searchPersons(query: string, ctx: SearchContext): Promise<SearchResultItem[]> {
  const persons = await db.persons.toArray();
  const recentIds = getRecentIds();
  return persons
    .map(p => {
      const name = personName(p);
      const subtitle = p.date
        ? `${p.date} ${p.timeIndex >= 0 ? `时序${p.timeIndex}` : ""}`
        : undefined;
      return {
        id: `person:${p.id}`,
        type: "person" as const,
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
        score: computeScore(name, subtitle, query, recentIds.indexOf(`person:${p.id}`)),
      };
    })
    .filter(item => fuzzyMatch(item.title, query) || fuzzyMatch(item.subtitle || "", query))
    .filter(item => item.score > 0 || !query);
}

/**
 * 搜索大六壬记录
 */
async function searchLiuren(query: string, ctx: SearchContext): Promise<SearchResultItem[]> {
  if (!ctx.currentPersonId) return [];
  const records = await db.liurenRecords.where("personId").equals(ctx.currentPersonId).toArray();
  const recentIds = getRecentIds();
  return records
    .map((r: LiurenRecord) => {
      const title = r.question || t("common.unnamed");
      const subtitle = `${r.calculationTime}${r.note ? ` · ${r.note}` : ""}`;
      return {
        id: `liuren:${r.id}`,
        type: "liuren" as const,
        title,
        subtitle,
        icon: "☰",
        action: () => {
          ctx.navigate(`/liuren?record=${r.id}`);
          markRecentUsed(`liuren:${r.id}`);
          ctx.onClose();
        },
        score: computeScore(title, subtitle, query, recentIds.indexOf(`liuren:${r.id}`)),
      };
    })
    .filter(item => fuzzyMatch(item.title, query) || fuzzyMatch(item.subtitle || "", query))
    .filter(item => item.score > 0 || !query);
}

/**
 * 搜索 Wiki 文档
 */
async function searchWiki(query: string, ctx: SearchContext): Promise<SearchResultItem[]> {
  if (!ctx.currentPersonId) return [];
  const docs = await db.wikiDocs.where("personId").equals(ctx.currentPersonId).toArray();
  const recentIds = getRecentIds();
  return docs
    .map((d: WikiDocument) => {
      const title = d.title || t("common.unnamed");
      const preview = d.content.slice(0, 80).replace(/\n/g, " ").trim();
      return {
        id: `wiki:${d.id}`,
        type: "wiki" as const,
        title,
        subtitle: preview || undefined,
        icon: "📖",
        action: () => {
          ctx.navigate(`/wiki?doc=${d.id}`);
          markRecentUsed(`wiki:${d.id}`);
          ctx.onClose();
        },
        score: computeScore(title, d.content, query, recentIds.indexOf(`wiki:${d.id}`)),
      };
    })
    .filter(item => fuzzyMatch(item.title, query) || fuzzyMatch(item.subtitle || "", query))
    .filter(item => item.score > 0 || !query);
}

/**
 * 搜索快捷操作（导航、主题切换等）
 */
function searchActions(query: string, ctx: SearchContext): SearchResultItem[] {
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

  // 语言切换动作：根据当前语言展示对应文案
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

  return actions
    .map(a => {
      const title = t(a.titleKey);
      return {
        id: a.id,
        type: "action" as const,
        title,
        icon: a.icon,
        action: a.action,
        score: computeScore(title, undefined, query, recentIds.indexOf(a.id)),
      };
    })
    .filter(item => fuzzyMatch(item.title, query))
    .filter(item => item.score > 0 || !query);
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
 * 综合搜索：查询所有数据源，按相关性排序，按类别分组返回
 */
export async function searchAll(query: string, ctx: SearchContext): Promise<SearchResultItem[]> {
  const [persons, liuren, wiki, actions] = await Promise.all([
    searchPersons(query, ctx),
    searchLiuren(query, ctx),
    searchWiki(query, ctx),
    Promise.resolve(searchActions(query, ctx)),
  ]);

  // 合并所有结果
  const all = [...actions, ...persons, ...liuren, ...wiki];

  // 排序：得分降序；同分时按类别顺序排
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

  return all;
}
