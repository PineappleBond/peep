/**
 * 大六壬 TS 实现与 PHP 参考实现的回归对比测试
 *
 * 数据来源：/tmp/review-liuren-php/tests/Fixtures/pan_regression_720.json
 * 该文件包含 720 个规范案例（12 指针 × 60 日），覆盖全部九宗门类型。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { calculateDaLiuRen } from "./calculator";

/** 九宗门 PHP 整数编号 → 名称 */
const JIU_ZONG_MEN_NAMES: Record<number, string> = {
  1: "元首",
  2: "重审",
  3: "比用",
  4: "比用知一",
  5: "涉害",
  6: "涉害见机",
  7: "涉害察微",
  8: "涉害缀瑕",
  9: "遥克蒿矢",
  10: "遥克弹射",
  11: "昴星虎视",
  12: "昴星冬蛇掩目",
  13: "别责",
  14: "八专",
  15: "八专独足",
  16: "伏吟不虞",
  17: "伏吟自任",
  18: "伏吟自信",
  19: "伏吟杜传",
  20: "返吟无依",
  21: "返吟无亲",
};

/**
 * TS 的 method 名 → PHP 九宗门编号集合（PHP 对部分方法分得更细）
 * TS "涉害见机/察微/缀瑕" 在 PHP 对应 5/6/7/8 多个编号
 */
const TS_METHOD_TO_PHP: Record<string, number[]> = {
  元首: [1],
  重审: [2],
  比用: [3],
  知一: [4],
  涉害: [5],
  涉害见机: [6],
  涉害察微: [7],
  涉害缀瑕: [8],
  蒿矢: [9],
  弹射: [10],
  昴星虎视: [11],
  昴星冬蛇掩目: [12],
  别责: [13],
  八专: [14],
  八专独足: [15],
  伏吟不虞: [16],
  伏吟自任: [17],
  伏吟自信: [18],
  伏吟杜传: [19],
  返吟无依: [20],
  返吟无亲: [21],
};

interface PhpCase {
  input: string;
  expected: Record<string, unknown>;
}

/** 加载 PHP fixture */
function loadPhpFixture(): Record<string, PhpCase> {
  const raw = readFileSync(
    "/tmp/review-liuren-php/tests/Fixtures/pan_regression_720.json",
    "utf-8",
  );
  const data = JSON.parse(raw);
  return data.cases as Record<string, PhpCase>;
}

/**
 * 解析 PHP 时间字符串 "YYYY-MM-DD HH:mm:ss" 为 [date, time]
 */
function parseDateTime(dt: string): [string, string] {
  const [date, time] = dt.split(" ");
  return [date, time];
}

/**
 * 比较单个案例
 */
