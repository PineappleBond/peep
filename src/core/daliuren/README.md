# 大六壬排盘 TypeScript 实现

## 概述

大六壬是中国古代三式之一（太乙、奇门、六壬），以占断人事见长。本模块为完整的六壬排盘 TypeScript 实现，覆盖从四柱、月将、天地盘、四课、三传（九宗门）到十二天将、神煞、课经、毕法赋等全套传统算法。

**主要特点：**

- **九宗门完备**：实现全部九宗门取法（贼克/比用/涉害/遥克/昴星/别责/八专）及伏吟、返吟特殊盘处理
- **课经 + 毕法赋**：内置 30+ 条课经规则和 6 条毕法规则，自动识别盘面格局
- **720 案例回归测试**：与 PHP 参考实现（meixiaoqiu/liuren）的 720 个标准案例逐一对比，全部通过
- **纯 TypeScript**：无额外框架依赖，仅依赖 `lunar-typescript` 做历法计算
- **完整类型定义**：所有接口、函数均有 TypeScript 类型标注

---

## 安装与使用

### 浏览器控制台

```js
// 全局方法（已在 peep 应用中注册）
await peep.DaLiuRen("2024-06-15", "12:00");

// 带命宫行年
await peep.DaLiuRen("2024-06-15", "12:00", { birthYear: 1990, gender: "男" });
```

### TypeScript/JavaScript 导入

```typescript
import { calculateDaLiuRen } from "./daliuren/calculator";

const result = calculateDaLiuRen("2024-06-15", "12:00");
console.log(result.fourPillars.dayPillar); // "丙午"
console.log(result.threeTransmissions.method); // "元首"
```

---

## API 参考

### calculateDaLiuRen(date, time, fateInput?)

主入口函数，返回完整盘面数据。

**参数：**

| 参数        | 类型                                          | 必填 | 说明                                        |
| ----------- | --------------------------------------------- | ---- | ------------------------------------------- |
| `date`      | `string`                                      | 是   | 公历日期，格式 `YYYY-MM-DD` 或 `YYYY/MM/DD` |
| `time`      | `string`                                      | 是   | 时间，格式 `HH:mm` 或 `HH:mm:ss`            |
| `fateInput` | `{ birthYear: number; gender: "男" \| "女" }` | 否   | 生年与性别，用于计算命宫行年                |

**返回值：** `DaLiuRenResult`

**异常：** 输入无效时抛出 `Error`（日期不存在、格式错误等）。

### DaLiuRenResult 接口

```typescript
interface DaLiuRenResult {
  /** 起课时间字符串（YYYY-MM-DD HH:mm:ss） */
  calculationTime: string;
  /** 四柱（年月日时干支） */
  fourPillars: FourPillars;
  /** 月将 */
  monthGeneral: MonthGeneral;
  /** 地盘（恒为 [0,1,...,11] 即子至亥） */
  earthBoard: number[];
  /** 天盘（月将加时后的十二支） */
  heavenBoard: number[];
  /** 四课 */
  fourLessons: FourLesson[];
  /** 旬空 */
  xunKong: XunKong;
  /** 三传（含取法名称和追踪） */
  threeTransmissions: ThreeTransmissionsResult;
  /** 十二天将（按地盘子至亥排列） */
  twelveGenerals: TwelveGeneral[];
  /** 旺相休囚死（每个天盘地支的状态） */
  wangXiang: Record<number, "旺" | "相" | "休" | "囚" | "死">;
  /** 六亲（每个天盘地支的六亲关系） */
  liuQin: Record<number, "父母" | "兄弟" | "子孙" | "妻财" | "官鬼">;
  /** 遁干（旬遁结果，地盘宫位 → 遁干） */
  xunDun: Record<number, string>;
  /** 日遁（五子元遁，12 个时辰的天干） */
  riDun: string[];
  /** 神煞列表 */
  shenSha: ShenSha[];
  /** 刑冲破害关系 */
  relations: BranchRelation[];
  /** 课经规则匹配 */
  keJing: KeJingMatch[];
  /** 毕法规则匹配 */
  biFa: BiFaMatch[];
  /** 命宫行年（需传入生年和性别，否则为 undefined） */
  fate?: FateInfo;
  /** 建除十二直（每个地支的建除类型） */
  jianChu: Record<number, JianChuType>;
  /** 纳音（每个地支的纳音） */
  naYin: Record<number, string>;
  /** 计算追踪记录 */
  calculationTrace: string[];
}
```

