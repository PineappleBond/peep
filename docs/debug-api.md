# 调试 API 文档（window.peep）

本项目在开发环境下暴露 `window.peep` 全局对象，供自动化测试和浏览器控制台调试使用。

> **注意**：`window.peep` 仅在 `import.meta.env.DEV` 为 `true` 时可用，生产构建中不存在。

## 概述

`window.peep` 提供以下方法：

| 方法 | 说明 | 页面 |
| ---- | ---- | ---- |
| `ZiWei(personId, scope?, time?)` | 紫微斗数排盘 + 运限操控 | / |
| `DaLiuRen(date, time, fateInput?)` | 大六壬排盘（纯计算） | 任意 |
| `DaLiuRenCreate(params)` | 大六壬起课（创建记录） | /liuren |
| `DaLiuRenList(params)` | 大六壬起课列表查询 | /liuren |
| `DaLiuRenView(params)` | 大六壬起课详情查看 | /liuren |
| `WikiCreate(params)` | Wiki 文档创建 | /wiki |
| `WikiList(params)` | Wiki 文档列表查询 | /wiki |
| `WikiView(params)` | Wiki 文档详情查看 | /wiki |
| `getChartDataForScope(params)` | 获取指定运限级别的盘面数据 | / |

## 类型定义

### Scope（运限级别）

```typescript
type Scope = "decadal" | "yearly" | "monthly" | "daily" | "hourly";
```

- `decadal` — 大限（十年运）
- `yearly` — 流年
- `monthly` — 流月
- `daily` — 流日
- `hourly` — 流时

### Person（人物档案）

```typescript
type Person = {
  id?: number;           // 主键，自增
  savedAt: number;       // 保存时间戳
  isDefault: boolean;    // 是否系统默认人物
} & BirthInput;
```

`BirthInput` 包含完整的排盘参数：姓名、性别、日历类型、日期、时辰、流派等。详见 `src/core/useZwds.ts`。

### ZiWeiResult（紫微返回数据）

```typescript
type ZiWeiResult = {
  person: Person | null;                    // 当前人物档案
  hbar: (HbarData & { visible: Record<Scope, boolean> }) | null;  // 运限拨盘数据
  chart: ScopeChartData | null;             // 指定运限级别的盘面分析数据
};
```

---

## API 详解

### ZiWei — 紫微斗数排盘

```typescript
function ZiWei(
  personId: number,
  scope?: Scope,
  time?: Date | number | string
): Promise<ZiWeiResult>
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `personId` | `number` | 是 | 人物 ID（正整数） |
| `scope` | `Scope` | 否 | 运限级别，不传则显示全部 |
| `time` | `Date \| number \| string` | 否 | 运限时间。支持 Date 对象、时间戳、或字符串（如 `"2024-06-15"` 或 `"2024-06-15 12:00:00"`） |

**返回值**：`Promise<ZiWeiResult>`

**执行顺序**：

1. 跳转到 `/` 页面（紫微斗数）
2. 切换人物（等待排盘计算完成）
3. 设置运限时间（如果提供）
4. 设置运限级别（如果提供，仅显示目标 scope）
5. 等待所有状态更新完成（双 rAF）
6. 返回完整数据

**示例**：

```javascript
// 查看人物 1 的本命盘
const result = await window.peep.ZiWei(1);
console.log(result.person.name);  // 姓名
console.log(result.hbar.visible); // 各运限级别可见状态

// 查看人物 1 的流年命盘，设定时间为 2024 年 6 月 15 日
const yearly = await window.peep.ZiWei(1, "yearly", "2024-06-15");
console.log(yearly.chart);  // 流年盘面分析数据

// 查看大限
const decadal = await window.peep.ZiWei(1, "decadal");
```

**注意事项**：

- 此方法会自动导航到紫微斗数首页
- `time` 字符串格式支持：`"YYYY-MM-DD"`（自动补 `00:00:00`）、`"YYYY-MM-DD HH"` （自动补 `:00:00`）、完整 ISO 格式
- 返回值中的 `hbar` 可能为 `null`（拨盘计算失败时）
- 返回值中的 `chart` 仅在指定 `scope` 时有值

---

### DaLiuRen — 大六壬排盘（纯计算）

```typescript
function DaLiuRen(
  date: string,
  time: string,
  fateInput?: { birthYear: number; gender: "男" | "女" }
): DaLiuRenResult
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `date` | `string` | 是 | 公历日期，格式 `YYYY-MM-DD` |
| `time` | `string` | 是 | 时间，格式 `HH:mm` 或 `HH:mm:ss` |
| `fateInput` | `object` | 否 | 可选的生年与性别信息 |

