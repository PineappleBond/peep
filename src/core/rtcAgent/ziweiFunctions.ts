/**
 * 紫微斗数（ZiWei）Function 定义
 *
 * 排盘与运限分析：ZiWei（UI 操控，完整盘面）、GetScopeData（纯计算，运限拨盘）、SetHoroscopeTime（纯计算，设置时间）。
 */
import { withMeta, z } from "@rtc-agent/component";
import {
  PERSON_ID_OPTIONAL,
  PERSON_SUMMARY_SCHEMA,
  peepApi,
  createMetadataUpdateHandler,
  createPassthroughHandler,
} from "./shared";

/* ---- 返回值 Zod Schema ---- */

const _decadeItemSchema = z
  .object({
    palaceIndex: z.number().describe("大限所在宫位索引 0-11"),
    range: z.array(z.number()).describe("大限年龄区间 [起岁, 止岁]，如 [6, 15]"),
    heavenlyStem: z.string().describe("大限天干，如 '戊'"),
    earthlyBranch: z.string().describe("大限地支，如 '子'"),
    startYear: z.number().describe("大限起始公历年"),
    endYear: z.number().describe("大限结束公历年"),
  })
  .describe("大限项");

const _childhoodSchema = z
  .object({
    startYear: z.number().describe("童限起始公历年"),
    endYear: z.number().describe("童限结束公历年"),
    label: z.string().describe("童限年龄标签，如 '1~5岁'"),
  })
  .describe("童限");

const _yearItemSchema = z
  .object({
    year: z.number().describe("公历年份"),
    gz: z.string().describe("流年干支，如 '庚子'"),
    age: z.number().describe("虚岁年龄"),
  })
  .describe("流年项");

const _monthItemSchema = z
  .object({
    month: z.number().describe("农历月份 1-12"),
    leap: z.boolean().describe("是否闰月"),
    label: z.string().describe("农历月标签，如 '冬月'"),
    solarLabel: z.string().describe("公历月标签，如 '1月'"),
    gz: z.string().describe("流月干支，如 '庚子'"),
  })
  .describe("流月项");

const _dayItemSchema = z
  .object({
    day: z.number().describe("农历日 1-30"),
    label: z.string().describe("农历日标签，如 '二十'"),
    solarLabel: z.string().describe("公历日标签，如 '1号'"),
    gz: z.string().describe("流日干支，如 '戊寅'"),
  })
  .describe("流日项");

const _hourItemSchema = z
  .object({
    hour: z.number().describe("时辰索引 0-11"),
    label: z.string().describe("时辰标签，如 '子时'"),
    gz: z.string().describe("流时干支，如 '丙子'"),
  })
  .describe("流时项");

const _pickSchema = z
  .object({
    year: z.number().describe("公历年"),
    month: z.number().describe("月"),
    day: z.number().describe("日"),
    hour: z.number().describe("时辰索引 0-11"),
    leap: z.boolean().describe("是否闰月"),
  })
  .describe("当前选中的时间");

/** 运限拨盘（hbar）—— ZiWei 与 GetScopeData 共用 */
const hbarSchema = z
  .object({
    decades: z.array(_decadeItemSchema).describe("大限数组"),
    childhood: _childhoodSchema.describe("童限"),
    activeDecadeIdx: z.number().describe("当前激活大限在 decades 数组中的索引"),
    years: z.array(_yearItemSchema).describe("流年数组"),
    activeYearIdx: z.number().describe("当前激活流年在 years 数组中的索引"),
    months: z.array(_monthItemSchema).describe("流月数组"),
    activeMonthIdx: z.number().describe("当前激活流月在 months 数组中的索引"),
    days: z.array(_dayItemSchema).describe("流日数组"),
    activeDayIdx: z.number().describe("当前激活流日在 days 数组中的索引"),
    hours: z.array(_hourItemSchema).describe("流时数组"),
    activeHourIdx: z.number().describe("当前激活流时在 hours 数组中的索引"),
    pick: _pickSchema.describe("当前选中的时间"),
    effLeap: z.boolean().describe("有效闰月标志"),
    clampedDay: z.number().describe("校正后的农历日（处理大月/小月边界）"),
    visible: z
      .object({
        decadal: z.boolean().describe("大限拨盘是否可见"),
        yearly: z.boolean().describe("流年拨盘是否可见"),
        monthly: z.boolean().describe("流月拨盘是否可见"),
        daily: z.boolean().describe("流日拨盘是否可见"),
        hourly: z.boolean().describe("流时拨盘是否可见"),
      })
      .describe("各级别拨盘可见性"),
  })
  .describe("运限拨盘");

