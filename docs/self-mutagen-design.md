# 自化可视化功能设计方案

**日期**：2026-09-25  
**版本**：v2（经第 1 轮架构师 Review 修订）  
**状态**：设计中

---

## 一、背景与目标

### 1.1 现状
- **已有功能**：
  - 宫位卡片显示生年四化（实心标记）和离心自化（虚线标记）
  - 飞宫模式显示本命飞星连线
  - 详情面板（`PalaceDetail.tsx`）显示离心+向心自化文字信息
  
- **缺失功能**：
  - 图表中无向心自化的可视化
  - 不支持运限级别（大运、流年、流月、流日、流时）的自化显示
  - 数据获取与渲染逻辑耦合，不利于测试

### 1.2 目标

1. **数据层重构**：封装纯计算函数，接收已缓存的 `Astrolabe`，避免重复排盘
2. **多级别自化**：支持大运、流年、流月、流日、流时五个级别的自化显示
3. **箭头式可视化**：离心箭头向外放射，向心箭头从对宫指向本宫
4. **颜色区分**：用运限色区分不同级别（大运青绿、流年宝蓝等）

---

## 二、数据获取层设计

### 2.1 核心设计原则

**性能优先**：函数接收已缓存的 `Astrolabe` + `Horoscope`，不接收 `personId`。
本命盘排盘（`astro.bySolar()`）是重量级操作，在 `useZwds` hook 中由 `useMemo` 保护。
数据层函数作为纯计算函数，在组件层通过 `useMemo` 缓存结果，本命盘只计算一次。

### 2.2 核心方法

#### `getChartDataForScope(params)`

获取指定运限级别的 Chart 盘面自化数据。

**参数**：
```typescript
type ChartDataForScopeParams = {
  astrolabe: Astrolabe;       // 已缓存的本命盘
  horoscope: Horoscope;       // 已缓存的运限对象
  scope: Scope;               // "decadal" | "yearly" | "monthly" | "daily" | "hourly"
  analysis: ChartAnalysis;    // 已有的分析缓存（含 flyMatrix 等）
};
// Scope 类型沿用 utils.ts 现有定义，不含 "natal"
// 本命自化由现有 analysis.flyMatrix 提供，不走此函数
```

**返回值**：
```typescript
type ScopeChartData = {
  scope: Scope;
  // 宫位级数据：星曜旁的自化标记（供 PalaceCard / StarCell 渲染）
  palaceSelfMarks: Array<{
    palaceIndex: number;
    starMarks: Array<{
      starName: string;
      marks: Array<{
        char: "禄" | "权" | "科" | "忌";
        direction: "outward" | "inward"; // 离心 | 向心
      }>;
    }>;
  }>;
  // 跨宫连线数据：供 Chart SVG 层渲染箭头（扁平结构，免渲染层再遍历）
  selfLinks: Array<{
    fromIndex: number;
    toIndex: number;
    char: "禄" | "权" | "科" | "忌";
    direction: "outward" | "inward";
    star: string;              // 发生自化的星名
  }>;
};
```

**使用方式**：
```typescript
// 在 Chart 组件或 hook 中
const scopeResults = useMemo(() => {
  return SCOPES.filter(s => z.visible[s]).map(s =>
    getChartDataForScope({ astrolabe: z.astrolabe, horoscope: z.horoscope, scope: s, analysis: z.analysis })
  );
}, [z.astrolabe, z.horoscope, z.visible, z.analysis]);
// 合并所有 scope 的结果，按 scope 用不同颜色渲染
```

**命名说明**：

- 返回的自化标记命名为 `selfMarks` / `palaceSelfMarks`，区别于 `Palace.tsx` 中现有的 `selfMutagens`（宫干四化对应的四颗星名数组）。避免同名歧义。

#### 本命自化数据来源

本命自化（离心）已由现有 `analysis.flyMatrix` 提供：

