/** 格局检测：运限格局扫描（大限/流年/流月层） */
import { util } from "iztro";
import { getHoroscopeStar } from "iztro/lib/star/horoscopeStar";
import type { Astrolabe } from "../useZwds";
import { fixIndex } from "../utils";
import {
  buildChartIndex,
  sanfangIdx,
  starNamesAt,
  type ChartIndex,
} from "../chartIndex";

/* ─────────────── 运限格局扫描（大限/流年/流月层） ─────────────── */

export type HoroPattern = {
  scope: "decadal" | "yearly" | "monthly";
  name: string;
  kind: "吉" | "凶" | "注意";
  basis: string;
  meaning: string;
};

/**
 * 以运限命宫为中心扫描运限层格局：本命星曜三方会照 + 该运限四化引动 + 该运限流曜。
 * 用于回答「这个大限/这一年/这个月是不是考运期/财运期/动荡期」。
 *
 * @param soulIdxOfScope 运限命宫所在的本命宫位索引（h.decadal.index / h.yearly.index / h.monthly.index）
 * @param stem/branch    运限干支（四化与流曜由此起）
 */
export function detectHoroscopePatterns(
  a: Astrolabe,
  scope: "decadal" | "yearly" | "monthly",
  soulIdxOfScope: number,
  stem: string,
  branch: string,
  ix: ChartIndex = buildChartIndex(a)
): HoroPattern[] {
  const S = fixIndex(soulIdxOfScope);
  const sf = sanfangIdx(S);
  const sfSet = new Set(sf);
  const sfStars = new Set<string>(sf.flatMap((q) => starNamesAt(a, q)));
  const tag = scope === "decadal" ? "大限" : scope === "yearly" ? "流年" : "流月";
  /* 流曜名前缀随层级（iztro 实名：运昌/流昌/月昌） */
  const fp = scope === "decadal" ? "运" : scope === "yearly" ? "流" : "月";
  const out: HoroPattern[] = [];
  const add = (name: string, kind: HoroPattern["kind"], basis: string, meaning: string) =>
    out.push({ scope, name, kind, basis, meaning });

  const mutStars = stem ? (util.getMutagensByHeavenlyStem(stem as never) as string[]) : [];
  const posOf = (star: string) => ix.pos.get(star) ?? -1;
  const inSf = (star: string) => sfSet.has(posOf(star));
  const mutInSf = (k: number) => !!mutStars[k] && inSf(mutStars[k]);
  const seatName = (i: number) => a.palaces[fixIndex(i)]?.name ?? "?";

  /* 运限流曜（大限=运X / 流年=流X），键统一去前缀 */
  const flowPos = new Map<string, number>();
  try {
    getHoroscopeStar(stem as never, branch as never, scope).forEach((g, idx) => {
      for (const s of g) flowPos.set((s.name as string).slice(1), idx);
    });
  } catch (e) {
    console.warn("[horoscope] 干支异常，流曜计算跳过:", e);
  }
  const flowIn = (short: string) => sfSet.has(flowPos.get(short) ?? -1);

  // 三奇加会（运限）
  if (mutInSf(0) && mutInSf(1) && mutInSf(2)) {
    add(
      "三奇加会（运限）",
      "吉",
      `${tag}化禄${mutStars[0]}、化权${mutStars[1]}、化科${mutStars[2]}俱会${tag}命宫三方四正`,
      "运限三奇拱照，此运才干机遇名望齐至，宜大胆进取"
    );
  }

  // 双禄交会：运限化禄会照 + 本命禄存/生年禄星亦在三方（非同星）
  if (mutInSf(0)) {
    const natalLuHere = sfStars.has("禄存") || (ix.natal[0] !== mutStars[0] && ix.natal[0] && sfStars.has(ix.natal[0]));
    if (natalLuHere) {
      add(
        "双禄交会（运限）",
        "吉",
        `${tag}化禄（${mutStars[0]}）与本命禄（${sfStars.has("禄存") ? "禄存" : `生年禄星${ix.natal[0]}`}）同会${tag}命宫三方`,
        "运限禄叠本命禄，财源双至，进财应期"
      );
    }
  }

  // 阳梁昌禄（运限）：太阳天梁+（本命文昌或流昌）+（运限禄或本命禄）
  if (
    sfStars.has("太阳") &&
    sfStars.has("天梁") &&
    (sfStars.has("文昌") || flowIn("昌")) &&
    (mutInSf(0) || sfStars.has("禄存") || (ix.natal[0] && sfStars.has(ix.natal[0])))
  ) {
    add(
      "阳梁昌禄（运限）",
      "吉",
      `太阳、天梁会${tag}命宫三方，文昌${sfStars.has("文昌") ? "" : `（${fp}昌）`}与禄俱到`,
      "考试功名应期：升学、考证、竞聘、体制晋升的窗口期"
    );
  }

  // 禄马交驰（运限）：流禄/运限化禄 与 流马/本命天马 同会三方
  {
    const luIn = flowIn("禄") || mutInSf(0) || sfStars.has("禄存");
    const maIn = flowIn("马") || sfStars.has("天马");
    if (luIn && maIn && (flowIn("禄") || flowIn("马") || mutInSf(0))) {
      add(
        "禄马交驰（运限）",
        "吉",
        `禄（${flowIn("禄") ? `${fp}禄` : mutInSf(0) ? `化禄${mutStars[0]}` : "禄存"}）与马（${flowIn("马") ? `${fp}马` : "天马"}）同会${tag}命宫三方`,
        "动中得财之运，宜外出经营、差旅开拓、异地机会"
      );
    }
  }

  // 羊陀夹忌（运限）：运限忌星恰落本命禄存之宫（必被羊陀所夹）
  {
    const jiStar = mutStars[3];
    const luCunPos = ix.pos.get("禄存");
    if (jiStar && luCunPos != null && posOf(jiStar) === luCunPos) {
      add(
        "羊陀夹忌（运限）",
        "凶",
        `${tag}化忌（${jiStar}）落入本命禄存之宫【${seatName(luCunPos)}】，受擎羊陀罗相夹`,
        "此运忌星受夹无处可泄，该宫事项动辄得咎，宜守不宜攻"
      );
    }
  }

  // 忌入/忌冲运限命宫
  {
    const jiStar = mutStars[3];
    const jiPos = jiStar ? posOf(jiStar) : -1;
    if (jiPos === S) {
      add(
        "忌入运限命宫",
        "注意",
        `${tag}化忌（${jiStar}）坐${tag}命宫【${seatName(S)}】`,
        "忌坐运限命，此运多自我纠结、执念沉淀，宜收敛整固"
      );
    } else if (jiPos === fixIndex(S + 6)) {
      add(
        "忌冲运限命宫",
        "注意",
        `${tag}化忌（${jiStar}）自对宫【${seatName(jiPos)}】冲${tag}命宫`,
        "忌冲运限命，冲力最烈，主变动离散——换环境/换轨道的敏感期"
      );
    }
  }

  // 杀破狼运：运限命宫坐杀破狼
  {
    const sbl = a.palaces[S].majorStars.find((s) => ["七杀", "破军", "贪狼"].includes(s.name as string));
    if (sbl) {
      add(
        "杀破狼运",
        "注意",
        `${tag}命宫坐${sbl.name}（三方必会齐杀破狼）`,
        "变动开创之运：转型、跳槽、创业多发于此，宜主动求变忌被动硬守"
      );
    }
  }

  // 火贪/铃贪引动：贪狼在三方与火/铃同宫，且被本运四化引动（禄权忌任一）
  {
    const tanPos = ix.pos.get("贪狼");
    if (tanPos != null && sfSet.has(tanPos)) {
      const mates = starNamesAt(a, tanPos);
      const fire = ["火星", "铃星"].find((f) => mates.includes(f));
      const trigged = mutStars[0] === "贪狼" || mutStars[1] === "贪狼" || mutStars[3] === "贪狼";
      if (fire && trigged) {
        add(
          "火贪引动（运限）",
          "注意",
          `贪狼与${fire}同宫于${seatName(tanPos)}（在${tag}命宫三方），且本${tag.charAt(1)}贪狼被四化引动`,
          "横发格被引动：暴利与暴损同门，见好就收、落袋为安"
        );
      }
    }
  }

  return out;
}


