# 架构说明文档

本文档描述 react-zwds（peep-v2）项目的整体架构设计、模块关系、数据流与关键技术决策。

## 项目定位

紫微斗数排盘 Web 应用，核心能力：

- **算法引擎**：iztro 负责星耀安放、四化、运限计算
- **自研盘面 UI**：深空霓虹主题，文墨天机 APP 风格
- **结构分析层**：确定性计算中间步骤，辅助 AI 推理
- **AI 导出**：TOON/MD 格式，附推理指引与知识附录
- **大六壬**：独立起课模块，完整三传四课/神煞/六亲
- **知识库 Wiki**：个人命理笔记管理

## 技术栈

| 层级   | 技术选型                      | 选型理由                                                                   |
| ------ | ----------------------------- | -------------------------------------------------------------------------- |
| 构建   | Vite 8                        | 极速 HMR，ESM 原生                                                         |
| 框架   | React 18                      | 函数组件 + Hooks                                                           |
| 类型   | TypeScript 5.6（strict）      | 类型安全                                                                   |
| 算法   | iztro 2.x                     | 成熟的紫微斗数 JS 引擎                                                     |
| 历法   | lunar-lite + lunar-typescript | 农历/闰月/干支（lunar-lite 部分 API 损坏，月天数走 lunar-typescript 兜底） |
| 存储   | Dexie.js (IndexedDB)          | 结构化本地存储，支持索引查询                                               |
| 序列化 | TOON                          | 紧凑格式，AI 导出省 token                                                  |
| 路由   | react-router-dom v7           | 多页面 SPA                                                                 |
| 测试   | Vitest + Playwright           | 单元 + E2E                                                                 |

## 三层架构

```text
┌──────────────────────────────────────────────────────────────┐
│                      页面层 (pages/)                          │
│   ZiweiPage    │    DaLiuRenPage    │    WikiPage            │
│   (直接加载)    │    (React.lazy)    │    (React.lazy)        │
├──────────────────────────────────────────────────────────────┤
│                    组件层 (components/)                        │
│                                                              │
│  紫微盘面组件           大六壬组件            Wiki 组件         │
│  Chart / Palace        LiurenChart         WikiList          │
│  StarCell              LiurenList          WikiEditor         │
│  CenterPanel           LiurenCreateDialog  WikiReader         │
│  HoroscopeBar          LiurenViewDialog                       │
│  PalaceDetail          LiurenFormFields                       │
│  Header / Layout       PersonSelector                         │
├──────────────────────────────────────────────────────────────┤
│                      逻辑层 (core/)                           │
│                                                              │
│  ┌─ 排盘核心 ─────────────────────────────────────────┐      │
│  │ useZwds    — 排盘主 Hook（拨盘状态→目标日期→horoscope）│     │
│  │ utils      — 干支/四化表/地支关系/真太阳时             │     │
│  │ lunar      — 农历⇄公历、闰月、日柱干支                 │     │
│  │ place      — 出生地经度/时区解析                       │     │
│  │ cities     — 中国省市区三级经度表                       │     │
│  │ tzdata     — 全球时区主城经度表（tzdb）                 │     │
│  │ hbar       — 运限拨盘数据计算                           │     │
│  └─────────────────────────────────────────────────────┘      │
│                                                              │
│  ┌─ 分析层 ───────────────────────────────────────────┐      │
│  │ chartIndex  — 盘面索引原语（星→宫/三方四正，整盘建一次） │     │
│  │ analysis    — 结构分析门面（飞宫矩阵/三方快照/传导链）   │     │
│  │ patterns    — 格局检测（本命 ~45 个 + 运限八类）         │     │
│  │ lifeKline   — 人生K线引擎（进出双动能+流曜引动）         │     │
│  │ knowledge   — L1 推理规则速查                           │     │
│  └─────────────────────────────────────────────────────┘      │
│                                                              │
│  ┌─ 导出与扩展 ───────────────────────────────────────┐      │
│  │ exportData  — AI 导出（TOON/MD/JSON）+ 口径约定       │     │
│  │ decadePlan  — 十年规划表计算                           │     │
│  │ synastry    — 合盘（双人相性分析）                      │     │
│  │ rectify     — 生时校正助手                             │     │
│  └─────────────────────────────────────────────────────┘      │
│                                                              │
│  ┌─ 数据层 ───────────────────────────────────────────┐      │
│  │ personDb    — 人物库 + Dexie 数据库实例                │     │
│  │ daliurenDb  — 大六壬起课 CRUD                          │     │
│  │ wikiDb      — Wiki 文档 CRUD + 链接关系                │     │
│  │ dbUtils     — 分页/过滤/搜索通用工具                    │     │
│  │ tagCache    — 标签缓存                                 │     │
│  │ migrations  — 数据库迁移脚本                           │     │
│  └─────────────────────────────────────────────────────┘      │
│                                                              │
│  ┌─ 基础设施 ─────────────────────────────────────────┐      │
│  │ debugApi     — window.peep 调试接口                   │     │
│  │ events       — 跨组件事件总线                         │     │
│  │ markdown     — 安全 Markdown 渲染器                    │     │
│  │ usePageInit  — 页面初始化 Hook                         │     │
│  │ globalSearch — 全局搜索核心（模糊/拼音/正则）           │     │
│  │ shortcuts    — 键盘快捷键注册系统                       │     │
│  │ guide        — 用户引导流程定义                         │     │
│  │ theme        — 主题管理（亮/暗/跟随系统）               │     │
│  │ toast        — 全局 Toast 通知                         │     │
│  │ sync         — 多设备同步（导出/导入+加密）             │     │
│  │ pluginSystem — 插件系统核心                             │     │
│  │ i18n         — 国际化支持                               │     │
│  │ daliuren/    — 大六壬算法引擎（22 个模块）               │     │
│  └─────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

## 数据流

### 紫微斗数排盘流程

```text
用户输入生辰
    │
    ▼
