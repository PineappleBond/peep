# 大六壬 UI 设计文档

## 概述

本设计文档描述大六壬排盘功能的 UI 架构和交互设计，支持紫微斗数、大六壬等多个术数系统的路由分离和共享组件复用。

## 产品形态

### 路由分离

应用采用路由分离架构，各术数系统独立路由：

- `/` — 紫微斗数（现有功能）
- `/liuren` — 大六壬（新功能）
- 未来扩展：`/bazi`、`/meihua`、`/taiyi`、`/qimen`

### 共享 Header

Header 全局共用，包含：

1. **标题**：应用名称（如"紫微斗数"或"大六壬"，根据当前路由动态显示）
2. **SVG Icon 导航**：各术数系统的图标入口，点击切换路由
   - 紫微斗数 Icon
   - 大六壬 Icon
   - 未来预留位置（八字、梅花、太乙、奇门）
3. **PersonSelector**：人物选择器（全局通用，所有术数系统共享）

## 大六壬页面设计

### 布局：左右分区（盘面为主）

```
┌──────────────────────────────────────────────────────┐
│ Header（标题 + SVG导航 + PersonSelector）            │
├───────────────────────────────┬──────────────────────┤
│                               │                      │
│  左侧：盘面区（70%宽度）      │  右侧：历史列表      │
│                               │  （30%宽度）         │
│  默认：空状态                 │                      │
│                               │  [新建起课] 按钮     │
│  点击列表项后：               │                      │
│  展示完整盘面详情             │  检索（简化）        │
│  （四柱、天地盘、四课、三传、 │  - 文本搜索          │
│   天将、神煞、课经等）        │  - Tag 筛选          │
│                               │                      │
│  占事信息：问题、备注、背景、 │  列表（简洁）        │
│  tags                         │  - 时间              │
│                               │  - 占事问题          │
│                               │  - tags              │
│                               │                      │
│                               │  分页                │
│                               │                      │
└───────────────────────────────┴──────────────────────┘
```

**设计原则**：盘面是核心展示区，占主要空间；列表仅为导航辅助，设计简洁。

### 左侧：盘面区

**默认状态**：空状态，显示引导文案"请选择右侧列表中的记录查看盘面，或点击【新建起课】开始"

**展示状态**：用户点击右侧某条记录后，展示该记录的完整盘面：

1. **四柱**：年月日时干支
2. **月将**：月将名称
3. **天地盘**：12 地支圆盘（天盘旋转，地盘固定）
4. **四课**：上下关系
5. **三传**：初传、中传、末传 + 取法名称（九宗门）
6. **十二天将**：贵人、螣蛇、朱雀等
7. **神煞**：吉神、凶煞列表
8. **课经/毕法**：匹配的格局规则
9. **占事信息**：问题、备注、背景、tags

### 右侧：历史列表区（简洁设计）

**检索条件（简化）**：

1. **文本搜索**：搜索占事问题、备注、背景信息（单一输入框）
2. **Tag 筛选**：多选标签（下拉或标签云）

> 注：日期范围检索作为高级选项，默认隐藏或折叠，避免界面过于复杂。

**列表展示（简洁）**：

每条记录仅显示：

- 起课时间（相对时间，如"2小时前"或"昨天"）
- 占事问题（一行，超长截断）
- tags（最多显示 3 个，超出显示 `+N`）

列表样式：紧凑的列表或卡片，高度固定，可滚动。

**分页**：每页 20 条（可调整）

**排序**：按 `savedAt` 倒序（最新在前）

**操作**：

- 点击列表项 → 左侧展示盘面详情（高亮当前选中项）
- 悬停显示操作按钮：编辑、删除
- 顶部"新建起课"按钮

### Dialog 弹窗

#### 新建起课 Dialog

表单字段：

- **占事问题**（必填）：文本输入，如"问事业"
- **备注**（选填）：文本输入
- **背景信息**（选填）：多行文本
- **tags**（选填）：标签输入（支持多个）

提交后：

1. 自动用**当前时间 + 当前人物出生年**调用 `calculateDaLiuren`
2. 保存完整记录到数据库
3. 关闭 Dialog，刷新列表，新记录在顶部

#### 查看详情 Dialog

展示完整卦象信息（与左侧盘面区内容一致，但以 Dialog 形式展示，适合移动端或大屏查看）。

#### 编辑 Dialog

表单字段同新建，但不可修改起课时间和卦象数据（已固定）。

#### 删除确认 Dialog

二次确认，显示"确定要删除这条起课记录吗？此操作不可恢复。"

## 数据库设计

### 扩展 personDb.ts

在现有 `PeepDatabase` 类中新增 `liuren_records` 表：

```typescript
class PeepDatabase extends Dexie {
  persons!: Table<Person, number>;
  liurenRecords!: Table<LiurenRecord, number>;

  constructor() {
    super("peep");
    this.version(1).stores({
      persons: "++id, savedAt, isDefault",
    });
    this.version(2).stores({
      persons: "++id, savedAt, isDefault",
      liurenRecords: "++id, personId, savedAt, calculationTime, *tags",
    });
  }
}
```

