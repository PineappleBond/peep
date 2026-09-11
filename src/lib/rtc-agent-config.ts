/**
 * rtc-agent 配置 - Zod 驱动版本
 *
 * 改进：
 * 1. 用 zodSchema 定义参数，组件自动校验和生成 OpenAPI
 * 2. 用 .describe() 添加描述，用 withMeta 添加示例
 * 3. 统一 ID 为自增整数（number）
 * 4. 精简到 14 个核心 function
 */

import { z, type ZodType } from 'zod';
import type { RtcAgentConfig } from '@/rtc-agent';
import {
  personAPI,
  documentAPI,
  folderAPI,
  tagAPI,
  baziAPI,
  ziweiAPI,
  liuyaoAPI,
} from './peep-api';
import { useLiuyaoRecordStore } from '@/stores/liuyaoRecordStore';
import { navigateTo } from './utils';
import { SCENARIO_IDS } from '@/modules/liuyao/core/scenarios/newRegistry';

// ── withMeta 辅助函数（从 web-components 复制） ──────

interface ZodMeta {
  example?: unknown;
  examples?: unknown[];
  format?: string;
}

/**
 * 为 Zod schema 附加 metadata（示例值等）
 *
 * 通过修改 _def.meta 实现，返回原 schema（链式调用友好）。
 * 注：Zod 原生不提供 .meta() API，此处通过内部 _def 注入。
 */
function withMeta<T extends ZodType>(schema: T, meta: ZodMeta): T {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Zod 内部 API
  const def = (schema as unknown as { _def: { meta?: ZodMeta } })._def;
  if (def) {
    def.meta = { ...def.meta, ...meta };
  }
  return schema;
}

/**
 * 安全解析 handler 参数：用 Zod schema 校验 Record<string, unknown>，返回强类型结果。
 *
 * 所有 rtc-agent handler 的入参都是 Record<string, unknown>，
 * 通过此函数统一校验并获取类型安全的输出，避免 handler 内部的 as any 断言。
 */
function parseParams<T>(schema: ZodType<T>, params: Record<string, unknown>): T {
  return schema.parse(params);
}

// ── 页面导航 ───────────────────────────────────────

/** 导航到指定路径（不等待渲染） */
const navigate = (path: string, search?: Record<string, string | number | undefined>) =>
  navigateTo(path, search, false);

// ── Zod Schema 定义 ────────────────────────────────

// Person
const personCreateSchema = z.object({
  name: withMeta(z.string().min(1, '姓名不能为空'), { example: '张三' })
    .describe('人物姓名，用于显示和搜索。建议使用真实姓名或常用称呼。'),
  gender: withMeta(z.enum(['male', 'female'], { message: '性别必须是 male 或 female' }), { example: 'male' }).describe('性别，影响大运排法。male: 男性（男命），female: 女性（女命）。'),
  birthDate: withMeta(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '出生日期格式必须是 YYYY-MM-DD'), { example: '1990-01-01' })
    .describe('出生日期，ISO 8601 格式（YYYY-MM-DD）。例如：1990-01-01。'),
  birthTime: withMeta(z.string().optional(), { example: '14:30' })
    .describe('出生时辰，可选。支持两种格式：24小时制时间（如 14:30）或时辰名称（如 子时）。'),
  isLunar: withMeta(z.boolean().default(false), { example: false })
    .describe('出生日期是否为农历。false（默认）：公历；true：农历。'),
  note: z.string().optional().describe('备注信息，可选。支持 Markdown 格式。'),
});

const personGetSchema = z.object({
  id: withMeta(z.number().int().positive('ID 必须是正整数'), { example: 1 })
    .describe('人物 ID（正整数）'),
});

const personListSchema = z.object({
  search: withMeta(z.string().optional(), { example: '张' })
    .describe('搜索关键词，按姓名模糊匹配。'),
});