BirthInput（状态）
    │
    ├─→ effectiveBirth() ──→ 真太阳时校正 / 子时处理 / 流派预设
    │
    ▼
useZwds Hook
    │
    ├─→ iztro.astro.bySolar() ──→ Astrolabe（本命盘）
    │        │
    │        ├─→ buildChartIndex() ──→ ChartIndex（共享索引）
    │        │
    │        ├─→ analyzeChart() ──→ ChartAnalysis（结构分析）
    │        │        ├─→ getSanfangSnapshots()  三方四正快照
    │        │        ├─→ getFlyMatrix()         飞宫四化矩阵
    │        │        ├─→ getJiaGong()           夹宫关系
    │        │        ├─→ traceMutagenChains()   四化传导链
    │        │        └─→ detectPatterns()       格局检测
    │        │
    │        └─→ buildLifeKline() ──→ LifeKlineData（K线评分）
    │
    ├─→ astrolabe.horoscope() ──→ Horoscope（运限数据）
    │        │
    │        └─→ detectHoroscopePatterns() ──→ 运限格局扫描
    │
    ├─→ buildHbarData() ──→ HbarData（拨盘数据）
    │
    └─→ UI 渲染
         ├─→ Chart（4×4 盘面）
         ├─→ CenterPanel（中宫信息）
         ├─→ HoroscopeBar（运限拨盘）
         └─→ LifeKline（K线图）
```

### AI 导出流程

```text
用户点击"复制给 AI"
    │
    ▼
组装导出载荷
    │
    ├─→ 元信息（meta）：流派/四化表/子时界/真太阳时口径
    ├─→ 十二宫星耀（含杂耀权重分档）
    ├─→ 结构分析层结果
    ├─→ 当前运限四化
    ├─→ 飞宫四化矩阵
    ├─→ 格局检测结果 + 赋文出处
    ├─→ 推理指引模板
    ├─→ 附录A：推理规则速查（knowledge.ts）
    └─→ 附录B：本盘四化全表
    │
    ▼
TOON 序列化（或 Markdown）
    │
    ▼
复制到剪贴板 / 下载文件
```

### 大六壬排盘流程

```text
用户输入占事信息
    │
    ▼
calculateDaLiuRen()
    │
    ├─→ 排盘（三传四课/天地盘）
    ├─→ 神煞系统
    ├─→ 六亲系统
    ├─→ 旺衰判断
    ├─→ 课经判断
    └─→ 毕法赋
    │
    ▼
DaLiuRenResult（完整卦象）
    │
    ├─→ 存入 IndexedDB（daliurenDb）
    └─→ UI 渲染（LiurenChart）
