/**
 * 时间/日历（Lunar）Function 定义
 *
 * 公历农历转换、八字、节气、黄历、生肖星座等。
 */
import { withMeta, z } from "@rtc-agent/component";
import { peepApi } from "./shared";

export const solarToLunarFunction = {
  name: "SolarToLunar",
  description:
    "公历转农历——将公历日期转换为农历日期，返回农历日期及干支信息。" +
    "\n\n" +
    "使用场景：" +
    "(1) 用户提供公历生日，需要转换为农历；" +
    "(2) 查看某天的农历日期及年/月/日干支；" +
    "(3) 确定某天的生肖。" +
    "\n\n" +
    "返回数据包含：农历年月日、是否闰月、年月日干支、生肖。" +
    "\n\n" +
    "示例：SolarToLunar({ date: '2024-06-15' }) — 将 2024年6月15日 转为农历。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "2024-06-15" }).describe(
      "公历日期，格式 YYYY-MM-DD 或 YYYY-MM-DD HH:mm",
    ),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = solarToLunarFunction.zodSchema.parse(args);
    return peepApi().SolarToLunar({ date: parsedArgs.date });
  },
  returns: {
    zodSchema: z.object({
      year: z.number().describe("农历年份"),
      month: z.number().describe("农历月份"),
      day: z.number().describe("农历日期"),
      isLeap: z.boolean().describe("是否闰月"),
      yearGanZhi: z.string().describe("年干支，如'甲辰'"),
      monthGanZhi: z.string().describe("月干支，如'庚午'"),
      dayGanZhi: z.string().describe("日干支，如'庚戌'"),
      zodiac: z.string().describe("生肖，如'龙'"),
    }),
  },
};

export const lunarToSolarFunction = {
  name: "LunarToSolar",
  description:
    "农历转公历——将农历日期转换为公历日期。" +
    "\n\n" +
    "使用场景：" +
    "(1) 用户提供农历生日，需要转换为公历；" +
    "(2) 确定农历某日对应的公历日期。" +
    "\n\n" +
    "示例：LunarToSolar({ year: 2024, month: 5, day: 10 }) — 将农历2024年五月初十转为公历。",
  zodSchema: z.object({
    year: withMeta(z.number().int().positive(), { example: 2024 }).describe("农历年份"),
    month: withMeta(z.number().int().min(1).max(12), { example: 5 }).describe("农历月份 1-12"),
    day: withMeta(z.number().int().min(1).max(30), { example: 10 }).describe("农历日期 1-30"),
    isLeap: withMeta(z.boolean(), { example: false }).optional().describe("是否闰月（默认 false）"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = lunarToSolarFunction.zodSchema.parse(args);
    return peepApi().LunarToSolar({
      year: parsedArgs.year,
      month: parsedArgs.month,
      day: parsedArgs.day,
      isLeap: parsedArgs.isLeap,
    });
  },
  returns: {
    zodSchema: z.object({
      date: z.string().describe("公历日期，格式 YYYY-MM-DD，如'2024-06-15'"),
    }),
  },
};

export const getEightCharactersFunction = {
  name: "GetEightCharacters",
  description:
    "获取八字（四柱）——根据公历日期时间计算年月日时四柱的天干地支及纳音。" +
    "\n\n" +
    "使用场景：" +
    "(1) 用户的出生时间已知，需要排出八字；" +
    "(2) 分析命理格局时需要八字作为基础数据；" +
    "(3) 查看某时刻的四柱干支。" +
    "\n\n" +
    "返回数据包含：年柱/月柱/日柱/时柱，每柱包含天干地支（ganZhi）和纳音（naYin）。" +
    "\n\n" +
    "示例：GetEightCharacters({ date: '1990-06-15 14:30' }) — 计算该时刻的八字。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "1990-06-15 14:30" }).describe(
      "公历日期时间，格式 YYYY-MM-DD HH:mm",
    ),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getEightCharactersFunction.zodSchema.parse(args);
    return peepApi().GetEightCharacters({ date: parsedArgs.date });
  },
  returns: {
    zodSchema: z.object({
      year: z
        .object({
          ganZhi: z.string().describe("年柱天干地支，如'甲辰'"),
          naYin: z.string().describe("年柱纳音五行，如'覆灯火'"),
        })
        .describe("年柱"),
      month: z
        .object({
          ganZhi: z.string().describe("月柱天干地支，如'庚午'"),
          naYin: z.string().describe("月柱纳音五行，如'路旁土'"),
        })
        .describe("月柱"),
      day: z
        .object({
          ganZhi: z.string().describe("日柱天干地支，如'庚戌'"),
          naYin: z.string().describe("日柱纳音五行，如'钗钏金'"),
        })
        .describe("日柱"),
      hour: z
        .object({
          ganZhi: z.string().describe("时柱天干地支，如'癸未'"),
          naYin: z.string().describe("时柱纳音五行，如'杨柳木'"),
        })
        .describe("时柱"),
    }),
  },
};

