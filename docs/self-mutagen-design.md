# 自化可视化功能设计方案

**日期**：2026-09-25  
**状态**：设计中

## 一、背景与目标

### 1.1 现状
- **已有功能**：
  - 宫位卡片显示生年四化（实心标记）和离心自化（虚线标记）
  - 飞宫模式显示本命飞星连线
  - 详情面板显示离心+向心自化文字信息
  
- **缺失功能**：
  - 图表中无向心自化的可视化
  - 不支持运限级别（大运、流年、流月、流日、流时）的自化显示
  - 数据获取与渲染逻辑耦合，不利于测试

### 1.2 目标
1. **数据层重构**：封装独立的数据获取方法，职责单一，便于测试
2. **多级别自化**：支持大运、流年、流月、流日、流时五个级别的自化显示
3. **箭头式可视化**：离心箭头向外放射，向心箭头从对宫指向本宫
4. **颜色区分**：用运限色区分不同级别（大运青绿、流年宝蓝等）

## 二、数据获取层设计

### 2.1 核心方法

#### `getChartData(personId, scope, time)`
获取 Chart 盘面渲染所需的纯数据（不含坐标、连线等渲染细节）。

**参数**：
```typescript
type ChartDataParams = {
  personId: string;           // 人物 ID
  scope: "natal" | "decadal" | "yearly" | "monthly" | "daily" | "hourly";
  time: string;               // "xxxx-xx-xx xx" 格式
};
```

**返回值**：
```typescript
type ChartData = {
  palaces: Array<{
    index: number;
    name: string;             // "命宫"
    branch: string;           // "子"
    stem: string;             // "甲"
    stars: Array<{
      name: string;           // "紫微"
      type: "main" | "aux" | "minor";
      mutagens: Array<{
        char: "禄" | "权" | "科" | "忌";
        scope: string;        // "natal" | "decadal" | ...
      }>;
      selfMutagens: Array<{
        char: "禄" | "权" | "科" | "忌";
        scope: string;
        direction: "outward" | "inward"; // 离心 | 向心
      }>;
    }>;
  }>;
  mingIndex: number;          // 命宫索引
  shenIndex: number;          // 身宫索引
};
```

**使用方式**：
- 图表需要显示所有级别时，调用 5 次（`decadal`/`yearly`/`monthly`/`daily`/`hourly`）
- 每次调用返回该级别的自化数据
- 渲染层合并结果，按 `scope` 用不同颜色渲染

#### `getHoroscopeBarData(personId, scope, time)`
获取 HoroscopeBar 运限栏数据。

**参数**：与 `getChartData` 相同

**返回值**：
```typescript
type HoroscopeBarData = {
  decadal: Array<{
    startAge: number;
    endAge: number;
    palaceName: string;
    stem: string;
    selected: boolean;
  }>;
  yearly: Array<{
    year: number;
    palaceName: string;
    stem: string;
    selected: boolean;
  }>;
  monthly: Array<{
    month: number;
    palaceName: string;
    stem: string;
    selected: boolean;
  }>;
  daily: Array<{
    day: number;
    palaceName: string;
    stem: string;
    selected: boolean;
  }>;
  hourly: Array<{
    hour: number;
    palaceName: string;
    stem: string;
    selected: boolean;
  }>;
};
```

### 2.2 职责分离原则
- **数据层**：只返回"是什么"（哪颗星有什么四化/自化）
- **渲染层**：负责"怎么画"（坐标计算、SVG 绘制、颜色应用）
- **测试友好**：可以断言"某宫的某星有某个 scope 的自化标记"

## 三、运限自化计算逻辑

### 3.1 本命自化（现有）
- **离心**：本宫宫干四化飞回本宫（`isSelf: to === P`）
- **向心**：对宫宫干四化飞入本宫

### 3.2 运限自化（新增）
对于每个运限级别（大运、流年等）：

1. **获取运限命宫**：
   - 从 `horoscope[scope].index` 获取运限命宫在本命盘的宫位索引
   - 取该宫位的本命天干作为"运限运干"

2. **计算离心自化**：
   - 用运干四化飞星
   - 如果飞到的星曜在运限命宫（本命对应宫位）= 离心自化

3. **计算向心自化**：
   - 取运限对宫（迁移宫）的宫干
   - 如果该干四化飞入运限命宫 = 向心自化