### LiurenRecord 接口

```typescript
interface LiurenRecord {
  id?: number;
  personId: number;          // 关联人物 ID
  calculationTime: string;   // 起课时间（YYYY-MM-DD HH:mm:ss）
  question: string;          // 占事问题
  note: string;              // 备注
  background: string;        // 背景信息
  tags: string[];            // 标签数组
  result: DaLiuRenResult;    // 完整卦象数据
  savedAt: number;           // 保存时间戳
}
```

### 索引设计

- `personId`：按人物过滤
- `savedAt`：按保存时间排序
- `calculationTime`：按起课时间排序/范围查询
- `*tags`：标签数组索引（支持多值查询）

### CRUD 操作

- `listLiurenRecords(personId, filters)`：查询列表（支持分页、日期范围、文本搜索、tag 筛选）
- `getLiurenRecord(id)`：获取单条记录
- `saveLiurenRecord(record)`：新增或更新
- `deleteLiurenRecord(id)`：删除记录

## 共享组件设计

### Layout 组件

```typescript
function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <div className="bg-fx" aria-hidden="true" />
      <Header />
      <main>{children}</main>
      <footer>...</footer>
    </div>
  );
}
```

### Header 组件

```typescript
function Header() {
  const location = useLocation();
  const title = getTitleByRoute(location.pathname);

  return (
    <header className="top">
      <h1>{title}</h1>
      <nav className="top-nav">
        <NavLink to="/" icon={<ZiweiIcon />} title="紫微斗数" />
        <NavLink to="/liuren" icon={<LiurenIcon />} title="大六壬" />
        {/* 未来扩展 */}
      </nav>
      <div className="top-actions">
        <PersonSelector currentId={currentPersonId} onSelect={handleSelect} />
      </div>
    </header>
  );
}
```

### Dialog 组件

通用弹窗，支持：

- 标题
- 内容区（表单或展示）
- 底部按钮（确认/取消）
- 关闭按钮（右上角 X）

### Pagination 组件

分页器，支持：

- 当前页码
- 每页条数
- 总条数
- 上一页/下一页/跳转

### TagInput 组件

标签输入，支持：

- 输入标签（回车或逗号分隔）
- 删除标签（点击 X）
- 显示已添加标签

### DateRangePicker 组件

日期范围选择器，支持：

- 起始日期
- 结束日期
- 快捷选项（最近 7 天、30 天、90 天）

## 技术栈

- **路由**：`react-router-dom` v6
- **数据库**：`dexie`（已用）
- **大六壬算法**：`src/core/daliuren/calculator.ts`（已完成）
- **样式**：现有 `src/index.css`（玄空霓虹主题）

## 实现分步

### 第一阶段：基础架构（1-2 天）

1. 安装 `react-router-dom`
2. 提取 `Layout` 和 `Header` 组件
3. 设计 SVG Icon（紫微、大六壬）
4. 配置路由（`/`、`/liuren`）
5. 迁移紫微斗数到 `Layout` 中
6. 创建大六壬空白页面

### 第二阶段：数据库与基础 UI（2-3 天）

1. 扩展 `personDb.ts`，新增 `liurenRecords` 表
2. 实现 CRUD 操作函数
3. 创建 `DaLiuRenPage` 组件（左右分区布局）
4. 实现左侧盘面区（空状态 + 展示状态）
5. 实现右侧历史列表（分页 + 基础检索）

### 第三阶段：Dialog 与高级功能（2-3 天）

1. 实现通用 `Dialog` 组件
2. 新建起课 Dialog（表单 + 自动起课）
3. 查看详情 Dialog（展示完整卦象）
4. 编辑 Dialog
5. 删除确认 Dialog
6. 高级检索（日期范围、文本搜索、tag 筛选）

### 第四阶段：优化与复用（1-2 天）

1. 提取通用组件（`Pagination`、`TagInput`、`DateRangePicker`）
2. 优化样式和交互
3. 测试与修复

## 成功标准

1. ✅ 紫微斗数和大六壬可通过路由切换
2. ✅ Header 共用，包含 SVG Icon 导航和 PersonSelector
3. ✅ 大六壬页面左右分区，左侧盘面，右侧列表
4. ✅ 可新建起课（自动用当前时间 + 人物出生年）
5. ✅ 历史记录持久化，支持分页和检索
6. ✅ 可查看详情、编辑、删除（删除二次确认）
7. ✅ 人物选择器全局通用

## 未来扩展

- 八字、梅花易数、太乙、奇门等术数系统
- 历史记录的导出功能（PDF、图片）
- 卦象的 AI 解读（复用现有 AI 导出功能）
- 跨术数系统的综合分析（如紫微 + 大六壬合参）