function compareCase(caseId: string, phpCase: PhpCase) {
  const [date, time] = parseDateTime(phpCase.input);
  const tsResult = calculateDaLiuRen(date, time);
  const exp = phpCase.expected;

  // 天地盘
  for (let i = 0; i < 12; i++) {
    expect(tsResult.heavenBoard[i], `${caseId} 天盘[${i}]`).toBe(exp[`tianpan${i}`] as number);
  }

  // 四课（PHP sike 格式：[rigan, L1上, L2下, L2上, rizhi, L3上, L4下, L4上]）
  // TS 第一课：lower=日干寄宫, upper=天盘[寄宫]
  // PHP sike[0]=rigan, sike[1]=lesson1 upper
  // PHP sike[2]=lesson2 lower = lesson1 upper
  // PHP sike[3]=lesson2 upper
  // 比较：TS fourLessons[0].upper === PHP sike[1]
  //       TS fourLessons[1].upper === PHP sike[3]
  //       TS fourLessons[2].upper === PHP sike[5]
  //       TS fourLessons[3].upper === PHP sike[7]
  expect(tsResult.fourLessons[0].upper, `${caseId} 课1上`).toBe(exp.sike1 as number);
  expect(tsResult.fourLessons[1].upper, `${caseId} 课2上`).toBe(exp.sike3 as number);
  expect(tsResult.fourLessons[2].upper, `${caseId} 课3上`).toBe(exp.sike5 as number);
  expect(tsResult.fourLessons[3].upper, `${caseId} 课4上`).toBe(exp.sike7 as number);

  // 四课下（PHP sike[0]=日干本身，TS 用日干寄宫支，两者表示不同，跳过第一课下的比较）
  // 第二课下=课1上
  expect(tsResult.fourLessons[1].lower, `${caseId} 课2下`).toBe(exp.sike2 as number);
  // 第三课下=日支
  expect(tsResult.fourLessons[2].lower, `${caseId} 课3下`).toBe(exp.sike4 as number);
  // 第四课下=课3上
  expect(tsResult.fourLessons[3].lower, `${caseId} 课4下`).toBe(exp.sike6 as number);

  // 三传
  expect(tsResult.threeTransmissions.initial, `${caseId} 初传`).toBe(exp.sanchuan0 as number);
  expect(tsResult.threeTransmissions.middle, `${caseId} 中传`).toBe(exp.sanchuan1 as number);
  expect(tsResult.threeTransmissions.final, `${caseId} 末传`).toBe(exp.sanchuan2 as number);

  // 九宗门
  const phpJiuZongMen = exp.jiuzongmen as number;
  const tsMethod = tsResult.threeTransmissions.method;
  const allowedPhpCodes = TS_METHOD_TO_PHP[tsMethod] ?? [];
  expect(
    allowedPhpCodes.includes(phpJiuZongMen),
    `${caseId} 九宗门：TS="${tsMethod}"（映射到 PHP ${JSON.stringify(allowedPhpCodes)}），PHP=${phpJiuZongMen}(${JIU_ZONG_MEN_NAMES[phpJiuZongMen] ?? "?"})`,
  ).toBe(true);

  // 旬遁（前 3 位）
  // PHP: xundunN = (sanchuanN - xunHead) mod 12 → 0-9 为天干索引，10/11 为空亡位
  // TS:  xunDun 是 Map<地盘宫位, 遁干字符>，仅覆盖本旬 10 个位置
  // 比较：当 PHP xundun 在 0-9 范围内时，TS 应有对应遁干
  const TIAN_GAN = "甲乙丙丁戊己庚辛壬癸";
  const sanchuan = [
    tsResult.threeTransmissions.initial,
    tsResult.threeTransmissions.middle,
    tsResult.threeTransmissions.final,
  ];
  for (let i = 0; i < 3; i++) {
    const expDun = exp[`xundun${i}`] as number;
    if (expDun >= 10) {
      // 空亡位，TS 应返回 undefined
      expect(
        tsResult.xunDun[sanchuan[i]],
        `${caseId} 旬遁[${i}]（三传=${sanchuan[i]}，空亡位）`,
      ).toBeUndefined();
    } else {
      const tsDunChar = tsResult.xunDun[sanchuan[i]];
      const tsDunIdx = typeof tsDunChar === "string" ? TIAN_GAN.indexOf(tsDunChar) : -1;
      expect(tsDunIdx, `${caseId} 旬遁[${i}]（三传=${sanchuan[i]}，TS遁干="${tsDunChar}"）`).toBe(
        expDun,
      );
    }
  }

  // 六亲（前 3 位）
  // PHP liuqin[i] = 三传第 i 支的五行与日干五行的生克关系
  // TS  liuQin[pos] = 天盘[pos] 的五行与日干五行的生克关系
  // 比较：TS liuQin[sanchuan[i]] 应等于 PHP liuqin[i]
  const PHP_LIU_QIN: Record<number, string> = {
    "-2": "子孙",
    "-1": "妻财",
    0: "兄弟",
    1: "官鬼",
    2: "父母",
  };
  for (let i = 0; i < 3; i++) {
    const tsLQ = tsResult.liuQin[sanchuan[i]];
    const expLQCode = exp[`liuqin${i}`] as number;
    const expLQ = PHP_LIU_QIN[expLQCode];
    expect(tsLQ, `${caseId} 六亲[${i}]（三传=${sanchuan[i]}）`).toBe(expLQ);
  }
}

describe("PHP 参考实现对比（720 案例回归）", () => {
  const cases = loadPhpFixture();
  const caseIds = Object.keys(cases).sort();

  it(`应包含 720 个案例`, () => {
    expect(caseIds.length).toBe(720);
  });

  // 对每个案例分别生成测试
  for (const caseId of caseIds) {
    it(`案例 ${caseId}（${cases[caseId].input}）`, () => {
      compareCase(caseId, cases[caseId]);
    });
  }
});
