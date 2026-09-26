/**
 * 结构分析层：把斗数推理中「机械且 AI 最易出错」的中间步骤确定性算好，
 * 供导出直接引用 —— 三方四正快照、飞宫四化全矩阵（含离心/向心自化）、
 * 四化传导链（禄忌两转三转）、夹宫关系、空宫借星；格局检测在 patterns.ts（此处聚合再导出）。
 *
 * 全部只读本命盘（Astrolabe），不依赖运限状态；四化表跟随 iztro 全局配置。
 * 各函数接受可选共享索引（analyzeChart 整盘建一次向下传），默认自建。
 */
import { util } from "iztro";
import type { Astrolabe } from "./useZwds";
import { MUTAGEN_CHARS, fixIndex, type MutagenChar, type ScopeSelfMark, type Scope } from "./utils";
import {
  AUSPICIOUS_MINORS,
  SEAT_ROLES,
  SHA_STARS,
  buildChartIndex,
  sanfangIdx,
  starNamesAt,
  starTxt,
  type ChartIndex,
} from "./chartIndex";
import { detectHoroscopePatterns, detectPatterns, type Pattern } from "./patterns";

/* 对外保持单一门面：格局与索引原语经此再导出 */
export * from "./patterns";
export * from "./chartIndex";

/* ─────────────── 一、空宫借星 ─────────────── */

/** 空宫借星信息：本宫无主星时从对宫借入的星耀 */
export type BorrowedInfo = {
  palaceIndex: number;
  palaceName: string;
  branch: string;
  /** 借对宫主星（带亮度） */
  borrowed: string[];
  oppositeName: string;
};

/**
 * 获取全部空宫的借星信息。
 * @param a - 本命盘对象
 * @param ix - 共享索引（可选，默认新建）
 * @returns 空宫列表，每项含借入的对宫主星
 */
export function getBorrowedStars(
  a: Astrolabe,
  ix: ChartIndex = buildChartIndex(a)
): BorrowedInfo[] {
  const out: BorrowedInfo[] = [];
  for (const p of a.palaces) {
    if (p.majorStars.length) continue;
    const opp = a.palaces[fixIndex(p.index + 6)];
    out.push({
      palaceIndex: p.index,
      palaceName: p.name,
      branch: p.earthlyBranch as string,
      borrowed: opp.majorStars.map(s => starTxt(ix, s.name as string)),
      oppositeName: opp.name,
    });
  }
  return out;
}

/* ─────────────── 二、三方四正快照 ─────────────── */

/** 三方四正中的一个席位（本宫/对宫/三合/三合） */
export type SanfangSeat = {
  role: (typeof SEAT_ROLES)[number];
  palaceName: string;
  branch: string;
  majors: string;
};

/**
 * 三方四正快照：某宫的完整三方四正信息汇总，
 * 含本宫/对宫/三合主星、会吉会煞、生年四化会入、空宫借星。
 */
export type SanfangSnapshot = {
  palaceIndex: number;
  palaceName: string;
  branch: string;
  seats: SanfangSeat[];
  /** 会照六吉+禄马（带落点） */
  auspicious: string[];
  /** 会照六煞（带落点） */
  inauspicious: string[];
  /** 生年四化会入（带落点） */
  natalMutagens: string[];
  shaCount: number;
  borrowed: string | null;
};

/**
 * 生成十二宫各宫的三方四正快照。
 * @param a - 本命盘对象
 * @param ix - 共享索引（可选，默认新建）
 * @returns 十二宫的三方四正快照数组
 */