### 子类型

#### FourPillars — 四柱

```typescript
interface FourPillars {
  yearStem: number; // 年干索引（0-9，甲=0）
  yearBranch: number; // 年支索引（0-11，子=0）
  monthStem: number; // 月干索引
  monthBranch: number; // 月支索引
  dayStem: number; // 日干索引
  dayBranch: number; // 日支索引
  hourStem: number; // 时干索引
  hourBranch: number; // 时支索引
  yearPillar: string; // 年柱字符串（如"甲子"）
  monthPillar: string; // 月柱字符串
  dayPillar: string; // 日柱字符串
  hourPillar: string; // 时柱字符串
}
```

#### MonthGeneral — 月将

```typescript
interface MonthGeneral {
  branch: number; // 月将地支索引（0-11）
  name: string; // 月将名称（如"登明"）
}
```

十二月将名称：神后(子)、大吉(丑)、功曹(寅)、太冲(卯)、天罡(辰)、太乙(巳)、胜光(午)、小吉(未)、传送(申)、从魁(酉)、河魁(戌)、登明(亥)。

#### FourLesson — 四课

```typescript
interface FourLesson {
  upper: number; // 上课（天盘侧）地支索引
  lower: number; // 下课（地盘侧）地支索引
  lowerType: "stem" | "branch"; // 下课类型：stem=日干寄宫，branch=日支本位或上神传递
}
```

四课推导规则：

- 第一课：日干寄宫 → 干上神（天盘）
- 第二课：干上神 → 上神再临天盘
- 第三课：日支 → 支上神（天盘）
- 第四课：支上神 → 上神再临天盘

#### XunKong — 旬空

```typescript
interface XunKong {
  xunHead: number; // 旬首地支索引
  void1: number; // 空亡地支 1
  void2: number; // 空亡地支 2
}
```

#### ThreeTransmissionsResult — 三传

```typescript
interface ThreeTransmissionsResult {
  initial: number; // 初传地支索引
  middle: number; // 中传地支索引
  final: number; // 末传地支索引
  method: string; // 九宗门取法名称（如"元首""重审""涉害见机"等）
  trace: string[]; // 计算追踪（每步推导记录）
}
```

`method` 可能的取值：

| 取法         | method 值        | 说明                             |
| ------------ | ---------------- | -------------------------------- |
| 元首         | `"元首"`         | 一课上克下，无上克下             |
| 重审         | `"重审"`         | 一课下贼上，无上克下             |
| 比用         | `"比用"`         | 多克，取与日干阴阳同者           |
| 知一         | `"知一"`         | 多克（无贼），取与日干阴阳同者   |
| 涉害         | `"涉害"`         | 多克，比涉害深度取最深者         |
| 涉害见机     | `"涉害见机"`     | 涉害深度相同，取孟下             |
| 涉害察微     | `"涉害察微"`     | 涉害深度相同，取仲下             |
| 涉害缀瑕     | `"涉害缀瑕"`     | 孟仲季俱同，阳取干上/阴取支上    |
| 蒿矢         | `"蒿矢"`         | 四课无克，上神遥克日干           |
| 弹射         | `"弹射"`         | 四课无克，日干遥克上神           |
| 昴星虎视     | `"昴星虎视"`     | 无克无遥，阳日取酉上神           |
| 昴星冬蛇掩目 | `"昴星冬蛇掩目"` | 无克无遥，阴日取酉下神           |
| 别责         | `"别责"`         | 四课不备，取干合/支合            |
| 八专         | `"八专"`         | 干支同位，阳顺阴逆               |
| 八专独足     | `"八专独足"`     | 三传俱同                         |
| 伏吟不虞     | `"伏吟不虞"`     | 伏吟盘有克                       |
| 伏吟自任     | `"伏吟自任"`     | 伏吟盘无克，阳日                 |
| 伏吟自信     | `"伏吟自信"`     | 伏吟盘无克，阴日                 |
| 伏吟杜传     | `"伏吟杜传"`     | 伏吟盘初传自刑                   |
| 返吟无依     | `"返吟无依"`     | 返吟盘，初传用九宗门，中末用冲链 |
| 返吟无亲     | `"返吟无亲"`     | 返吟盘特殊日                     |

