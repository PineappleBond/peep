/**
 * Wiki（知识库）Function 定义
 *
 * 命理知识库管理，存储学习笔记、格局解析、案例分析等 Markdown 文档。
 */
import { withMeta, z } from "@rtc-agent/component";
import { CONFIRM_FIELD, peepApi, needsConfirm, extractConfirmed } from "./shared";

/* ---- 共享文档 Schema ---- */

const _docSchema = z.object({
  personId: z.number().describe("命主 ID"),
  title: z.string().describe("文档标题"),
  content: z.string().describe("Markdown 正文内容"),
  tags: z.array(z.string()).describe("标签列表"),
  savedAt: z.number().describe("首次保存时间戳（毫秒）"),
  updatedAt: z.number().describe("最后更新时间戳（毫秒）"),
  id: z.number().describe("文档 ID"),
});

const _docWithLinksSchema = _docSchema.extend({
  linkTargetIds: z.array(z.number()).describe("关联文档 ID 列表"),
});

/* ---- Function 定义 ---- */

export const wikiListFunction = {
  name: "WikiList",
  description:
    "查询 Wiki 文档列表，可按关键字、标签过滤并分页。" +
    "\n\n" +
    "使用场景：" +
    "(1) 查看知识库中的文档列表；" +
    "(2) 搜索特定主题的文档——如搜索'紫微'找到所有相关文档；" +
    "(3) 按标签过滤——如只查看'格局'类文档。" +
    "\n\n" +
    "Wiki 用于存储命理知识、学习笔记、案例分析等 Markdown 文档。如需查看某篇文档的完整内容，请调用 WikiView。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    searchText: withMeta(z.string(), { example: "紫微" })
      .optional()
      .describe("搜索关键字——匹配标题或正文"),
    tags: z.array(z.string()).optional().describe("按标签过滤——只返回包含指定标签的文档"),
    page: withMeta(z.number().int().positive(), { example: 1 }).optional().describe("页码，默认 1"),
    pageSize: withMeta(z.number().int().positive(), { example: 20 })
      .optional()
      .describe("每页条数，默认 20"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = wikiListFunction.zodSchema.parse(args);
    return peepApi().WikiList(parsedArgs);
  },
  returns: {
    zodSchema: z.object({
      docs: z.array(_docSchema).describe("文档列表"),
      total: z.number().describe("文档总数"),
    }),
  },
};

export const wikiCreateFunction = {
  name: "WikiCreate",
  description:
    "创建一篇 Wiki 文档（Markdown 正文），可设置标签与关联文档。" +
    "\n\n" +
    "⚠️ 安全机制：首次调用会返回操作摘要（不执行创建），" +
    "你需要将摘要展示给用户并获得确认后，再次调用并传入 confirmed: true 才会真正创建。" +
    "\n\n" +
    "使用场景：" +
    "(1) 记录命理知识学习笔记；" +
    "(2) 保存案例分析文档；" +
    "(3) 整理格局、星曜等参考资料。" +
    "\n\n" +
    "文档支持 Markdown 格式，可设置标签便于检索，可通过 linkTargetIds 关联其他文档形成知识网络。" +
    "\n\n" +
    "示例：WikiCreate({ title: '紫府同宫格', content: '# 紫府同宫格\\n\\n紫府同宫是...', tags: ['格局', '紫微'] })。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    title: withMeta(z.string(), { example: "紫微斗数入门" }).describe("文档标题"),
    content: withMeta(z.string(), { example: "# 紫微斗数\n\n紫微斗数是..." }).describe(
      "Markdown 正文——支持标准 Markdown 语法",
    ),
    tags: z.array(z.string()).optional().describe("标签——用于分类检索，如 ['格局', '紫微']"),
    linkTargetIds: z
      .array(z.number().int().positive())
      .optional()
      .describe("关联文档 ID 列表——建立文档间的链接关系，形成知识网络"),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type CreateInput = z.infer<typeof wikiCreateFunction.zodSchema>;
    const parsedArgs = wikiCreateFunction.zodSchema.parse(args) as CreateInput;
    if (!parsedArgs.confirmed) {
      return needsConfirm(
        "创建 Wiki 文档",
        `即将创建文档：「${parsedArgs.title}」${parsedArgs.tags?.length ? `，标签：${parsedArgs.tags.join("、")}` : ""}`,
      );
    }
    const params = extractConfirmed(parsedArgs);
    return peepApi().WikiCreate(params);
  },
  returns: { zodSchema: _docSchema },
};

