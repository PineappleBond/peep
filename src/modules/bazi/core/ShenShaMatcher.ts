/**
 * 神煞匹配器
 *
 * 根据 JSON 规则库，匹配四柱/大运/流年中的天干、地支、纳音、干支组合，
 * 输出每条规则的命中详情（源柱、目标柱、匹配值）。
 *
 * 规则数据格式见 data/shensha-rules.json。
 */

import rulesJson from "../data/shensha-rules.json";
import nayinRows from "../data/nayin.json";

// ── 类型定义 ──────────────────────────────────────────

type Pillar = {
  name: string;
  gan: string;
  zhi: string;
  ganzhi: string;
  nayin: string | null;
  wuxing: string | null;
};

type Rule = {
  id: number;
  name: string;
  main: string;
  tags: string;
  sex: string;
  data: Record<string, unknown>;
};

export interface ShenShaHit {
  rule_type: string;
  source_pillar: string;
  source_value: string;
  target_pillar: string;
  target_value: string;
  target_ganzhi: string;
}

export interface ShenShaMatch {
  id: number;
  name: string;
  main: string;
  tags: string;
  sex: string;
  matches: ShenShaHit[];
}

// ── 常量 ──────────────────────────────────────────────

const GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const WUXING = ["金", "木", "水", "火", "土"];

/** 纳音 → 五行（取纳音字符串中第一个五行字符） */
const NAYIN: Record<string, string> = Object.fromEntries(
  Object.entries(
    nayinRows as unknown as Record<string, [string, number, number]>,
  ).map(([pillar, row]) => [pillar, row[0]]),
);

/** 标签编码 → 柱名映射 */
const TAG_TO_PILLAR: Record<string, string[]> = {
  "7": ["年柱"],
  "8": ["月柱"],
  "9": ["日柱"],
  "10": ["时柱"],
  "11": ["纳音"],
  "12": ["大运", "流年"],
  "13": ["年柱"],
  "15": ["日柱"],
  "16": ["月柱"],
};

/** main 编码 → 柱名映射 */
const MAIN_GAN_PILLAR: Record<string, string> = {
  "1": "年柱",
  "3": "日柱",
  "5": "月柱",
};
const MAIN_ZHI_PILLAR: Record<string, string> = {
  "7": "年柱",
  "8": "月柱",
  "9": "日柱",
  "10": "时柱",
};
const MAIN_EXTRA_PILLAR: Record<string, string> = {
  "13": "年柱",
  "15": "日柱",
  "16": "月柱",
  "25": "日柱",
  "26": "年柱",
};

// ── 核心类 ──────────────────────────────────────────────

export class ShenShaMatcher {
  private rules = rulesJson as Rule[];