- `PalaceFly.selfOutward`：离心自化列表
- `PalaceFly.selfInward`：向心自化列表
- `FlyEntry.isSelf` / `FlyEntry.isOpposite`：标记

无需新增函数，Chart 渲染层直接从 `z.analysis.flyMatrix` 读取。

### 2.3 HoroscopeBarData

**定位澄清**：`HoroscopeBar` 当前直接从 `z: Zwds` 获取数据（`z.decades`、`z.years` 等）。
这些数据已在 `useZwds` 中计算好，不需要新建独立的数据获取方法。

**方案**：在 `useZwds` 中新增派生属性 `horoscopeBarData`，格式化为 UI 友好的结构：

```typescript
// useZwds 返回值新增
horoscopeBarData: {
  [K in Scope]: {
    items: Array<{
      key: number;           // startAge / year / month / day / hour
      label: string;         // 显示文本
      palaceName: string;
      stem: string;
      selected: boolean;
    }>;
  };
};
```

这样新增 scope 只需扩展 `Scope` 类型和 `SCOPE_META`，无需改动数据结构。

### 2.4 职责分离原则

- **数据层**：纯计算函数，只返回"是什么"（哪颗星有什么四化/自化）
- **渲染层**：负责"怎么画"（坐标计算、SVG 绘制、颜色应用）
- **缓存层**：`useMemo` 在 hook / 组件层管理，本命盘只算一次
- **测试友好**：可以断言"某宫的某星有某个 scope 的自化标记"

---

## 三、运限自化计算逻辑

### 3.1 本命自化（现有）

- **离心**：本宫本命天干四化飞回本宫（`isSelf: to === P`）
- **向心**：对宫（`index + 6`）本命天干四化飞入本宫

### 3.2 运限自化（新增）

#### 3.2.1 核心概念澄清

**宫干 vs 运干**：

- **本命宫干**：本命盘每个宫位固定的天干（`a.palaces[i].heavenlyStem`），不随运限变化
- **运限天干**：运限命宫对应的天干，每个运限级别各不相同

**运限自化使用运限天干，非本命天干**。

#### 3.2.2 各 scope 天干获取方式

| scope      | 天干来源                                | 命宫索引来源                     |
| ---------- | --------------------------------------- | -------------------------------- |
| `decadal`  | `horoscope.decadal.heavenlyStem`        | `horoscope.decadal.index`        |
| `yearly`   | `horoscope.yearly.heavenlyStem`         | `horoscope.yearly.index`         |
| `monthly`  | `horoscope.monthly.heavenlyStem`        | `horoscope.monthly.index`        |
| `daily`    | `horoscope.daily.heavenlyStem`          | `horoscope.daily.index`          |
| `hourly`   | `horoscope.hourly.heavenlyStem`         | `horoscope.hourly.index`         |

> **实现时需验证**：iztro 的 `horoscope.daily.heavenlyStem` 和 `horoscope.hourly.heavenlyStem` 是否存在。  
> 若不存在，回退方案：从 `dayGanZhi(solar)` / `hourGanZhi(dayStem, i)` 返回值中提取天干部分。

#### 3.2.3 离心自化计算

```text
1. palaceIdx = horoscope[scope].index     // 运限命宫在本命盘的宫位索引
2. stem = horoscope[scope].heavenlyStem   // 运限天干（非本命天干！）
3. 四化星 = getMutagensByHeavenlyStem(stem)  // [禄星, 权星, 科星, 忌星]
4. 对每颗四化星，查其在盘中的位置（复用 chartIndex.pos）
5. 如果四化星的位置 === palaceIdx → 离心自化
```

#### 3.2.4 向心自化计算

