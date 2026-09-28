# 紫微斗数排盘 Web 应用 - 需求文档

## 1. 项目概述

### 1.1 产品定位

紫微斗数排盘 Web 应用，集成命理分析 AI 助手（RTC Agent），提供紫微斗数、大六壬、六爻三种命理术数的排盘与分析能力，以及知识库管理功能。

### 1.2 技术栈

- **前端框架**：React 18 + TypeScript + Vite
- **样式方案**：原生 CSS（无 UI 框架）
- **算法引擎**：iztro（紫微斗数排盘）
- **数据存储**：IndexedDB（通过 Dexie.js）
- **AI 助手**：RTC Agent（嵌入式面板）

---

## 2. 核心业务维度

系统包含 **5 个核心业务维度**，每个维度独立管理，通过人物档案关联：

### 2.1 人物库（Person）

命主档案管理，是所有分析的前提。

**数据结构**：

- 基础信息：姓名、性别、出生日期时间
- 高级设置：历法类型、真太阳时、流派、四化表等
- 关联数据：大六壬记录、六爻记录、Wiki 文档

**现有 Function**：

- `PersonList`：列出所有人物
- `PersonGet`：获取单个人物详情
- `PersonCreate`：创建新人物
- `PersonUpdate`：更新人物信息（支持部分字段更新）
- `PersonDelete`：删除人物

**缺失 Function**：

- `PersonSetDefault`：设置默认人物（当前需通过 PersonUpdate 的 isDefault 字段实现）

### 2.2 紫微斗数（ZiWei）

紫微斗数排盘与运限分析。

**数据特点**：

- 纯计算数据，不存储到数据库
- 每次根据人物档案实时计算
- 包含十二宫、星曜、四化、运限等

**现有 Function**：

- `ZiWei`：获取完整盘面（操控 UI，耗时 1-3 秒）
- `GetScopeData`：获取运限拨盘数据（纯计算，响应快）

**功能边界**：

- 只读操作，无增删改
- 运限时间通过 UI 拨盘调整，无独立 Function

### 2.3 大六壬（DaLiuRen）

大六壬起课占卜，适合具体事件的占断。

**数据结构**：

- 关联人物 ID
- 起课时间、占事问题、备注、背景
- 标签数组
- 完整卦象数据（四课、三传、天地盘等）

**现有 Function**：

- `DaLiuRenCreate`：起课（创建记录）
- `DaLiuRenList`：列出起课记录（支持搜索、标签过滤、分页）
- `DaLiuRenView`：查看起课详情
- `DaLiuRenDelete`：删除起课记录
- `DaLiuRenBatchView`：批量查看详情

**功能边界**：

- 起课记录一旦创建**不可修改**（业务逻辑约束）
- 可删除、可更新元数据（标签、备注）

**缺失 Function**：

- `DaLiuRenUpdateTags`：更新起课记录的标签
- `DaLiuRenUpdateNote`：更新起课记录的备注和背景信息

### 2.4 六爻（LiuYao）

六爻起卦占卜，适合具体事件的占断。

**数据结构**：

- 关联人物 ID
- 起卦时间、占事问题、备注、背景
- 标签数组
- 六爻值（6 个 0-3 的整数）
- 完整卦象（卦名、宫位、世应、纳甲、六亲、六神、旬空、变卦）
- 用神定位结果
- 求测对象（自占/父母/子女/配偶/兄弟/医药）

**现有 Function**：

- `LiuYaoCreate`：起卦（创建记录）
- `LiuYaoList`：列出起卦记录（支持搜索、标签过滤、分页）
- `LiuYaoView`：查看起卦详情
- `LiuYaoDelete`：删除起卦记录
- `LiuYaoBatchView`：批量查看详情

**功能边界**：

- 起卦记录一旦创建**不可修改**（业务逻辑约束）
- 可删除、可更新元数据（标签、备注）

**缺失 Function**：

- `LiuYaoUpdateTags`：更新起卦记录的标签
- `LiuYaoUpdateNote`：更新起卦记录的备注和背景信息

