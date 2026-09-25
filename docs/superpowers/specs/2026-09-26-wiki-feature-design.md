# Wiki 功能设计文档

## 概述

Wiki 是一个面向 LLM 消费的知识库系统，采用类似 llms.txt 的结构化文档模式。每篇文档必须关联人物库中的人物 ID，支持 Markdown 格式编写、实体标注、双向链接，最终可导出为 LLM 友好的格式。

设计理念源自 Karpathy 的 "LLM OS"——LLM 作为 CPU，知识库作为持久化文件系统。Wiki 页面就是 LLM 的"记忆单元"，通过 Markdown 原生格式让 LLM 高效理解和检索。

## 产品形态

### 路由扩展

在现有路由基础上新增 Wiki 路由：

- `/` — 紫微斗数（已有）
- `/liuren` — 大六壬（已有）
- `/wiki` — **Wiki 知识库（新增）**

### Header 导航扩展

Header 的 SVG Icon 导航区新增 Wiki 入口：

```tsx
<nav className="top-nav">
  <NavLink to="/" title="紫微斗数"><ZiweiIcon /></NavLink>
  <NavLink to="/liuren" title="大六壬"><LiurenIcon /></NavLink>
  <NavLink to="/wiki" title="Wiki"><WikiIcon /></NavLink>   {/* 新增 */}
</nav>
```

**WikiIcon 设计**：展开书卷/多层文档造型，使用 `currentColor` 配合玄空霓虹主题。

### 标题联动

Header 标题根据路由动态切换：

```typescript
function getTitleByPath(pathname: string): string {
  if (pathname.startsWith("/liuren")) return "大六壬";
  if (pathname.startsWith("/wiki")) return "知识库";   // 新增
  return "紫微斗数";
}

function getSubtitleByPath(pathname: string): string {
  if (pathname.startsWith("/liuren")) return "古法占课 · 天地盘 · 四课三传";
  if (pathname.startsWith("/wiki")) return "LLM 知识底座 · Markdown · 实体关联";  // 新增
  return "玄机排盘 · iztro 引擎 · 自研盘面";
}
```

## 页面设计

### 布局：左右分区（沿用大六壬模式）

```
┌──────────────────────────────────────────────────────────────┐
│ Header：知识库 | LLM 知识底座   [紫微] [六壬] [📜 Wiki]   人物选择器 │
├───────────────┬──────────────────────────────────────────────┤
│               │                                              │
│  左侧列表区    │  右侧阅读/编辑区                              │
│  (30%, min    │  (70%)                                      │
│   280px)      │                                              │
│               │                                              │
│ [+ 新建文档]   │  ┌────────────────────────────────────────┐  │
│               │  │ 文档标题                            [编辑]│  │
│ ┌───────────┐ │  │ ───────────────────────────────────── │  │
│ │ 🔍搜索...  │ │  │ 👤 关联人物：张三  ·  🕐 2026-09-25    │  │
│ └───────────┘ │  │ 🏷️ #命理 #大限 #流年                  │  │
│               │  └────────────────────────────────────────┘  │
│ [命理] [大限]  │                                              │
│ [流年] [宫位]  │  ┌────────────────────────────────────────┐  │
│               │  │                                        │  │
│ ┌───────────┐ │  │  ## 大限概述                            │  │
│ │ 09-25 14:30│ │  │                                        │  │
│ │ 大限走法详解│ │  │  大限是紫微斗数中十年一运的重要分析...    │  │
│ │ 📎 张三     │ │  │                                        │  │
│ │ #命理 #大限 │ │  │  ### 阳男顺行                          │  │
│ │             │ │  │  甲年生人，命宫在子，大限顺行...         │  │
│ ├───────────┤ │  │                                        │  │
│ │ 09-24 10:00│ │  │  > 引用古籍：「大限管十年之休咎」       │  │
│ │ 流年飞星笔记│ │  │                                        │  │
│ │ 📎 张三     │ │  │  ---                                   │  │
│ │ #流年       │ │  │                                        │  │
│ └───────────┘ │  │  ## 关联实体                             │  │
│               │  │  🏠 命宫 → 紫微、天府                    │  │
│  ↑ 悬停显示    │  │  ⭐ 紫微星 → 帝星，主贵                  │  │
│  [编辑][删除]  │  │  🔗 大限 → 命宫                         │  │
│               │  │                                        │  │
│  分页 [< 1/3 >]│  │  ## 关联文档                             │  │
│               │  │  📜 流年飞星笔记                         │  │
│               │  │  📜 四化详解                             │  │
│               │  └────────────────────────────────────────┘  │
└───────────────┴──────────────────────────────────────────────┘
```

