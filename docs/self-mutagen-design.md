# 自化可视化功能设计方案

**日期**：2026-09-25  
**版本**：v7（经第 7 轮架构师 Review 修订）  
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

### 2.2 类型定义

新增公共类型（在 `utils.ts` 中导出）：

```typescript
export type MutagenChar = (typeof MUTAGEN_CHARS)[number]; // "禄" | "权" | "科" | "忌"

// 运限自化标记（StarCell / PalaceCard / PalaceDetail 共用）
export type ScopeSelfMark = {
  scope: Scope;
  char: MutagenChar;
  direction: "outward" | "inward";
};
```

### 2.3 核心方法

#### `getChartDataForScope(params)`

获取指定运限级别的 Chart 盘面自化数据。

**参数**：

```typescript
type ChartDataForScopeParams = {
  astrolabe: Astrolabe;       // 已缓存的本命盘
  horoscope: Horoscope;       // 已缓存的运限对象
  scope: Scope;               // "decadal" | "yearly" | "monthly" | "daily" | "hourly"
  chartIndex?: ChartIndex;    // 可选：外部缓存的索引（避免重复构建）
};
// Scope 类型沿用 utils.ts 现有定义，不含 "natal"
// 本命自化由现有 analysis.flyMatrix 提供，不走此函数
```

> **注意**：
> - 参数中不再包含 `analysis`。运限自化计算只需要 `astrolabe` + `horoscope`。
> - `chartIndex` 可选：若外部已缓存（如 `useMemo`），传入避免重复构建；否则函数内部通过 `buildChartIndex(astrolabe)` 获取。
> - `horoscope` 在童限期间仍可能为有效对象（iztro 不返回 null），调用方需自行过滤 `decadal` scope（见 3.2.5 节）。

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
        char: MutagenChar;
        direction: "outward" | "inward"; // 离心 | 向心
      }>;
    }>;
  }>;
  // 跨宫连线数据：供 Chart SVG 层渲染箭头（扁平结构，免渲染层再遍历）
  selfLinks: Array<{
    fromIndex: number;
    toIndex: number;
    char: MutagenChar;
    direction: "outward" | "inward";
    star: string;              // 发生自化的星名
    isSelfLoop: boolean;       // 离心时 fromIndex === toIndex，SVG 渲染为星芒而非连线
  }>;
};
```

**聚合逻辑伪代码**：

```text
getChartDataForScope(params):
  if (!horoscope) return { scope, palaceSelfMarks: [], selfLinks: [] }
  palaceIdx = horoscope[scope].index     // 运限命宫在本命盘的宫位索引
  stem = horoscope[scope].heavenlyStem   // 运限天干
  chartIndex = params.chartIndex ?? buildChartIndex(astrolabe)

  // 1. 计算运限命宫的离心 + 向心自化
  rawMarks = getSelfMarksForScope(palaceIdx, stem, astrolabe, chartIndex)

  // 2. 构建 palaceSelfMarks（12 宫，大部分宫位为空数组）
  palaceSelfMarks = 12宫.map(palace => {
    if (palace.index !== palaceIdx) return { palaceIndex: palace.index, starMarks: [] }
    // 只有运限命宫有自化标记
    stars = [...palace.majorStars, ...palace.minorStars].filter(s => rawMarks.outward 中有 s 或 rawMarks.inward 中有 s)
    return { palaceIndex, starMarks: stars.map(...) }
  })

  // 3. 构建 selfLinks（扁平连线数据）
  oppIdx = fixIndex(palaceIdx + 6)
  selfLinks = [
    // 离心：运限命宫 → 运限命宫（isSelfLoop = true）
    ...rawMarks.outward.map(m => ({
      fromIndex: palaceIdx, toIndex: palaceIdx, isSelfLoop: true,
      char: m.char, direction: "outward", star: m.star
    })),
    // 向心：对宫 → 运限命宫（isSelfLoop = false）
    ...rawMarks.inward.map(m => ({
      fromIndex: oppIdx, toIndex: palaceIdx, isSelfLoop: false,
      char: m.char, direction: "inward", star: m.star
    })),
  ]

  return { scope, palaceSelfMarks, selfLinks }
```

**使用方式**：

```typescript
// 在 Chart 组件中
const chartIndex = useMemo(() => buildChartIndex(z.astrolabe), [z.astrolabe]);