### 2.5 Wiki（知识库）

命理知识库管理，存储学习笔记、格局解析、案例分析等 Markdown 文档。

**数据结构**：

- 关联人物 ID
- 标题、内容（Markdown 格式）
- 标签数组
- 文档间链接关系（sourceDocId → targetDocId）
- 时间戳（savedAt、updatedAt）

**现有 Function**：

- `WikiList`：列出文档（支持搜索、标签过滤、分页）
- `WikiView`：查看文档详情
- `WikiCreate`：创建新文档
- `WikiUpdate`：更新文档（全量替换标题/内容/标签/链接）
- `WikiBatchView`：批量查看详情

**功能边界**：

- 文档一旦创建**不可删除**（业务逻辑约束）
- 可更新内容、标签、链接

**缺失 Function**：

- `WikiReplaceContent`：替换文档内容中的字符串（支持 Replace All）
- `WikiInsertContent`：在文档指定位置插入内容
- `WikiDelete`：删除文档（当前不支持，但可能需要）

---

## 3. Agent 系统设计

### 3.1 架构概述

Agent 基于 RTC Agent 框架，通过 Function 注册机制与前端交互。

**核心特性**：

- **UI 操控模式**：Agent 像人类一样操作 UI（导航页面、切换人物、等待渲染、读取数据）
- **skipUI 模式**：直接操作数据库，跳过 UI 交互（性能优化）
- **安全确认机制**：破坏性操作（Create/Update/Delete）需用户确认

### 3.2 Function 注册机制

每个 Function 包含：

- `name`：函数名
- `description`：功能描述（给 AI 理解用）
- `zodSchema`：参数 Schema（Zod 定义，AI 据此生成正确调用）
- `handler`：处理函数（桥接 debugApi）
- `returns.zodSchema`：返回值 Schema（精确描述返回数据结构）

### 3.3 Function 分组

按业务域划分为 6 个组：

1. `person`：命主档案管理
2. `ziwei`：紫微斗数排盘
3. `daliuren`：大六壬起课
4. `liuyao`：六爻起卦
5. `wiki`：知识库管理
6. `lunar`：时间/日历计算

### 3.4 交互流程

**典型流程**：

1. Agent 接收用户请求
2. 通过 PersonList/PersonGet 确认命主
3. 导航到对应页面（ZiWei/DaLiuRen/LiuYao/Wiki）
4. 切换人物、等待渲染完成
5. 调用 Function 获取数据或执行操作
6. 返回结果给用户

**UI 状态追踪**：

- 通过 `getUiState`/`updateUiState` 追踪当前 UI 状态
- 智能判断是否需要操作（避免不必要的 UI 交互）

---

## 4. 待完善功能

### 4.1 大六壬元数据更新

**需求背景**：起课记录一旦创建不可修改，但用户可能需要更新标签或备注。

**新增 Function**：

- `DaLiuRenUpdateTags`：更新起课记录的标签
  - 参数：recordId, tags[]
  - 返回：更新后的记录
- `DaLiuRenUpdateNote`：更新备注和背景信息
  - 参数：recordId, note, background
  - 返回：更新后的记录

**实现要点**：

- 仅更新元数据，不修改卦象数据
- 支持 skipUI 模式（直接更新数据库）
- 更新后使标签缓存失效

### 4.2 六爻元数据更新

**需求背景**：同大六壬，起卦记录不可修改，但需支持元数据更新。

**新增 Function**：

- `LiuYaoUpdateTags`：更新起卦记录的标签
  - 参数：recordId, tags[]
  - 返回：更新后的记录
- `LiuYaoUpdateNote`：更新备注和背景信息
  - 参数：recordId, note, background
  - 返回：更新后的记录

**实现要点**：

- 同大六壬，仅更新元数据
- 支持 skipUI 模式
- 更新后使标签缓存失效

### 4.3 Wiki 内容细粒度编辑

**需求背景**：当前 WikiUpdate 是全量替换，对于长文档不够精细。