**设计原则**：左侧列表为导航辅助（沿用大六壬的"左导航右内容"模式），右侧为核心阅读/编辑区。

### 右侧：阅读/编辑区

#### 阅读模式（默认）

用户点击左侧某条文档后，展示该文档的完整内容：

1. **文档标题**（H1）
2. **元信息条**：关联人物、创建时间、标签 chips
3. **Markdown 正文渲染**：标题、段落、列表、引用、代码块、链接等
4. **关联实体面板**：提取的实体列表（名称 + 类型 + 描述），实体名称在正文中高亮可点击
5. **关联文档列表**：双向链接，点击跳转到关联文档
6. **操作按钮**：右上角 [编辑] 按钮

**空状态**：未选中任何文档时，显示引导文案"请选择左侧文档查看，或点击【新建文档】开始撰写"

#### 编辑模式

点击 [编辑] 或 [新建文档] 进入编辑模式：

1. **标题编辑**：input 输入框
2. **正文编辑**：Markdown textarea（等宽字体，建议带行号）
3. **标签输入**：chips + 回车添加 + 自动补全已有标签
4. **关联文档选择**：搜索选择其他 Wiki 文档建立双向链接
5. **底部按钮**：[保存] [取消]

> 注：实体标注功能（选中文本 → 标注为实体）可作为第二阶段增强功能，初期先支持纯 Markdown + 标签。

### 左侧：文档列表区

#### 检索条件

1. **文本搜索**：搜索标题、正文内容（单一输入框）
2. **标签筛选**：多选标签 chips（从已有标签中提取）

#### 列表展示

每条文档显示：

- 更新时间（相对时间，如"2小时前"或"昨天"）
- 文档标题（一行，超长截断）
- 关联人物名称
- 标签（最多显示 3 个，超出显示 `+N`）

列表样式：紧凑的列表项，高度固定，可滚动。

#### 排序与分页

- **排序**：按 `updatedAt` 倒序（最近更新在前）
- **分页**：每页 20 条

#### 操作

- 点击列表项 → 右侧展示文档内容（高亮当前选中项）
- 悬停显示操作按钮：编辑、删除
- 顶部 [+ 新建文档] 按钮

#### 空状态

- 无文档时显示"暂无文档，点击【新建文档】开始撰写"
- 搜索无结果时显示"未找到匹配的文档"

### Dialog 弹窗

#### 删除确认 Dialog

二次确认，显示"确定要删除这篇文档吗？此操作不可恢复。"

> 注：新建和编辑直接在右侧区域进行（非 Dialog），保持编辑区有充足空间。

## 数据库设计

### 扩展 personDb.ts

在现有 `PeepDatabase` 类中新增 Wiki 相关表：

```typescript
class PeepDatabase extends Dexie {
  persons!: Table<Person, number>;
  liurenRecords!: Table<LiurenRecord, number>;
  wikiDocs!: Table<WikiDocument, number>;        // 新增
  wikiLinks!: Table<WikiLink, number>;           // 新增：双向链接

  constructor() {
    super("peep");
    this.version(1).stores({ persons: "++id, savedAt, isDefault" });
    this.version(2).stores({
      persons: "++id, savedAt, isDefault",
      liurenRecords: "++id, personId, savedAt, calculationTime, *tags",
    });
    this.version(3).stores({                    // 新增 version(3)
      persons: "++id, savedAt, isDefault",
      liurenRecords: "++id, personId, savedAt, calculationTime, *tags",
      wikiDocs: "++id, personId, updatedAt, savedAt, *tags",
      wikiLinks: "++id, sourceDocId, targetDocId",
    });
  }
}
```

### WikiDocument 接口

```typescript
interface WikiDocument {
  id?: number;
  personId: number;           // 关联人物 ID（必需）
  title: string;              // 文档标题
  content: string;            // Markdown 正文
  tags: string[];             // 标签数组
  savedAt: number;            // 创建时间戳
  updatedAt: number;          // 最后更新时间戳
}
```

### WikiLink 接口

```typescript
interface WikiLink {
  id?: number;
  sourceDocId: number;        // 源文档 ID
  targetDocId: number;        // 目标文档 ID
}
```

### 索引设计

**wikiDocs**：
- `personId`：按人物过滤
- `updatedAt`：按更新时间排序
- `savedAt`：按创建时间排序
- `*tags`：标签数组索引（支持多值查询）

**wikiLinks**：
- `sourceDocId`：查询某文档链接了哪些文档
- `targetDocId`：查询某文档被哪些文档链接（反向链接）

### CRUD 操作

