import { describe, it, expect } from "vitest";
import { vigorOf } from "../vigor";

describe("vigorOf", () => {
  it("旺：时间五行与爻五行相同（同我者）", () => {
    expect(vigorOf("金", "金")).toBe("旺");
    expect(vigorOf("木", "木")).toBe("旺");
    expect(vigorOf("水", "水")).toBe("旺");
    expect(vigorOf("火", "火")).toBe("旺");
    expect(vigorOf("土", "土")).toBe("旺");
  });

  it("相：时间生爻（生我者）", () => {
    expect(vigorOf("金", "水")).toBe("相"); // 金生水
    expect(vigorOf("水", "木")).toBe("相"); // 水生木
    expect(vigorOf("木", "火")).toBe("相"); // 木生火
    expect(vigorOf("火", "土")).toBe("相"); // 火生土
    expect(vigorOf("土", "金")).toBe("相"); // 土生金
  });

  it("休：爻生时间（我生者）", () => {
    expect(vigorOf("水", "金")).toBe("休"); // 金生水，爻生时间
    expect(vigorOf("木", "水")).toBe("休"); // 水生木
    expect(vigorOf("火", "木")).toBe("休"); // 木生火
    expect(vigorOf("土", "火")).toBe("休"); // 火生土
    expect(vigorOf("金", "土")).toBe("休"); // 土生金
  });

  it("囚：爻克时间（我克者）", () => {
    // 囚 = 爻克时间 = ELEM_OVERCOME[lineElem] === timeElem
    expect(vigorOf("木", "金")).toBe("囚"); // 金克木（爻=金，时间=木）
    expect(vigorOf("土", "木")).toBe("囚"); // 木克土（爻=木，时间=土）
    expect(vigorOf("火", "水")).toBe("囚"); // 水克火（爻=水，时间=火）
    expect(vigorOf("金", "火")).toBe("囚"); // 火克金（爻=火，时间=金）
    expect(vigorOf("水", "土")).toBe("囚"); // 土克水（爻=土，时间=水）
  });

  it("死：时间克爻（克我者）", () => {
    expect(vigorOf("火", "金")).toBe("死"); // 火克金
    expect(vigorOf("金", "木")).toBe("死"); // 金克木
    expect(vigorOf("木", "土")).toBe("死"); // 木克土
    expect(vigorOf("土", "水")).toBe("死"); // 土克水
    expect(vigorOf("水", "火")).toBe("死"); // 水克火
  });

  it("五行组合全覆盖（5x5 = 25 种）", () => {
    const elems = ["金", "木", "水", "火", "土"] as const;
    const results = new Set<string>();

    for (const timeElem of elems) {
      for (const lineElem of elems) {
        results.add(`${timeElem}-${lineElem}:${vigorOf(timeElem, lineElem)}`);
      }
    }

    expect(results.size).toBe(25); // 5x5 = 25 种组合
  });
});