// Folder
const folderCreateSchema = z.object({
  title: withMeta(z.string().min(1, '文件夹标题不能为空'), { example: '八字学习' })
    .describe('文件夹标题（不能为空）'),
  parentFolderId: withMeta(z.number().int().positive().optional(), { example: 1 })
    .describe('父文件夹 ID，不传则为根级'),
});

const folderListSchema = z.object({}).optional();

// Document
const documentCreateSchema = z.object({
  type: withMeta(z.enum(['recall', 'diary', 'notes'], { message: '文档类型必须是 recall/diary/notes' }), { example: 'recall' }).describe('文档类型：recall（回忆录）/ diary（日记）/ notes（笔记）'),
  title: withMeta(z.string().optional(), { example: '我的第一篇日记' })
    .describe('文档标题，可选'),
  content: withMeta(z.string().optional(), { example: '## 今日感悟\n\n今天学到了很多...' })
    .describe('文档内容，支持 Markdown，可选'),
  personId: withMeta(z.number().int().positive().optional(), { example: 1 })
    .describe('关联的人物 ID，可选'),
  folderId: withMeta(z.number().int().positive().optional(), { example: 1 })
    .describe('关联的文件夹 ID，可选'),
  tags: withMeta(z.array(z.string()).optional(), { example: ['八字', '学习'] })
    .describe('标签列表，可选'),
});

const documentListSchema = z.object({
  type: withMeta(z.enum(['recall', 'diary', 'notes']), { example: 'recall' })
    .describe('文档类型：recall / diary / notes'),
  personId: withMeta(z.number().int().positive().optional(), { example: 1 })
    .describe('按人物 ID 筛选，可选'),
  search: withMeta(z.string().optional(), { example: '运势' })
    .describe('搜索关键词，可选'),
});

const documentViewSchema = z.object({
  id: withMeta(z.number().int().positive('文档 ID 必须是正整数'), { example: 1 })
    .describe('文档 ID（正整数）'),
});

// Tag
const tagListSchema = z.object({}).optional();

// Bazi
const baziChartSchema = z.object({
  personId: withMeta(z.number().int().positive('人物 ID 必须是正整数'), { example: 1 })
    .describe('人物 ID'),
  level: withMeta(z.enum(['dayun', 'liunian', 'liuyue', 'liuri', 'liushi'], { message: '层级必须是 dayun/liunian/liuyue/liuri/liushi' }), { example: 'liuri' }).describe('分析层级：dayun（大运）/ liunian（流年）/ liuyue（流月）/ liuri（流日）/ liushi（流时）'),
  datetime: withMeta(z.string().min(1, '时间不能为空'), { example: '2026-09-11H12' })
    .describe('指定时间，格式: YYYY-MM-DDHhh（如 2026-09-11H12 表示 2026年9月11日12时）。系统会自动计算该时间对应的大运、流年、流月、流日、流时。'),
});

// Ziwei
const ziweiChartSchema = z.object({
  personId: withMeta(z.number().int().positive('人物 ID 必须是正整数'), { example: 1 })
    .describe('人物 ID'),
  level: withMeta(z.enum(['dayun', 'liunian', 'liuyue', 'liuri', 'liushi'], { message: '层级必须是 dayun/liunian/liuyue/liuri/liushi' }), { example: 'liuyue' }).describe('分析层级'),
  datetime: withMeta(z.string().min(1, '时间不能为空'), { example: '2026-09-11H12' })
    .describe('指定时间，格式: YYYY-MM-DDHhh'),
});

// Liuyao
const liuyaoCreateSchema = z.object({
  question: withMeta(z.string().optional(), { example: '今年的运势如何？' })
    .describe('占问的问题，可选但建议填写'),
  background: withMeta(z.string().optional(), { example: '最近工作上遇到了一些选择...' })
    .describe('占问的背景信息，可选'),
  scenarioId: withMeta(z.enum(SCENARIO_IDS as [string, ...string[]]).optional(), { example: 'other' })
    .describe(`占问场景：${SCENARIO_IDS.join(' / ')}，默认 other`),
  personId: withMeta(z.number().int().positive().optional(), { example: 1 })
    .describe('关联的人物 ID，可选'),
  personName: withMeta(z.string().optional(), { example: '张三' })
    .describe('关联的人物姓名，可选'),
});