const _starSchema = z
  .object({
    name: z.string().describe("星曜名称，如 '紫微'、'文昌'"),
    brightness: z.string().describe("亮度/庙旺状态，如 '庙'、'旺'、'得地'"),
    mutagen: z.string().describe("四化标记，如 '禄'、'权'、'科'、'忌'，无则为空串"),
  })
  .describe("星曜");

const _adjectiveStarSchema = z
  .object({
    name: z.string().describe("杂耀名称，如 '天官'、'天福'"),
  })
  .describe("杂耀");

const _scopeStarSchema = z
  .object({
    name: z.string().describe("运限星曜名称"),
  })
  .describe("运限星曜");

const _mutagenItemSchema = z
  .object({
    star: z.string().describe("产生四化的星曜名称"),
    char: z.string().describe("四化字符：禄/权/科/忌"),
  })
  .describe("四化标记");

const _palaceSchema = z
  .object({
    palaceIndex: z.number().describe("宫位索引 0-11，对应地支位置"),
    palaceName: z
      .string()
      .describe(
        "宫名，如 '命宫'、'兄弟'、'夫妻'、'子女'、'财帛'、'疾厄'、'迁移'、'交友'、'官禄'、'田宅'、'福德'、'父母'",
      ),
    branch: z.string().describe("地支，如 '寅'、'卯'"),
    heavenlyStem: z.string().describe("宫位天干，如 '戊'"),
    majorStars: z.array(_starSchema).describe("主星数组（紫微系十四主星等）"),
    minorStars: z.array(_starSchema).describe("辅星数组（左辅、右弼、文昌、文曲等）"),
    adjectiveStars: z.array(_adjectiveStarSchema).describe("杂耀数组"),
    scopePalaceName: z.string().describe("运限宫名——当前运限级别下此宫对应的宫名"),
    scopeStars: z.array(_scopeStarSchema).describe("运限星曜数组"),
    natalMutagens: z.array(_mutagenItemSchema).describe("本命四化数组"),
    scopeMutagens: z.array(_mutagenItemSchema).describe("运限四化数组"),
    selfMutagens: z.array(_mutagenItemSchema).describe("自化四化数组"),
    scopeSelfMutagens: z.array(_mutagenItemSchema).describe("运限自化四化数组"),
    decadalRange: z.array(z.number()).describe("大限年龄区间 [起岁, 止岁]，如 [26, 35]"),
    ages: z.array(z.number()).describe("小限年龄数组，如 [6, 18]"),
    changsheng12: z.string().describe("长生十二神，如 '长生'、'沐浴'、'冠带'"),
    boshi12: z.string().describe("博士十二神，如 '官府'、'博士'、'力士'"),
    suiqian12: z.string().describe("岁前十二神，如 '晦气'、'丧门'、'贯索'"),
    jiangqian12: z.string().describe("将前十二神，如 '劫煞'、'灾煞'、'天煞'"),
    isBodyPalace: z.boolean().describe("是否为身宫"),
    isOriginalPalace: z.boolean().describe("是否为原命宫"),
  })
  .describe("宫位数据");

const _flyItemSchema = z
  .object({
    mutagen: z.string().describe("四化字符：禄/权/科/忌"),
    star: z.string().describe("产生四化的星曜名称"),
    toIndex: z.number().describe("飞入目标宫位索引 0-11"),
    toName: z.string().describe("飞入目标宫名"),
    isSelf: z.boolean().describe("是否为自化（飞入本宫）"),
    isOpposite: z.boolean().describe("是否为对宫（飞入冲宫）"),
  })
  .describe("飞星项");