**返回值**：`DaLiuRenResult` — 完整的大六壬卦象数据（三传四课、神煞、六亲等）

**示例**：

```javascript
// 基本排盘
const result = window.peep.DaLiuRen("2024-06-15", "14:30");
console.log(result);

// 带生年信息
const result2 = window.peep.DaLiuRen("2024-06-15", "14:30", {
  birthYear: 1990,
  gender: "男"
});
```

**注意事项**：

- 此方法为纯计算函数，不会导航到任何页面
- 返回的 `DaLiuRenResult` 包含完整的卦象结构化数据

---

### DaLiuRenCreate — 大六壬起课（创建记录）

```typescript
function DaLiuRenCreate(params: {
  personId: number;
  question: string;
  note?: string;
  background?: string;
  tags?: string[];
}): Promise<LiurenRecord>
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `personId` | `number` | 是 | 关联人物 ID |
| `question` | `string` | 是 | 占事问题 |
| `note` | `string` | 否 | 备注 |
| `background` | `string` | 否 | 背景信息 |
| `tags` | `string[]` | 否 | 标签数组 |

**返回值**：`Promise<LiurenRecord>` — 创建成功的起课记录

**执行顺序**：

1. 跳转到 `/liuren` 页面
2. 选择人物
3. 填写表单数据
4. 打开新建对话框
5. 提交表单并等待保存完成

**示例**：

```javascript
const record = await window.peep.DaLiuRenCreate({
  personId: 1,
  question: "近期事业运势如何？",
  note: "测试起课",
  background: "目前在公司工作三年，考虑是否跳槽",
  tags: ["事业", "流年"]
});
console.log(record.id);          // 新记录 ID
console.log(record.result);      // 完整卦象数据
```

---

### DaLiuRenList — 大六壬起课列表

```typescript
function DaLiuRenList(params: {
  personId: number;
  searchText?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ records: LiurenRecord[]; total: number }>
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `personId` | `number` | 是 | 关联人物 ID |
| `searchText` | `string` | 否 | 搜索文本（匹配问题/备注/背景） |
| `tags` | `string[]` | 否 | 标签过滤（多值匹配） |
| `page` | `number` | 否 | 页码（从 1 开始） |
| `pageSize` | `number` | 否 | 每页条数 |

**返回值**：

```typescript
{
  records: LiurenRecord[];  // 当前页记录
  total: number;            // 总条数
}
```

**示例**：

```javascript
// 获取人物 1 的全部起课记录
const { records, total } = await window.peep.DaLiuRenList({ personId: 1 });
console.log(`共 ${total} 条记录`);

// 搜索包含"事业"的记录，带标签过滤
const result = await window.peep.DaLiuRenList({
  personId: 1,
  searchText: "事业",
  tags: ["流年"],
  page: 1,
  pageSize: 10
});
```

---

### DaLiuRenView — 大六壬起课详情

```typescript
function DaLiuRenView(params: {
  personId: number;
  recordId: number;
}): Promise<LiurenRecord>
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `personId` | `number` | 是 | 关联人物 ID |
| `recordId` | `number` | 是 | 起课记录 ID |

**返回值**：`Promise<LiurenRecord>` — 完整的起课记录详情

**示例**：

```javascript
const record = await window.peep.DaLiuRenView({
  personId: 1,
  recordId: 42
});
console.log(record.question);    // 占事问题
console.log(record.result);      // 完整卦象数据
```

---

### WikiCreate — Wiki 文档创建

```typescript
function WikiCreate(params: {
  personId: number;
  title: string;
  content: string;
  tags?: string[];
  linkTargetIds?: number[];
}): Promise<WikiDocument>
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `personId` | `number` | 是 | 关联人物 ID |
| `title` | `string` | 是 | 文档标题 |
| `content` | `string` | 是 | 文档内容（Markdown 格式） |
| `tags` | `string[]` | 否 | 标签数组 |
| `linkTargetIds` | `number[]` | 否 | 链接目标文档 ID 列表 |

**返回值**：`Promise<WikiDocument>` — 创建成功的文档

**示例**：

```javascript
const doc = await window.peep.WikiCreate({
  personId: 1,
  title: "紫微十四主星笔记",
  content: "# 紫微星\n\n紫微为帝星，主尊贵……",
  tags: ["主星", "笔记"],
  linkTargetIds: [5, 12]  // 链接到文档 5 和 12
});
console.log(doc.id);  // 新文档 ID
```

---

### WikiList — Wiki 文档列表

```typescript
function WikiList(params: {
  personId: number;
  searchText?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ docs: WikiDocument[]; total: number }>
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `personId` | `number` | 是 | 关联人物 ID |
| `searchText` | `string` | 否 | 搜索文本（匹配标题/内容） |
| `tags` | `string[]` | 否 | 标签过滤 |
| `page` | `number` | 否 | 页码（从 1 开始） |
| `pageSize` | `number` | 否 | 每页条数 |

**返回值**：

```typescript
{
  docs: WikiDocument[];  // 当前页文档
  total: number;         // 总条数
}
```

**示例**：

```javascript
const { docs, total } = await window.peep.WikiList({
  personId: 1,
  searchText: "主星",
  page: 1
});
```

---

### WikiView — Wiki 文档详情

```typescript
function WikiView(params: {
  personId: number;
  docId: number;
}): Promise<WikiDocument & { linkTargetIds: number[] }>
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `personId` | `number` | 是 | 关联人物 ID |
| `docId` | `number` | 是 | 文档 ID |

**返回值**：`Promise<WikiDocument & { linkTargetIds: number[] }>` — 文档详情，附带链接目标 ID 列表

**示例**：

```javascript
const doc = await window.peep.WikiView({
  personId: 1,
  docId: 42
});
console.log(doc.title);          // 标题
console.log(doc.content);        // Markdown 内容
console.log(doc.linkTargetIds);  // 链接的文档 ID 列表
```

---

### getChartDataForScope — 获取盘面分析数据

```typescript
function getChartDataForScope(params: {
  astrolabe: Astrolabe;
  horoscope: Horoscope;
  scope: Scope;
}): ScopeChartData
```

**参数**：

| 参数 | 类型 | 必填 | 说明 |
| ---- | ---- | ---- | ---- |
| `astrolabe` | `Astrolabe` | 是 | iztro 本命盘对象 |
| `horoscope` | `Horoscope` | 是 | iztro 运限对象 |
| `scope` | `Scope` | 是 | 运限级别 |

**返回值**：`ScopeChartData` — 指定运限级别的盘面分析数据

**注意事项**：

- 此方法为纯计算函数，不会导航到任何页面
- 通常通过 `ZiWei()` 方法间接获取，直接调用需要先获取 `astrolabe` 和 `horoscope` 对象

---

## 内部机制

### 回调注册

调试 API 通过回调注册模式与 React 组件通信：

1. 各页面组件挂载时调用 `registerDebugApi()` / `registerZiWeiCallbacks()` / `registerDaLiuRenCallbacks()` / `registerWikiCallbacks()` 注册回调
2. 调试方法调用时先检查回调是否就绪（`waitForCallbacks()`，超时 3 秒抛错）
3. 通过回调操控 UI 状态并获取数据

### 页面导航

部分方法会自动导航到对应页面：

- `ZiWei` → `/`（紫微斗数）
- `DaLiuRenCreate` / `DaLiuRenList` / `DaLiuRenView` → `/liuren`（大六壬）
- `WikiCreate` / `WikiList` / `WikiView` → `/wiki`（Wiki）

导航使用 `react-router` 的 `navigate()`（如已注册）或 `window.location.href`（降级）。

### 错误处理

- 所有异步方法在失败时抛出 `Error` 实例
- 错误消息包含来源标签（如 `[ZiWei]`、`[DaLiuRenCreate]`）便于排查
- 回调注册超时时抛出超时错误

### 时序保证

- 人物切换后等待状态更新（`requestAnimationFrame` 双帧）
- 表单填写后等待 50ms 确保 React 状态同步
- Dialog 打开后等待 100ms 确保渲染完成
- 保存操作后等待 150ms 确保持久化完成

---

## 调试示例

### 控制台快速排盘

```javascript
// 1. 查看当前人物
const r = await window.peep.ZiWei(1);
console.log(r.person);

// 2. 看流年
const y = await window.peep.ZiWei(1, "yearly", "2026-01-01");
console.log(y.chart);
```

### 自动化测试场景

```javascript
// 创建人物后批量起课
for (const q of ["事业", "财运", "感情"]) {
  await window.peep.DaLiuRenCreate({
    personId: 1,
    question: `${q}运势如何？`,
    tags: [q]
  });
}

// 验证列表
const { total } = await window.peep.DaLiuRenList({ personId: 1 });
console.assert(total >= 3, "应有至少 3 条记录");
```