export function getSanfangSnapshots(
  a: Astrolabe,
  ix: ChartIndex = buildChartIndex(a)
): SanfangSnapshot[] {
  return a.palaces.map(p => {
    const idxs = sanfangIdx(p.index);
    const seats: SanfangSeat[] = idxs.map((q, k) => {
      const t = a.palaces[q];
      return {
        role: SEAT_ROLES[k],
        palaceName: t.name,
        branch: t.earthlyBranch as string,
        majors: t.majorStars.map(s => starTxt(ix, s.name as string)).join("、") || "无主星",
      };
    });
    const locTag = (q: number, k: number) =>
      k === 0 ? "本宫" : k === 1 ? `对宫·${a.palaces[q].name}` : `三合·${a.palaces[q].name}`;
    const auspicious: string[] = [];
    const inauspicious: string[] = [];
    const natalMutagens: string[] = [];
    let shaCount = 0;
    idxs.forEach((q, k) => {
      const names = starNamesAt(a, q);
      for (const n of names) {
        if (AUSPICIOUS_MINORS.includes(n)) auspicious.push(`${n}(${locTag(q, k)})`);
        if (SHA_STARS.includes(n)) {
          inauspicious.push(`${n}(${locTag(q, k)})`);
          shaCount++;
        }
        const mk = ix.natal.indexOf(n);
        if (mk >= 0) natalMutagens.push(`${n}化${MUTAGEN_CHARS[mk]}(${locTag(q, k)})`);
      }
    });
    const opp = a.palaces[fixIndex(p.index + 6)];
    const borrowed =
      p.majorStars.length === 0
        ? `本宫无主星，借对宫【${opp.name}】${
            opp.majorStars.map(s => starTxt(ix, s.name as string)).join("、") || "（对宫亦无主星）"
          }`
        : null;
    return {
      palaceIndex: p.index,
      palaceName: p.name,
      branch: p.earthlyBranch as string,
      seats,
      auspicious,
      inauspicious,
      natalMutagens,
      shaCount,
      borrowed,
    };
  });
}

/* ─────────────── 三、飞宫四化全矩阵 ─────────────── */

/** 飞宫四化中的一条飞入记录：某宫干四化的某化落入何宫 */
export type FlyEntry = {
  mutagen: (typeof MUTAGEN_CHARS)[number];
  star: string;
  toIndex: number;
  toName: string;
  toBranch: string;
  /** 落回本宫（离心自化） */
  isSelf: boolean;
  /** 落入对宫（即对宫的向心来源） */
  isOpposite: boolean;
};

/** 单宫的飞宫四化汇总：宫干四化飞入列表 + 离心自化 + 向心自化 */
export type PalaceFly = {
  palaceIndex: number;
  palaceName: string;
  branch: string;
  stem: string;
  flies: FlyEntry[];
  /** 离心自化：本宫干四化本宫之星 */
  selfOutward: string[];
  /** 向心自化：对宫干四化入本宫之星 */
  selfInward: string[];
};

/** 飞宫四化全矩阵：十二宫各宫的宫干四化互飞 + 语句化描述 */
export type FlyMatrix = {
  palaces: PalaceFly[];
  /** 语句化：每宫一句「X宫(干)：禄入A、权入B、科入C、忌入D」 */
  sentences: string[];
  note: string;
};

/**
 * 生成十二宫飞宫四化全矩阵：每宫的宫干四化飞向何宫，含离心/向心自化标注。
 * @param a - 本命盘对象
 * @param ix - 共享索引（可选，默认新建）
 * @returns 飞宫矩阵，含结构化的飞入列表和语句化描述
 */
export function getFlyMatrix(a: Astrolabe, ix: ChartIndex = buildChartIndex(a)): FlyMatrix {
  const rawFlies = (P: number): FlyEntry[] => {
    const p = a.palaces[P];
    const stars = util.getMutagensByHeavenlyStem(p.heavenlyStem as never) as string[];
    return stars.map((star, k) => {
      const to = ix.pos.get(star) ?? -1;
      const t = to >= 0 ? a.palaces[to] : null;
      return {
        mutagen: MUTAGEN_CHARS[k],
        star,
        toIndex: to,
        toName: t?.name ?? "（星不在盘中）",
        toBranch: (t?.earthlyBranch as string) ?? "",
        isSelf: to === P,
        isOpposite: to === fixIndex(P + 6),
      };
    });
  };
  const palaces: PalaceFly[] = a.palaces.map(p => {
    const flies = rawFlies(p.index);
    const oppFlies = rawFlies(fixIndex(p.index + 6));
    return {
      palaceIndex: p.index,
      palaceName: p.name,
      branch: p.earthlyBranch as string,
      stem: p.heavenlyStem as string,
      flies,
      selfOutward: flies.filter(f => f.isSelf).map(f => `${f.star}化${f.mutagen}`),
      selfInward: oppFlies
        .filter(f => f.toIndex === p.index)
        .map(f => `${f.star}化${f.mutagen}（来自对宫宫干）`),
    };
  });
  const sentences = palaces.map(pf => {
    const parts = pf.flies.map(f =>
      f.isSelf
        ? `化${f.mutagen}=${f.star}→本宫（自化${f.mutagen}·离心）`
        : `化${f.mutagen}=${f.star}→${f.toName}`
    );
    return `${pf.palaceName}(${pf.stem}${pf.branch})：${parts.join("，")}`;
  });
  return {
    palaces,
    sentences,
    note: "宫干四化=该宫对他宫的因果投射（如财帛宫化忌入夫妻=为配偶/感情付出金钱）。离心自化=本宫气外泄不聚；向心自化=对宫牵引入本宫。忌入某宫=纠缠沉淀，忌落对宫即冲本宫=变动更烈。",
  };
}

