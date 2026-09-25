import { describe, it } from "vitest";
import { calculateDaLiuRen } from "./calculator";

describe("Debug test", () => {
  it("should output debug info", () => {
    const result = calculateDaLiuRen("2024-06-15", "18:00");
    console.log("日干:", result.fourPillars.dayStem);
    console.log("时支:", result.fourPillars.hourBranch);
    console.log("天盘:", result.heavenBoard);
    console.log("十二天将:");
    result.twelveGenerals.forEach((g, i) => {
      console.log(`  [${i}] position=${g.position}, general=${g.general}, name=${g.name}`);
    });
  });
});