const scopeResults = useMemo(() => {
  if (!z.horoscope) return [];
  const effectiveScopes = SCOPES.filter(s => {
    if (s === "decadal" && z.activeDecadeIdx === -1) return false; // 童限跳过
    return z.visible[s];
  });
  return effectiveScopes.map(s =>
    getChartDataForScope({ astrolabe: z.astrolabe, horoscope: z.horoscope, scope: s, chartIndex })
  );
}, [z.astrolabe, z.horoscope, z.visible, z.activeDecadeIdx, chartIndex]);
// 合并所有 scope 的结果，按 scope 用不同颜色渲染
```

**命名说明**：

- 返回的自化标记命名为 `selfMarks` / `palaceSelfMarks`，区别于 `Palace.tsx` 中现有的 `selfMutagens`（宫干四化对应的四颗星名数组）。避免同名歧义。
- 核心计算函数也统一命名为 `getSelfMarksForScope`（非旧名 `getSelfMutagensForScope`）。

#### 本命自化数据来源

本命自化（离心）已由现有 `analysis.flyMatrix` 提供：

- `PalaceFly.selfOutward`：离心自化列表
- `PalaceFly.selfInward`：向心自化列表
- `FlyEntry.isSelf` / `FlyEntry.isOpposite`：标记

无需新增函数，Chart 渲染层直接从 `z.analysis.flyMatrix` 读取。

### 2.4 HoroscopeBarData

**结论**：无需新增。`HoroscopeBar` 当前直接从 `z: Zwds` 获取数据（`z.decades`、`z.years` 等），这些数据已在 `useZwds` 中计算好且由 `useMemo` 保护，读取方式简洁高效。新增 `horoscopeBarData` 派生属性属于过度抽象，删除此节。

### 2.5 数据流完整路径

**传递策略：prop 下传**（scopeResults 是纯 UI 派生数据，不污染核心 hook）

```text
Chart.tsx
  ↓ useMemo 计算 scopeResults（5 个 scope 的 getChartDataForScope 结果）
  ↓ 按 palaceIndex 预过滤为 perPalaceSelfMarks: Record<number, selfScopeMarks[]>
  ↓ 通过新 prop 传给 PalaceCard
PalaceCard（props 新增 selfScopeMarks）
  ↓ 按 starName 过滤，传给 StarCell
StarCell（props 新增 selfScopeMarks）
  ↓ 渲染
.mut-scope-self 标记（点线，运限色）

Chart.tsx SVG 层
  ↓ 从 scopeResults 合并所有 selfLinks
  ↓ 计算坐标 + 渲染
离心星芒 / 向心虚线箭头
```

**Chart.tsx 中的预过滤逻辑**：

```typescript
// 将 scopeResults 按 palaceIndex → starName 二级分组
const perPalaceSelfMarks = useMemo(() => {
  const map: Record<number, Record<string, ScopeSelfMark[]>> = {};
  for (const r of scopeResults) {
    for (const pm of r.palaceSelfMarks) {
      if (!map[pm.palaceIndex]) map[pm.palaceIndex] = {};
      for (const sm of pm.starMarks) {
        const marks = sm.marks.map(m => ({ scope: r.scope, char: m.char, direction: m.direction }));
        (map[pm.palaceIndex][sm.starName] ??= []).push(...marks);
      }
    }
  }
  return map;
}, [scopeResults]);

// 传给 PalaceCard（直接按 index 查找，无需字符串匹配）
<PalaceCard
  palace={p}
  z={z}
  focus={focus}
  onFocus={handleFocus}
  onDetail={setDetailIdx}
  selfScopeMarks={perPalaceSelfMarks[p.index] ?? {}}