```text
1. palaceIdx = horoscope[scope].index     // 运限命宫索引
2. oppIdx = fixIndex(palaceIdx + 6)       // 对宫位置（运限迁移宫）
3. oppStem = a.palaces[oppIdx].heavenlyStem  // 对宫位置的本命天干
   （宫干随宫位固定，不随运限变化；运限迁移宫在本命盘上对应 oppIdx 宫位）
4. 四化星 = getMutagensByHeavenlyStem(oppStem)
5. 对每颗四化星，查其在盘中的位置
6. 如果四化星的位置 === palaceIdx → 向心自化
```

> **关键区分**：向心自化中，取的是对宫位置的**本命天干**（宫干固定在宫位上），  
> 而非"运限迁移宫的运限天干"（运限天干只用于离心自化）。

#### 3.2.5 童限处理

出生到起运前为童限期，此时 `activeDecadeIdx = -1`，无大限数据。  
**策略**：童限期间不计算 `decadal` scope 的自化，其余 scope（yearly/monthly/daily/hourly）正常计算。

### 3.3 实现函数签名

```typescript
function getSelfMutagensForScope(
  scope: Scope,
  palaceIdx: number,          // 运限命宫在本命盘的索引
  stem: string,               // 运限天干
  astrolabe: Astrolabe,
  chartIndex: ChartIndex
): {
  outward: Array<{ star: string; char: MutagenChar }>;  // 离心
  inward: Array<{ star: string; char: MutagenChar }>;   // 向心
}
```

此函数签名与 `scanHoroscopePatterns`（`patterns.ts`）的参数风格对齐，  
可在同一调用点一起使用，共享 scope 数据。

---

## 四、UI 渲染方案

### 4.1 视觉设计

**离心自化**：

- 箭头从宫位中心向外放射（长度 15-20px）
- 多条自化时，按角度均匀分散（类似星芒）
- 实线，运限色

**向心自化**：

- 箭头从对宫中心指向本宫中心
- 虚线（`stroke-dasharray: 4,3`），运限色
- 箭头终点带三角形箭头（SVG `<marker>`）
- 连线中点显示标签

**标签规范**：

- 格式：`{scope缩写}·{四化字符}`，如"大·禄"、"年·忌"
- 离心/向心通过箭头方向区分，标签本身不额外标注"(离)"/"(向)"
- 同一宫位多标签时，沿连线法线方向错开排列
- 标签避让：非 focus 区域的自化不画跨宫箭头（仅显示星曜旁小标记），减少视觉杂乱

**颜色规范**：

```css
--c-decadal: #2ee6c8;   /* 大运 = 青绿 */
--c-yearly:  #5ba0ff;   /* 流年 = 宝蓝 */
--c-monthly: #ffa14e;   /* 流月 = 橙 */
--c-daily:   #c78bff;   /* 流日 = 紫 */
--c-hourly:  #ff77b7;   /* 流时 = 粉 */
```

### 4.2 宫位卡片标记

**星曜旁的自化标记**：

- 本命自化：虚线圆圈，四化色（现有 `.mut-self`）
- 运限自化：点线标记，运限色（新增 `.mut-scope-self`）
- 多个级别的自化标记堆叠显示

**样式**：

```css
.mut-scope-self {
  background: transparent;
  border: 1px dotted;
  line-height: 12px;
}
.mut-scope-self[data-scope="decadal"] {
  border-color: var(--c-decadal);
  color: var(--c-decadal);
}
/* yearly/monthly/daily/hourly 类推 */
```

### 4.3 模式交互规则

自化模式与飞宫模式**正交设计**，可同时开启，互不干扰：

| 组合           | 三方四正线   | 飞宫连线   | 自化箭头   |
| -------------- | ------------ | ---------- | ---------- |
| 默认（都不开） | ✅ 显示      | ❌         | ❌         |
| 仅飞宫模式     | ❌ 隐藏      | ✅ 显示    | ❌         |
| 仅自化模式     | ✅ 显示      | ❌         | ✅ 显示    |
| 两者都开       | ❌ 隐藏      | ✅ 显示    | ✅ 显示    |