/* ─────────────── 四、夹宫关系 ─────────────── */

/** 夹宫关系：某宫被左右两宫特定星耀组合夹制的情况 */
export type JiaGong = {
  palaceIndex: number;
  palaceName: string;
  branch: string;
  kind: string;
  good: boolean;
  detail: string;
};

const JIA_PAIRS: { kind: string; s1: string; s2: string; good: boolean; note: string }[] = [
  { kind: "左右夹", s1: "左辅", s2: "右弼", good: true, note: "贵人扶持，稳固" },
  { kind: "昌曲夹", s1: "文昌", s2: "文曲", good: true, note: "文星辅佑，利科名" },
  { kind: "魁钺夹", s1: "天魁", s2: "天钺", good: true, note: "贵人夹命，机遇多" },
  { kind: "日月夹", s1: "太阳", s2: "太阴", good: true, note: "日月夹辅，不权则富" },
  {
    kind: "羊陀夹",
    s1: "擎羊",
    s2: "陀罗",
    good: false,
    note: "羊陀相夹（本宫必坐禄存），束缚牵制",
  },
  { kind: "火铃夹", s1: "火星", s2: "铃星", good: false, note: "火铃夹制，急躁受迫" },
  { kind: "空劫夹", s1: "地空", s2: "地劫", good: false, note: "空劫相夹，财福易漏" },
];

/**
 * 检测十二宫的夹宫关系（左右/昌曲/魁钺/日月/羊陀/火铃/空劫/禄忌夹）。
 * @param a - 本命盘对象
 * @param ix - 共享索引（可选，默认新建）
 * @returns 命中的夹宫关系列表
 */
export function getJiaGong(a: Astrolabe, ix: ChartIndex = buildChartIndex(a)): JiaGong[] {
  const out: JiaGong[] = [];
  for (const p of a.palaces) {
    const prev = new Set(starNamesAt(a, p.index - 1));
    const next = new Set(starNamesAt(a, p.index + 1));
    const both = (x: string, y: string) =>
      (prev.has(x) && next.has(y)) || (prev.has(y) && next.has(x));
    for (const pair of JIA_PAIRS) {
      if (both(pair.s1, pair.s2)) {
        out.push({
          palaceIndex: p.index,
          palaceName: p.name,
          branch: p.earthlyBranch as string,
          kind: pair.kind,
          good: pair.good,
          detail: pair.note,
        });
      }
    }
    // 禄忌夹：一邻有禄存或生年禄星，另一邻有生年忌星
    const luSet = ["禄存", ix.natal[0]].filter(Boolean) as string[];
    const jiStar = ix.natal[3];
    if (jiStar) {
      const hasLu = (s: Set<string>) => luSet.some(n => s.has(n));
      if ((hasLu(prev) && next.has(jiStar)) || (hasLu(next) && prev.has(jiStar))) {
        out.push({
          palaceIndex: p.index,
          palaceName: p.name,
          branch: p.earthlyBranch as string,
          kind: "禄忌夹",
          good: false,
          detail: "禄忌相夹，吉中藏纠缠、进退两难",
        });
      }
    }
  }
  return out;
}

/* ─────────────── 五、四化传导链（禄忌两转三转） ─────────────── */