const _flyMatrixItemSchema = z
  .object({
    fromIndex: z.number().describe("来源宫位索引 0-11"),
    fromName: z.string().describe("来源宫名"),
    stem: z.string().describe("宫位天干，如 '戊'"),
    flies: z.array(_flyItemSchema).describe("此宫天干引发的四化飞星数组"),
  })
  .describe("飞星矩阵行");

const _selfLinkSchema = z
  .object({
    fromIndex: z.number().describe("来源宫位索引 0-11"),
    toIndex: z.number().describe("目标宫位索引 0-11"),
    isSelfLoop: z.boolean().describe("是否为自环（来源与目标相同）"),
    char: z.string().describe("四化字符：禄/权/科/忌"),
    direction: z.string().describe("方向：'outward'(离心自化) 或 'inward'(向心自化)"),
    star: z.string().describe("产生自化的星曜名称"),
  })
  .describe("自化链接");

const _chartSchema = z
  .object({
    scope: z
      .string()
      .describe("运限级别，如 'natal'、'decadal'、'yearly'、'monthly'、'daily'、'hourly'"),
    palaces: z.array(_palaceSchema).describe("十二宫数组"),
    flyMatrix: z.array(_flyMatrixItemSchema).describe("飞星矩阵——每宫天干引发的四化飞星"),
    selfLinks: z.array(_selfLinkSchema).describe("自化链接数组"),
  })
  .describe("盘面数据");

const _ziweiReturnSchema = z
  .object({
    person: PERSON_SUMMARY_SCHEMA.describe("人物基础信息"),
    hbar: hbarSchema.describe("运限拨盘"),
    chart: _chartSchema.describe("盘面数据"),
  })
  .describe("紫微盘面完整数据");

/* ---- Function 定义 ---- */

/** ZiWei 参数 schema（独立定义，避免 handler 自引用） */
const _ziweiSchema = z.object({
  personId: PERSON_ID_OPTIONAL,
  scope: withMeta(z.enum(["decadal", "yearly", "monthly", "daily", "hourly"]), {
    example: "yearly",
  }).describe(
    "运限级别：decadal=大限(十年运势), yearly=流年(当年运势), monthly=流月(当月运势), daily=流日(当日运势), hourly=流时(当时运势)。根据用户问题选择合适的级别",
  ),
  time: withMeta(z.string(), { example: "2024-06-15 12:00" })
    .optional()
    .describe(
      "公历观测时间（可选），如 '2024-06-15 12:00' 或 '2024-06-15'；省略则用当前时间。用于指定分析的时间点",
    ),
});

export const ziweiFunction = {
  name: "ZiWei",
  description:
    "为指定命主排出紫微斗数完整盘面，按运限级别（大限/流年/流月/流日/流时）返回分析数据。" +
    "返回数据包含：(1) hbar 运限拨盘（大运/流年/流月/流日/流时列表及可见性），(2) chart 运限盘面（十二宫星曜、四化飞星等完整盘面数据）。" +
    "\n\n" +
    "⚠️ 重要提示：此接口会像人类一样操控 UI（导航到紫微页面、切换人物、等待渲染完成），耗时约 1-3 秒。" +
    "内部通过轮询等待 UI 状态稳定（pick/astrolabe 校验），不会超时。" +
    "用户看到的数据与 Agent 返回的数据完全一致——这是保证数据一致性的核心原则。" +
    "\n\n" +
    "适用于需要完整盘面数据的场景：查看十二宫星曜分布、分析四化飞星、查看具体宫位的吉凶星曜组合等。" +
    "\n\n" +
    "使用示例：" +
    "(1) ZiWei({ scope: 'yearly' }) — 查看默认人物的流年盘面；" +
    "(2) ZiWei({ personId: 1, scope: 'monthly', time: '2024-06-15' }) — 查看指定人物 2024年6月的流月盘面。",
  zodSchema: _ziweiSchema,
  handler: createPassthroughHandler(
    _ziweiSchema,
    (p: {
      personId?: number;
      scope: "decadal" | "yearly" | "monthly" | "daily" | "hourly";
      time?: string;
    }) => peepApi().ZiWei(p.personId, p.scope, p.time),
  ),
  returns: {
    zodSchema: _ziweiReturnSchema,
  },
};