export const getSolarTermsFunction = {
  name: "GetSolarTerms",
  description:
    "获取某年的 24 节气——返回该年所有节气的名称和公历日期。" +
    "\n\n" +
    "使用场景：" +
    "(1) 查看某年有哪些节气及其日期；" +
    "(2) 确定节气交接的时间点；" +
    "(3) 分析节气与运限的关系。" +
    "\n\n" +
    "返回数据包含：节气列表，每项有 name（节气名称）、date（公历日期）、description（描述）。" +
    "\n\n" +
    "示例：GetSolarTerms({ year: 2024 }) — 获取 2024 年的 24 节气。",
  zodSchema: z.object({
    year: withMeta(z.number().int().positive(), { example: 2024 }).describe("年份"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getSolarTermsFunction.zodSchema.parse(args);
    return peepApi().GetSolarTerms({ year: parsedArgs.year });
  },
  returns: {
    zodSchema: z.array(
      z.object({
        name: z.string().describe("节气名称，如'冬至'、'小寒'"),
        date: z.string().describe("节气公历日期，格式 YYYY-MM-DD"),
        description: z.string().describe("节气描述"),
      }),
    ),
  },
};

export const getCurrentSolarTermFunction = {
  name: "GetCurrentSolarTerm",
  description:
    "获取当前/指定日期的节气信息——返回当前所在的节气（节/气）及下一个节气。" +
    "\n\n" +
    "使用场景：" +
    "(1) 查看今天处于哪个节气；" +
    "(2) 确定下一个节气是什么时候；" +
    "(3) 分析当前时节对运势的影响。" +
    "\n\n" +
    "返回数据包含：currentJie/currentQi（当前节/气）、nextJie/nextQi（下一个节/气），每项有 name 和 date。" +
    "\n\n" +
    "示例：GetCurrentSolarTerm({ date: '2024-06-15' }) — 获取该日期的节气信息，省略 date 则用今天。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "2024-06-15" })
      .optional()
      .describe("公历日期（可选），省略则用当前日期"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getCurrentSolarTermFunction.zodSchema.parse(args);
    return peepApi().GetCurrentSolarTerm({ date: parsedArgs.date });
  },
  returns: {
    zodSchema: z.object({
      currentJie: z
        .object({
          name: z.string().describe("节气名称"),
          date: z.string().describe("节气公历日期，格式 YYYY-MM-DD"),
        })
        .nullable()
        .describe("当前所在节（可能为 null）"),
      currentQi: z
        .object({
          name: z.string().describe("节气名称"),
          date: z.string().describe("节气公历日期，格式 YYYY-MM-DD"),
        })
        .nullable()
        .describe("当前所在气（可能为 null）"),
      nextJie: z
        .object({
          name: z.string().describe("下一个节名称"),
          date: z.string().describe("下一个节公历日期，格式 YYYY-MM-DD"),
        })
        .nullable()
        .describe("下一个节（可能为 null）"),
      nextQi: z
        .object({
          name: z.string().describe("下一个气名称"),
          date: z.string().describe("下一个气公历日期，格式 YYYY-MM-DD"),
        })
        .nullable()
        .describe("下一个气（可能为 null）"),
    }),
  },
};

export const getChineseCalendarFunction = {
  name: "GetChineseCalendar",
  description:
    "获取传统黄历信息——返回某日的宜忌、冲煞、彭祖百忌、胎神、五行、星宿等传统历法信息。" +
    "\n\n" +
    "使用场景：" +
    "(1) 查看某天适合做什么（宜）、不适合做什么（忌）；" +
    "(2) 了解当日的冲煞方位；" +
    "(3) 传统择日参考。" +
    "\n\n" +
    "返回数据包含：yi（宜事项列表）、ji（忌事项列表）、chong（冲）、sha（煞）、pengZu（彭祖百忌）、taiShen（胎神）、wuXing（五行）、xingXiu（星宿）等。" +
    "\n\n" +
    "示例：GetChineseCalendar({ date: '2024-06-15' }) — 获取该日的黄历信息。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "2024-06-15" })
      .optional()
      .describe("公历日期（可选），省略则用当前日期"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getChineseCalendarFunction.zodSchema.parse(args);
    return peepApi().GetChineseCalendar({ date: parsedArgs.date });
  },
  returns: {
    zodSchema: z.object({
      yi: z.array(z.string()).describe("宜事项列表，如['嫁娶','祭祀']"),
      ji: z.array(z.string()).describe("忌事项列表，如['无']"),
      chong: z.string().describe("冲（地支），如'辰'"),
      sha: z.string().describe("煞（方位），如'北'"),
      pengZu: z.string().describe("彭祖百忌，如'庚不经络织机虚张 戌不吃犬作怪上床'"),
      taiShen: z.string().describe("胎神方位，如'碓磨栖 外东北'"),
      wuXing: z.string().describe("五行纳音，如'钗钏金'"),
      xingXiu: z.string().describe("星宿名，如'胃'"),
      xingXiuAnimal: z.string().describe("星宿对应动物，如'彘'"),
      xingXiuLuck: z.string().describe("星宿吉凶，如'吉'"),
    }),
  },
};

export const getDailyInfoFunction = {
  name: "GetDailyInfo",
  description:
    "获取每日综合信息——返回某日的公历/农历日期、干支、生肖、星座、节日、星期等综合信息。" +
    "\n\n" +
    "使用场景：" +
    "(1) 快速了解某日的基本信息；" +
    "(2) 查看当天是否为节日或周末；" +
    "(3) 确定某日的星座和生肖。" +
    "\n\n" +
    "返回数据包含：solar（公历）、lunar（农历）、ganZhi（年月日干支）、zodiac（生肖）、constellation（星座）、festival（节日列表）、isWeekend（是否周末）、weekDay（星期几）。" +
    "\n\n" +
    "示例：GetDailyInfo({ date: '2024-06-15' }) — 获取该日的综合信息。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "2024-06-15" })
      .optional()
      .describe("公历日期（可选），省略则用当前日期"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getDailyInfoFunction.zodSchema.parse(args);
    return peepApi().GetDailyInfo({ date: parsedArgs.date });
  },
  returns: {
    zodSchema: z.object({
      solar: z.string().describe("公历日期，格式 YYYY-MM-DD，如'2024-06-15'"),
      lunar: z.string().describe("农历日期，格式 YYYY-MM-DD，如'2024-05-10'"),
      ganZhi: z
        .object({
          year: z.string().describe("年干支，如'甲辰'"),
          month: z.string().describe("月干支，如'庚午'"),
          day: z.string().describe("日干支，如'庚戌'"),
        })
        .describe("年月日干支"),
      zodiac: z.string().describe("生肖，如'龙'"),
      constellation: z.string().describe("星座，如'双子'"),
      festival: z.array(z.string()).describe("节日列表（可能为空数组）"),
      isWeekend: z.boolean().describe("是否周末"),
      weekDay: z.number().describe("星期几，0-6，0=周日"),
    }),
  },
};

export const getZodiacFunction = {
  name: "GetZodiac",
  description:
    "获取生肖——根据日期获取对应的生肖（基于农历年）。" +
    "\n\n" +
    "使用场景：" +
    "(1) 确定某人的生肖；" +
    "(2) 查看某年的生肖。" +
    "\n\n" +
    "返回数据包含：zodiac（生肖）、year（农历年份）。" +
    "\n\n" +
    "示例：GetZodiac({ date: '1990-06-15' }) — 获取该日期对应的生肖。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "1990-06-15" })
      .optional()
      .describe("公历日期（可选），省略则用当前日期"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getZodiacFunction.zodSchema.parse(args);
    return peepApi().GetZodiac({ date: parsedArgs.date });
  },
  returns: {
    zodSchema: z.object({
      zodiac: z.string().describe("生肖名，如'马'"),
      year: z.number().describe("农历年份，如 1990"),
    }),
  },
};

export const getConstellationFunction = {
  name: "GetConstellation",
  description:
    "获取星座——根据公历日期获取对应的西方星座。" +
    "\n\n" +
    "使用场景：" +
    "(1) 确定某人的星座；" +
    "(2) 查看星座的五行属性和吉凶。" +
    "\n\n" +
    "返回数据包含：constellation（星座名称）、element（五行属性）、luck（吉凶）。" +
    "\n\n" +
    "示例：GetConstellation({ date: '1990-06-15' }) — 获取该日期对应的星座。",
  zodSchema: z.object({
    date: withMeta(z.string(), { example: "1990-06-15" })
      .optional()
      .describe("公历日期（可选），省略则用当前日期"),
  }),
  handler: (args: Record<string, unknown>) => {
    const parsedArgs = getConstellationFunction.zodSchema.parse(args);
    return peepApi().GetConstellation({ date: parsedArgs.date });
  },
  returns: {
    zodSchema: z.object({
      constellation: z.string().describe("星座名，如'双子'"),
      element: z.string().describe("五行属性，如'风'"),
      luck: z.string().describe("吉凶，如'吉'"),
    }),
  },
};