#### TwelveGeneral — 十二天将

```typescript
interface TwelveGeneral {
  position: number; // 地盘宫位地支索引（0-11）
  general: number; // 天将编号（0-11）
  name: string; // 天将名称
}
```

十二天将：贵人(0)、螣蛇(1)、朱雀(2)、六合(3)、勾陈(4)、青龙(5)、天空(6)、白虎(7)、太常(8)、玄武(9)、太阴(10)、天后(11)。

#### ShenSha — 神煞

```typescript
interface ShenSha {
  name: string; // 神煞名称
  branch: number; // 落宫地支索引
  type: "吉" | "凶"; // 吉凶属性
  description: string; // 说明
}
```

#### BranchRelation — 地支关系

```typescript
interface BranchRelation {
  type: "冲" | "刑" | "破" | "害" | "合";
  branches: [number, number];
  description: string;
}
```

#### KeJingMatch — 课经匹配

```typescript
interface KeJingMatch {
  rule: KeJingRule; // 匹配到的规则
  evidence: string[]; // 匹配证据（人可读的字符串列表）
}
```

#### BiFaMatch — 毕法匹配

```typescript
interface BiFaMatch {
  rule: BiFaRule; // 匹配到的规则
  evidence: string[]; // 匹配证据
}
```

#### FateInfo — 命宫行年

```typescript
interface FateInfo {
  mingGong: number; // 命宫地支（生年地支）
  xingNian: number; // 行年地支
  xingNianStem: number; // 行年天干
  xingNianIndex: number; // 行年六十甲子序号
  age: number; // 虚岁
}
```

#### JianChuType — 建除十二直

```typescript
type JianChuType =
  "建" | "除" | "满" | "平" | "定" | "执" | "破" | "危" | "成" | "收" | "开" | "闭";
```

---

## 使用示例

### 基本排盘

```typescript
import { calculateDaLiuRen } from "./daliuren/calculator";

const result = calculateDaLiuRen("2024-06-15", "12:00");

// 四柱
console.log(result.fourPillars.dayPillar); // "丙午"
console.log(result.fourPillars.hourPillar); // "甲午"

// 月将
console.log(result.monthGeneral.name); // 月将名称

// 天地盘
console.log(result.heavenBoard.map(b => "子丑寅卯辰巳午未申酉戌亥"[b]).join(" "));

// 四课
result.fourLessons.forEach((lesson, i) => {
  const upper = "子丑寅卯辰巳午未申酉戌亥"[lesson.upper];
  const lower = "子丑寅卯辰巳午未申酉戌亥"[lesson.lower];
  console.log(`第${i + 1}课: ${upper}←${lower}`);
});

// 三传
const { initial, middle, final, method } = result.threeTransmissions;
const dz = "子丑寅卯辰巳午未申酉戌亥";
console.log(`取法: ${method}`);
console.log(`三传: ${dz[initial]}→${dz[middle]}→${dz[final]}`);

// 十二天将
result.twelveGenerals.forEach(g => {
  console.log(`${"子丑寅卯辰巳午未申酉戌亥"[g.position]}: ${g.name}`);
});
```

### 带命宫行年

```typescript
const result = calculateDaLiuRen("2024-06-15", "12:00", {
  birthYear: 1990,
  gender: "男",
});

console.log(result.fate?.mingGong); // 命宫地支
console.log(result.fate?.xingNian); // 行年地支
console.log(result.fate?.age); // 虚岁
```