const liuyaoGetSchema = z.object({
  id: withMeta(z.number().int().positive('记录 ID 必须是正整数'), { example: 1 })
    .describe('记录 ID（正整数）'),
  granularity: withMeta(z.enum(['year', 'month', 'day', 'hour']).optional(), { example: 'hour' })
    .describe('查看粒度：year/month/day/hour，默认 year。可选'),
});

const liuyaoListSchema = z.object({
  personId: withMeta(z.number().int().positive().optional(), { example: 1 })
    .describe('按人物 ID 筛选，可选'),
});

// ── Persona ────────────────────────────────────────

let personaContent: string | null = null;

export async function loadPersona(): Promise<string> {
  if (personaContent) return personaContent;

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}rtc-agent/AGENT.md`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    personaContent = await response.text();
    return personaContent;
  } catch (error) {
    console.warn('[rtc-agent] Failed to load AGENT.md, using default persona:', error);
    personaContent = getDefaultPersona();
    return personaContent;
  }
}

function getDefaultPersona(): string {
  return `# Peep 国学命理助手

## 你的身份

- **姓名**：命理师
- **专业**：八字命理、紫微斗数、六爻占卜
- **风格**：温和、专业、客观、建设性
- **语言**：用通俗语言解释专业术语

## ⚡ 启动流程（每次收到用户请求时必须执行）

**收到用户请求后，在回应任何内容之前，必须按顺序执行以下步骤。禁止跳过任何步骤。**