### 3.3 实现要点
- 新增 `getSelfMutagensForScope(horoscope, scope, astrolabe)` 函数
- 复用现有 `FlyEntry` 类型，添加 `scope` 字段
- 返回结构包含 `selfOutward` 和 `selfInward` 数组

## 四、UI 渲染方案

### 4.1 视觉设计

**离心自化**：
- 箭头从宫位中心向外放射（长度 15-20px）
- 多条自化时，按角度均匀分散（类似星芒）
- 实线，运限色

**向心自化**：
- 箭头从对宫中心指向本宫中心
- 虚线（`stroke-dasharray: 4,3`），运限色
- 箭头终点带三角形箭头
- 连线中点显示标签："大·禄"、"年·忌"等

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
- 本命自化：虚线圆圈，四化色（现有）
- 运限自化：点线+箭头，运限色（新增）
- 多个级别的自化标记堆叠显示

**样式示例**：
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
```

### 4.3 交互
- 新增"自化模式"开关（类似"飞宫模式"）
- 开启后显示所有可见运限的自化箭头
- 按 `visible[s]` 状态控制显示哪些级别

## 五、实现步骤

### 阶段一：数据层重构
1. 定义 `ChartData` 和 `HoroscopeBarData` 类型
2. 实现 `getChartData(personId, scope, time)` 方法
3. 实现 `getHoroscopeBarData(personId, scope, time)` 方法
4. 编写单元测试（验证各 scope 的自化数据正确性）

### 阶段二：运限自化计算
1. 新增 `getSelfMutagensForScope` 函数
2. 扩展 `analysis.ts`，支持运限宫干计算
3. 在 `getChartData` 中集成运限自化数据

### 阶段三：UI 渲染
1. 在 `CenterPanel` 添加"自化模式"开关
2. 修改 `StarCell.tsx`，渲染运限自化标记（点线+箭头）
3. 修改 `Chart.tsx`，绘制离心/向心箭头（SVG）
4. 添加 CSS 样式（运限色、点线、箭头）

### 阶段四：集成测试
1. 验证各运限级别的自化显示正确
2. 验证颜色区分和交互逻辑
3. 验证与现有飞宫模式的兼容性

## 六、测试策略

### 6.1 数据层测试
```typescript
// 示例：测试大运自化数据
const data = await getChartData("person1", "decadal", "2024-01-01 12:00");
const mingPalace = data.palaces.find(p => p.index === data.mingIndex);
const ziwei = mingPalace.stars.find(s => s.name === "紫微");

// 断言：紫微星有大运离心自化禄
expect(ziwei.selfMutagens).toContainEqual({
  char: "禄",
  scope: "decadal",
  direction: "outward"
});
```

### 6.2 UI 测试
- 验证自化模式下，箭头正确显示
- 验证不同 scope 的颜色区分
- 验证开关切换的交互逻辑

## 七、涉及文件

| 文件 | 改动 |
|---|---|
| `src/core/analysis.ts` | 新增 `getSelfMutagensForScope`，扩展运限自化计算 |
| `src/core/dataService.ts`（新建） | 实现 `getChartData` 和 `getHoroscopeBarData` |
| `src/components/Chart.tsx` | 集成自化模式，绘制箭头连线 |
| `src/components/CenterPanel.tsx` | 添加自化模式开关 |
| `src/components/StarCell.tsx` | 渲染运限自化标记 |
| `src/components/Palace.tsx` | 传递运限自化数据 |
| `src/index.css` | 新增 `.mut-scope-self` 样式 |

## 八、风险与注意事项

1. **性能**：每次调用 `getChartData` 都会重新计算星盘，需要考虑缓存策略
2. **兼容性**：自化模式不应影响现有的飞宫模式和三方四正连线
3. **数据准确性**：运限自化的计算逻辑需要与紫微斗数理论一致
4. **视觉清晰度**：多个级别的自化箭头叠加时，需要避免视觉混乱

## 九、后续优化

1. **缓存机制**：对相同参数的 `getChartData` 调用进行缓存
2. **按需加载**：只计算用户可见的运限级别
3. **导出功能**：支持将自化数据导出为 JSON/CSV
4. **动画效果**：自化箭头的渐显动画

---

**文档维护**：本文档随实现进展更新，最终实现以代码为准。
