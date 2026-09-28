# WikiLink 使用指南

## 问题场景

Agent 创建了 4 篇 Wiki 文档后，想要建立它们之间的关联关系（linkTargetIds），但 WikiCreate 只能在创建时设置链接，无法为已存在的文档添加关联。

## 解决方案

使用新增的 `WikiLink` 调试 API 函数。

## API 签名

```typescript
await window.peep.WikiLink(params, options);
```

### 参数

```typescript
interface WikiLinkParams {
  personId?: number; // 可选，不传则使用默认人物
  sourceDocId: number; // 源文档 ID
  targetDocIds: number[]; // 目标文档 ID 列表
  append?: boolean; // 可选，true=追加模式，false=替换模式（默认）
}
```

### 返回值

```typescript
{
  sourceDocId: number;
  targetDocIds: number[];
}
```

## 使用示例

### 场景：Agent 创建了 4 篇文档，需要建立关联

假设 Agent 创建了以下 4 篇文档：

- 文档 1: "紫微斗数基础" (id: 1)
- 文档 2: "十四主星" (id: 2)
- 文档 3: "十二宫位" (id: 3)
- 文档 4: "四化飞星" (id: 4)

现在需要建立关联关系：

- 文档 1 → 文档 2, 3, 4（基础文档链接到所有进阶文档）
- 文档 2 → 文档 3（主星链接到宫位）

### 实现代码

```javascript
// 1. 建立文档 1 到文档 2,3,4 的链接（替换模式）
await window.peep.WikiLink(
  {
    sourceDocId: 1,
    targetDocIds: [2, 3, 4],
  },
  { skipUI: true },
);

// 2. 建立文档 2 到文档 3 的链接（替换模式）
await window.peep.WikiLink(
  {
    sourceDocId: 2,
    targetDocIds: [3],
  },
  { skipUI: true },
);

// 3. 如果想给文档 1 追加新的链接（不覆盖现有链接）
await window.peep.WikiLink(
  {
    sourceDocId: 1,
    targetDocIds: [5], // 假设后来又创建了文档 5
    append: true,
  },
  { skipUI: true },
);
```

### 验证关联

```javascript
// 查看文档 1 的关联
const doc1 = await window.peep.WikiView({ docId: 1 }, { skipUI: true });
console.log("文档 1 链接到:", doc1.linkTargetIds); // [2, 3, 4]

// 查看反向链接（谁链接到了文档 3）
const doc3 = await window.peep.WikiView(
  {
    docId: 3,
    includeBacklinks: true,
  },
  { skipUI: true },
);
console.log("文档 3 被链接自:", doc3.backlinkSourceIds); // [1, 2]
```

## 两种模式详解

### 替换模式（默认，append=false）

- 清除源文档的所有现有链接
- 重新建立指定的链接
- 适用于：首次建立关联、完全重写关联关系

```javascript
// 假设文档 1 当前链接到 [2, 3]
await window.peep.WikiLink(
  {
    sourceDocId: 1,
    targetDocIds: [4, 5],
  },
  { skipUI: true },
);
// 现在文档 1 链接到 [4, 5]（2 和 3 的链接被清除）
```

### 追加模式（append=true）

- 保留源文档的所有现有链接
- 在现有链接基础上追加新链接
- 自动去重（不会重复添加已存在的链接）
- 适用于：逐步建立关联、增量更新

```javascript
// 假设文档 1 当前链接到 [2, 3]
await window.peep.WikiLink(
  {
    sourceDocId: 1,
    targetDocIds: [3, 4, 5], // 3 已存在
    append: true,
  },
  { skipUI: true },
);
// 现在文档 1 链接到 [2, 3, 4, 5]（3 不会重复）
```

## 清空所有链接

```javascript
// 传入空数组清除所有链接
await window.peep.WikiLink(
  {
    sourceDocId: 1,
    targetDocIds: [],
  },
  { skipUI: true },
);
```

## 错误处理

### 常见错误

1. **源文档不存在**

   ```text
   WikiError: 源文档 999 不存在
   ```