export const wikiUpdateFunction = {
  name: "WikiUpdate",
  description:
    "更新已有 Wiki 文档的标题、内容、标签或关联。" +
    "\n\n" +
    "⚠️ 安全机制：首次调用会返回操作摘要（不执行更新），" +
    "你需要将摘要展示给用户并获得确认后，再次调用并传入 confirmed: true 才会真正更新。" +
    "\n\n" +
    "使用场景：" +
    "(1) 修改文档标题或内容；" +
    "(2) 更新文档标签；" +
    "(3) 调整文档关联关系。" +
    "\n\n" +
    "所有字段都是可选的，只更新提供的字段。" +
    "\n\n" +
    "示例：WikiUpdate({ docId: 123, title: '新标题', tags: ['格局'] })。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    docId: withMeta(z.number().int().positive(), { example: 123 }).describe("要更新的文档 ID"),
    title: withMeta(z.string(), { example: "新标题" }).optional().describe("新标题（可选）"),
    content: withMeta(z.string(), { example: "# 更新后的内容\n\n..." })
      .optional()
      .describe("新 Markdown 正文（可选）"),
    tags: z.array(z.string()).optional().describe("新标签列表（可选，会替换原有标签）"),
    linkTargetIds: z
      .array(z.number().int().positive())
      .optional()
      .describe("新关联文档 ID 列表（可选，会替换原有关联）"),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type UpdateInput = z.infer<typeof wikiUpdateFunction.zodSchema>;
    const parsedArgs = wikiUpdateFunction.zodSchema.parse(args) as UpdateInput;
    if (!parsedArgs.confirmed) {
      const updates: string[] = [];
      if (parsedArgs.title) updates.push(`标题→"${parsedArgs.title}"`);
      if (parsedArgs.content) updates.push("内容已修改");
      if (parsedArgs.tags) updates.push(`标签→[${parsedArgs.tags.join(",")}]`);
      if (parsedArgs.linkTargetIds) updates.push(`关联→[${parsedArgs.linkTargetIds.join(",")}]`);
      return needsConfirm(
        "更新 Wiki 文档",
        `即将更新文档 #${parsedArgs.docId}：${updates.join("，") || "无修改"}`,
      );
    }
    const params = extractConfirmed(parsedArgs);
    return peepApi().WikiUpdate(params);
  },
  returns: { zodSchema: _docSchema },
};

export const wikiViewFunction = {
  name: "WikiView",
  description:
    "查看指定 Wiki 文档的完整内容。" +
    "\n\n" +
    "使用场景：从 WikiList 获取文档列表后，想深入阅读某篇文档的完整 Markdown 正文。" +
    "\n\n" +
    "返回数据包含文档标题、正文、标签、关联文档等信息。" +
    "\n\n" +
    "⚠️ 性能提示：如需查看多个文档，请使用 WikiBatchView 批量查看（减少 UI 操作次数，避免超时）。" +
    "\n\n" +
    "示例：WikiView({ docId: 456 }) — 查看 ID 为 456 的文档详情。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    docId: withMeta(z.number().int().positive(), { example: 456 }).describe(
      "文档 ID——从 WikiList 返回的 docs 中获取",
    ),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = wikiViewFunction.zodSchema.parse(args);
    return peepApi().WikiView(parsedArgs);
  },
  returns: { zodSchema: _docWithLinksSchema },
};

