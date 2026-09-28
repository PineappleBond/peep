/**
 * 人物库（Person）Function 定义
 *
 * 命主档案增删改查，是所有分析的前提。
 */
import { withMeta, z } from "@rtc-agent/component";
import {
  CONFIRM_FIELD,
  PERSON_ID_OPTIONAL,
  mergeBirthInput,
  peepApi,
  needsConfirm,
  extractConfirmed,
} from "./shared";

/* ---- 共享 Schema ---- */

/** Person 基础信息 schema——PersonList 和 PersonGet 共用 */
const _personReturnSchema = z.object({
  id: z.number().describe("人物ID"),
  name: z.string().describe("姓名"),
  gender: z.string().describe("性别"),
  calendar: z.string().describe("历法类型：solar(公历) 或 lunar(农历)"),
  date: z.string().describe("出生日期，格式 YYYY-MM-DD"),
  timeIndex: z.number().describe("时辰索引 0-12，0=早子时(23-1点)，12=晚子时(23-24点)"),
  isLeapMonth: z.boolean().describe("是否农历闰月"),
  exactTime: z.string().describe("精确时间（时分）"),
  useTrueSolar: z.boolean().describe("是否使用真太阳时"),
  placeMode: z.string().describe("地点模式"),
  province: z.string().describe("省份"),
  city: z.string().describe("城市"),
  district: z.string().describe("区县"),
  timezone: z.string().describe("时区"),
  algorithm: z.string().describe("排盘算法"),
  yearDivide: z.string().describe("年分割方式"),
  mutagenTable: z.string().describe("四化表"),
  dayDivide: z.string().describe("日分割方式"),
  astroType: z.string().describe("星系类型"),
  residence: z.string().describe("居住地"),
  isDefault: z.boolean().describe("是否为默认人物"),
  savedAt: z.number().describe("保存时间戳（毫秒）"),
});

export const personListFunction = {
  name: "PersonList",
  description:
    "列出所有人物（命主档案），返回每人 id、姓名、生年、性别等基本信息。" +
    "使用场景：查看当前有哪些命主可供分析，或获取命主 ID 以便调用其他接口。" +
    "示例调用：PersonList() 返回所有人物列表。",
  zodSchema: z.object({}),
  handler: () => peepApi().PersonList(),
  returns: {
    zodSchema: z.array(_personReturnSchema),
  },
};

export const personGetFunction = {
  name: "PersonGet",
  description:
    "获取单个人物的完整出生信息，包括姓名、公历/农历日期、时辰、性别、历法、是否闰月等。" +
    "使用场景：在分析前确认命主的详细出生信息，或获取命主的高级设置（如流派、四化表）。" +
    "省略 personId 时返回默认人物。" +
    "示例调用：PersonGet({ personId: 1 }) 获取 ID 为 1 的人物详情。",
  zodSchema: z.object({
    personId: PERSON_ID_OPTIONAL,
  }),
  handler: (args: Record<string, unknown>) => {
    const input = personGetFunction.zodSchema.parse(args);
    return peepApi().PersonGet(input.personId);
  },
  returns: {
    zodSchema: _personReturnSchema,
  },
};

