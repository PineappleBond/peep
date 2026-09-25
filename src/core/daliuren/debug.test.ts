import { describe, it } from "vitest";
import { calculateDaLiuRen } from "./calculator";
import { isDaytime } from "./tianjiang";

describe("Debug test", () => {
  it("should check isDaytime for 2024-02-04 07:20", () => {
    const result = isDaytime(2024, 2, 4, 7, 20);
    console.log("isDaytime(2024, 2, 4, 7, 20) =", result);

    const fullResult = calculateDaLiuRen("2024-02-04", "07:20");
    console.log("日干:", fullResult.fourPillars.dayStem);
    console.log("天盘:", fullResult.heavenBoard);
    console.log("十二天将:");
    fullResult.twelveGenerals.forEach((g, i) => {
      console.log(`  [${i}] ${g.name}(${g.general})`);
    });
    console.log("PHP 天将: [1,2,3,4,5,6,7,8,9,10,11,0]");
  });
});