/** 四化传导链中的一个步骤：某宫干四化某星飞入何宫 */
export type ChainStep = {
  fromIndex: number;
  fromName: string;
  /** 出发宫宫干 */
  stem: string;
  /** 化出之星 */
  star: string;
  toIndex: number;
  toName: string;
  /** 星就坐出发宫（离心自化），链在此泄出 */
  isSelf: boolean;
  /** 出发宫的禄星与忌星俱入同一宫（禄忌同途，吉中藏耗） */
  luJiTogether: boolean;
};

/** 一条四化传导链：从某宫起飞的禄或忌，经两转三转的完整路径 */
export type MutagenChain = {
  kind: "禄" | "忌";
  headIndex: number;
  headName: string;
  steps: ChainStep[];
  /** 终止方式：自化=泄出 / 回头=缠回链首 / 成环=链中互缠 / 三转止=达步数上限 */
  end: "自化" | "回头" | "成环" | "三转止";
  /** 链路一句话（可直接展示/导出） */
  text: string;
};

/** 四化传导链汇总：全部禄链与忌链 */
export type MutagenChains = {
  ji: MutagenChain[];
  lu: MutagenChain[];
  note: string;
};

/** 两转三转：链最多走三步（链首起飞 + 再转两次） */
const CHAIN_HOPS = 3;

function traceOne(a: Astrolabe, ix: ChartIndex, head: number, kind: "禄" | "忌"): MutagenChain {
  const kIdx = kind === "禄" ? 0 : 3;
  const steps: ChainStep[] = [];
  const visited = [head];
  let cur = head;
  let end: MutagenChain["end"] = "三转止";
  for (let hop = 0; hop < CHAIN_HOPS; hop++) {
    const p = a.palaces[cur];
    const table = util.getMutagensByHeavenlyStem(p.heavenlyStem as never) as string[];
    const star = table[kIdx];
    const to = ix.pos.get(star);
    if (to === undefined) break; // 防御：四化星理论上必在盘中
    const luTo = ix.pos.get(table[0]);
    const isSelf = to === cur;
    steps.push({
      fromIndex: cur,
      fromName: p.name,
      stem: p.heavenlyStem as string,
      star,
      toIndex: to,
      toName: a.palaces[to].name,
      isSelf,
      luJiTogether: luTo !== undefined && luTo === ix.pos.get(table[3]),
    });
    if (isSelf) {
      end = "自化";
      break;
    }
    if (to === head) {
      end = "回头";
      break;
    }
    if (visited.includes(to)) {
      end = "成环";
      break;
    }
    visited.push(to);
    cur = to;
  }
  const text =
    steps
      .map(
        s =>
          `${s.fromName}(${s.stem})${s.star}${kind}入${s.isSelf ? "本宫" : s.toName}${
            s.luJiTogether ? "（禄忌同途）" : ""
          }`
      )
      .join(" → ") + `【${end === "自化" ? `自化${kind}` : end}】`;
  return { kind, headIndex: head, headName: a.palaces[head].name, steps, end, text };
}

/**
 * 追踪十二宫的四化传导链（禄链+忌链，两转三转）。
 * 每条链从某宫起飞，沿宫干四化逐级传导，遇自化/回头/成环即止。
 * @param a - 本命盘对象
 * @param ix - 共享索引（可选，默认新建）
 * @returns 全部禄链与忌链的汇总
 */
export function traceMutagenChains(
  a: Astrolabe,
  ix: ChartIndex = buildChartIndex(a)
): MutagenChains {
  return {
    ji: a.palaces.map(p => traceOne(a, ix, p.index, "忌")),
    lu: a.palaces.map(p => traceOne(a, ix, p.index, "禄")),
    note: "宫干四化逐级串联（最多三转，遇自化/回头/成环即止）：忌链=破耗与责任的传导路径，链尾宫为最终沉淀处；禄链=福泽输送路径，看福最终归于何事。【自化X】=链在该宫泄出不聚；【回头】=缠回链首宫（因果回身）；【成环】=链中两宫互缠；（禄忌同途）=该宫禄忌俱入同一宫，吉中藏耗。",
  };
}

/* ─────────────── 汇总入口 ─────────────── */

/**
 * 结构分析层聚合结果：一次 analyzeChart 调用的全部输出，
 * 含格局检测、三方快照、飞宫矩阵、四化传导链、夹宫、借星。
 */