### 课经与毕法

```typescript
const result = calculateDaLiuRen("2024-01-01", "08:00");

// 课经
result.keJing.forEach(match => {
  console.log(`${match.rule.name}（${match.rule.group}）: ${match.rule.description}`);
  console.log(`  证据: ${match.evidence.join("; ")}`);
});

// 毕法
result.biFa.forEach(match => {
  console.log(`${match.rule.name}: ${match.evidence.join("; ")}`);
});
```

### 神煞与地支关系

```typescript
const result = calculateDaLiuRen("2024-06-15", "12:00");
const dz = "子丑寅卯辰巳午未申酉戌亥";

// 吉神
result.shenSha
  .filter(s => s.type === "吉")
  .forEach(s => console.log(`${s.name}(${dz[s.branch]}) - ${s.description}`));

// 凶煞
result.shenSha
  .filter(s => s.type === "凶")
  .forEach(s => console.log(`${s.name}(${dz[s.branch]}) - ${s.description}`));

// 刑冲破害
result.relations.forEach(r => {
  console.log(`${r.type}: ${dz[r.branches[0]]}${dz[r.branches[1]]} — ${r.description}`);
});
```

### 单独调用子模块

```typescript
import { getWangXiang } from "./daliuren/wangshuai";
import { getLiuQin } from "./daliuren/liuqin";
import { getNaYin } from "./daliuren/nayin";
import { getJianChu } from "./daliuren/jianchu";

// 旺相休囚死
console.log(getWangXiang(2, 2)); // 寅月寅支 → "旺"
console.log(getWangXiang(2, 5)); // 寅月巳支 → "相"

// 六亲（甲日，子支）
console.log(getLiuQin(0, 0)); // 甲(木)日子(水) → "父母"

// 纳音
console.log(getNaYin(0, 0)); // 甲子 → "海中金"

// 建除
console.log(getJianChu(2, 2)); // 寅月寅日 → "建"
console.log(getJianChu(2, 3)); // 寅月卯日 → "除"
```

---

## 模块说明

### calculator.ts — 主入口

排盘主流程，协调所有子模块。导出 `calculateDaLiuRen` 主函数及辅助函数：

| 导出函数                                                 | 说明                 |
| -------------------------------------------------------- | -------------------- |
| `calculateDaLiuRen(date, time, fateInput?)`              | 主入口，返回完整盘面 |
| `calculateFourPillars(solar)`                            | 计算四柱             |
| `calculateMonthGeneral(solar)`                           | 计算月将（中气换将） |
| `buildHeavenEarthBoards(monthGeneralBranch, hourBranch)` | 构建天地盘           |
| `extractFourLessons(dayStem, dayBranch, heavenBoard)`    | 提取四课             |
| `calculateXunKong(dayStem, dayBranch)`                   | 计算旬空             |
| `hourToBranch(hour)`                                     | 小时转时辰地支       |
| `calculateSexagenaryIndex(stem, branch)`                 | 计算六十甲子序号     |

### sanchuan.ts — 九宗门三传

实现九宗门取传法，按优先级链式判断：

**优先级：**

1. **伏吟**（天地盘重合）→ 不虞/自任/自信/杜传
2. **贼克** → 元首（上克下单一）/ 重审（下贼上单一）
3. **比用/知一** → 多克时取与日干阴阳同者
4. **涉害** → 比用无法唯一确定时，比较涉害深度（见机/察微/缀瑕）
5. **遥克** → 四课无克时，蒿矢（上神克日干）/ 弹射（日干克上神）
6. **昴星** → 无遥克时，虎视（阳日）/ 冬蛇掩目（阴日）
7. **别责** → 四课不备（交叉对相等）
8. **八专** → 干支同位（四课仅二）
9. **返吟**（天地盘对冲）→ 覆盖中末传为冲链，特殊日走无亲格

| 导出函数                                                                    | 说明                                        |
| --------------------------------------------------------------------------- | ------------------------------------------- |
| `calculateThreeTransmissions(fourLessons, dayStem, dayBranch, heavenBoard)` | 计算三传，返回含 method 和 trace 的完整结果 |