1. **检查场景文档**：\`ls("/scenarios")\` 查看可用场景
2. **匹配并加载**：如果用户的请求涉及分析、解读、预测等多步骤任务，必须 \`read\` 对应的场景文档
3. **读取函数索引**：\`read("/functions/INDEX.md")\` 获取最新的函数签名（如已在上下文中则跳过）
4. **按场景执行**：严格遵循场景文档中的阶段流程，不要自由发挥

> **⚠️ 这是强制流程。** 不要凭记忆判断"这个任务不需要场景文档"。先 ls，再判断，再执行。

**不需要场景文档的简单操作**：创建人物、打开列表页、查询单条记录、更新信息。其他所有任务都应该先检查场景。

## 核心原则

1. **尊重隐私** — 只收集分析所需信息
2. **客观中立** — 不夸大吉凶，提供平衡视角
3. **教育性** — 解释命理概念，不只给结论
4. **专业性** — 基于传统理论，有理有据
5. **诚实承认局限** — 不知道就说不知道，不猜测、不套用

## ⚠️ 工具使用铁律

### 1. 使用 script 前，必读 /functions/INDEX.md

你所有业务操作（人物、日记、排盘、起卦...）都通过 \`script\` 工具执行 TypeScript 代码完成。

**调用 \`script\` 前，必须先 \`read("/functions/INDEX.md")\`** 获取最新的函数签名和参数说明。

\`/functions/INDEX.md\` 是自动生成的唯一真相源，函数名、参数名、返回类型均以它为准。不要凭记忆调用。

### 2. 参数校验

所有参数都会经过严格校验。如果参数有问题，会返回详细的错误信息，并引导你读取 /functions/INDEX.md。

### 3. 场景文档

详见顶部 **⚡ 启动流程**。场景文档是多步骤任务的操作手册，必须按阶段执行，不允许跳过。

### 4. 回忆录：早期读取

如果系统中有用户回忆录（memoir），在进行命理分析前应先读取，了解用户背景、关注点、历史事件。

**不要等到分析后再读回忆录** — 不了解背景的分析等于盲人摸象。

## ⚠️ 分析铁律（核心约束）

### 1. 信息不足时必须先问

在掌握足够背景信息之前，**禁止给出分析结论**。

**判断标准**：如果用户问"某天的运势"，你至少需要知道：

- 用户关心什么（财运？感情？事业？健康？）
- 是否有已知事件（面试、约会、重要决策）
- 回忆录中是否有相关信息

**行为规范**：

- ❌ 错误：信息不足就直接"分析"
- ✅ 正确：先用 \`ask_user\` 补充必要信息

### 2. 禁止事后套用

**铁律**：先独立推导，再等用户验证；知道结果后，不能用同样的信号解释不同的结果。

**示例**：

- ❌ 错误：用户说"那天破财了"，然后从命盘里找"破财信号"
- ✅ 正确：先看命盘推断"可能破财"，再问用户验证

### 3. 承认局限，用词克制

**禁止使用的词**：一定、必然、肯定、绝对
**推荐使用的词**：可能、倾向、暗示、建议关注

**示例**：

- ❌ 错误："你明天一定会破财"
- ✅ 正确："从命盘看，明天财星受冲，建议谨慎理财"

### 4. 命理能看趋势，不能断言具体事件

**可以说的**：

- 运势起伏趋势（上升/下降/波动）
- 需要注意的领域（财运、感情、健康）
- 建议的行动方向（保守/进取/观望）

**不能说的**：

- 具体会发生什么事（"你会被车撞"）
- 具体时间点的确定性结果（"下午3点必然破财"）
- 无法验证的断言（"你前世是..."）

## 基础工具一览

你只有以下基础工具：

- \`ls\` / \`find\` / \`grep\` — 探索文件结构
- \`read\` — 读取文件（场景文档、INDEX.md、用户文档、回忆录）
- \`write\` — 写入文件
- \`script\` — 执行 TypeScript 代码调用业务函数（**先读 INDEX.md**）
- \`ask_user\` — 向用户提问（**信息不足时必须使用**）
- \`sub_agent\` — 调度专家子代理

## 结语

作为命理助手，你的目标是帮助用户理解自己、规划未来、学习国学。

**记住**：承认不知道，比给出错误答案更有价值。
`;
}

// ── 主配置 ─────────────────────────────────────────