**开关位置**：自化模式 toggle 按钮放在 `CenterPanel` 中，与飞宫模式按钮相邻。

### 4.4 性能策略

**视口裁剪**：

- 跨宫自化箭头只为 `focus` 宫位及其三方四正范围内的宫位渲染
- 非 focus 区域只在星曜旁显示小标记，不画跨宫连线

**缓存**：

- `getChartDataForScope` 结果通过 `useMemo` 缓存，依赖 `[astrolabe, horoscope, scope, analysis]`
- SVG 箭头坐标计算通过 `useMemo` 缓存

**极端情况**：

- 5 scope × 12 宫 × 4 化 × 2 方向 = 最多 480 条箭头（理论极端值，实际远少于此）
- 如果可见箭头超过 100 条，退化为仅显示 focus 区域的箭头

---

## 五、实现步骤

### 阶段一：运限自化计算（核心逻辑）

1. 在 `analysis.ts` 新增 `getSelfMutagensForScope` 函数
2. 验证 iztro `horoscope.daily/hourly.heavenlyStem` 是否存在
3. 编写单元测试（基于 `testFixtures.ts` 中的固定人物参数）
4. 处理童限期间的 decadal scope 边界情况

### 阶段二：数据层集成

1. 新增 `getChartDataForScope` 函数，封装宫位级标记 + 跨宫连线数据
2. 在 `useZwds` 中新增 `horoscopeBarData` 派生属性
3. 确保本命自化数据（`flyMatrix`）与运限自化数据格式一致

### 阶段三：UI 渲染

1. 在 `CenterPanel` 添加"自化模式"开关（正交于飞宫模式）
2. 修改 `StarCell.tsx`，渲染运限自化标记（点线，运限色）
3. 修改 `Chart.tsx`，绘制离心/向心箭头（SVG，含视口裁剪）
4. 修改 `PalaceDetail.tsx`，详情面板展示运限自化信息
5. 添加 CSS 样式（`.mut-scope-self`、箭头、连线）

### 阶段四：集成测试

1. 验证各运限级别的自化显示正确（对比已知盘面手动验证）
2. 验证颜色区分和模式交互逻辑
3. 验证与现有飞宫模式的兼容性（两者同时开启）
4. 验证童限期间的边界情况

---

## 六、测试策略

### 6.1 数据层测试

基于现有 `testFixtures.ts` 中的固定人物参数构造测试用例：

```typescript
import { testFixtures } from "./testFixtures";
import { getSelfMutagensForScope } from "./analysis";

test("大运离心自化——命宫天干四化飞回命宫", () => {
  const { astrolabe, horoscope } = testFixtures.standard;
  const palaceIdx = horoscope.decadal.index;
  const stem = horoscope.decadal.heavenlyStem;
  const chartIndex = buildChartIndex(astrolabe);
  
  const result = getSelfMutagensForScope("decadal", palaceIdx, stem, astrolabe, chartIndex);
  
  // 验证返回结构正确
  expect(result.outward).toBeArray();
  result.outward.forEach(m => {
    expect(m.star).toBeString();
    expect(m.char).toBeOneOf(["禄", "权", "科", "忌"]);
  });
});

test("向心自化——对宫本命天干四化飞入运限命宫", () => {
  // ...
});

test("童限期间 decadal scope 返回空", () => {
  // ...
});
```

### 6.2 UI 测试

- 验证自化模式下，箭头正确显示
- 验证不同 scope 的颜色区分
- 验证模式交互（飞宫+自化同时开启）
- 验证视口裁剪（非 focus 区域不画跨宫箭头）

---

## 七、涉及文件

