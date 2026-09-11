import { useMemo, useState } from "react";
import type { Zwds } from "../core/useZwds";
import { buildExportAiText } from "../core/export";
import { AiPromptPanel, type PromptTab } from "@/components/shared/AiPromptPanel";
import {
  CompareTabExtra,
  buildCompareSection,
  type RelationshipType,
} from "@/components/shared/CompareInput";
import {
  EventTabExtra,
  buildEventInstructions,
  type EventType,
} from "@/components/shared/EventInput";
import { useSelectedPerson } from "@/hooks/useSelectedPerson";
import type { Person } from "@/lib/db";

interface Props {
  z: Zwds;
}

type TabKey = "chart" | "yunxian" | "event" | "compare";
type YunxianScope = "year" | "month" | "day";

const YUNXIAN_SCOPE_LABELS: Record<YunxianScope, string> = {
  year: "流年",
  month: "流月",
  day: "流日",
};

/** 紫微斗数 AI 分析通用指引（角色设定 + 推理规范） */
const ZIWEI_ROLE =
  "你是一位严谨的紫微斗数分析师，严格依据命盘数据推理，不做模糊笼统的描述。" +
  "每个论断须注明依据（引用具体宫位、星曜、四化），区分「结构必然 / 大概率 / 倾向参考」三档确定度。" +
  "流派口径以数据中 meta 字段为准，不得改星、改宫、改四化。";

const CHART_INST =
  "请根据以上紫微斗数命盘数据，按下列章节进行详细命理分析。每个论断必须注明命理依据（引用具体宫位、主星、辅星、四化），并按确定度标注：【必然】/【大概率】/【倾向】。\n\n" +
  "### 0. 盘面骨架复述（先复述，确认无误再展开）\n" +
  "- 命宫主星组合与亮度、身宫位置\n" +
  "- 已检出格局（命盘元数据中 patterns）\n" +
  "- 生年四化落宫\n" +
  "- 三方四正的关键结构\n\n" +
  "### 1. 性格特质（先天格局）\n" +
  "- 核心性格（命宫主星组合推导，注明依据）\n" +
  "- 显性优势（2-3 条，每条注明依据）\n" +
  "- 显性劣势 / 盲点（2-3 条，每条注明依据）\n\n" +
  "### 2. 事业方向\n" +
  "- 适合的行业类型（官禄宫主星 + 四化推导）\n" +
  "- 职场风格与定位（如管理型、技术型、创意型、幕后型）\n" +
  "- 关键发展节点（大限中事业转折的年龄段）\n\n" +
  "### 3. 财运特点\n" +
  "- 财帛宫星曜状态（主星、四化、辅星）\n" +
  "- 求财方式倾向（稳健积累 vs 风险获利 vs 技术变现）\n" +
  "- 财来财去的关键诱因\n\n" +
  "### 4. 感情模式\n" +
  "- 夫妻宫主星与四化引动（含飞宫四化交会）\n" +
  "- 感情倾向与相处模式\n" +
  "- 关键年份（婚恋变动应期）\n\n" +
  "### 5. 健康注意\n" +
  "- 疾厄宫星曜对应的体质弱项\n" +
  "- 需注意的生活习惯与调理方向\n\n" +
  "### 6. 人生课题\n" +
  "- 这一生需要完成的成长主题（结合命宫主星与四化主导）\n" +
  "- 核心矛盾与平衡点\n\n" +
  "### 7. 大限走势（后天运势）\n" +
  "- 按每个大限分小节，给出吉凶基调与关键事件倾向\n" +
  "- 结合当前流年流月，推导近期（1-2 年）具体可把握的时间节点\n\n" +
  "### 8. 可操作的人生建议\n" +
  "- 针对上述分析给出 3-5 条具体、可执行的建议（事业/财运/感情/健康各至少 1 条）\n" +
  "- 每条建议须与前面论断相呼应，避免空泛";

const YUNXIAN_YEAR_INST =
  "请重点分析命主当前及近期的流年运势：\n" +
  "1. 当前大限（十年运）的整体基调——大限命宫三方四正、大限四化走向、与原局的引动关系\n" +
  "2. 当前流年运势详析——流年命宫落宫、流年四化引动，围绕事业/财运/感情/健康四方面\n" +
  "3. 前后各2-3年的流年走向对比（吉凶等级标注，关键转折年份详解）\n" +
  "4. 需要注意的关键时间节点与应期（冲合刑会引发的重大变化）";

const YUNXIAN_MONTH_INST =
  "请重点分析命主当前流年的逐月运势：\n" +
  "1. 当前大限+流年的整体基调（大限四化与流年四化叠加对原局的作用）\n" +
  "2. 本年十二流月逐月运势（每月围绕事业/财运/感情/健康，标注吉凶等级）\n" +
  "3. 重点月份详解——吉凶转折月份，说明引发因素（流月四化引动、流耀交会等）\n" +
  "4. 全年节奏规划建议：何时进取、何时守成、关键月份注意事项";

const YUNXIAN_DAY_INST =
  "请重点分析命主当前流月的逐日运势：\n" +
  "1. 当前大限+流年+流月的整体基调（三层运限叠加对原局的作用方向）\n" +
  "2. 本月逐日运势概览（标注特别吉凶的日子）\n" +
  "3. 关键日子详解——适合做什么/不适合做什么，说明星曜与四化依据\n" +
  "4. 择事建议：如有具体事项（签约、出行、面试等），推荐最佳日期与时段";

