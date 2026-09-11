import type { ReactNode } from "react";

/* ── 事件类型 ───────────────────────────────────── */

export type EventType =
  | "career"     // 事业/工作
  | "wealth"     // 财运
  | "love"       // 感情
  | "health"     // 健康
  | "exam"       // 考试
  | "travel"     // 出行
  | "legal"      // 诉讼
  | "other";     // 其他

const EVENT_TYPE_OPTIONS: { value: EventType; label: string; icon: string }[] = [
  { value: "career", label: "事业", icon: "💼" },
  { value: "wealth", label: "财运", icon: "💰" },
  { value: "love", label: "感情", icon: "❤️" },
  { value: "health", label: "健康", icon: "🏥" },
  { value: "exam", label: "考试", icon: "📝" },
  { value: "travel", label: "出行", icon: "✈️" },
  { value: "legal", label: "诉讼", icon: "⚖️" },
  { value: "other", label: "其他", icon: "📌" },
];

const EVENT_TYPE_LABEL: Record<EventType, string> = Object.fromEntries(
  EVENT_TYPE_OPTIONS.map(o => [o.value, o.label])
) as Record<EventType, string>;

/* ── 各模块各事件类型的分析维度指引 ─────────────── */

type Module = "bazi" | "ziwei" | "liuyao";

interface EventInstructions {
  /** 事件类型对应的核心分析维度 */
  focusPoints: string[];
  /** 该事件类型需要 AI 重点回应的维度 */
  outputDimensions: string[];
}

/**
 * 按事件类型 + 模块生成专项分析指引
 */