```

## 核心模块详解

### useZwds.ts — 排盘主 Hook

**职责**：管理排盘的全部状态与计算。

**输入**：`BirthInput`（姓名/性别/日期/时辰/流派/真太阳时等）

**输出**：`Zwds` 对象，包含：

- `astrolabe` — iztro 本命盘
- `horoscope` — 运限数据
- `visible` — 各运限级别可见状态
- `pick` — 当前拨盘选中状态
- `actions` — 状态修改方法

**关键决策**：

- 流派切换时自动设置四化表（iztro 全局配置，粘性——undefined 不清除残留）
- 拨盘状态通过 `PickState` 管理（年月日时+闰月标志）
- `DEFAULT_BIRTH_INPUT` 作为旧存档的字段补齐兜底

### analysis.ts — 结构分析层

**职责**：把斗数推理中"机械且 AI 最易出错"的中间步骤确定性算好。

**核心函数**：

- `getSanfangSnapshots()` — 十二宫各一行三方四正汇总
- `getFlyMatrix()` — 十二宫宫干四化互飞（12x4 矩阵）
- `getJiaGong()` — 夹宫关系（左右/昌曲/魁钺/日月/羊陀等八类）
- `traceMutagenChains()` — 四化传导链（禄忌两转三转）
- `getBorrowedStars()` — 空宫借星标注
- `analyzeChart()` — 聚合门面，一次调用产出全部分析结果
- `getChartDataForScope()` — 按运限级别提取盘面数据

**设计原则**：

- 全部只读本命盘（Astrolabe），不依赖运限状态
- 各函数接受可选共享索引（`ChartIndex`），整盘建一次向下传
- 格局检测（`patterns.ts`）和索引原语（`chartIndex.ts`）拆为独立模块，由 analysis 聚合再导出

### lifeKline.ts — 人生K线引擎

**职责**：为十二宫各生成一条 0-100 评分 K 线。

**方法论**（三合派口径）：

- 每域独立评分（本宫x1.0 + 对宫x0.6 + 三合x0.4）
- 区分"进"与"出"两股动能
- 逐年叠加：大限四化 + 流年四化 + 流曜 + 小限 + 叠象
- 月K线下钻（闰年 13 根含闰月位）

**关键决策**：

- K线量化数据仅盘面展示，不随 AI 导出（避免自定分值被 AI 误引）
- 忌按专用落位权重：入本宫x1.0 / 落对宫=冲x0.9 / 三合x0.4
- 双忌叠加非线性放大 35%

### patterns.ts — 格局检测

**职责**：检测本命格局（~45 个经典格局）与运限格局扫描。

**本命格局**：紫府同宫/君臣庆会/机月同梁/阳梁昌禄/火贪铃贪/羊陀夹忌/三奇加会/明珠出海等，含成格瑕疵判定与古籍赋文出处。

**运限格局**：以当前大限/流年命宫三方为中心，扫描八类运限格局。

### exportData.ts — AI 导出

**职责**：统一处理紫微斗数、大六壬、知识库三类数据的导出。

**支持格式**：

- **Markdown（MD）**：可读性最佳，适合 AI 输入或阅读
- **TOON**：紧凑格式，较 JSON 省约 70% token
- **JSON**：结构化备份，可再导入

**口径约定**（与 CLAUDE.md 一致）：

- AI 导出不携带人生K线量化数据（含月K线、十年规划表的均值/高光/低谷列）
- 流日/流时默认不随导出（择日/择时场景由 UI 勾选附加）
- 小限保留导出但带口径备注（辅助年系统，勿与流年混同）
- 杂耀带 weight 权重档（中=可参与断事，低=仅叠加参考，名单见 `ADJ_MID_WEIGHT`）

### globalSearch.ts — 全局搜索

**职责**：为命令面板提供搜索能力。

**匹配能力**：

- 模糊匹配（大小写不敏感 + 中文字符子串）
- 拼音匹配（全拼 / 首字母，缓存转换结果）
- 正则匹配（`/pattern/flags` 语法）

**搜索语法**：

- `type:person|liuren|wiki|action` 限制类型
- `tag:xxx` 限制标签（多次出现取交集）
- `after:YYYY-MM-DD` / `before:YYYY-MM-DD` 限制时间
- `-keyword` 排除关键词

### sync.ts — 多设备同步

**职责**：实现跨设备数据迁移（方案 C：导出/导入 + 端到端加密）。

**设计思路**：

- 将 IndexedDB 全部数据（人物、六壬、Wiki）打包为 JSON 快照
- 可选用密码派生 AES-GCM 密钥加密（PBKDF2-SHA256）
- 生成可分享的同步链接（URL 哈希携带密文，纯客户端，不上传服务器）
- 在另一设备打开链接即可还原数据（覆盖或合并）

**安全约定**：

- 密码不传输、不存储；仅作为密钥派生材料
- 每次加密使用随机 salt + iv，相同密码不同密文
- 无密码模式下为明文 Base64（便于调试，不推荐用于敏感数据）

### shortcuts.ts — 全局快捷键

**职责**：注册/管理模式的全局键盘快捷键系统。

**设计**：

- 组件挂载时注册、卸载时自动注销
- 后注册的快捷键优先匹配（页面快捷键优先于全局快捷键）
- 输入框（input/textarea/select/contenteditable）中的按键不触发
- 无修饰键的定义自动允许 Shift（因 Shift 只改变字符大小写/符号）

**API**：

- `registerShortcut(def)` — 注册单个快捷键，返回注销函数
- `registerShortcuts(defs)` — 批量注册
- `getRegisteredShortcuts()` — 获取所有已注册快捷键（帮助弹窗用）

### personDb.ts — 数据层

**职责**：Dexie.js 封装 IndexedDB，管理三种实体。

**数据库版本**：

- v1：人物库
- v2：+ 大六壬起课记录
- v3：+ Wiki 文档 + Wiki 链接关系

**索引设计**：

- `persons`: `++id, savedAt, isDefault`
- `liurenRecords`: `++id, personId, savedAt, calculationTime, *tags`
- `wikiDocs`: `++id, personId, savedAt, updatedAt, *tags`
- `wikiLinks`: `++id, sourceDocId, targetDocId`

## 样式架构

样式文件按职责拆分，全部原生 CSS（无预处理器/UI 框架）：

```text
src/styles/
├── base.css         # CSS 变量、重置、全局排版
├── layout.css       # 页面布局（Header/主区域/底部面板）
├── components.css   # 通用组件（Dialog/Button/徽章等）
├── ziwei.css        # 紫微盘面专用样式
├── daliuren.css     # 大六壬盘面专用样式
└── wiki.css         # Wiki 页面专用样式
```

主题变量集中在 `base.css`，支持亮/暗双主题（`data-theme` 属性切换）。

## 路由与页面加载

```text
/          → ZiweiPage     （直接加载，首屏关键路径）
/liuren    → DaLiuRenPage  （React.lazy 懒加载）
/wiki      → WikiPage      （React.lazy 懒加载）
*          → 重定向到 /
```

大六壬和 Wiki 页面使用 `React.lazy` + `Suspense` 懒加载，减少首屏 bundle 体积。

## 调试架构

开发环境下 `window.peep` 暴露调试 API（详见 [debug-api.md](debug-api.md)）：

```text
App.tsx (initDebugApi)
    │
    ├─→ ZiweiPage (registerZiWeiCallbacks)
    ├─→ DaLiuRenPage (registerDaLiuRenCallbacks)
    └─→ WikiPage (registerWikiCallbacks)
