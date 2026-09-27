# 六爻模块设计文档

## 概述

为 peep-v2 项目新增六爻（Liu Yao）占卜模块，提供完整的起卦、排盘、历史查询功能。采用对称式 UI 布局，支持动态显示流年/流月/流日/流时对卦象各爻的五行生克影响。

## 需求总结

1. **新增页面**：六爻页面，采用左右分区布局（类似大六壬）
2. **核心算法**：从老项目复制排盘核心模块（types/constants/chart/calendar/palace），繁体转简体
3. **数据存储**：IndexedDB 存储起卦记录，支持历史查询
4. **UI 特性**：
   - 左右对称式卦象展示：本卦 ↔ 变卦
   - 动态 8 列：左右各 4 列（流年/流月/流日/流时），根据 hbar 选择动态显示
   - 每列显示该时间层级对各爻的五行生克关系（旺/相/休/囚/死）
5. **调试 API**：参考紫微斗数模式，支持 UI 操控（包括控制 hbar 显示状态）

## 技术设计

### 1. 模块架构

```
src/
├── core/
│   └── liuyao/
│       ├── core/              # 核心算法（从老项目复制）
│       │   ├── types.ts       # 类型定义
│       │   ├── constants.ts   # 纳甲表、五行常量
│       │   ├── chart.ts       # 排盘核心逻辑
│       │   ├── calendar.ts    # 日期干支计算
│       │   └── palace.ts      # 八卦宫位逻辑
│       ├── liuyaoDb.ts        # IndexedDB 数据层
│       ├── liuyao.ts          # 业务逻辑
│       └── hbar.ts            # 六爻 hbar 计算（复用紫微逻辑）
├── components/
│   └── liuyao/
│       ├── LiuyaoChart.tsx        # 对称式卦象展示
│       ├── LiuyaoList.tsx         # 历史记录列表
│       ├── LiuyaoCreateDialog.tsx # 新建对话框
│       ├── LiuyaoViewDialog.tsx   # 查看详情对话框
│       ├── LiuyaoEditDialog.tsx   # 编辑对话框
│       ├── LiuyaoDeleteDialog.tsx # 删除确认对话框
│       ├── LiuyaoEmpty.tsx        # 空状态
│       └── LiuyaoHbar.tsx         # 六爻专用 hbar（4 级）
├── pages/
│   └── LiuyaoPage.tsx             # 六爻页面
└── core/debugApi/
    └── liuyao.ts                  # 调试 API
```

### 2. 数据模型

```typescript
interface LiuyaoRecord {
  id: number;
  personId: number; // 关联人物 ID
  question: string; // 占事
  background?: string; // 背景信息
  note?: string; // 备注
  tags: string[]; // 标签
  divinationTime: string; // 起卦时间（ISO 格式）

  // 起卦数据
  lines: SixLines; // 六爻值（0-3，从初爻到上爻）

  // 排盘结果
  chart: ChartJSON; // 完整卦象（本卦+变卦+六神+六亲等）

  // 元数据
  createdAt: string;
  updatedAt: string;
}
```

### 3. UI 结构设计

#### 3.1 页面布局（左右分区）

- **左侧（30%）**：历史记录列表 + 搜索 + 分页
- **右侧（70%）**：卦象展示区（hbar + 对称式卦象表格）

#### 3.2 对称式卦象表格

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 流年  │ 流月  │ 流日  │ 流时  │    本卦六爻   │    变卦六爻   │ 流时  │ 流日  │ 流月  │ 流年  │
├───────┼───────┼───────┼───────┼──────────────┼──────────────┼───────┼───────┼───────┤
│ 丁未  │ 戊申  │ 丙寅  │ 乙未  │ 上爻：六神… │ 上爻：六神… │ 乙未  │ 丙寅  │ 戊申  │ 丁未  │
│  旺   │  相   │  休   │  囚   │ 五爻：六神… │ 五爻：六神… │  囚   │  休   │  相   │  旺   │
│  ...  │  ...  │  ...  │  ...  │ 四爻：...    │ 四爻：...    │  ...  │  ...  │  ...  │  ...  │
│       │       │       │       │ 三爻：...    │ 三爻：...    │       │       │       │       │
│       │       │       │       │ 二爻：...    │ 二爻：...    │       │       │       │       │
│       │       │       │       │ 初爻：...    │ 初爻：...    │       │       │       │       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**列结构：**

- **左侧 4 列**：流年→流月→流日→流时（对本卦各爻的五行生克）
- **中间左侧**：本卦 6 爻（每爻包含六神、六亲、干支、图像、世应、伏藏、动）
- **中间右侧**：变卦 6 爻（镜像对称）
- **右侧 4 列**：流时→流日→流月→流年（对变卦各爻的五行生克，顺序反转）