  /**
   * 匹配所有规则
   *
   * @param bazi   - 四柱数据 { 年柱: {gan, zhi, ...}, ... }
   * @param extra  - 额外柱（大运、流年等）
   * @param options - 配置项 { gender, include_duplicates, wuxing_source }
   */
  matchAll(
    bazi: Record<string, unknown>,
    extra: Record<string, unknown> = {},
    options: Record<string, unknown> = {},
  ): ShenShaMatch[] {
    const gender = String(options.gender ?? "0");
    const includeDuplicates = !!options.include_duplicates;
    const wuxingSource = String(options.wuxing_source ?? "nayin_first");

    const pillars = this.normalizePillars(bazi, extra);
    const dayGan = pillars["日柱"]?.gan ?? null;
    const dayGanWuxing = dayGan ? this.ganWuxing(dayGan) : null;

    let results: ShenShaMatch[] = [];

    for (const rule of this.rules) {
      if (!this.genderAllowed(String(rule.sex), gender)) continue;

      let matched = this.matchRule(rule, pillars, dayGanWuxing, wuxingSource);
      if (!matched.length) continue;

      if (!includeDuplicates) {
        const seen = new Set<string>();
        matched = matched.filter((r) => {
          const k = JSON.stringify(r);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }

      results.push({
        id: rule.id,
        name: rule.name,
        main: rule.main,
        tags: rule.tags,
        sex: rule.sex,
        matches: matched,
      });
    }

    return results.sort((a, b) => a.id - b.id);
  }

  // ── 私有辅助 ──────────────────────────────────────────

  private genderAllowed(ruleSex: string, gender: string): boolean {
    return ruleSex === "0" || ruleSex === gender;
  }

  /**
   * 标准化柱位数据：合并 bazi + extra，校验 gan/zhi 合法性，
   * 计算 ganzhi 和纳音五行。
   */
  private normalizePillars(
    bazi: Record<string, unknown>,
    extra: Record<string, unknown>,
  ): Record<string, Pillar> {
    const out: Record<string, Pillar> = {};

    for (const [name, item] of Object.entries({ ...bazi, ...extra })) {
      const gan = String((item as Record<string, unknown>)?.gan ?? "").trim();
      const zhi = String((item as Record<string, unknown>)?.zhi ?? "").trim();

      if (!this.isGan(gan) || !this.isZhi(zhi)) {
        throw new Error(`柱 ${name} 的 gan/zhi 不合法：${gan}${zhi}`);
      }

      const ganzhi = gan + zhi;
      const nayin = NAYIN[ganzhi] ?? null;

      out[name] = {
        name,
        gan,
        zhi,
        ganzhi,
        nayin,
        wuxing: nayin ? this.nayinWuxing(nayin) : null,
      };
    }

    return out;
  }

  /** 匹配单条规则，返回命中列表 */
  private matchRule(
    rule: Rule,
    pillars: Record<string, Pillar>,
    dayGanWuxing: string | null,
    wuxingSource: string,
  ): ShenShaHit[] {
    const data = rule.data;
    const keys = Object.keys(data);
    if (!keys.length) return [];

    let type = this.detectRuleType(keys);
    if (type === "ganzhi_exact") {
      type = this.refineGanzhiSubtype(data);
    }

    let hits: ShenShaHit[] = [];
    const main = this.resolveMainSources(rule, pillars);
    const allowedOrig = this.resolveAllowedTargets(rule);
    let allowedTargets = [...allowedOrig];

    if (type === "gan_to_zhi") {
      for (const [sourceName, gan] of Object.entries(main.gan)) {
        if (!(gan in data)) continue;
        for (const targetZhi of this.splitZhiValues(String(data[gan]))) {
          for (const [targetName, target] of Object.entries(pillars)) {
            if (target.zhi === targetZhi) {
              hits.push(
                this.hit(type, sourceName, gan, targetName, targetZhi, target.ganzhi),
              );
            }
          }
        }
      }
    } else if (type === "zhi_to_zhi") {
      for (const [sourceName, zhi] of Object.entries(main.zhi)) {
        if (!(zhi in data)) continue;

        const value = String(data[zhi]);
        const ganzhiList = this.extractGanzhiList(value);

        if (ganzhiList.length) {
          // 干支列表模式：逐对匹配
          let targets = main.pillars.length ? main.pillars : Object.keys(pillars);
          if (!main.pillars.length) {
            const tagSet = String(rule.tags ?? "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            targets = tagSet.map((t) => MAIN_EXTRA_PILLAR[t]).filter(Boolean);
            if (!targets.length) targets = ["日柱"];
          }

          for (const gz of ganzhiList) {
            for (const targetName of targets) {
              const target = pillars[targetName];
              if (target && target.ganzhi === gz) {
                hits.push(
                  this.hit("zhi_to_ganzhi", sourceName, zhi, targetName, gz, target.ganzhi),
                );
              }
            }
          }
          continue;
        }

        // 纯地支或纯天干模式
        const targets = this.splitZhiValues(value);
        if (targets.length) {
          for (const targetZhi of targets) {
            for (const [targetName, target] of Object.entries(pillars)) {
              if (target.zhi === targetZhi) {
                hits.push(
                  this.hit(type, sourceName, zhi, targetName, targetZhi, target.ganzhi),
                );
              }
            }
          }
        } else {
          for (const targetGan of this.splitGanValues(value)) {
            for (const [targetName, target] of Object.entries(pillars)) {
              if (target.gan === targetGan) {
                hits.push(
                  this.hit(type, sourceName, zhi, targetName, targetGan, target.ganzhi),
                );
              }
            }
          }
        }
      }
    } else if (type === "ganzhi_exact") {
      const targets = main.pillars.length ? main.pillars : Object.keys(pillars);
      for (const key of keys) {
        for (const pn of targets) {
          const p = pillars[pn];
          if (p && p.ganzhi === key) {
            hits.push(this.hit(type, pn, key, pn, key, p.ganzhi));
          }
        }
      }
    } else if (type === "ganzhi_to_zhi") {
      const sources = main.pillars.length ? main.pillars : Object.keys(pillars);
      for (const sourceName of sources) {
        const p = pillars[sourceName];
        if (!p || !(p.ganzhi in data)) continue;
        for (const targetZhi of this.splitZhiValues(String(data[p.ganzhi]))) {
          for (const [targetName, target] of Object.entries(pillars)) {
            if (target.zhi === targetZhi) {
              hits.push(
                this.hit(type, sourceName, p.ganzhi, targetName, targetZhi, target.ganzhi),
              );
            }
          }
        }
      }
    } else if (type === "combo_stems") {
      for (const combo of keys) {
        const need = this.splitGanValues(combo);
        const found: { pillar: string; gan: string; ganzhi: string }[] = [];

        for (const gan of need) {
          for (const [pn, p] of Object.entries(pillars)) {
            if (p.gan === gan) {
              found.push({ pillar: pn, gan, ganzhi: p.ganzhi });
              break;
            }
          }
        }

        if (found.length === need.length) {
          hits.push({
            rule_type: type,
            source_pillar: found.map((x) => x.pillar).join(","),
            source_value: need.join(""),
            target_pillar: found.map((x) => x.pillar).join(","),
            target_value: need.join(""),
            target_ganzhi: found.map((x) => x.ganzhi).join(","),
          });
        }
      }
    } else if (type === "wuxing_to_zhi") {
      const contexts: { source_pillar: string; source_value: string }[] = [];

      if (wuxingSource === "nayin_first") {
        for (const [pn, p] of Object.entries(pillars)) {
          if (p.wuxing) contexts.push({ source_pillar: pn, source_value: p.wuxing });
        }
        if (dayGanWuxing) {
          contexts.push({ source_pillar: "日干", source_value: dayGanWuxing });
        }
      } else if (dayGanWuxing) {
        contexts.push({ source_pillar: "日干", source_value: dayGanWuxing });
      }

      for (const ctx of contexts) {
        const wx = ctx.source_value;
        if (!(wx in data)) continue;
        for (const z of this.splitZhiValues(String(data[wx]))) {
          for (const [pn, p] of Object.entries(pillars)) {
            if (p.zhi === z) {
              hits.push(
                this.hit(type, ctx.source_pillar, wx, pn, z, p.ganzhi),
              );
            }
          }
        }
      }
    }

    // 按 tags 过滤目标柱
    if (allowedTargets.length) {
      hits = hits.filter((h) => allowedTargets.includes(h.target_pillar ?? ""));
    }

    return hits;
  }

  private hit(
    type: string,
    sp: string,
    sv: string,
    tp: string,
    tv: string,
    tg: string,
  ): ShenShaHit {
    return {
      rule_type: type,
      source_pillar: sp,
      source_value: sv,
      target_pillar: tp,
      target_value: tv,
      target_ganzhi: tg,
    };
  }

  /** 从 tags 编码解析允许的目标柱位 */
  private resolveAllowedTargets(rule: Rule): string[] {
    const codes = String(rule.tags ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!codes.length || codes.includes("0")) return [];
    return [...new Set(codes.flatMap((c) => TAG_TO_PILLAR[c] ?? []))];
  }

  /**
   * 从 main 编码解析源柱
   *
   * 返回 { gan: {柱名: 天干}, zhi: {柱名: 地支}, pillars: [柱名...] }
   */
  private resolveMainSources(
    rule: Rule,
    pillars: Record<string, Pillar>,
  ): {
    gan: Record<string, string>;
    zhi: Record<string, string>;
    pillars: string[];
  } {
    const codes = String(rule.main ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const gan: Record<string, string> = {};
    const zhi: Record<string, string> = {};
    let ps: string[] = [];

    if (!codes.length) {
      // 无编码：默认取所有柱
      for (const [n, p] of Object.entries(pillars)) {
        gan[n] = p.gan;
        zhi[n] = p.zhi;
      }
      return { gan, zhi, pillars: Object.keys(pillars) };
    }

    for (const c of codes) {
      if (MAIN_GAN_PILLAR[c] && pillars[MAIN_GAN_PILLAR[c]]) {
        gan[MAIN_GAN_PILLAR[c]] = pillars[MAIN_GAN_PILLAR[c]].gan;
      }
      if (MAIN_ZHI_PILLAR[c] && pillars[MAIN_ZHI_PILLAR[c]]) {
        zhi[MAIN_ZHI_PILLAR[c]] = pillars[MAIN_ZHI_PILLAR[c]].zhi;
      }
      if (MAIN_EXTRA_PILLAR[c]) {
        ps.push(MAIN_EXTRA_PILLAR[c]);
      }
    }

    // 编码无法解析时，回退到全部柱
    if (!Object.keys(gan).length && !Object.keys(zhi).length && !ps.length) {
      for (const [n, p] of Object.entries(pillars)) {
        gan[n] = p.gan;
        zhi[n] = p.zhi;
      }
      ps = Object.keys(pillars);
    }

    return { gan, zhi, pillars: [...new Set(ps)] };
  }

  /** 根据 data 的 key 格式推断规则类型 */
  private detectRuleType(keys: string[]): string {
    const f = keys[0];
    if (this.isGan(f)) return "gan_to_zhi";
    if (this.isZhi(f)) return "zhi_to_zhi";
    if (WUXING.includes(f)) return "wuxing_to_zhi";

    const gl = this.splitGanValues(f);
    if (gl.length >= 2 && gl.join("") === f) return "combo_stems";
    if (this.isGanzhi(f)) return "ganzhi_exact";

    return "unknown";
  }

  /** 细分干支精确匹配的子类型 */
  private refineGanzhiSubtype(data: Record<string, unknown>): string {
    const first = Object.values(data)[0];
    if (first === null || first === "" || first === false) return "ganzhi_exact";

    const v = String(first);
    return this.splitZhiValues(v).length && !this.splitGanValues(v).length
      ? "ganzhi_to_zhi"
      : "ganzhi_exact";
  }

  private splitZhiValues(v: string): string[] {
    return [...new Set(Array.from(v).filter((c) => ZHI.includes(c)))];
  }

  private splitGanValues(v: string): string[] {
    return [...new Set(Array.from(v).filter((c) => GAN.includes(c)))];
  }

  /** 从字符串中提取连续的干支对（如"甲子乙丑" → ["甲子", "乙丑"]） */
  private extractGanzhiList(v: string): string[] {
    const cs = Array.from(v);
    const list: string[] = [];
    let i = 0;

    while (i < cs.length - 1) {
      if (this.isGan(cs[i]) && this.isZhi(cs[i + 1])) {
        list.push(cs[i] + cs[i + 1]);
        i += 2;
      } else {
        return [];
      }
    }

    if (i !== cs.length) return [];
    return [...new Set(list)];
  }

  private isGan(v: string): boolean {
    return GAN.includes(v);
  }

  private isZhi(v: string): boolean {
    return ZHI.includes(v);
  }

  private isGanzhi(v: string): boolean {
    const c = Array.from(v);
    return c.length === 2 && this.isGan(c[0]) && this.isZhi(c[1]);
  }

  private ganWuxing(g: string): string {
    if (["庚", "辛"].includes(g)) return "金";
    if (["甲", "乙"].includes(g)) return "木";
    if (["壬", "癸"].includes(g)) return "水";
    if (["丙", "丁"].includes(g)) return "火";
    if (["戊", "己"].includes(g)) return "土";
    throw new Error(`未知天干：${g}`);
  }

  private nayinWuxing(n: string): string {
    for (const x of ["金", "木", "水", "火", "土"]) {
      if (n.includes(x)) return x;
    }
    throw new Error(`未知纳音：${n}`);
  }
}