```

各页面挂载时注册回调，调试方法通过回调与 React 状态交互。支持跨页面导航（自动跳转 + 等待回调就绪）。

## 知识体系（三层）

```text
L1 推理规则速查    knowledge.ts      结构化 checklist，随导出附给 AI
L2 格局赋文        patterns.ts       格局检测命中时附带古籍出处
L3 公版赋文库      docs/kb/          二十篇紫微古籍繁体原文
```

## 关键技术决策

### 为什么不使用 react-iztro

react-iztro 提供的组件风格与本项目设计目标（文墨天机 APP 风格、深空霓虹主题）不兼容。直接使用 iztro 的底层计算 API，UI 层完全自研，获得完全的视觉控制权。

### 为什么 lunar-lite 部分走 lunar-typescript 兜底

lunar-lite 0.2.x 的 `getTotalDaysOfLunarMonth` / `getLeapMonth` / `getLeapDays` 引用了不存在的 `LUNAR_INFO` 常量，调用必抛错。月天数与闰月一律走底层依赖 lunar-typescript 计算。

### 为什么 K 线数据不随 AI 导出

自定分值（0-100 评分）是辅助可视化的简化工具，不是命理定论。AI 可能将这些分值当作精确结论引用，导致误报。K 线仅用于盘面展示辅助人眼判断。

### 为什么用 TOON 格式而非纯 JSON

TOON（`@toon-format/toon`）是紧凑的数据序列化格式，相同数据较 JSON 省约 70% token。在 AI 导出场景下，token 用量直接影响成本和上下文窗口利用率。

### 为什么四化表跟随 iztro 全局配置

iztro 的四化表通过全局 `config` 设置，具有粘性——设为 undefined 不会清除残留，会静默沿用上一张盘的四化表。因此流派切换时必须显式设置新表，`DEFAULT_BIRTH_INPUT` 作为旧存档缺失字段的兜底。