export type ChartAnalysis = {
  note: string;
  patterns: Pattern[];
  sanfang: SanfangSnapshot[];
  flyMatrix: FlyMatrix;
  mutagenChains: MutagenChains;
  jiaGong: JiaGong[];
  borrowed: BorrowedInfo[];
};

/* ─────────────── 六、运限自化计算 ─────────────── */

/**
 * 运限自化核心计算：给定运限命宫索引和天干，计算离心+向心自化。
 *
 * @param palaceIdx 运限命宫在本命盘的宫位索引
 * @param stem 运限天干（HeavenlyStemName 类型，此处用 string 避免依赖 iztro 内部类型）
 * @param a 本命盘
 * @param ix 盘索引（可选，外部缓存则传入）
 */
export function getSelfMarksForScope(
  palaceIdx: number,
  stem: string,
  a: Astrolabe,
  ix: ChartIndex = buildChartIndex(a)
): {
  outward: Array<{ star: string; char: MutagenChar }>;
  inward: Array<{ star: string; char: MutagenChar }>;
} {
  const outward: Array<{ star: string; char: MutagenChar }> = [];
  const inward: Array<{ star: string; char: MutagenChar }> = [];

  // 1. 离心自化：运限天干四化飞回运限命宫
  const outwardStars = util.getMutagensByHeavenlyStem(stem as never) as string[];
  for (let k = 0; k < outwardStars.length; k++) {
    const star = outwardStars[k];
    const pos = ix.pos.get(star) ?? -1;
    if (pos === -1) continue; // 星不在盘中，跳过
    if (pos === palaceIdx) {
      outward.push({ star, char: MUTAGEN_CHARS[k] });
    }
  }

  // 2. 向心自化：对宫本命天干四化飞入运限命宫
  const oppIdx = fixIndex(palaceIdx + 6);
  const oppStem = a.palaces[oppIdx].heavenlyStem as string;
  const inwardStars = util.getMutagensByHeavenlyStem(oppStem as never) as string[];
  for (let k = 0; k < inwardStars.length; k++) {
    const star = inwardStars[k];
    const pos = ix.pos.get(star) ?? -1;
    if (pos === -1) continue;
    if (pos === palaceIdx) {
      inward.push({ star, char: MUTAGEN_CHARS[k] });
    }
  }

  return { outward, inward };
}

/**
 * 指定运限级别的完整盘面数据：十二宫星耀+运限标签+四化+飞宫+自化连线。
 * 供调试 API 和盘面渲染使用。
 */
export type ScopeChartData = {
  scope: Scope;
  /** 12 宫完整数据 */
  palaces: Array<{
    palaceIndex: number;
    palaceName: string;
    branch: string;
    heavenlyStem: string;
    // 星曜
    majorStars: Array<{ name: string; brightness: string; mutagen?: string }>;
    minorStars: Array<{ name: string; brightness: string; mutagen?: string }>;
    adjectiveStars: Array<{ name: string }>;
    // 运限标签（如"大兄""年财"）
    scopePalaceName: string;
    // 运限星曜
    scopeStars: Array<{ name: string }>;
    // 四化标记
    natalMutagens: Array<{ star: string; char: MutagenChar }>;
    scopeMutagens: Array<{ star: string; char: MutagenChar }>;
    selfMutagens: Array<{ star: string; char: MutagenChar; direction: "outward" }>;
    scopeSelfMutagens: Array<{ star: string; char: MutagenChar; direction: "outward" | "inward" }>;
    // 其他
    decadalRange: [number, number];
    ages: number[];
    changsheng12: string;
    boshi12: string;
    suiqian12: string;
    jiangqian12: string;
    isBodyPalace: boolean;
    isOriginalPalace: boolean;
  }>;
  /** 飞星数据（宫干四化飞入何宫） */
  flyMatrix: Array<{
    fromIndex: number;
    fromName: string;
    stem: string;
    flies: Array<{
      mutagen: MutagenChar;
      star: string;
      toIndex: number;
      toName: string;
      isSelf: boolean;
      isOpposite: boolean;
    }>;
  }>;
  /** 自化连线数据 */
  selfLinks: Array<{
    fromIndex: number;
    toIndex: number;
    char: MutagenChar;
    direction: "outward" | "inward";
    star: string;
    isSelfLoop: boolean;
  }>;
};