2. **目标文档不存在**

   ```text
   WikiError: 目标文档 888 不存在
   ```

3. **无效的文档 ID**

   ```text
   WikiError: sourceDocId 无效：-1，需为正整数
   ```

4. **未使用 skipUI=true**

   ```text
   WikiError: WikiLink 当前仅支持 skipUI=true 模式
   ```

### 最佳实践

```javascript
try {
  await window.peep.WikiLink(
    {
      sourceDocId: 1,
      targetDocIds: [2, 3, 4],
    },
    { skipUI: true },
  );
  console.log("关联建立成功");
} catch (err) {
  if (err instanceof window.peep.WikiError) {
    console.error("Wiki 操作失败:", err.message);
    console.error("错误代码:", err.errorCode);
    console.error("建议:", err.suggestion);
  }
}
```

## 注意事项

1. **必须使用 skipUI=true**：WikiLink 仅支持 skipUI 模式，UI 模式待实现
2. **批量操作务必使用 skipUI=true**：调用 WikiView/WikiList 等 API 时，如果不需操控 UI，**必须**传入 `{ skipUI: true }`，否则会走完整 UI 流程（导航、选择人物、等待状态更新），导致：
   - 每次调用增加 ~300ms 延迟
   - 循环调用时累积超时（如 4 次调用 × 300ms = 1.2 秒）
   - 30 秒脚本执行超时限制
3. **单向链接**：链接是单向的，A→B 不等于 B→A
4. **无循环检测**：系统不检测循环链接（A→B→C→A），需自行避免
5. **personId 可选**：不传则使用当前选中的人物，建议显式传入以避免歧义

### 正确示例 vs 错误示例

#### ❌ 错误：批量操作不使用 skipUI

```javascript
// 会导致超时！
for (const id of [1, 2, 3, 4]) {
  const doc = await window.peep.WikiView({ docId: id }); // 每次走完整 UI 流程
}
```

#### ✅ 正确：批量操作使用 skipUI

```javascript
// 快速、不会超时
for (const id of [1, 2, 3, 4]) {
  const doc = await window.peep.WikiView({ docId: id }, { skipUI: true }); // 直接查数据库
}
```

## 完整示例：Agent 创建 4 篇关联文档

```javascript
// Agent 创建 4 篇文档
const doc1 = await window.peep.WikiCreate(
  {
    title: "紫微斗数基础",
    content: "# 基础概念\n\n...",
    tags: ["基础"],
  },
  { skipUI: true },
);

const doc2 = await window.peep.WikiCreate(
  {
    title: "十四主星",
    content: "# 主星详解\n\n...",
    tags: ["主星"],
  },
  { skipUI: true },
);

const doc3 = await window.peep.WikiCreate(
  {
    title: "十二宫位",
    content: "# 宫位说明\n\n...",
    tags: ["宫位"],
  },
  { skipUI: true },
);

const doc4 = await window.peep.WikiCreate(
  {
    title: "四化飞星",
    content: "# 四化详解\n\n...",
    tags: ["四化"],
  },
  { skipUI: true },
);

// 建立关联关系
// 基础文档链接到所有进阶文档
await window.peep.WikiLink(
  {
    sourceDocId: doc1.id,
    targetDocIds: [doc2.id, doc3.id, doc4.id],
  },
  { skipUI: true },
);

// 主星链接到宫位
await window.peep.WikiLink(
  {
    sourceDocId: doc2.id,
    targetDocIds: [doc3.id],
  },
  { skipUI: true },
);

// 四化链接到主星和宫位
await window.peep.WikiLink(
  {
    sourceDocId: doc4.id,
    targetDocIds: [doc2.id, doc3.id],
  },
  { skipUI: true },
);

console.log("文档关联建立完成！");
```

## 相关 API

- `WikiCreate`: 创建文档（可在创建时设置 linkTargetIds）
- `WikiView`: 查看文档详情（返回 linkTargetIds 和可选的 backlinkSourceIds）
- `WikiList`: 查询文档列表