/** 运限分析指令映射（模块级常量，避免 useMemo 依赖警告） */
const YUNXIAN_INST_MAP: Record<YunxianScope, string> = {
  year: YUNXIAN_YEAR_INST,
  month: YUNXIAN_MONTH_INST,
  day: YUNXIAN_DAY_INST,
};

/** 紫微事件预测通用分析框架 */
const EVENT_ANALYSIS_FRAMEWORK =
  "请根据以上紫微斗数命盘数据，针对所问之事进行专项分析。\n" +
  "分析要求：\n" +
  "1. 先复述盘面骨架（命宫主星与亮度、格局、生年四化），确认无误后再展开\n" +
  "2. 每个论断须注明命理依据（引用具体宫位、星曜、四化）\n" +
  "3. 区分「确定 / 大概率 / 倾向参考」三档确定度\n" +
  "4. 严格按输出要求的四个维度组织回答";

const COMPARE_INST =
  "请对比分析两人紫微斗数命盘，严格依据提供的命盘数据，从所给维度逐项展开：\n" +
  "1. 每个论断须注明依据（引用具体宫位、星曜、四化）\n" +
  "2. 区分「结构必然 / 大概率 / 倾向参考」三档确定度\n" +
  "3. 给出可操作的相处建议，避免空泛描述";

export function AiExportPanel({ z }: Props) {
  const [question, setQuestion] = useState("");
  const [eventType, setEventType] = useState<EventType>("career");
  const [compareInput, setCompareInput] = useState("");
  const [comparePerson, setComparePerson] = useState<Person | null>(null);
  const [relationship, setRelationship] = useState<RelationshipType>("partner");
  const [yunxianScope, setYunxianScope] = useState<YunxianScope>("year");
  const { selectedPerson } = useSelectedPerson();

  const { astrolabe, input } = z;
  const basePayload = useMemo(() => buildExportAiText(z, { withDaily: yunxianScope === "day" }), [z, yunxianScope]);

  const name = input.name || "命主";

  const prompts = useMemo(() => {
    if (!astrolabe || !basePayload) return {} as Record<TabKey, string>;

    const addInst = (inst: string) =>
      `${basePayload}\n---\n\n${ZIWEI_ROLE}\n\n${inst}`;

    const compareSection = buildCompareSection({
      currentName: name,
      comparePerson,
      pastedData: compareInput,
      relationship,
      module: "ziwei",
      placeholder: "（请在此粘贴对方的紫微斗数命盘数据）",
    });

    return {
      chart: addInst(CHART_INST),

      yunxian: addInst(`当前分析对象：${name}，分析粒度：${YUNXIAN_SCOPE_LABELS[yunxianScope]}。\n\n${YUNXIAN_INST_MAP[yunxianScope]}`),

      event: (() => {
        const q = question.trim() || "（请在此输入具体问题）";
        const eventInstructions = buildEventInstructions({
          eventType,
          question: q,
          module: "ziwei",
        });
        return addInst(`${eventInstructions}\n\n${EVENT_ANALYSIS_FRAMEWORK}`);
      })(),

      compare: `${basePayload}${compareSection}\n\n---\n\n${ZIWEI_ROLE}\n\n${COMPARE_INST}`,
    };
  }, [astrolabe, basePayload, name, yunxianScope, question, eventType, compareInput, comparePerson, relationship]);

  const tabs: PromptTab[] = [
    { key: "chart", label: "命盘解读", hint: "完整的紫微命盘数据 + 全面命理分析提示词" },
    {
      key: "yunxian",
      label: "运限分析",
      hint: "命盘数据 + 大限流年流月运限分析提示词",
      input: {
        label: "分析时间范围",
        placeholder: "",
        value: "",
        onChange: () => {},
        rows: 0,
        hideTextarea: true,
        renderExtra: (
          <div className="flex gap-1 mb-1.5">
            {(["year", "month", "day"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setYunxianScope(s)}
                className={`flex-1 text-xs py-1 px-2 rounded border transition-colors ${
                  yunxianScope === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {YUNXIAN_SCOPE_LABELS[s]}
              </button>
            ))}
          </div>
        ),
      },
    },
    {
      key: "event",
      label: "事件预测",
      hint: "命盘数据 + 事件类型 + 具体问题，生成针对性预测提示词",
      input: {
        label: "具体问题",
        placeholder: "例如：今年适合创业吗？感情运势如何？什么时候买房比较好？",
        value: question,
        onChange: setQuestion,
        rows: 2,
        renderExtra: (
          <EventTabExtra
            eventType={eventType}
            onEventTypeChange={setEventType}
          />
        ),
      },
    },
    {
      key: "compare",
      label: "关系对比",
      hint: "当前命盘 + 对方命盘数据，生成关系对比分析提示词",
      input: {
        label: "对方紫微信息",
        placeholder: "粘贴对方的紫微斗数命盘数据...",
        value: compareInput,
        onChange: setCompareInput,
        rows: 3,
        renderExtra: (
          <CompareTabExtra
            currentPersonId={selectedPerson?.id}
            comparePerson={comparePerson}
            onComparePersonChange={setComparePerson}
            relationship={relationship}
            onRelationshipChange={setRelationship}
          />
        ),
      },
    },
  ];

  if (!astrolabe || !basePayload) return null;

  return <AiPromptPanel tabs={tabs} prompts={prompts} />;
}