export async function createRtcAgentConfig(): Promise<RtcAgentConfig> {
  const persona = await loadPersona();

  return {
    name: 'Peep',
    description: 'Peep - 国学命理助手（八字、紫微、六爻）',
    persona,
    groups: [
      // ========== 人物管理 ==========
      {
        name: 'person',
        description: `人物管理 - 管理命理分析的主体。

人物是命理分析的核心，每个人物包含：
- 姓名、性别
- 出生日期和时辰（影响八字、紫微排盘）
- 是否农历（系统自动转换）

使用场景：
- "帮我创建一个新人物"
- "查看张三的详细信息"
- "更新我的出生时辰"`,
        functions: [
          {
            name: 'create',
            description: '创建新的人物记录，并跳转到人物详情页',
            zodSchema: personCreateSchema,
            handler: async (params) => {
              const input = parseParams(personCreateSchema, params);
              const person = await personAPI.create(input);
              // 跳转到人物列表页并选中该人物
              navigate('/persons', { personId: person.id });
              return person;
            },
          },
          {
            name: 'get',
            description: '根据 ID 获取人物的详细信息，并跳转到人物详情页',
            zodSchema: personGetSchema,
            handler: async (params) => {
              const { id } = parseParams(personGetSchema, params);
              const person = await personAPI.get(id);
              if (person) {
                navigate('/persons', { personId: id });
              }
              return person;
            },
          },
          {
            name: 'list',
            description: `获取人物列表，并跳转到人物列表页面。

支持按姓名模糊搜索，方便查找特定人物。`,
            zodSchema: personListSchema,
            handler: async (params) => {
              const opts = parseParams(personListSchema, params);
              // 跳转到人物列表页
              navigate('/persons', opts.search ? { search: opts.search } : undefined);
              return personAPI.list(opts);
            },
          },
        ],
      },

      // ========== 文件夹 ==========
      {
        name: 'folder',
        description: `文件夹管理 - 组织文档的目录结构。

支持多级嵌套，形成树形结构：
- 创建根级或子文件夹
- 重命名文件夹
- 移动文件夹（改变父文件夹）

使用场景：
- "创建一个'八字学习'文件夹"
- "把这个文档移到'紫微斗数'文件夹"`,
        functions: [
          {
            name: 'create',
            description: '创建新的文件夹，并跳转到文档管理页面',
            zodSchema: folderCreateSchema,
            handler: async (params) => {
              const { title, parentFolderId } = parseParams(folderCreateSchema, params);
              const folder = await folderAPI.create(title, parentFolderId ?? null);
              navigate('/documents');
              return folder;
            },
          },
          {
            name: 'list',
            description: '获取所有文件夹列表，并跳转到文档管理页面',
            zodSchema: folderListSchema,
            handler: async () => {
              navigate('/documents');
              return folderAPI.list();
            },
          },
        ],
      },

      // ========== 文档 ==========
      {
        name: 'document',
        description: `文档管理 - 统一管理回忆录、日记、笔记。

三种文档类型：
- recall: 回忆录（记录过往经历和重要事件）
- diary: 日记（每日记录和生活随笔）
- notes: 笔记（学习笔记和心得总结）

使用场景：
- "帮我创建一个回忆录"
- "查看我的日记列表"
- "打开这篇笔记"`,
        functions: [
          {
            name: 'create',
            description: '创建新的文档，并跳转到编辑页面',
            zodSchema: documentCreateSchema,
            handler: async (params) => {
              const { type, title, content, personId, folderId, tags } = parseParams(documentCreateSchema, params);
              const typeAPI = documentAPI[type];
              const id = await typeAPI.create({ title, content, personId, folderId, tags });
              navigate(`/documents/edit/${id}`);
              return id;
            },
          },
          {
            name: 'list',
            description: '获取文档列表，并跳转到文档列表页面',
            zodSchema: documentListSchema,
            handler: async (params) => {
              const { type, personId, search } = parseParams(documentListSchema, params);
              const typeAPI = documentAPI[type];
              navigate(`/documents/${type}`, { personId, search });
              return typeAPI.list({ personId, search });
            },
          },
          {
            name: 'view',
            description: '查看文档详情并跳转到编辑页面',
            zodSchema: documentViewSchema,
            handler: async (params) => {
              const { id } = parseParams(documentViewSchema, params);
              const doc = await documentAPI.get(id);
              if (doc) {
                navigate(`/documents/edit/${id}`);
              }
              return doc;
            },
          },
        ],
      },

      // ========== 标签 ==========
      {
        name: 'tag',
        description: `标签管理 - 文档的分类系统。

标签比文件夹更灵活，一个文档可以有多个标签。

常用标签示例：八字、紫微、六爻、学习、案例`,
        functions: [
          {
            name: 'list',
            description: '获取所有标签及其使用次数，并跳转到文档管理页面',
            zodSchema: tagListSchema,
            handler: async () => {
              // 跳转到文档管理页面
              navigate('/documents');
              return tagAPI.list();
            },
          },
        ],
      },

      // ========== 八字排盘 ==========
      {
        name: 'bazi',
        description: `八字排盘 - 四柱八字命理分析。

八字即四柱（年柱、月柱、日柱、时柱），每柱由天干地支组成。

功能：
- 根据人物生辰自动排盘
- 显示日主（命主本人）
- 支持大运、流年、流月、流日、流时分析

使用前提：必须先创建人物并填写生辰信息。`,
        functions: [
          {
            name: 'chart',
            description: `根据人物的生辰信息进行八字排盘。

参数说明：
- personId: 人物 ID
- level: 分析层级（dayun/liunian/liuyue/liuri/liushi）
- datetime: 指定时间，格式 YYYY-MM-DDHhh（如 2026-09-11H12）

层级说明：
- dayun: 大运（10年一运）- 系统根据 datetime 自动定位
- liunian: 流年（1年）- 包含大运 + 流年
- liuyue: 流月（1个月）- 包含大运 + 流年 + 流月
- liuri: 流日（1天）- 包含大运 + 流年 + 流月 + 流日
- liushi: 流时（2小时）- 包含全部五级

返回：四柱 + 大运 + 流年 + 流月 + 流日 + 流时（根据 level 自动包含）`,
            zodSchema: baziChartSchema,
            handler: async (params) => {
              const { personId, level, datetime } = parseParams(baziChartSchema, params);
              const result = await baziAPI.chart(personId, { level, datetime });
              navigate('/', { tab: 'bazi', personId });
              return result;
            },
          },
        ],
      },

      // ========== 紫微斗数 ==========
      {
        name: 'ziwei',
        description: `紫微斗数 - 紫微斗数命理分析。

紫微斗数以命宫为核心，配合十二宫进行解读：
- 命宫：代表命主本人的性格、天赋
- 身宫：代表后天运势、行为模式
- 十二宫：命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、事业、田宅、福德、父母

使用前提：必须先创建人物并填写生辰信息。`,
        functions: [
          {
            name: 'chart',
            description: `根据人物的生辰信息进行紫微斗数排盘。

参数说明同 bazi.chart。

返回：四柱 + 大运 + 流年 + 流月（根据 level 自动包含）`,
            zodSchema: ziweiChartSchema,
            handler: async (params) => {
              const { personId, level, datetime } = parseParams(ziweiChartSchema, params);
              const result = await ziweiAPI.chart(personId, { level, datetime });
              navigate('/', { tab: 'ziwei', personId });
              return result;
            },
          },
        ],
      },

      // ========== 六爻起卦 ==========
      {
        name: 'liuyao',
        description: `六爻起卦 - 中国传统占卜方法。

六爻通过掷卦得到六个爻（0-3），形成卦象进行解读：
- 0: 老阴（变爻）
- 1: 少阳
- 2: 少阴
- 3: 老阳（变爻）

使用场景：
- "帮我起一卦，问今年的运势"
- "掷卦"（随机生成）`,
        functions: [
          {
            name: 'create',
            description: '创建新的六爻起卦记录，系统自动随机起卦，并跳转到六爻详情页',
            zodSchema: liuyaoCreateSchema,
            handler: async (params) => {
              const { question, background, scenarioId, personId, personName } = parseParams(liuyaoCreateSchema, params);
              const lines = liuyaoAPI.tossHexagram();
              const id = await liuyaoAPI.create({
                lines,
                question,
                background,
                scenarioId,
                personId,
                personName,
              });
              useLiuyaoRecordStore.getState().setSelectedRecord(id);
              navigate('/', { tab: 'liuyao' });
              const record = await liuyaoAPI.get(id);
              return record;
            },
          },
          {
            name: 'get',
            description: '获取六爻记录的详细信息，并跳转到六爻详情页',
            zodSchema: liuyaoGetSchema,
            handler: async (params) => {
              const { id, granularity } = parseParams(liuyaoGetSchema, params);
              const record = await liuyaoAPI.get(id, granularity);
              if (record) {
                useLiuyaoRecordStore.getState().setSelectedRecord(id);
                navigate('/', { tab: 'liuyao' });
              }
              return record;
            },
          },
          {
            name: 'list',
            description: '获取六爻记录列表，并跳转到六爻列表页面',
            zodSchema: liuyaoListSchema,
            handler: async (params) => {
              const { personId } = parseParams(liuyaoListSchema, params);
              navigate('/', { tab: 'liuyao', personId });
              return liuyaoAPI.list({ personId });
            },
          },
        ],
      },
    ],
  };
}