export const personCreateFunction = {
  name: "PersonCreate",
  description:
    "创建新的命主人物档案并自动切换为该人物。" +
    "⚠️ 安全机制：首次调用会返回操作摘要（不执行创建），" +
    "你需要将摘要展示给用户并获得确认后，再次调用并传入 confirmed: true 才会真正创建。" +
    "使用场景：当用户提到新的出生信息需要分析，但当前人物列表中不存在时使用。" +
    "示例调用：PersonCreate({ name: '张三', date: '1990-05-15', timeIndex: 4, gender: '男' })。" +
    "注意：AI 只需提供核心出生信息，其余高级设置（真太阳时、流派等）使用默认值。",
  zodSchema: z.object({
    name: withMeta(z.string(), { example: "张三" }).describe("姓名"),
    date: withMeta(z.string(), { example: "1990-05-15" }).describe("公历出生日期，格式 YYYY-MM-DD"),
    timeIndex: withMeta(z.number().int().min(0).max(12), { example: 4 }).describe(
      "时辰索引 0-12，对应早子时(0)到晚子时(12)。0=早子时(23-1点)，1=丑时(1-3点)，2=寅时(3-5点)...12=晚子时(23-24点)",
    ),
    gender: withMeta(z.enum(["男", "女"]), { example: "男" }).describe("性别"),
    calendar: withMeta(z.enum(["solar", "lunar"]), { example: "solar" })
      .optional()
      .describe("历法类型，默认 solar（公历）。lunar 表示农历输入"),
    isLeapMonth: withMeta(z.boolean(), { example: false })
      .optional()
      .describe("是否农历闰月（仅农历输入时有效）"),
    isDefault: withMeta(z.boolean(), { example: false })
      .optional()
      .describe("是否设为默认人物（后续分析默认使用），默认 false"),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type CreateInput = z.infer<typeof personCreateFunction.zodSchema>;
    const input = personCreateFunction.zodSchema.parse(args) as CreateInput;
    if (!input.confirmed) {
      return needsConfirm(
        "创建人物",
        `即将创建人物：${input.name}，${input.date}，时辰${input.timeIndex}，${input.gender}`,
      );
    }
    return peepApi().PersonCreate(mergeBirthInput(input), input.isDefault);
  },
  returns: {
    zodSchema: z.object({
      id: z.number().describe("新创建的人物ID"),
      name: z.string().describe("姓名"),
      gender: z.string().describe("性别"),
      date: z.string().describe("公历出生日期，格式 YYYY-MM-DD"),
      timeIndex: z.number().describe("时辰索引 0-12"),
      savedAt: z.number().describe("保存时间戳（毫秒）"),
      isDefault: z.boolean().describe("是否为默认人物"),
    }),
  },
};

export const personUpdateFunction = {
  name: "PersonUpdate",
  description:
    "更新指定人物的出生信息。" +
    "⚠️ 安全机制：首次调用会返回操作摘要（不执行更新），" +
    "你需要将摘要展示给用户并获得确认后，再次调用并传入 confirmed: true 才会真正更新。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 }).describe("命主 ID"),
    name: withMeta(z.string(), { example: "张三" }).describe("姓名"),
    date: withMeta(z.string(), { example: "1990-05-15" }).describe("公历出生日期，YYYY-MM-DD"),
    timeIndex: withMeta(z.number().int().min(0).max(12), { example: 4 }).describe(
      "时辰索引 0-12，对应早子时至晚子时",
    ),
    gender: withMeta(z.enum(["男", "女"]), { example: "男" }).describe("性别"),
    calendar: withMeta(z.enum(["solar", "lunar"]), { example: "solar" })
      .optional()
      .describe("历法，默认 solar"),
    isLeapMonth: withMeta(z.boolean(), { example: false }).optional().describe("是否农历闰月"),
    isDefault: withMeta(z.boolean(), { example: false })
      .optional()
      .describe("是否设为默认人物；不传则保持原值"),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type UpdateInput = z.infer<typeof personUpdateFunction.zodSchema>;
    const input = personUpdateFunction.zodSchema.parse(args) as UpdateInput;
    if (!input.confirmed) {
      return needsConfirm(
        "更新人物",
        `即将更新人物 #${input.personId}：${input.name}，${input.date}，时辰${input.timeIndex}，${input.gender}`,
      );
    }
    const params = extractConfirmed(input);
    return peepApi().PersonUpdate(params.personId, mergeBirthInput(params), params.isDefault);
  },
  returns: {
    zodSchema: z.object({
      id: z.number().describe("人物ID"),
      name: z.string().describe("姓名"),
      savedAt: z.number().describe("保存时间戳（毫秒）"),
      isDefault: z.boolean().describe("是否为默认人物"),
    }),
  },
};

export const personDeleteFunction = {
  name: "PersonDelete",
  description:
    "删除指定人物；默认人物不可删除。" +
    "⚠️ 不可逆操作：首次调用会返回操作摘要（不执行删除），" +
    "你必须明确告知用户此操作不可撤销，获得确认后再传入 confirmed: true 调用。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 }).describe("命主 ID"),
    confirmed: CONFIRM_FIELD,
  }),
  handler: (args: Record<string, unknown>) => {
    type DeleteInput = z.infer<typeof personDeleteFunction.zodSchema>;
    const input = personDeleteFunction.zodSchema.parse(args) as DeleteInput;
    if (!input.confirmed) {
      return needsConfirm(
        "删除人物",
        `即将删除人物 #${input.personId}（此操作不可撤销）`,
        "请明确告知用户此操作不可撤销，确认后再次调用并传入 confirmed: true",
      );
    }
    return peepApi().PersonDelete(input.personId);
  },
  returns: {
    zodSchema: z.void().describe("删除操作无返回数据，仅表示操作成功"),
  },
};

/** 设置默认人物——系统中只能有一个默认人物 */
export const personSetDefaultFunction = {
  name: "PersonSetDefault",
  description:
    "将指定人物设为默认人物（系统中只能有一个默认人物）。" +
    "设置新默认人物时，会自动取消原默认人物的标记。" +
    "\n\n" +
    "使用场景：用户要求切换默认人物时使用。" +
    "\n\n" +
    "示例：PersonSetDefault({ personId: 2 }) — 将 ID 为 2 的人物设为默认。",
  zodSchema: z.object({
    personId: withMeta(z.number().int().positive(), { example: 1 }).describe("命主 ID"),
  }),
  handler: (args: Record<string, unknown>) => {
    const { personId } = personSetDefaultFunction.zodSchema.parse(args) as { personId: number };
    return peepApi().PersonSetDefault(personId);
  },
  returns: {
    zodSchema: z
      .object({
        id: z.number().describe("人物 ID"),
        name: z.string().describe("姓名"),
        isDefault: z.boolean().describe("是否为默认人物（应为 true）"),
      })
      .describe("更新后的人物信息"),
  },
};