```typescript
// 文档操作
listWikiDocs(personId, filters): Promise<{ docs: WikiDocument[]; total: number }>
getWikiDoc(id): Promise<WikiDocument | undefined>
saveWikiDoc(doc): Promise<WikiDocument>          // 新增或更新
deleteWikiDoc(id): Promise<void>

// 标签操作
getAllWikiTags(personId): Promise<string[]>      // 获取某人物下所有标签

// 链接操作
getWikiLinks(sourceDocId): Promise<number[]>     // 获取正向链接
getWikiBacklinks(targetDocId): Promise<number[]> // 获取反向链接
saveWikiLinks(sourceDocId, targetDocIds): Promise<void>
deleteWikiLinksByDoc(docId): Promise<void>       // 删除文档时清理链接
```

## 组件设计

### 组件拆分

| 组件 | 文件路径 | 职责 |
|------|----------|------|
| `WikiPage` | `src/pages/WikiPage.tsx` | 页面主框架，管理选中状态、模式切换 |
| `WikiList` | `src/components/wiki/WikiList.tsx` | 左侧列表（搜索 + 标签筛选 + 条目列表 + 分页） |
| `WikiReader` | `src/components/wiki/WikiReader.tsx` | 右侧阅读模式（Markdown 渲染 + 元信息 + 实体/链接面板） |
| `WikiEditor` | `src/components/wiki/WikiEditor.tsx` | 编辑模式（标题 + Markdown textarea + 标签 + 关联文档选择） |
| `WikiIcon` | `src/components/icons/WikiIcon.tsx` | Header 导航 SVG 图标 |

### WikiPage 状态管理

```typescript
function WikiPage() {
  const [person, setPerson] = useState<Person | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<WikiDocument | null>(null);
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [listRefreshKey, setListRefreshKey] = useState(0);

  // 监听人物切换事件
  // 新建文档 → 清空 selectedDoc，切换到 edit 模式
  // 选中列表项 → 加载文档，切换到 read 模式
  // 保存文档 → 刷新列表，切换回 read 模式
}
```

### WikiList 组件

参考大六壬的 `LiurenList` 组件，支持：

- 搜索输入框
- 标签筛选 chips
- 文档列表（标题 + 相对时间 + 人物 + 标签）
- 悬停显示编辑/删除按钮
- 分页
- `forwardRef` + `useImperativeHandle` 暴露命令式接口

### WikiReader 组件

```typescript
interface WikiReaderProps {
  doc: WikiDocument;
  onEditClick: () => void;
  onDocClick: (docId: number) => void;   // 点击关联文档跳转
}
```

功能：
- Markdown → HTML 渲染
- 元信息展示（人物、时间、标签）
- 关联实体展示（初期可省略，后续扩展）
- 关联文档列表（正向链接 + 反向链接）
- [编辑] 按钮

### WikiEditor 组件

```typescript
interface WikiEditorProps {
  doc?: WikiDocument;                // undefined 表示新建
  personId: number;
  existingTags: string[];            // 已有标签列表（用于自动补全）
  onSave: (doc: WikiDocument, linkTargetIds: number[]) => Promise<void>;
  onCancel: () => void;
}
```

功能：
- 标题输入
- Markdown 编辑 textarea
- 标签 chips 输入
- 关联文档搜索选择
- 保存/取消按钮

## Markdown 渲染方案

项目当前无 UI 框架，推荐轻量方案：

### 方案 A：自写简易渲染器（推荐）

与现有零依赖风格一致，手写 Markdown → HTML 转换：

```typescript
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n/g, "</p><p>")
    // ... 更多规则
}
```

优点：零依赖，体积小
缺点：不支持复杂语法（表格、嵌套列表等）

### 方案 B：引入 marked 库

```bash
npm install marked dompurify
```

- `marked`（~40KB）：成熟的 Markdown 解析器
- `dompurify`：XSS 防护

优点：功能完整，支持 GFM
缺点：增加包体积

### 建议

初期使用方案 A（自写简易渲染器），覆盖常用语法即可。若后续需要复杂排版，再引入 marked。

## 导出功能（llms.txt 格式）

Wiki 的核心价值在于面向 LLM 消费。提供导出功能，将文档集合导出为 llms.txt 格式：

### 导出内容

```markdown
# 紫微斗数知识库 — 张三

> 紫微斗数命理分析知识库，涵盖宫位、星耀、四化、大限、流年等核心概念。

## 核心概念

- [命宫解析](#doc-1): 命宫是紫微斗数的核心，代表先天性格与一生格局
- [紫微星详解](#doc-2): 紫微为帝星，主贵，居于命宫则性格尊贵

## 进阶分析

- [大限走法](#doc-3): 大限十年一运，阳男顺行、阴女逆行
- [流年飞星](#doc-4): 流年天干四化飞入各宫的吉凶判断

## Optional

- [古籍引用汇编](#doc-5): 太微赋、骨髓赋等经典赋文整理
```