function getEventInstructions(
  eventType: EventType,
  module: Module
): EventInstructions {
  switch (eventType) {
    case "career":
      return {
        focusPoints: module === "bazi"
          ? [
            "官杀星（事业星）旺衰与动静——当前大运/流年对官杀的引动方向",
            "印星状态（靠山、贵人）是否得力",
            "食伤与官杀的生克关系（创意/表达 vs 约束/规矩的平衡）",
            "日主旺衰能否担得起官杀之压",
            "当前大运是否为事业上升期的关键节点",
          ]
          : module === "ziwei"
            ? [
              "官禄宫主星组合与亮度——先天事业格局",
              "官禄宫四化（尤其是化禄/化权/化忌的落宫方向）",
              "当前大限官禄宫与流年官禄宫的叠动",
              "命宫主星与官禄宫的关系（三方四正联动）",
              "辅星（左辅右弼/天魁天钺等）对事业的加持程度",
            ]
            : [
              "官鬼爻旺衰与动静——事体核心信号",
              "官鬼爻与世爻的生克关系——事成与否的关键",
              "父母爻（文书/任命）状态——是否有正式任命/文书之象",
              "妻财爻对官鬼爻的助力或消耗",
              "动爻变化方向对事业的影响",
            ],
        outputDimensions: [
          "可行性评估：当前条件是否支持此事（成功率判断）",
          "最佳时机：推荐的行动时间窗口（具体到月份/流月）",
          "风险预警：可能的阻碍与应对策略",
          "具体建议：宜忌事项与行动方向",
        ],
      };

    case "wealth":
      return {
        focusPoints: module === "bazi"
          ? [
            "财星（正财/偏财）旺衰与动静——财运根基",
            "食伤生财的通路是否畅通（生财之源）",
            "比劫夺财的风险（竞争/破财信号）",
            "当前大运是否走财地或用神到位",
            "流年流月引动财星的时间节点",
          ]
          : module === "ziwei"
            ? [
              "财帛宫主星组合——先天财运格局",
              "财帛宫四化方向（化禄主进财/化忌主损耗）",
              "福德宫（来财之源）与财帛宫的三方联动",
              "当前大限/流年财帛宫的引动",
              "田宅宫状态（不动产/蓄财能力）",
            ]
            : [
              "妻财爻旺衰与动静——求财核心信号",
              "子孙爻（财源）是否有力——生财之源",
              "兄弟爻（劫财）是否发动——破财风险",
              "妻财爻与世爻关系——财能否到手",
              "应爻状态——合作/交易对方的诚意",
            ],
        outputDimensions: [
          "可行性评估：当前财运格局是否支持此投资/消费决策",
          "最佳时机：推荐的行动时间窗口",
          "风险预警：破财信号与防范策略",
          "具体建议：宜忌事项（如宜守不宜攻、适合的方向）",
        ],
      };

    case "love":
      return {
        focusPoints: module === "bazi"
          ? [
            "配偶星（男看财星/女看官星）旺衰与动静",
            "日支（配偶宫）状态——刑冲合害对感情的影响",
            "桃花星与红鸾天喜的引动情况",
            "当前大运/流年对配偶星宫的引动方向",
            "食伤与官杀的平衡（感情中的付出与压力）",
          ]
          : module === "ziwei"
            ? [
              "夫妻宫主星组合——先天感情格局",
              "夫妻宫四化（化禄主缘深/化忌主纠葛）",
              "桃花星（红鸾/天喜/咸池等）落宫与引动",
              "当前大限/流年夫妻宫的叠动方向",
              "命宫与夫妻宫的三方四正联动",
            ]
            : [
              "用神定位——男占看妻财爻/女占看官鬼爻",
              "世应关系——双方态度与互动模式",
              "用神旺衰与动静——感情的根基与走向",
              "间爻（如有动爻间隔）——阻碍或助力因素",
              "变卦方向——事体最终走向",
            ],
        outputDimensions: [
          "可行性评估：缘分深浅与成功可能性",
          "最佳时机：感情发展的关键时间节点",
          "风险预警：可能的感情波折与应对",
          "具体建议：相处之道与行动建议",
        ],
      };

    case "health":
      return {
        focusPoints: module === "bazi"
          ? [
            "五行偏枯与脏腑对应（过旺/过弱的五行所主器官）",
            "日主强弱——体质根基",
            "当前大运/流年对日主的冲克力度",
            "食神/印星状态——调养与恢复能力",
            "流月引动健康信号的时间节点",
          ]
          : module === "ziwei"
            ? [
              "疾厄宫主星组合——先天体质弱点",
              "疾厄宫四化方向（化忌主隐患）",
              "五行局与星曜的五行属性——脏腑对应",
              "当前大限/流年疾厄宫的引动",
              "流耀（流陀/流羊等）对疾厄宫的冲击",
            ]
            : [
              "用神定位——自占看世爻",
              "世爻旺衰——体质根基",
              "官鬼爻状态——病象信号（如有）",
              "子孙爻（医药/克制病源）是否有力",
              "动爻变化对健康的方向性影响",
            ],
        outputDimensions: [
          "可行性评估：手术/治疗时机的合适程度",
          "最佳时机：推荐的行动/调养时间窗口",
          "风险预警：需特别注意的健康时段",
          "具体建议：调养方向与注意事项",
        ],
      };

    case "exam":
      return {
        focusPoints: module === "bazi"
          ? [
            "印星（学业星）旺衰与动静",
            "食伤（才华发挥）状态——临场表现",
            "官印相生的配合——是否有功名之象",
            "当前流年对印星的引动方向",
            "流月引动的时间节点——备考冲刺期",
          ]
          : module === "ziwei"
            ? [
              "父母宫（文书宫）主星——先天学业格局",
              "官禄宫状态——考试功名运势",
              "父母宫四化方向",
              "当前大限/流年对文昌文曲的引动",
              "流耀对考试宫位的加持/冲击",
            ]
            : [
              "父母爻（文书/成绩）旺衰——成绩信号",
              "官鬼爻（名次/官方认可）状态",
              "世爻旺衰——自身状态与发挥",
              "父母爻与世爻的关系——成绩与自身匹配度",
              "动爻变化方向——临场发挥的走向",
            ],
        outputDimensions: [
          "可行性评估：当前运势对考试的支撑度",
          "最佳时机：有利的时间节点",
          "风险预警：可能影响发挥的因素",
          "具体建议：备考方向与注意事项",
        ],
      };

    case "travel":
      return {
        focusPoints: module === "bazi"
          ? [
            "驿马星状态——出行信号",
            "日主旺衰与当前流月的配合——出行安全",
            "流年流月中冲克日柱/时柱的风险时段",
            "出行方位与五行喜忌的配合",
            "流月引动的关键时间节点",
          ]
          : module === "ziwei"
            ? [
              "迁移宫主星组合——出行运势",
              "迁移宫四化方向（化忌主波折）",
              "当前大限/流年迁移宫的引动",
              "流耀对迁移宫的冲击",
              "命宫与迁移宫的三方联动",
            ]
            : [
              "世爻旺衰——出行者自身状态",
              "应爻状态——目的地情况",
              "动爻变化——途中的变量",
              "驿马星是否发动——出行信号",
              "变卦方向——出行结果",
            ],
        outputDimensions: [
          "可行性评估：出行时机是否合适",
          "最佳时机：推荐出行的时间窗口",
          "风险预警：需回避的时段与方向",
          "具体建议：注意事项与方位建议",
        ],
      };

    case "legal":
      return {
        focusPoints: module === "bazi"
          ? [
            "官杀（官非/官方力量）旺衰与动静",
            "印星（法律保护/贵人）是否得力",
            "比劫（对抗力量）的状态",
            "当前大运/流年是否引动官非信号",
            "食伤制杀的力量——抗争能力",
          ]
          : module === "ziwei"
            ? [
              "官禄宫与迁移宫的关联——官非信号",
              "化忌落宫方向——是非纠纷来源",
              "当前大限/流年对官非宫的引动",
              "天刑/天姚等刑煞星的引动",
              "贵人星（天魁天钺）是否得力——法律助力",
            ]
            : [
              "官鬼爻旺衰——官方/对手力量",
              "世应关系——己方与对方的力量对比",
              "父母爻（法律文书/证据）状态",
              "妻财爻——诉讼花费与利益得失",
              "动爻变化方向——诉讼走向",
            ],
        outputDimensions: [
          "可行性评估：诉讼/法律行动的胜算",
          "最佳时机：推荐行动的时间窗口",
          "风险预警：可能的法律风险与对手动态",
          "具体建议：应对策略与注意事项",
        ],
      };

    case "other":
    default:
      return {
        focusPoints: module === "bazi"
          ? [
            "用神与忌神在此事中的角色——哪些十神代表此事成败关键",
            "当前大运对此事的利弊——大运是否助力或阻碍",
            "流年流月引动时机——何时最有利、何时需防范",
            "日主旺衰与事的承载力",
          ]
          : module === "ziwei"
            ? [
              "事件对应核心宫位的先天状态",
              "当前大限/流年四化对该宫位的引动方向",
              "飞宫四化与自化交互",
              "辅星对事体的加持/削弱",
            ]
            : [
              "用神旺衰与动静——事体核心信号",
              "原神/忌神力量对比",
              "动爻变化对事体的影响方向",
              "世应关系——主客力量对比",
            ],
        outputDimensions: [
          "可行性评估：当前条件是否支持此事",
          "最佳时机：推荐的行动时间窗口",
          "风险预警：可能的阻碍与应对策略",
          "具体建议：宜忌事项与行动方向",
        ],
      };
  }
}

