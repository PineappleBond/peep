/**
 * 盘面索引原语测试：星→宫映射、三方四正、星文本格式化
 */
import { describe, expect, it } from "vitest";
import { astro } from "iztro";
import {
  AUSPICIOUS_MINORS,
  SHA_STARS,
  SEAT_ROLES,
  buildChartIndex,
  sanfangIdx,
  starNamesAt,
  starTxt,
} from "./chartIndex";
import { fixIndex, MUTAGEN_CHARS } from "./utils";
import type { Astrolabe } from "./useZwds";

function makeChart(dateStr = "2000-08-16", timeIndex = 2): Astrolabe {
  return astro.withOptions({
    type: "solar",
    dateStr,
    timeIndex,
    gender: "男" as never,
    isLeapMonth: false,
    fixLeap: true,
    language: "zh-CN",
    config: { algorithm: "default", yearDivide: "normal", horoscopeDivide: "normal" },
  });
}

describe("chartIndex 盘面索引原语", () => {
  const a = makeChart();
  const ix = buildChartIndex(a);

  describe("常量列表", () => {
    it("六吉星 8 颗", () => {
      expect(AUSPICIOUS_MINORS).toHaveLength(8);
      expect(AUSPICIOUS_MINORS).toContain("左辅");
      expect(AUSPICIOUS_MINORS).toContain("禄存");
    });

    it("六煞星 6 颗", () => {
      expect(SHA_STARS).toHaveLength(6);
      expect(SHA_STARS).toContain("擎羊");
      expect(SHA_STARS).toContain("地劫");
    });

    it("三方四正座次角色", () => {
      expect(SEAT_ROLES).toEqual(["本宫", "对宫", "三合", "三合"]);
    });
  });

  describe("buildChartIndex", () => {
    it("soulIdx 指向命宫", () => {
      expect(a.palaces[ix.soulIdx].name).toBe("命宫");
    });

    it("pos 映射覆盖所有主星+辅星+杂耀", () => {
      let totalStars = 0;
      for (const p of a.palaces) {
        totalStars += p.majorStars.length + p.minorStars.length + p.adjectiveStars.length;
      }
      expect(ix.pos.size).toBe(totalStars);
    });

    it("pos 映射值均在 0-11 范围", () => {
      for (const [, idx] of ix.pos) {
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(12);
      }
    });

    it("yearStem 取自日期干支首位", () => {
      const yearStem = a.chineseDate.split(" ")[0]?.charAt(0);
      expect(ix.yearStem).toBe(yearStem);
    });

    it("natal 四化星为 4 颗", () => {
      expect(ix.natal).toHaveLength(4);
    });
  });

  describe("sanfangIdx 三方四正", () => {
    it("命宫三方四正：本宫/对宫(+6)/三合(+4,-4)", () => {
      const soulIdx = ix.soulIdx;
      const sf = sanfangIdx(soulIdx);
      expect(sf).toHaveLength(4);
      expect(sf[0]).toBe(fixIndex(soulIdx));
      expect(sf[1]).toBe(fixIndex(soulIdx + 6));
      expect(sf[2]).toBe(fixIndex(soulIdx + 4));
      expect(sf[3]).toBe(fixIndex(soulIdx - 4));
    });

    it("四正索引均在 0-11 范围", () => {
      for (let i = 0; i < 12; i++) {
        const sf = sanfangIdx(i);
        for (const idx of sf) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(12);
        }
      }
    });
  });

  describe("starNamesAt 取星名列表", () => {
    it("返回主星+辅星+杂耀的所有名称", () => {
      const names = starNamesAt(a, 0);
      const p = a.palaces[0];
      const expected = [...p.majorStars, ...p.minorStars, ...p.adjectiveStars].map(
        s => s.name as string
      );
      expect(names).toEqual(expected);
    });

    it("负索引自动回绕（fixIndex）", () => {
      // 不应抛错
      expect(() => starNamesAt(a, -1)).not.toThrow();
      expect(() => starNamesAt(a, 12)).not.toThrow();
    });
  });

  describe("starTxt 星名带亮度与四化标记", () => {
    it("普通星只带名称", () => {
      // 取一颗不在四化表中的星
      const txt = starTxt(ix, "左辅");
      expect(txt).toContain("左辅");
    });

    it("生年四化星带【生年X】标记", () => {
      // 2000 庚年四化：太阳化禄、武曲化权、太阴化科、天同化忌
      const luStar = ix.natal[0]; // 太阳
      const txt = starTxt(ix, luStar);
      expect(txt).toContain(`【生年${MUTAGEN_CHARS[0]}】`);
    });

    it("有亮度的星带(亮度)标记", () => {
      // 找一颗有亮度的星
      for (const [name, bright] of ix.bright) {
        const txt = starTxt(ix, name);
        expect(txt).toContain(`(${bright})`);
        break;
      }
    });
  });
});