### 导出范围

- 当前人物下的所有文档
- 按标签分组（H2 区块）
- 每篇文档包含标题 + 一句话摘要（content 首行或前 100 字）

### 导出方式

在 Wiki 页面右上角添加 [导出] 按钮，点击后下载 `llms.txt` 文件。

## 样式设计

### 新增 CSS 类名

沿用玄空霓虹主题，新增以下 CSS 类：

```css
/* Wiki 页面布局 */
.wiki-layout { /* 左右分区 */ }
.wiki-list { /* 左侧列表区 */ }
.wiki-reader { /* 右侧阅读区 */ }
.wiki-editor { /* 右侧编辑区 */ }

/* 列表项 */
.wiki-list-item { }
.wiki-list-item.active { }
.wiki-list-item-title { }
.wiki-list-item-meta { }

/* 阅读区 */
.wiki-doc-header { }
.wiki-doc-meta { }
.wiki-doc-content { }
.wiki-doc-content h1, h2, h3 { }
.wiki-doc-content blockquote { }
.wiki-doc-content code { }
.wiki-doc-links { }

/* 编辑区 */
.wiki-editor-title { }
.wiki-editor-textarea { }
.wiki-editor-tags { }
```

### 颜色变量

复用现有 CSS 变量：

- `--bg`：背景色
- `--panel`：面板背景
- `--line` / `--line-strong`：边框
- `--text` / `--dim` / `--faint`：文字层级
- `--gold`：高亮色（激活状态）
- `--cyan`：辉光色

## 技术栈

- **路由**：`react-router-dom` v7（已用）
- **数据库**：`dexie` v4（已用）
- **样式**：现有 `src/index.css`（玄空霓虹主题）
- **Markdown 渲染**：自写简易渲染器（初期）

## 实现分步

### 第一阶段：基础架构（1-2 天）

1. 创建 `WikiIcon.tsx` SVG 图标组件
2. 修改 `Header.tsx`：添加 Wiki 导航入口 + 标题联动
3. 扩展 `personDb.ts`：新增 `wikiDocs` 和 `wikiLinks` 表（version 3）
4. 实现 Wiki CRUD 函数（`listWikiDocs`、`saveWikiDoc` 等）
5. 修改 `App.tsx`：添加 `/wiki` 路由

### 第二阶段：列表与阅读（2-3 天）

1. 创建 `WikiPage.tsx` 页面框架（左右分区布局）
2. 实现 `WikiList.tsx` 左侧列表组件（搜索 + 标签筛选 + 分页 + 悬停操作）
3. 实现简易 Markdown 渲染函数
4. 实现 `WikiReader.tsx` 右侧阅读组件（元信息 + 正文渲染 + 关联文档）
5. 空状态引导文案

### 第三阶段：编辑功能（2-3 天）

1. 实现 `WikiEditor.tsx` 编辑组件（标题 + textarea + 标签输入 + 关联文档选择）
2. 新建文档流程
3. 编辑文档流程
4. 删除确认 Dialog
5. 双向链接维护（保存时同步 wikiLinks 表）

### 第四阶段：导出与优化（1-2 天）

1. 实现 llms.txt 导出功能
2. 样式微调与响应式适配
3. 测试与修复

## 成功标准

1. ✅ Header 导航新增 Wiki 图标入口，可切换到 `/wiki` 路由
2. ✅ Wiki 页面左右分区，左侧文档列表，右侧阅读/编辑区
3. ✅ 每篇文档必须关联人物 ID（从当前选中人物自动获取）
4. ✅ 支持 Markdown 格式编写和渲染
5. ✅ 支持标签管理和标签筛选
6. ✅ 支持文档间双向链接
7. ✅ 文档持久化到 IndexedDB
8. ✅ 支持导出为 llms.txt 格式
9. ✅ 样式沿用玄空霓虹主题，视觉统一

## 未来扩展

### 实体标注增强

- 选中文本 → 弹出浮动菜单 → 标注为实体（人物/地点/概念/星耀/宫位/事件）
- 实体列表展示在文档底部面板
- 实体关系三元组（source → predicate → target）

### AI 辅助

- 接入 AI 自动提取实体和关系
- AI 辅助撰写文档摘要
- AI 基于 Wiki 知识库回答命理问题

### 知识图谱可视化

- 用力导向图展示文档间的链接关系
- 用节点图展示实体间的关系网络

### 全文搜索增强

- 使用 FlexSearch 或 MiniSearch 实现更精准的全文搜索
- 支持搜索结果高亮

### 多人物知识共享

- 跨人物的通用知识库（如"紫微斗数基础概念"不绑定特定人物）
- 人物专属知识库（如"张三的命盘分析"绑定到张三）