/** GetScopeData 参数 schema（独立定义，避免 handler 自引用） */
const _getScopeDataSchema = z.object({
  solarDate: withMeta(z.string(), { example: "2024-06-15 12:00" }).describe(
    "公历观测日期，如 '2024-06-15 12:00' 或 '2024-06-15'。用于确定分析的时间点",
  ),
  personId: PERSON_ID_OPTIONAL,
});

export const getScopeDataFunction = {
  name: "GetScopeData",
  description:
    "根据公历日期获取指定命主的运限数据（大运/流年/流月/流日/流时列表），纯计算接口，不操控 UI，响应快。" +
    "\n\n" +
    "✅ 适用场景：" +
    "(1) 只查看当前运限状态——'我现在走什么大运？''今年流年如何？''这个月运势怎样？' " +
    "(2) 比较不同运限级别的关系——查看大限→流年→流月的层级关系 " +
    "(3) 快速获取运限列表数据，无需完整盘面星曜信息。" +
    "\n\n" +
    "⚠️ 如需完整盘面数据（十二宫星曜分布、四化飞星、具体宫位分析），请使用 ZiWei 接口。" +
    "\n\n" +
    "使用示例：" +
    "(1) GetScopeData({ solarDate: '2024-06-15' }) — 获取默认人物 2024-06-15 的运限数据；" +
    "(2) GetScopeData({ solarDate: '2024-06-15', personId: 1 }) — 获取指定人物的运限数据。" +
    "\n\n" +
    "返回数据包含大运列表、流年列表、流月列表、流日列表、流时列表，每项包含干支、生肖、年龄等信息。",
  zodSchema: _getScopeDataSchema,
  handler: createPassthroughHandler(
    _getScopeDataSchema,
    (p: { solarDate: string; personId?: number }) =>
      peepApi().GetScopeData(p.solarDate, p.personId),
  ),
  returns: {
    zodSchema: hbarSchema,
  },
};

/** SetHoroscopeTime 参数 schema（独立定义，避免 handler 工厂循环引用） */
const _setHoroscopeTimeSchema = z.object({
  personId: withMeta(z.number().int().positive(), { example: 1 })
    .optional()
    .describe("命主 ID（可选）；省略则使用默认人物"),
  year: withMeta(z.number().int().min(1900).max(2100), { example: 2024 }).describe("年份"),
  month: withMeta(z.number().int().min(1).max(12), { example: 6 }).describe("月份（1-12）"),
  day: withMeta(z.number().int().min(1).max(31), { example: 15 }).describe("日期（1-31）"),
  hour: withMeta(z.number().int().min(0).max(23), { example: 14 })
    .optional()
    .describe("小时（0-23，可选，默认 0）"),
});

/** 设置运限时间——直接控制运限拨盘的年月日时 */
export const setHoroscopeTimeFunction = {
  name: "SetHoroscopeTime",
  description:
    "设置运限时间——直接控制运限拨盘的年月日时（纯计算，不操控 UI）。" +
    "设置后返回当前运限状态（pick 值）。" +
    "\n\n" +
    "使用场景：用户要求查看特定日期的运限时使用。" +
    "\n\n" +
    "示例：SetHoroscopeTime({ year: 2024, month: 6, day: 15, hour: 14 }) — 设置运限到 2024 年 6 月 15 日 14 时。",
  zodSchema: _setHoroscopeTimeSchema,
  handler: createMetadataUpdateHandler(
    _setHoroscopeTimeSchema,
    (params: { personId?: number; year: number; month: number; day: number; hour?: number }) =>
      peepApi().SetHoroscopeTime(params),
  ),
  returns: {
    zodSchema: z
      .object({
        year: z.number().describe("设置的年份"),
        month: z.number().describe("设置的月份"),
        day: z.number().describe("设置的日期"),
        hour: z.number().describe("设置的小时（0-23）"),
      })
      .describe("设置后的运限时间（pick 值）"),
  },
};