/>
```

**PalaceCard 新增 props**：

```typescript
// Palace.tsx
interface PalaceCardProps {
  // ...existing
  selfScopeMarks?: Record<string, ScopeSelfMark[]>;
  // key = starName, value = 该星的运限自化标记列表
}
```

**StarCell 新增 props**：

```typescript
// StarCell.tsx 新增
selfScopeMarks?: ScopeSelfMark[];
```

> **注意**：`majorStars` 和 `minorStars` 的 StarCell 均需传入 `selfScopeMarks`（两者都可能包含被自化的星曜）。
>
> **direction 在 StarCell 层的处理**：离心/向心在星曜旁标记的外观相同（同为 `.mut-scope-self` 点线框），但通过 `title` tooltip 区分：`title="离心·大限禄"` vs `title="向心·大限禄"`。direction 数据在 selfLinks（SVG 层）中用于确定箭头方向。

### 2.6 职责分离原则

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

> **已验证**：iztro `HoroscopeItem` 类型包含 `heavenlyStem: HeavenlyStemName`，`daily` 和 `hourly` 均为 `HoroscopeItem` 类型，无需回退方案。

#### 3.2.3 离心自化计算

```text
1. palaceIdx = horoscope[scope].index     // 运限命宫在本命盘的宫位索引
2. stem = horoscope[scope].heavenlyStem   // 运限天干（非本命天干！）
3. 四化星 = getMutagensByHeavenlyStem(stem)  // [禄星, 权星, 科星, 忌星]
4. 对每颗四化星，查其在盘中的位置（chartIndex.pos.get(star) ?? -1）
5. 如果位置为 -1，跳过该星（星不在盘中，不产生自化标记）
6. 如果四化星的位置 === palaceIdx → 离心自化
```

#### 3.2.4 向心自化计算

```text
1. palaceIdx = horoscope[scope].index     // 运限命宫索引
2. oppIdx = fixIndex(palaceIdx + 6)       // 对宫位置（运限迁移宫）
3. oppStem = a.palaces[oppIdx].heavenlyStem  // 对宫位置的本命天干
   （宫干随宫位固定，不随运限变化；运限迁移宫在本命盘上对应 oppIdx 宫位）