### tianjiang.ts — 十二天将

根据昼夜贵人和顺逆行排列十二天将。

**昼夜贵人口诀**（"甲戊庚牛羊"）：

- 甲戊庚：昼贵丑、夜贵未
- 乙己：昼贵子、夜贵申
- 丙丁：昼贵亥、夜贵酉
- 壬癸：昼贵巳、夜贵卯
- 辛：昼贵午、夜贵寅

**顺逆行规则**：贵人落地盘亥子丑寅卯辰（索引 11,0,1,2,3,4）顺行，落巳午未申酉戌（索引 5-10）逆行。

**昼夜判定**：卯时至申时（时辰索引 3-8）为昼，其余为夜。

| 导出函数                                                                | 说明           |
| ----------------------------------------------------------------------- | -------------- |
| `calculateTwelveGenerals(dayStem, hourBranch, heavenBoard, earthBoard)` | 计算十二天将   |
| `isDaytime(hourBranch)`                                                 | 判断是否为昼占 |

### kejing.ts — 课经规则

实现 30+ 条课经（格局）规则，按分组分类：

**三传类：** 元首课、重审课、比用课、涉害课、遥克课、昴星课、别责课、八专课、三奇课、官爵课、三光课、三阳课、六仪课、冲神三传、连珠课、连茹课

**盘面类：** 伏吟课、返吟课

**天将类：** 富贵课、龙德课、时泰课、铸印课、斫轮课、龙虎课

**特殊类：** 天祸课、九丑课、伏殃课、玄关课、天心课、天目课、天耳课、金华课、玉堂课、进儒课、退儒课、天罗地网课

| 导出函数/类型            | 说明                   |
| ------------------------ | ---------------------- |
| `evaluateKeJing(result)` | 评估盘面匹配哪些课经   |
| `getAllKeJingRules()`    | 获取所有已注册课经规则 |
| `KeJingRule`             | 课经规则接口           |
| `KeJingMatch`            | 课经匹配结果接口       |

### bifa.ts — 毕法赋

实现《六壬大全·毕法赋》前六法判断：

| 编号    | 规则名称       | 说明                                |
| ------- | -------------- | ----------------------------------- |
| bifa.01 | 前后引从升迁吉 | 初末传分临日干/日支前后宫，前引后从 |
| bifa.02 | 首尾相见始终宜 | 旬首旬尾临干支，或四建/三传尽入四课 |
| bifa.03 | 帘幕贵人高甲第 | 帘幕贵人临干年命，或德入天门        |
| bifa.04 | 催官使者赴官期 | 官星乘白虎临日干，或三传合局生官星  |
| bifa.05 | 六阳数足须公用 | 四课上神与中末传六位全阳或五阳      |
| bifa.06 | 六阴相继尽昏迷 | 四课上神与中末传六位全阴或五阴      |

| 导出函数/类型          | 说明                     |
| ---------------------- | ------------------------ |
| `evaluateBiFa(result)` | 评估盘面匹配哪些毕法规则 |
| `getAllBiFaRules()`    | 获取所有已注册毕法规则   |
| `BiFaRule`             | 毕法规则接口             |
| `BiFaMatch`            | 毕法匹配结果接口         |

### shensha.ts — 神煞

计算 40+ 种常用神煞，按来源分类：

**年煞（5 种）：** 岁破、丧门、吊客、病符、岁虎

**月煞（11 种）：** 天医、皇书、天喜、天马、天德、月德、丧车、游魂、伏殃、三丘、五墓

**日煞（干/支，10 种）：** 驿马、劫煞、亡神、将星、华盖、咸池、红艳、文昌、学堂、词馆

**补充神煞（14 种）：** 天德合、月德合、天恩、天赦、圣心、皇恩、天成、天官、天福、天财、禄神、天罗、地网

| 导出函数/类型                                                               | 说明             |
| --------------------------------------------------------------------------- | ---------------- |
| `calculateShenSha(yearBranch, monthBranch, dayStem, dayBranch, hourBranch)` | 计算全部常用神煞 |
| `ShenSha`                                                                   | 神煞接口         |