/** 当前大限+流年+流月三 scope 一次扫描（共享索引）：导出与盘面格局面板共用入口 */
export function scanHoroscopePatterns(
  a: Astrolabe,
  h: {
    decadal: { index: number; heavenlyStem: unknown; earthlyBranch: unknown };
    yearly: { index: number; heavenlyStem: unknown; earthlyBranch: unknown };
    monthly?: { index: number; heavenlyStem: unknown; earthlyBranch: unknown };
  }
): { decadal: HoroPattern[]; yearly: HoroPattern[]; monthly: HoroPattern[] } {
  const ix = buildChartIndex(a);
  return {
    decadal: detectHoroscopePatterns(
      a,
      "decadal",
      h.decadal.index,
      h.decadal.heavenlyStem as string,
      h.decadal.earthlyBranch as string,
      ix
    ),
    yearly: detectHoroscopePatterns(
      a,
      "yearly",
      h.yearly.index,
      h.yearly.heavenlyStem as string,
      h.yearly.earthlyBranch as string,
      ix
    ),
    monthly: h.monthly
      ? detectHoroscopePatterns(
          a,
          "monthly",
          h.monthly.index,
          h.monthly.heavenlyStem as string,
          h.monthly.earthlyBranch as string,
          ix
        )
      : [],
  };
}