/* ── 事件类型选择器 UI ───────────────────────────── */

interface EventTypeSelectorProps {
  value: EventType;
  onChange: (v: EventType) => void;
}

function EventTypeSelector({ value, onChange }: EventTypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {EVENT_TYPE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-xs py-1 px-2 rounded border transition-colors ${
            value === opt.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
          }`}
        >
          <span className="mr-0.5">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── 事件 Tab 的 renderExtra ───────────────────── */

interface EventTabExtraProps {
  eventType: EventType;
  onEventTypeChange: (v: EventType) => void;
  /** 可选的前置内容（放在事件类型选择器之前） */
  before?: ReactNode;
}

export function EventTabExtra({ eventType, onEventTypeChange, before }: EventTabExtraProps) {
  return (
    <div className="space-y-1.5">
      {before}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground shrink-0">事件类型</span>
        <EventTypeSelector value={eventType} onChange={onEventTypeChange} />
      </div>
    </div>
  );
}

/* ── 构建事件提示词的专项分析区块 ─────────────── */

interface BuildEventInstructionsOpts {
  eventType: EventType;
  question: string;
  module: Module;
}

/**
 * 构建事件预测的分析指引文本，拼入提示词中
 */
// eslint-disable-next-line react/only-export-components
export function buildEventInstructions(opts: BuildEventInstructionsOpts): string {
  const { eventType, question, module } = opts;
  const inst = getEventInstructions(eventType, module);
  const eventLabel = EVENT_TYPE_LABEL[eventType] ?? "其他";

  const lines: string[] = [];
  lines.push(`## 事件类型：${eventLabel}`);
  lines.push("");
  lines.push(`**所问之事：** ${question || "（请在此输入具体问题）"}`);
  lines.push("");

  lines.push("### 核心分析维度");
  inst.focusPoints.forEach((p, i) => {
    lines.push(`${i + 1}. ${p}`);
  });
  lines.push("");

  lines.push("### 输出要求");
  lines.push("请严格按以下四个维度组织输出：");
  lines.push("");
  inst.outputDimensions.forEach((d, i) => {
    lines.push(`${i + 1}. **${d}**`);
  });
  lines.push("");
  lines.push("每个论断须注明命理依据，区分「确定 / 大概率 / 倾向参考」三档确定度。");

  return lines.join("\n");
}