### wangshuai.ts — 旺相休囚死

根据月支确定当令五行，判断各地支五行的旺衰状态。

**规则：**

- 同五行 → 旺
- 当令生目标 → 相
- 目标生当令 → 休
- 目标克当令 → 囚
- 当令克目标 → 死

**月支 → 当令五行：**

- 寅卯月 → 木旺
- 巳午月 → 火旺
- 申酉月 → 金旺
- 亥子月 → 水旺
- 辰戌丑未月 → 土旺

| 导出函数                                  | 说明                       |
| ----------------------------------------- | -------------------------- |
| `getWangXiang(monthBranch, targetBranch)` | 获取单个地支的旺衰状态     |
| `getAllWangXiang(monthBranch)`            | 获取全部 12 地支的旺衰状态 |

### liuqin.ts — 六亲

以日干五行为"我"，判断目标地支的六亲关系：

| 关系 | 五行条件                   |
| ---- | -------------------------- |
| 父母 | 生我者（目标五行生我）     |
| 兄弟 | 同我者（目标五行与我相同） |
| 子孙 | 我生者（我生目标五行）     |
| 妻财 | 我克者（我克目标五行）     |
| 官鬼 | 克我者（目标五行克我）     |

| 导出函数                           | 说明                   |
| ---------------------------------- | ---------------------- |
| `getLiuQin(dayStem, targetBranch)` | 获取单个地支的六亲     |
| `getAllLiuQin(dayStem)`            | 获取全部 12 地支的六亲 |

### dungan.ts — 遁干

实现旬遁和日遁（五子元遁）两种遁干法。

**旬遁**：按日柱所在旬的旬首（恒为甲），在地盘上从旬首位置起甲，顺次遁出甲乙丙丁……

**日遁（五子元遁）**：按日干决定子时起何干，顺推十二时辰天干。口诀：

- 甲己日起甲子时
- 乙庚日起丙子时
- 丙辛日起戊子时
- 丁壬日起庚子时
- 戊癸日起壬子时

| 导出函数                                           | 说明                               |
| -------------------------------------------------- | ---------------------------------- |
| `calculateXunDun(dayStem, dayBranch, heavenBoard)` | 计算旬遁，返回 Map<宫位, 天干>     |
| `calculateRiDun(dayStem)`                          | 计算日遁，返回 12 个时辰的天干数组 |
| `getRiDunStem(dayStem, hourBranch)`                | 获取某时辰的遁干                   |
| `getXunInfo(dayStem, dayBranch)`                   | 获取旬首信息（旬首地支和旬名）     |

### relations.ts — 刑冲破害合

检测地支之间的五种关系：

**六冲：** 子午、丑未、寅申、卯酉、辰戌、巳亥

**三刑：**

- 寅巳申（无恩之刑）
- 丑戌未（恃势之刑）
- 子卯（无礼之刑）
- 辰午酉亥（自刑）

**六破：** 子酉、午卯、申巳、寅亥、辰丑、戌未

**六害：** 子未、丑午、寅巳、卯辰、申亥、酉戌

**六合：** 子丑、寅亥、卯戌、辰酉、巳申、午未

| 导出函数/类型                   | 说明                           |
| ------------------------------- | ------------------------------ |
| `findBranchRelations(branches)` | 检测给定地支列表中所有两两关系 |
| `BranchRelation`                | 关系接口                       |

### fate.ts — 命宫行年

**命宫**：生年地支即为命宫。

**行年**：

- 男命：一岁起丙寅（甲子序号 2），顺行
- 女命：一岁起壬申（甲子序号 8），逆行

**虚岁** = 当前年 - 生年 + 1

| 导出函数/类型                                   | 说明             |
| ----------------------------------------------- | ---------------- |
| `calculateFate(birthYear, gender, currentYear)` | 计算命宫行年     |
| `FateInfo`                                      | 命宫行年信息接口 |

### jianchu.ts — 建除十二直