4. 四化星 = getMutagensByHeavenlyStem(oppStem)
5. 对每颗四化星，查其在盘中的位置（chartIndex.pos.get(star) ?? -1）
6. 如果位置为 -1，跳过该星
7. 如果四化星的位置 === palaceIdx → 向心自化
```

> **关键区分**：向心自化中，取的是对宫位置的**本命天干**（宫干固定在宫位上），
> 而非"运限迁移宫的运限天干"（运限天干只用于离心自化）。

#### 3.2.5 边界条件处理

**童限**：

- 判断条件：`activeDecadeIdx === -1`
- 策略：跳过 `decadal` scope 的 `getChartDataForScope` 调用
- 注意：`horoscope.decadal` 在童限期间仍有数据（iztro 不返回 null），但该数据不对应命主实际大限，应跳过

**闰月**：

- `effLeap = true` 时，iztro 已根据实际公历日期计算 `horoscope.monthly/daily/hourly`
- 闰月与本月共享月建干支，运限自化计算不受影响（取的是 `horoscope[scope].heavenlyStem`）

**子时跨日**：

- `dayDivide` 配置（`"forward"` | `"current"`）控制晚子时（23:00-00:00）归当日还是次日
- 已由 iztro 在 `horoscope()` 计算中处理，`getChartDataForScope` 直接读取即可
- 测试用例应覆盖晚子时场景（`timeIndex=12`）

**星不在盘中**：

- `chartIndex.pos.get(star)` 返回 `undefined` 时，取 `-1`，跳过该星
- 与现有 `getFlyMatrix` 的处理方式一致

### 3.3 实现函数签名

```typescript
function getSelfMarksForScope(
  palaceIdx: number,          // 运限命宫在本命盘的索引
  stem: string,               // 运限天干（调用方从 horoscope[scope].heavenlyStem 传入，HeavenlyStemName 类型，此处用 string 避免依赖 iztro 内部类型）
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

- `isSelfLoop = true`：`fromIndex === toIndex`，SVG 渲染为环绕锚点的星芒（非连线）
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

**颜色规范（已有 CSS 变量，无需新增）**：

现有 `index.css` 已定义 `--c-decadal` 到 `--c-hourly`，以及 `.mut-decadal` 到 `.mut-hourly` 类（已设置 `border-color` 和 `color`）。
只需新增 `.mut-scope-self` 基础规则覆盖 `border-style`，运限色由现有 `.mut-{scope}` 类自动生效：

```css
/* 新增：运限自化 = 点线边框（颜色由现有 .mut-{scope} 类提供） */
.mut-scope-self {
  background: transparent;
  border: 1px dotted;
  line-height: 12px;
}
/* 无需为每个 scope 写复合规则——.mut-decadal 等已设置正确的 border-color 和 color */
```

### 4.2 SVG 层级策略

SVG 渲染顺序（从底到顶）：

1. 三方四正线（底层，非飞宫模式时显示）
2. 飞宫连线（中层，飞宫模式时显示）
3. 自化箭头（顶层，自化模式时显示）

箭头使用 `marker-end` 三角形 + 不同 `stroke-dasharray` 区分离心（实线星芒）/向心（虚线箭头），与飞宫线的实线视觉上可区分。

**SVG `<marker>` 定义**：

```xml
<defs>
  <!-- 向心箭头：fill=context-stroke 动态继承连线颜色 -->
  <marker id="arrow-self" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
  </marker>
</defs>
```

> `fill="context-stroke"` 使箭头颜色自动继承所在 `<line>` 的 `stroke` 颜色（运限色），无需为每个 scope 定义独立 marker。

### 4.3 宫位卡片标记

**星曜旁的自化标记**：

- 本命自化：虚线圆圈，四化色（现有 `.mut-self`）
- 运限自化：点线标记，运限色（新增 `.mut-scope-self`）
- 多个级别的自化标记堆叠显示

**StarCell 标记 DOM 结构**：

```html
<!-- 本命四化（实心） -->
<b class="mut mut-natal" data-m="禄">禄</b>
<!-- 运限四化（描边按限色） -->
<b class="mut mut-scope mut-decadal" data-m="权">权</b>
<!-- 本命自化（虚线，四化色） -->
<b class="mut mut-self" data-m="忌">忌</b>
<!-- 运限自化（点线，运限色）——新增 -->
<b class="mut mut-scope-self mut-decadal" data-m="禄">禄</b>
<b class="mut mut-scope-self mut-yearly" data-m="科">科</b>
```

**样式**：见 4.1 节"颜色规范"（已统一定义）。

### 4.4 模式交互规则

自化模式与飞宫模式**正交设计**，可同时开启，互不干扰：

**状态管理**（在 `Chart.tsx` 中）：

```typescript
const [selfMode, setSelfMode] = useState(false);
// 类比现有 flyMode：const [flyMode, setFlyMode] = useState(false);
```

| 组合           | 三方四正线   | 飞宫连线   | 自化箭头   |
| -------------- | ------------ | ---------- | ---------- |
| 默认（都不开） | ✅ 显示      | ❌         | ❌         |
| 仅飞宫模式     | ❌ 隐藏      | ✅ 显示    | ❌         |
| 仅自化模式     | ✅ 显示      | ❌         | ✅ 显示    |
| 两者都开       | ❌ 隐藏      | ✅ 显示    | ✅ 显示    |

**开关位置**：自化模式 toggle 按钮放在 `CenterPanel` 的 `depth-row` 中，飞宫按钮右侧，样式为 `.db.db-self`。通过 `onToggleSelf` 回调传给 `CenterPanel`。

小屏幕适配：`.depth-row` 已有无条件 `flex-wrap: wrap`（`index.css:888`），无需额外媒体查询。

**`.db-self` 按钮样式**（类比现有 `.db-fly`）：

```css
.db-self { color: var(--m-ji); }           /* 忌色（紫），呼应自化"泄气"概念 */
.db-self:hover { background: rgba(227,91,216,0.15); }
.db-self.on { background: rgba(227,91,216,0.25); box-shadow: 0 0 6px rgba(227,91,216,0.4); }
```

> 按钮始终可点击（即使 `horoscope` 为 null），SVG 层在无数据时自然不渲染，与飞宫按钮行为一致。

### 4.5 PalaceDetail 运限自化展示

在 `PalaceDetail.tsx` 中新增"运限自化" section（与现有"宫干四化" section 并列）。

**数据来源**：`PalaceDetail` 已接收 `z: Zwds`（含 `z.astrolabe`、`z.horoscope`），内部直接调用 `getSelfMarksForScope` 计算各 visible scope 的自化数据（无需从 Chart 层传入）。

```html
<section>
  <h4>运限自化</h4>
  {visibleScopes.map(s => (
    <p key={s.scope}>
      <span className={`pat-scope pat-scope-${s.scope}`}>{scopeLabel(s.scope)}</span>
      离心：{s.outward.length ? s.outward.map(m => `${m.star}化${m.char}`).join("、") : "无"}
      {" / "}
      向心：{s.inward.length ? s.inward.map(m => `${m.star}化${m.char}`).join("、") : "无"}
    </p>
  ))}
</section>
```

- 显示所有 `visible[s] === true` 的 scope
- 离心/向心并列展示
- scope 标签复用现有 `.pat-scope` / `.pat-scope-{scope}` 样式（格局面板已有）
- `scopeLabel`：decadal→"大运"、yearly→"流年"、monthly→"流月"、daily→"流日"、hourly→"流时"

### 4.6 性能策略

**箭头数量估算**：

- 每个 scope 最多 8 条箭头（离心 4 + 向心 4），5 scope 最多 40 条
- 实际因星曜位置重叠（同一颗星不可能同时化禄和化权），通常每 scope 2-4 条
- 40 条远低于 SVG 性能瓶颈，无需退化逻辑

**视口裁剪**：

- 跨宫自化箭头（向心连线）只为 `focus` 宫位及其三方四正范围内的宫位渲染
- 非 focus 区域只在星曜旁显示小标记，不画跨宫连线

**缓存**：

- `getChartDataForScope` 结果通过 `useMemo` 缓存，依赖 `[astrolabe, horoscope, scope]`
- SVG 箭头坐标计算通过 `useMemo` 缓存

---

## 五、实现步骤

### 阶段一：类型与核心计算

1. 在 `utils.ts` 新增 `MutagenChar` 类型导出
2. 在 `analysis.ts` 新增 `getSelfMarksForScope` 函数
3. 处理边界条件：星不在盘中（`pos.get() ?? -1` → 跳过）
4. 编写单元测试（基于 `testFixtures.ts` 中的固定人物参数）

### 阶段二：数据层聚合

1. 新增 `getChartDataForScope` 函数，封装聚合逻辑（伪代码见 2.3 节）
2. 构建 `palaceSelfMarks`（12 宫）+ `selfLinks`（扁平连线）
3. 确保本命自化数据（`flyMatrix`）与运限自化数据格式一致

### 阶段三：UI 渲染

1. 在 `CenterPanel` 添加"自化模式"开关（正交于飞宫模式，`.db.db-self`，`onToggleSelf` 回调）
2. 修改 `Chart.tsx`：计算 `scopeResults` + `perPalaceSelfMarks`，通过 prop 传给 PalaceCard
3. 修改 `Palace.tsx`：接收 `selfScopeMarks` prop，按 starName 过滤传给 StarCell（`majorStars` 和 `minorStars` 均需传入）
4. 修改 `StarCell.tsx`：渲染运限自化标记（`.mut-scope-self.mut-{scope}`，点线，运限色），tooltip 区分离心/向心
5. 修改 `Chart.tsx` SVG 层：绘制离心星芒 / 向心虚线箭头（含 `<marker>` 定义，视口裁剪）
6. 修改 `PalaceDetail.tsx`：新增"运限自化" section（见 4.5 节）
7. 添加 CSS 样式（`.mut-scope-self` 点线边框、SVG `<marker>` 定义）

### 阶段四：集成测试

1. 验证各运限级别的自化显示正确（对比已知盘面手动验证）
2. 验证颜色区分和模式交互逻辑
3. 验证与现有飞宫模式的兼容性（两者同时开启）
4. 验证边界情况（童限、晚子时、闰月）

---

## 六、测试策略

### 6.1 核心计算测试

基于现有 `testFixtures.ts` 中的固定人物参数构造测试用例：

```typescript
import { makeZwdsFixture } from "./testFixtures";
import { getSelfMarksForScope, buildChartIndex } from "./analysis";

test("大运离心自化——运限天干四化飞回运限命宫", () => {
  const { astrolabe, horoscope } = makeZwdsFixture();
  const palaceIdx = horoscope.decadal.index;
  const stem = horoscope.decadal.heavenlyStem as string;
  const chartIndex = buildChartIndex(astrolabe);
  
  const result = getSelfMarksForScope(palaceIdx, stem, astrolabe, chartIndex);
  
  expect(result.outward).toBeArray();
  result.outward.forEach(m => {
    expect(m.star).toBeString();
    expect(m.char).toBeOneOf(["禄", "权", "科", "忌"]);
  });
});

test("向心自化——对宫本命天干四化飞入运限命宫", () => {
  // ...
});

test("星不在盘中——跳过该星不产生自化标记", () => {
  // ...
});
```

### 6.2 聚合函数测试

```typescript
test("getChartDataForScope——palaceSelfMarks 只在运限命宫有标记", () => {
  const result = getChartDataForScope({ astrolabe, horoscope, scope: "decadal" });
  const palaceIdx = horoscope.decadal.index;
  
  // 只有运限命宫有自化标记，其余 11 宫为空
  const nonEmpty = result.palaceSelfMarks.filter(p => p.starMarks.length > 0);
  expect(nonEmpty).toHaveLength(1);
  expect(nonEmpty[0].palaceIndex).toBe(palaceIdx);
});

test("getChartDataForScope——selfLinks 方向正确", () => {
  const result = getChartDataForScope({ astrolabe, horoscope, scope: "yearly" });
  
  result.selfLinks.forEach(link => {
    if (link.direction === "outward") {
      expect(link.isSelfLoop).toBe(true);
      expect(link.fromIndex).toBe(link.toIndex);
    } else {
      expect(link.isSelfLoop).toBe(false);
      expect(link.fromIndex).toBe(fixIndex(link.toIndex + 6));
    }
  });
});
```

### 6.3 多 scope 叠加测试

```typescript
test("多 scope 叠加：大运离心 + 流年向心同时存在", () => {
  // 构造某宫同时有大运自化和流年自化的场景
  // 验证 palaceSelfMarks 正确区分 scope 和 direction
});
```

### 6.4 边界条件测试

```typescript
test("童限期间 decadal scope 返回空", () => {
  // activeDecadeIdx === -1 的场景
});

test("晚子时流日自化：dayDivide=forward 时归次日", () => {
  // timeIndex = 12 的场景
});

test("闰月流月自化：闰五月与五月共用月建干支", () => {
  // effLeap = true 的场景
});
```

### 6.5 UI 测试

- 验证自化模式下，箭头正确显示
- 验证不同 scope 的颜色区分
- 验证模式交互（飞宫+自化同时开启）
- 验证视口裁剪（非 focus 区域不画跨宫箭头）

---

## 七、涉及文件

| 文件 | 改动 |
| --- | --- |
| `src/core/utils.ts` | 新增 `MutagenChar` 类型导出 |
| `src/core/analysis.ts` | 新增 `getSelfMarksForScope` + `getChartDataForScope` |
| `src/components/Chart.tsx` | 集成自化模式，SVG 箭头绘制（含视口裁剪） |
| `src/components/CenterPanel.tsx` | 添加自化模式开关（`.db.db-self`） |
| `src/components/StarCell.tsx` | 渲染运限自化标记（`.mut-scope-self`），新增 `selfScopeMarks` prop |
| `src/components/Palace.tsx` | 从 `scopeResults` 提取数据传给 StarCell |
| `src/components/PalaceDetail.tsx` | 详情面板展示运限自化信息 |
| `src/index.css` | 新增 `.mut-scope-self` 样式、SVG marker 定义 |
| `src/core/analysis.test.ts` | 新增运限自化单元测试 + 聚合测试 + 边界测试 |

---

## 八、风险与注意事项

1. **斗数学理准确性**：运限自化的取干规则（离心用运干、向心用对宫本命干）需与斗数理论一致，建议实现后与已知盘面交叉验证
2. **童限边界**：`activeDecadeIdx === -1` 时跳过 decadal scope
3. **视觉清晰度**：向心连线最多 40 条，远低于 SVG 性能瓶颈
4. **与 patterns 模块协同**：`getSelfMarksForScope` 的参数风格与 `scanHoroscopePatterns` 对齐，可共享调用点

---

## 九、后续优化

1. **按需计算**：只为 `visible[s]` 为 true 的 scope 计算自化
2. **导出功能**：支持将自化数据导出为 JSON/CSV
3. **动画效果**：自化箭头的渐显动画

---

## 附录：Review 修订记录

### v1 → v2 修订（第 1 轮架构师 Review）

| # | 问题 | 修订 |
| --- | --- | --- |
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

### v2 → v3 修订（第 2 轮架构师 Review）

| # | 问题 | 修订 |
| --- | --- | --- |
| 1 | 函数名 `getSelfMutagensForScope` 与数据命名 `selfMarks` 矛盾 | 统一为 `getSelfMarksForScope` |
| 2 | `getChartDataForScope` 聚合逻辑缺失 | 补充完整伪代码（12 宫遍历 + selfLinks 生成） |
| 3 | `analysis` 参数用途不明 | 从参数中移除，`chartIndex` 由函数内部构建 |
| 4 | `horoscopeBarData` 无消费方（死代码） | 删除此节，HoroscopeBar 保持现有读取方式 |
| 5 | StarCell 数据传递路径不清晰 | 补充完整数据流路径 + StarCell 新增 props 定义 |
| 6 | 星不在盘中的处理缺失 | 步骤 4-5 间加入 `pos.get() ?? -1` → 跳过防御 |
| 7 | 闰月影响未说明 | 补充闰月边界说明（iztro 已处理） |
| 8 | 子时跨日影响未说明 | 补充 dayDivide 说明 + 测试覆盖 |
| 9 | 童限判断条件不明确 | 明确 `activeDecadeIdx === -1` 判断 |
| 10 | `MutagenChar` 类型未定义 | 新增 `utils.ts` 导出 |
| 11 | 类型定义冗余 | 统一引用 `MutagenChar` |
| 12 | `getChartDataForScope` 无测试计划 | 补充聚合函数测试（palaceSelfMarks + selfLinks） |
| 13 | 缺少多 scope 叠加测试 | 补充叠加场景测试用例 |
| 14 | 缺少晚子时 + 闰月边界测试 | 补充边界测试用例 |
| 15 | iztro daily/hourly heavenlyStem 待验证 | 已确认存在，删除回退方案说明 |
| 16 | SVG 层级冲突未说明 | 补充 SVG 渲染顺序策略（三层） |
| 17 | CenterPanel 按钮布局未说明 | 补充 flex-wrap 小屏幕适配 |
| 18 | `horoscopeBarData` 性能隐患 | 删除（见 #4） |
| 19 | 离心 selfLink 的 fromIndex === toIndex 语义不清 | 新增 `isSelfLoop` 字段，SVG 渲染为星芒 |
| 20 | "480 条箭头"估算有误 | 修正为 40 条，删除退化逻辑 |

### v3 → v4 修订（第 3 轮架构师 Review）

| # | 问题 | 修订 |
| --- | --- | --- |
| 1 | CSS 类名矛盾（`data-scope` vs `mut-{scope}`） | 统一为 `.mut-scope-self.mut-{scope}` |
| 2 | 伪代码缺少 horoscope null 守卫 | 入口添加 `if (!horoscope) return empty` |
| 3 | scopeResults 传递路径断裂（关键） | 补充完整 prop 下传方案 + perPalaceSelfMarks 预过滤逻辑 |
| 4 | PalaceDetail 修改方案缺失 | 补充 4.5 节完整 section 结构草案 |
| 5 | SVG marker 规格缺失 | 补充 `<marker>` 定义（`context-stroke` 动态继承颜色） |
| 6 | 童限处理调用点不明确 | 明确为调用方过滤（`effectiveScopes` 中排除） |
| 7 | `buildChartIndex` 重复构建 | 参数新增可选 `chartIndex`，由调用方缓存 |
| 8 | 自化模式状态变量名缺失 | 补充 `selfMode` + `setSelfMode` + `onToggleSelf` |
| 9 | 颜色变量重复定义 | 标注"已有，无需新增"，删除冗余 CSS 变量 |
| 10 | `selfScopeMarks` 中 direction 在 StarCell 层无消费 | 通过 title tooltip 区分离心/向心 |
| 11 | majorStars/minorStars 均需传入 selfScopeMarks | 明确标注两组 StarCell 都需传入 |
| 12 | `scanHoroscopePatterns` 只支持 3 个 scope | 说明"参数风格类似，不同调用点使用" |
| 13 | flex-wrap 缺具体 CSS | 已确认 `.depth-row` 有 unconditional flex-wrap，无需额外媒体查询 |
| 14 | stem 参数类型未对齐 iztro | 保持 `string`，注释中说明 cast 需求 |

### v4 → v5 修订（第 5 轮 Review）

赋值覆盖 Bug 修复、CSS 冗余规则删除、PalaceDetail 数据来源明确。

### v5 → v6 修订（第 6 轮 Review，评分 9.5/10）

4 个 trivial 修复：flex-wrap 媒体查询冗余删除、testFixtures 导入修正、palace.stars 拆分、stem 类型注释补充。

### v6 → v7 修订（第 7 轮 Review，评分 9.8/10）

实现步骤措辞矛盾修复（删除"flex-wrap 媒体查询"残留），版本号同步。

---

**文档维护**：本文档随实现进展更新，最终实现以代码为准。