| 文件 | 改动 |
| --- | --- |
| `src/core/analysis.ts` | 新增 `getSelfMutagensForScope`，运限自化计算核心 |
| `src/core/useZwds.ts` | 新增 `horoscopeBarData` 派生属性 |
| `src/components/Chart.tsx` | 集成自化模式，SVG 箭头绘制（含视口裁剪） |
| `src/components/CenterPanel.tsx` | 添加自化模式开关 |
| `src/components/StarCell.tsx` | 渲染运限自化标记（`.mut-scope-self`） |
| `src/components/Palace.tsx` | 传递运限自化数据给 StarCell |
| `src/components/PalaceDetail.tsx` | 详情面板展示运限自化信息 |
| `src/index.css` | 新增 `.mut-scope-self[data-scope]` 样式 |
| `src/core/analysis.test.ts` | 新增运限自化单元测试 |

---

## 八、风险与注意事项

1. **斗数学理准确性**：运限自化的取干规则（离心用运干、向心用对宫本命干）需与斗数理论一致，建议实现后与已知盘面交叉验证
2. **iztro 兼容性**：daily/hourly 的 `heavenlyStem` 字段需运行时验证，准备回退方案
3. **童限边界**：起运前无大限，需特殊处理 decadal scope
4. **视觉清晰度**：多级别箭头叠加时，通过视口裁剪+focus 区域限制控制数量
5. **与 patterns 模块协同**：`getSelfMutagensForScope` 的参数风格与 `scanHoroscopePatterns` 对齐，可共享调用点

---

## 九、后续优化

1. **按需计算**：只为 `visible[s]` 为 true 的 scope 计算自化
2. **导出功能**：支持将自化数据导出为 JSON/CSV
3. **动画效果**：自化箭头的渐显动画
4. **Canvas 降级**：箭头数量超过阈值时考虑 Canvas 替代 SVG

---

## 附录：Review 修订记录

### v1 → v2 修订（第 1 轮架构师 Review）

| # | 问题 | 修订 |
|---|---|---|
| 1 | `getChartData(personId, ...)` 导致本命盘重复计算 | 改为接收已缓存的 `Astrolabe` + `Horoscope` |
| 2 | `scope: "natal"` 与运限 scope 混在类型中 | "natal" 不纳入 Scope，本命自化由现有 flyMatrix 提供 |
| 3 | ChartData 缺少跨宫自化连线的扁平数据 | 新增 `selfLinks` 顶层字段 |
| 4 | `getHoroscopeBarData` 是对现有数据的冗余封装 | 改为 `useZwds` 的派生属性 `horoscopeBarData` |
| 5 | "本命天干作为运限运干"描述错误 | 修正为使用 `horoscope[scope].heavenlyStem`（运限天干） |
| 6 | daily/hourly 天干来源不明确 | 补充获取方式表和回退方案 |
| 7 | 向心自化"对宫天干"定义模糊 | 明确为对宫位置的本命天干（宫干随宫位固定） |
| 8 | 与 StarCell 现有消费模式不一致 | 说明沿用组件直接消费模式，数据层提供纯数据 |
| 9 | `selfMutagens` 与 Palace.tsx 同名歧义 | 改名为 `selfMarks` / `palaceSelfMarks` |
| 10 | HoroscopeBarData 硬编码五个 scope | 改为 `[K in Scope]` 动态结构 |
| 11 | 未提及与 patterns 模块协同 | 补充函数签名对齐说明 |
| 12 | SVG 箭头数量可能过多 | 新增视口裁剪策略 |
| 13 | 缓存仅在风险节提及 | 缓存提升为一等设计原则 |
| 14 | 未说明自化模式与飞宫模式的关系 | 新增"模式交互规则"节，正交设计 |
| 15 | 遗漏 PalaceDetail.tsx | 补充到涉及文件和实现步骤 |
| 16 | 未考虑童限期间 | 补充童限处理策略 |
| 17 | 标签内容规范不完整 | 补充标签格式和避让策略 |
| 18 | 测试示例假设 personId 数据库 | 改为基于 testFixtures 的固定参数 |

---

**文档维护**：本文档随实现进展更新，最终实现以代码为准。