**动态列逻辑：**

- 8 列根据 hbar 选中的层级动态显示/隐藏
- 如只选流年+流月，则只显示 4 列（左 2 + 右 2）
- 无变卦时，变卦列显示与本卦相同内容

**五行生克计算：**

- 计算时间地支五行与该爻地支五行的生克关系
- 显示为：旺、相、休、囚、死

### 4. Hbar 设计

**时间层级：** 流年/流月/流日/流时（4 级，无大运）

**时间基准：** 基于起卦时间（divinationTime）

**逻辑复用：** 复用紫微斗数 hbar 的计算逻辑，只调整层级（去掉 decadal）

**状态管理：**

```typescript
type LiuyaoHbarState = {
  visible: {
    yearly: boolean;
    monthly: boolean;
    daily: boolean;
    hourly: boolean;
  };
  pick: {
    year: number;
    month: number;
    day: number;
    hour: number;
  };
};
```

### 5. DebugApi 设计

#### 5.1 回调注册

LiuyaoPage 注册以下回调：

```typescript
registerLiuyaoCallbacks({
  // 列表操作
  getLiuyaoList: (filters) => Promise<LiuyaoListResult>,
  setListFilters: (filters) => void,

  // 创建记录
  openCreateDialog: () => void,
  fillCreateForm: (data) => void,
  submitCreateForm: () => Promise<LiuyaoRecord>,

  // 选择记录
  selectRecord: (recordId) => Promise<LiuyaoRecord | null>,
  getSelectedRecord: () => LiuyaoRecord | null,

  // hbar 控制
  setHbarVisibility: (visible) => void,
  pickTime: (time) => void,
  getHbarState: () => LiuyaoHbarState,
});
```

#### 5.2 核心函数

**`LiuYao(personId?, recordId?, options?)`**

- 核心调试接口：选择记录 + 控制 hbar + 返回完整数据
- 参数：
  - `personId`: 人物 ID（可选）
  - `recordId`: 起卦记录 ID（可选）
  - `options.scope`: 控制显示哪些时间层级（`('yearly' | 'monthly' | 'daily' | 'hourly')[]`）
  - `options.time`: 控制选中时间点
- 返回：人物信息、卦象数据、hbar 状态、左右 8 列的衰旺数据

**`LiuYaoCreate(params, options?)`**

- 创建起卦记录（带安全确认）
- 支持 skipUI 模式（纯计算 + DB 写入）

**`LiuYaoList(params, options?)`**

- 查询起卦记录列表（支持搜索、标签、分页）
- 支持 skipUI 模式

**`LiuYaoView(params, options?)`**

- 查看指定记录详情
- 支持 skipUI 模式

#### 5.3 UI 操控流程

```
navigateToPage('/liuyao')
→ selectPersonAndWait(personId)
→ selectRecord(recordId)
→ setHbarVisibility({ yearly, monthly, daily, hourly })
→ pickTime({ year, month, day, hour })
→ waitForStateUpdate()
→ return data
```

### 6. RTC Agent 注册

在 `rtcAgent.ts` 的 `FUNCTION_GROUPS` 中新增：

```typescript
{
  name: "liuyao",
  description: "六爻起卦与占卜——适合具体事件的占断...",
  functions: [
    liuyaoCreateFunction,
    liuyaoListFunction,
    liuyaoViewFunction,
  ],
}
```

## 实现要点

### 样式复用

- 表格样式参考 `.liuren-*` CSS 类
- hbar 组件复用 `HoroscopeBar` 的 Row/Cell 模式
- 对话框复用 `Dialog` 组件
- 列表复用 `RecordList` 模式

### 代码风格

- 遵循现有代码风格（参考 daliuren/ziwei 模块）
- 使用 TypeScript 严格模式
- 添加完整的 JSDoc 注释
- 错误处理使用自定义 Error 类（LiuyaoError）

### 性能优化

- hbar 计算使用 LRU 缓存
- 组件使用 memo 优化
- 列表使用虚拟滚动（如数据量大）

## 后续扩展

1. **规则判断**：复制 rules/ 模块，提供断卦规则提示
2. **场景分析**：复制 scenarios/ 模块，提供常见占事场景分析
3. **评分系统**：复制 scoring/ 模块，提供卦象评分
4. **导出功能**：支持导出卦象数据（JSON/MD）
5. **AI 分析**：结合 RTC Agent 提供智能断卦建议

## 参考资料

- 老项目六爻核心算法：`/Users/leichujun/Workspaces/PineappleBond/peep/src/modules/liuyao/core/`
- 紫微斗数 debugApi：`src/core/debugApi/ziwei.ts`
- 大六壬 debugApi：`src/core/debugApi/daliuren.ts`
- 大六壬页面布局：`src/pages/DaLiuRenPage.tsx`