/** getChartDataForScope 的输入参数 */
export type ChartDataForScopeParams = {
  astrolabe: Astrolabe;
  /** Horoscope 类型从 iztro 导入较复杂，此处用 unknown + 安全访问器 */
  horoscope: unknown;
  scope: Scope;
  chartIndex?: ChartIndex;
};

/**
 * Horoscope 安全访问器：从 unknown 类型的 horoscope 对象中提取指定 scope 的数据。
 * 避免使用 any，同时保证属性存在性检查。
 */
function horoscopeScope(horoscope: unknown, scope: Scope) {
  const h = horoscope as Record<string, unknown> | null;
  if (!h || typeof h !== "object") return null;
  const s = h[scope] as Record<string, unknown> | undefined;
  if (!s || typeof s !== "object") return null;
  return {
    index: s.index as number,
    heavenlyStem: s.heavenlyStem as string,
    palaceNames: s.palaceNames as string[],
    stars: (s.stars as Array<Array<{ name: string }>> | undefined) ?? undefined,
  };
}

/**
 * 获取指定运限级别的完整 Chart 盘面数据。
 * 包含：星曜、四化、飞星、自化、运限标签等所有 UI 渲染所需数据。
 */
export function getChartDataForScope(params: ChartDataForScopeParams): ScopeChartData {
  const { astrolabe, horoscope, scope, chartIndex } = params;
  const ix = chartIndex ?? buildChartIndex(astrolabe);

  if (!horoscope) {
    return { scope, palaces: [], flyMatrix: [], selfLinks: [] };
  }

  const scopeData = horoscopeScope(horoscope, scope);
  if (!scopeData) {
    return { scope, palaces: [], flyMatrix: [], selfLinks: [] };
  }

  const scopePalaceIdx = scopeData.index;
  const scopeStem = scopeData.heavenlyStem;
  const scopeMutagenStars = util.getMutagensByHeavenlyStem(scopeStem as never) as string[];

  // 计算运限命宫的离心 + 向心自化
  const rawMarks = getSelfMarksForScope(scopePalaceIdx, scopeStem, astrolabe, ix);

  // 构建 12 宫完整数据
  const palaces = astrolabe.palaces.map(palace => {
    // 本命四化（生年天干）
    const pillars = astrolabe.chineseDate.split(" ");
    const natalStem = pillars[0]?.charAt(0) ?? "";
    const natalMutagenStars = util.getMutagensByHeavenlyStem(natalStem as never) as string[];
    const natalMutagens = natalMutagenStars
      .map((star, k) => {
        const pos = ix.pos.get(star) ?? -1;
        return pos === palace.index ? { star, char: MUTAGEN_CHARS[k] } : null;
      })
      .filter((m): m is { star: string; char: MutagenChar } => m !== null);

    // 运限四化
    const scopeMutagens = scopeMutagenStars
      .map((star, k) => {
        const pos = ix.pos.get(star) ?? -1;
        return pos === palace.index ? { star, char: MUTAGEN_CHARS[k] } : null;
      })
      .filter((m): m is { star: string; char: MutagenChar } => m !== null);

    // 本命自化（离心）
    const palaceStem = palace.heavenlyStem as string;
    const selfMutagenStars = util.getMutagensByHeavenlyStem(palaceStem as never) as string[];
    const selfMutagens = selfMutagenStars
      .map((star, k) => {
        const pos = ix.pos.get(star) ?? -1;
        return pos === palace.index
          ? { star, char: MUTAGEN_CHARS[k], direction: "outward" as const }
          : null;
      })
      .filter((m): m is { star: string; char: MutagenChar; direction: "outward" } => m !== null);

    // 运限自化（离心 + 向心）
    const scopeSelfMutagens: Array<{
      star: string;
      char: MutagenChar;
      direction: "outward" | "inward";
    }> = [];
    if (palace.index === scopePalaceIdx) {
      for (const m of rawMarks.outward) {
        scopeSelfMutagens.push({ star: m.star, char: m.char, direction: "outward" });
      }
      for (const m of rawMarks.inward) {
        scopeSelfMutagens.push({ star: m.star, char: m.char, direction: "inward" });
      }
    }

    // 运限标签
    const scopePalaceName = scopeData.palaceNames[palace.index] || palace.name;

    // 运限星曜（通过安全访问器取数据）
    const scopeStars = scopeData.stars?.[palace.index]?.map(s => ({ name: s.name })) || [];

    return {
      palaceIndex: palace.index,
      palaceName: palace.name,
      branch: palace.earthlyBranch as string,
      heavenlyStem: palace.heavenlyStem as string,
      majorStars: palace.majorStars.map(s => ({
        name: s.name,
        brightness: s.brightness || "",
        mutagen: s.mutagen,
      })),
      minorStars: palace.minorStars.map(s => ({
        name: s.name,
        brightness: s.brightness || "",
        mutagen: s.mutagen,
      })),
      adjectiveStars: palace.adjectiveStars.map(s => ({ name: s.name })),
      scopePalaceName,
      scopeStars,
      natalMutagens,
      scopeMutagens,
      selfMutagens,
      scopeSelfMutagens,
      decadalRange: palace.decadal.range as [number, number],
      ages: palace.ages,
      changsheng12: palace.changsheng12,
      boshi12: palace.boshi12,
      suiqian12: palace.suiqian12,
      jiangqian12: palace.jiangqian12,
      isBodyPalace: palace.isBodyPalace,
      isOriginalPalace: palace.isOriginalPalace,
    };
  });

  // 飞星数据
  const flyMatrix = astrolabe.palaces.map(palace => {
    const stem = palace.heavenlyStem as string;
    const flyStars = util.getMutagensByHeavenlyStem(stem as never) as string[];
    const flies = flyStars.map((star, k) => {
      const to = ix.pos.get(star) ?? -1;
      const toPalace = to >= 0 ? astrolabe.palaces[to] : null;
      return {
        mutagen: MUTAGEN_CHARS[k],
        star,
        toIndex: to,
        toName: toPalace?.name ?? "（星不在盘中）",
        isSelf: to === palace.index,
        isOpposite: to === fixIndex(palace.index + 6),
      };
    });
    return {
      fromIndex: palace.index,
      fromName: palace.name,
      stem,
      flies,
    };
  });

  // 自化连线数据
  const oppIdx = fixIndex(scopePalaceIdx + 6);
  const selfLinks = [
    ...rawMarks.outward.map(m => ({
      fromIndex: scopePalaceIdx,
      toIndex: scopePalaceIdx,
      isSelfLoop: true,
      char: m.char,
      direction: "outward" as const,
      star: m.star,
    })),
    ...rawMarks.inward.map(m => ({
      fromIndex: oppIdx,
      toIndex: scopePalaceIdx,
      isSelfLoop: false,
      char: m.char,
      direction: "inward" as const,
      star: m.star,
    })),
  ];

  return { scope, palaces, flyMatrix, selfLinks };
}

/**
 * 结构分析层聚合入口：一次调用产出全部分析结果。
 * 整盘只建一次共享索引，六个分析函数复用。
 * @param a - 本命盘对象
 * @returns 完整分析结果（格局/三方/飞宫/传导链/夹宫/借星）
 */
export function analyzeChart(a: Astrolabe): ChartAnalysis {
  const ix = buildChartIndex(a); // 整盘建一次索引，六个分析共享
  return {
    note: "本节为确定性结构分析（与安星/四化同一口径算出）：patterns=格局检测（含成格瑕疵与古籍出处）；sanfang=每宫三方四正快照（会吉/会煞/四化会入已汇总，无需再数宫位）；flyMatrix=十二宫宫干四化飞宫全矩阵（含离心/向心自化）；mutagenChains=禄忌传导链（宫干四化逐级串联两转三转）；jiaGong=夹宫关系；borrowed=空宫借星。分析时请直接引用本节结论。",
    patterns: detectPatterns(a, ix),
    sanfang: getSanfangSnapshots(a, ix),
    flyMatrix: getFlyMatrix(a, ix),
    mutagenChains: traceMutagenChains(a, ix),
    jiaGong: getJiaGong(a, ix),
    borrowed: getBorrowedStars(a, ix),
  };
}