以月建（月支）起"建"，顺排十二宫。

**顺序：** 建 → 除 → 满 → 平 → 定 → 执 → 破 → 危 → 成 → 收 → 开 → 闭

**吉凶参考：** 建(吉)、除(吉)、满(凶)、平(吉)、定(凶)、执(凶)、破(凶)、危(凶)、成(吉)、收(凶)、开(吉)、闭(凶)

| 导出函数/类型                           | 说明                           |
| --------------------------------------- | ------------------------------ |
| `getJianChu(monthBranch, targetBranch)` | 获取单个地支的建除类型         |
| `getMonthJianChu(monthBranch)`          | 获取当月全部 12 地支的建除类型 |
| `JianChuType`                           | 建除类型                       |

### nayin.ts — 纳音五行

六十甲子纳音表，每两组干支对应一纳音（共 30 组）。

**口诀节选：** 甲子乙丑海中金、丙寅丁卯炉中火、戊辰己巳大林木……

| 导出函数/常量                         | 说明                   |
| ------------------------------------- | ---------------------- |
| `getNaYin(stem, branch)`              | 获取单对干支的纳音名称 |
| `getBoardNaYin(dayStem, heavenBoard)` | 批量计算天盘纳音       |
| `NAYIN_TABLE`                         | 纳音表（60 项）        |
| `NAYIN_ELEMENT`                       | 纳音名称 → 五行映射    |

### types.ts — 类型定义

所有接口类型的集中定义，包括 `DaLiuRenResult` 及其所有子类型。无运行时逻辑。

### constants.ts — 常量表

所有查找表和常量的集中定义，包括：

- 天干地支名称（`TIAN_GAN`、`DI_ZHI`）
- 五行（`WU_XING`、`STEM_ELEMENT`、`BRANCH_ELEMENT`）
- 阴阳（`STEM_YIN_YANG`、`BRANCH_YIN_YANG`）
- 十干寄宫（`STEM_LODGING`）
- 十二天将（`TIAN_JIANG`、`NOBLEMAN_TABLE`）
- 月将（`MONTH_GENERAL_NAMES`、`JIE_QI_TO_MONTH_GENERAL`）
- 节气（`JIE_QI_NAMES`）
- 地支关系（`LIU_CHONG`、`LIU_HAI_PAIRS`、`LIU_HE_PAIRS`、`SAN_HE_TRIPLES`、`DI_ZHI_XING`）
- 旬首（`XUN_HEAD`）
- 课经/毕法共用表（`DAY_VIRTUES`、`DAY_ORIGIN`、`DAY_LU`）

### utils.ts — 公共工具函数

多模块共享的辅助函数：

| 导出函数                                 | 说明                     |
| ---------------------------------------- | ------------------------ |
| `elemB(branch)`                          | 取地支五行               |
| `elemS(stem)`                            | 取天干五行               |
| `keOf(a)`                                | 五行 a 所克之五行        |
| `shengOf(a)`                             | 五行 a 所生之五行        |
| `sexagenaryIndex(stem, branch)`          | 计算六十甲子序号         |
| `stemLodgingBranch(stem)`                | 日干寄宫所在支           |
| `isFuyin(result)`                        | 天地盘是否伏吟           |
| `isFanyin(result)`                       | 天地盘是否返吟           |
| `inFourLessons(branch, result)`          | 天盘某支是否在四课上课中 |
| `getGeneralRidingBranch(branch, result)` | 天盘某支所乘天将编号     |
| `findGeneralPosition(name, result)`      | 找某天将所在地盘宫位     |

---

## 传统算法参考

### 月将（中气换将）

大六壬以"中气换将"确定月将，即以二十四节气中的**中气**（非节气）为换将点。

**中气与月将对应：**

| 中气 | 月将       |
| ---- | ---------- |
| 冬至 | 丑（大吉） |
| 大寒 | 子（神后） |
| 雨水 | 亥（登明） |
| 春分 | 戌（河魁） |
| 谷雨 | 酉（从魁） |
| 小满 | 申（传送） |
| 夏至 | 未（小吉） |
| 大暑 | 午（胜光） |
| 处暑 | 巳（太乙） |
| 秋分 | 辰（天罡） |
| 霜降 | 卯（太冲） |
| 小雪 | 寅（功曹） |