export const wikiBatchViewFunction = {
  name: "WikiBatchView",
  description:
    "批量查看多个 Wiki 文档的完整内容——一次调用查看多个文档，显著减少 UI 操作时间。" +
    "\n\n" +
    "使用场景：" +
    "(1) 需要对比多个文档内容时；" +
    "(2) 需要连续阅读多篇相关文档时；" +
    "(3) 避免因多次单独调用 WikiView 导致超时。" +
    "\n\n" +
    "⚠️ 与 WikiView 的区别：WikiBatchView 内部优化了 UI 操作——只在首次调用时导航页面和选择人物，" +
    "后续文档复用已加载的页面状态，因此查看多个文档时比多次调用 WikiView 快得多。" +
    "\n\n" +
    "示例：WikiBatchView({ docIds: [1, 2, 3, 4] }) — 批量查看 ID 为 1,2,3,4 的文档。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 })
      .optional()
      .describe("命主 ID（可选）；省略则使用默认人物"),
    docIds: z
      .array(z.number().int().positive())
      .min(1)
      .max(20)
      .describe("文档 ID 数组——要查看的文档 ID 列表，最多 20 个"),
  }),
  handler: async (args: Record<string, unknown>) => {
    const parsedArgs = wikiBatchViewFunction.zodSchema.parse(args);
    const results = [];
    for (const docId of parsedArgs.docIds) {
      const doc = await peepApi().WikiView({
        personId: parsedArgs.personId,
        docId,
      });
      results.push(doc);
    }
    return { docs: results, count: results.length };
  },
  returns: {
    zodSchema: z.object({
      docs: z.array(_docWithLinksSchema).describe("文档详情数组，每项同 WikiView 返回结构"),
      count: z.number().describe("文档数量"),
    }),
  },
};

/** Wiki 内容替换 */
export const wikiReplaceContentFunction = {
  name: "WikiReplaceContent",
  description:
    "替换 Wiki 文档内容中的字符串——支持单次替换或全局替换（Replace All）。" +
    "\n\n" +
    "使用场景：用户要求批量修改文档中的某个关键词或短语时使用。" +
    "\n\n" +
    "示例：WikiReplaceContent({ docId: 123, searchText: '旧文本', replaceText: '新文本', isGlobal: true }) — 全局替换。",
  zodSchema: z.object({
    docId: withMeta(z.number().int().positive(), { example: 123 }).describe(
      "文档 ID——从 WikiList 返回的 docs 中获取",
    ),
    searchText: z.string().describe("要搜索的文本"),
    replaceText: z.string().describe("替换后的文本"),
    isGlobal: z
      .boolean()
      .optional()
      .default(true)
      .describe("是否全局替换（默认 true，即 Replace All）"),
  }),
  handler: async (args: Record<string, unknown>) => {
    const params = wikiReplaceContentFunction.zodSchema.parse(args) as {
      docId: number;
      searchText: string;
      replaceText: string;
      isGlobal?: boolean;
    };
    return peepApi().WikiReplaceContent(params);
  },
  returns: {
    zodSchema: z
      .object({
        id: z.number().describe("文档 ID"),
        title: z.string().describe("文档标题"),
        content: z.string().describe("替换后的文档内容"),
        tags: z.array(z.string()).describe("标签列表"),
        updatedAt: z.number().describe("更新时间戳"),
      })
      .describe("更新后的文档"),
  },
};

/** Wiki 内容插入 */
export const wikiInsertContentFunction = {
  name: "WikiInsertContent",
  description:
    "在 Wiki 文档的指定位置插入内容——支持按行号插入、在文档开头插入或在文档结尾插入。" +
    "\n\n" +
    "使用场景：用户要求在文档的特定位置添加新内容时使用。" +
    "\n\n" +
    "示例：WikiInsertContent({ docId: 123, content: '## 新章节', position: 5 }) — 在第 5 行之前插入。" +
    "\n示例：WikiInsertContent({ docId: 123, content: '附录内容', position: 'end' }) — 在文档末尾追加。",
  zodSchema: z.object({
    docId: withMeta(z.number().int().positive(), { example: 123 }).describe(
      "文档 ID——从 WikiList 返回的 docs 中获取",
    ),
    content: z.string().describe("要插入的内容（支持 Markdown）"),
    position: z
      .union([z.number().int().positive(), z.enum(["start", "end"])])
      .optional()
      .default("end")
      .describe("插入位置：正整数=在该行之前插入（1-based），'start'=开头，'end'=结尾（默认）"),
  }),
  handler: async (args: Record<string, unknown>) => {
    const params = wikiInsertContentFunction.zodSchema.parse(args) as {
      docId: number;
      content: string;
      position?: number | "start" | "end";
    };
    return peepApi().WikiInsertContent(params);
  },
  returns: {
    zodSchema: z
      .object({
        id: z.number().describe("文档 ID"),
        title: z.string().describe("文档标题"),
        content: z.string().describe("插入后的文档内容"),
        tags: z.array(z.string()).describe("标签列表"),
        updatedAt: z.number().describe("更新时间戳"),
      })
      .describe("更新后的文档"),
  },
};