**新增 Function**：

- `WikiReplaceContent`：替换文档内容中的字符串
  - 参数：docId, searchText, replaceText, isGlobal（是否 Replace All）
  - 返回：更新后的文档
  - 实现：使用 JavaScript 的 `String.prototype.replace()` 或 `replaceAll()`
- `WikiInsertContent`：在文档指定位置插入内容
  - 参数：docId, position（行号或锚点），content
  - 返回：更新后的文档
  - 实现：按行分割内容，插入指定位置
- `WikiDelete`：删除文档（可选）
  - 参数：docId
  - 返回：无
  - 注意：需评估是否开放删除功能

**实现要点**：

- WikiReplaceContent 支持正则表达式（可选）
- WikiInsertContent 支持多种定位方式（行号、标题锚点）
- 更新后自动更新 updatedAt 时间戳

### 4.4 人物库增强

**需求背景**：设置默认人物需要单独 Function。

**新增 Function**：

- `PersonSetDefault`：设置默认人物
  - 参数：personId
  - 返回：更新后的人物
  - 实现：更新人物的 isDefault 字段，并确保其他人物的 isDefault 为 false

**实现要点**：

- 系统中只能有一个默认人物
- 设置新默认人物时，自动取消原默认人物的标记

### 4.5 紫微斗数运限控制

**需求背景**：当前运限时间只能通过 UI 拨盘调整，Agent 无法直接控制。

**新增 Function**：

- `SetHoroscopeTime`：设置运限时间
  - 参数：personId, year, month, day, hour
  - 返回：设置后的运限数据
  - 实现：调用 `setHoroscopeTimeWithRetry`

**实现要点**：

- 纯计算操作，不操控 UI
- 设置后返回当前运限状态

---

## 5. 非功能性需求

### 5.1 性能要求

- **Function 响应时间**：
  - 纯计算接口（GetScopeData、computeDaLiuRenData）：< 100ms
  - UI 操控接口（ZiWei、DaLiuRenCreate）：< 3s
  - 列表查询（List）：< 500ms
- **缓存策略**：
  - 排盘结果缓存（clearAstrolabeCache）
  - 标签缓存（tagCache）
  - 运限拨盘数据缓存

### 5.2 错误处理

- **错误分类**：
  - INVALID_INPUT：参数验证失败
  - NOT_FOUND：资源不存在
  - NOT_INITIALIZED：回调未初始化
  - COMPUTE_FAILED：计算失败
- **错误信息**：
  - 包含 context（上下文信息）
  - 包含 suggestion（恢复建议）
  - 包含 errorCode（错误代码）

### 5.3 安全机制

- **写操作确认**：
  - Create/Update/Delete 首次调用返回操作摘要
  - 用户确认后，AI 再次调用并传入 `confirmed: true`
  - 防止 AI 幻觉或 prompt 注入造成误操作
- **默认人物保护**：
  - 默认人物不可删除
  - 必须先设置其他人物为默认，才能删除原默认人物

### 5.4 数据一致性

- **UI 同步**：
  - 写操作触发 `globalEvents.emit("person.changed")`
  - 所有页面监听事件并重新计算
- **数据库事务**：
  - 使用 Dexie.js 的事务机制
  - 确保关联数据（如 Wiki 链接）的一致性

---

## 6. 附录

### 6.1 术语表

- **命主**：人物档案对应的真实个体
- **运限**：大限、流年、流月、流日、流时的统称
- **四化**：禄、权、科、忌四种星曜转化
- **起课**：大六壬占卜的起卦过程
- **起卦**：六爻占卜的摇卦过程
- **用神**：六爻占卜中代表求测对象的核心爻位

### 6.2 参考资料

- RTC Agent 文档：https://rtc-agent.cherish.chat
- iztro 算法引擎：https://github.com/SylarLong/iztro
- Dexie.js 文档：https://dexie.org/docs/

---

**文档版本**：1.0  
**最后更新**：2026-09-28  
**维护者**：PineappleBond 团队