实现上遍历全年节气时刻表，找到目标时刻之前最近的节气，按索引查表得月将。

### 天地盘

**月将加占时**：天盘 = 地盘 + (月将 - 时支) mod 12。

地盘固定为子至亥（0-11），天盘为月将加临时支后的旋转结果。即 `heaven[hourBranch] = monthGeneral`。

### 四课

以日干、日支为基，通过天盘推得四层上下关系：

1. **第一课**：日干寄宫（地盘）→ 天盘上神
2. **第二课**：第一课上神所在地盘 → 天盘上神
3. **第三课**：日支（地盘）→ 天盘上神
4. **第四课**：第三课上神所在地盘 → 天盘上神

**十干寄宫**：甲→寅、乙→辰、丙→巳、丁→未、戊→巳、己→未、庚→申、辛→戌、壬→亥、癸→丑。

### 九宗门

九宗门是确定三传（初传、中传、末传）的规则链，按优先级从高到低：

1. **贼克**：四课中有上克下或下贼上，取单一克者为初传。上克下为"元首"，下贼上为"重审"。
2. **比用（知一）**：多克时，取与日干阴阳相同之课上神为初传。
3. **涉害**：比用无法唯一确定时，计算各候选的涉害深度（上神回归本位路径上的克数），取最深者。深度相同时按孟仲季排序（见机/察微/缀瑕）。
4. **遥克**：四课无克时，检查四课上神与日干的遥克关系。上神克日干为"蒿矢"，日干克上神为"弹射"。
5. **昴星**：无遥克时，取酉上下神。阳日取天盘酉上神（虎视），阴日取天盘酉所在地盘位（冬蛇掩目）。
6. **别责**：四课不备（仅三课）时，阳日取干合上神、阴日取支合。
7. **八专**：干支同位（四课仅二）时，阳日干上神顺数 2 位、阴日支上神逆数 2 位。

**特殊盘**：

- **伏吟**（天地盘重合）：有克取克（不虞），无克阳日取干上神（自任）、阴日取支上神（自信），初传自刑时取替代（杜传）。中末传用刑链。
- **返吟**（天地盘对冲）：初传沿用标准九宗门，中末传改为冲链。特殊日（辛未/辛丑/丁丑/己丑）走无亲格。

**中末传标准递推**：中传 = 天盘[初传]，末传 = 天盘[中传]。

### 十二天将

以日干查昼夜贵人表，根据占时（昼/夜）确定贵人落宫。贵人落地盘亥至辰位顺行、巳至戌位逆行，依次排列十二天将。

---

## 测试

### 单元测试

```bash
npm test
```

运行所有 `*.test.ts` 文件，包括 720 案例回归测试。

### 回归测试

720 个 PHP 参考案例（12 种指针 x 60 日）全部通过，覆盖全部九宗门类型（21 种取法）。

测试数据来源：`/tmp/review-liuren-php/tests/Fixtures/pan_regression_720.json`

---

## 索引约定

所有地支、天干索引均为 0-based：

- **天干**：甲=0, 乙=1, 丙=2, 丁=3, 戊=4, 己=5, 庚=6, 辛=7, 壬=8, 癸=9
- **地支**：子=0, 丑=1, 寅=2, 卯=3, 辰=4, 巳=5, 午=6, 未=7, 申=8, 酉=9, 戌=10, 亥=11
- **五行**：木=0, 火=1, 土=2, 金=3, 水=4

---

## 参考资源

- **PHP 参考实现**：[meixiaoqiu/liuren](https://github.com/meixiaoqiu/liuren)
- **传统文献**：
  - 《六壬大全》
  - 《大六壬指南》
  - 《毕法赋》
  - 《观月经》
- **历法计算**：[lunar-typescript](https://github.com/6tail/lunar-typescript)

---

## 许可证

本模块随仓库主项目许可。
