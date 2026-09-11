import { useState, useMemo } from "react";
import { User, Search, X } from "lucide-react";
import { usePersons } from "@/hooks/usePersons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Person } from "@/lib/db";

/* ── 关系类型 ───────────────────────────────────── */

export type RelationshipType =
  | "partner"      // 伴侣
  | "parent-child" // 亲子
  | "parent"       // 父母
  | "friend"       // 朋友
  | "colleague"    // 同事
  | "other";       // 其他

const RELATIONSHIP_OPTIONS: { value: RelationshipType; label: string }[] = [
  { value: "partner", label: "伴侣" },
  { value: "parent-child", label: "亲子" },
  { value: "parent", label: "父母" },
  { value: "friend", label: "朋友" },
  { value: "colleague", label: "同事" },
  { value: "other", label: "其他" },
];

const RELATIONSHIP_LABEL: Record<RelationshipType, string> = Object.fromEntries(
  RELATIONSHIP_OPTIONS.map(o => [o.value, o.label])
) as Record<RelationshipType, string>;

interface RelationshipTypeSelectorProps {
  value: RelationshipType;
  onChange: (v: RelationshipType) => void;
}

function RelationshipTypeSelector({ value, onChange }: RelationshipTypeSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground shrink-0">关系</span>
      <Select value={value} onValueChange={(v) => onChange(v as RelationshipType)}>
        <SelectTrigger className="h-6 w-[72px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RELATIONSHIP_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ── 人物选择器 ─────────────────────────────────── */

interface PersonPickerProps {
  /** 当前选中的人物（命主A），用于排除 */
  currentPersonId?: number | null;
  /** 选中的对方人物 ID */
  selectedPersonId: number | null;
  onSelect: (person: Person | null) => void;
}

function PersonPicker({ currentPersonId, selectedPersonId, onSelect }: PersonPickerProps) {
  const { persons } = usePersons();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // 过滤：排除当前命主，按搜索词过滤
  const filtered = useMemo(() => {
    let list = persons.filter(p => p.id !== currentPersonId);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [persons, currentPersonId, search]);

  const selectedPerson = useMemo(
    () => persons.find(p => p.id === selectedPersonId) ?? null,
    [persons, selectedPersonId]
  );

  if (isOpen) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">对方</span>
          <div className="relative flex-1">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="搜索人物..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-6 h-6 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => { setIsOpen(false); setSearch(""); }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-1">
            {persons.length <= 1 ? "人物库中暂无其他人物" : "没有匹配的人物"}
          </p>
        ) : (
          <div className="max-h-32 overflow-auto rounded border bg-background">
            {filtered.map(p => (
              <div
                key={p.id}
                className={
                  "flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer hover:bg-accent transition-colors " +
                  (p.id === selectedPersonId ? "bg-accent" : "")
                }
                onClick={() => {
                  onSelect(p);
                  setIsOpen(false);
                  setSearch("");
                }}
              >
                <div
                  className={
                    "w-1 h-4 rounded-full shrink-0 " +
                    (p.gender === "male" ? "bg-sky-400" : "bg-pink-400")
                  }
                />
                <span className="truncate">{p.name}</span>
                <span className="text-muted-foreground text-[10px] ml-auto">
                  {p.birthDate}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (selectedPerson) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground shrink-0">对方</span>
        <div
          className="flex items-center gap-1 bg-primary/5 rounded px-1.5 py-0.5 cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => setIsOpen(true)}
          title="点击更换"
        >
          <User className="h-3 w-3 text-primary shrink-0" />
          <span className="text-xs font-medium">{selectedPerson.name}</span>
          <Badge
            variant="secondary"
            className={
              "text-[10px] px-1 py-0 h-3.5 leading-none " +
              (selectedPerson.gender === "male"
                ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                : "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300")
            }
          >
            {selectedPerson.gender === "male" ? "男" : "女"}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {selectedPerson.birthDate}
            {selectedPerson.birthTime ? ` ${selectedPerson.birthTime}` : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            title="清除"
          >
            <X className="h-2.5 w-2.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={() => setIsOpen(true)}
      className="gap-1"
    >
      <User className="h-3 w-3" />
      选择对方人物
    </Button>
  );
}

/* ── 对比信息格式化 ─────────────────────────────── */

/** 把 Person 的基本信息格式化为 Markdown 片段（供提示词使用） */
function formatPersonBasicInfo(person: Person): string {
  const lines: string[] = [];
  lines.push(`- 姓名：${person.name}`);
  lines.push(`- 性别：${person.gender === "male" ? "男" : "女"}`);
  lines.push(`- 出生日期：${person.birthDate}${person.birthTime ? ` ${person.birthTime}` : ""}`);
  if (person.isLunar) lines.push("- 历法：农历");
  return lines.join("\n");
}

/** 关系类型对应的中文标签（用于提示词） */
function relationshipLabel(type: RelationshipType): string {
  return RELATIONSHIP_LABEL[type] ?? "其他";
}

/* ── 关系对比分析指引（按类型、按模块） ─────────── */

type Module = "bazi" | "ziwei" | "liuyao";

interface CompareInstructions {
  /** 关系类型标签（一句话说明） */
  relationHeader: string;
  /** 重点分析维度 */
  focusPoints: string[];
}

/**
 * 按关系类型与模块生成对比分析指引
 * - 伴侣：性格契合、价值观、沟通方式、长期相处
 * - 亲子：代际理解、教育适配、情感纽带
 * - 父母：孝道、传承、角色定位
 * - 朋友：志趣相投、互助互补
 * - 同事：事业助力、合作模式、竞争点
 * - 其他：通用维度
 */
export function getCompareInstructions(
  rel: RelationshipType,
  module: Module
): CompareInstructions {
  const header = `双方关系：${relationshipLabel(rel)}`;

  // 公共通用点
  const common = [
    "整体缘分深浅评估与相处建议",
  ];

  switch (rel) {
    case "partner":
      return {
        relationHeader: header,
        focusPoints: [
          ...(module === "bazi"
            ? [
              "日主关系（天干合化、地支刑冲合害）",
              "五行互补性（双方五行缺失与对方旺相的匹配度）",
              "十神关系匹配度（对方是否为命主的财官印等有利十神）",
              "配偶星与日支状态对婚姻的影响",
            ]
            : module === "ziwei"
              ? [
                "命宫主星匹配度（性格互补性与潜在冲突）",
                "夫妻宫关联（双方配偶星与对方命宫的互动）",
                "四化飞宫互动（双方禄忌交汇、飞化方向）",
                "价值观与生活方式契合度",
              ]
              : [
                "两卦用神差异（用神旺衰变化、六亲转换）",
                "体用关系（两卦间的五行生克、卦宫互动）",
                "感情卦的核心信号（世应关系、配偶爻状态）",
              ]),
          "沟通方式与情感互动模式",
          "潜在冲突点与化解建议",
          ...common,
        ],
      };

    case "parent-child":
      return {
        relationHeader: header,
        focusPoints: [
          ...(module === "bazi"
            ? [
              "日主五行生克（长辈与晚辈的互动模式）",
              "印星与食伤星的对应（教养方式）",
              "时柱与年柱的关系（代际传承）",
            ]
            : module === "ziwei"
              ? [
                "命宫与子女宫/父母宫的对应",
                "四化在亲子宫位的引动",
                "主星组合的教育风格匹配",
              ]
              : [
                "两卦用神差异（六亲爻位转换）",
                "体用关系（长辈与晚辈的五行互动）",
                "动爻变化对亲子关系的影响",
              ]),
          "代沟与理解难点",
          "情感纽带特点与相处距离建议",
          ...common,
        ],
      };

    case "parent":
      return {
        relationHeader: header,
        focusPoints: [
          ...(module === "bazi"
            ? [
              "印星状态与父母宫对应",
              "年柱与日主的互动（孝道与传承）",
              "五行互补（照顾与被照顾的模式）",
            ]
            : module === "ziwei"
              ? [
                "父母宫主星与对方命宫的关联",
                "四化在父母宫的引动方向",
                "主星亮度对代际关系的影响",
              ]
              : [
                "两卦用神差异（父母爻状态）",
                "体用关系（五行生克中的照顾方向）",
                "卦象中的传承信号",
              ]),
          "角色定位与责任分工",
          "代际期望与沟通建议",
          ...common,
        ],
      };

    case "friend":
      return {
        relationHeader: header,
        focusPoints: [
          ...(module === "bazi"
            ? [
              "日主五行互补（志趣相投的基础）",
              "比肩劫财状态（朋友缘分深浅）",
              "双方用神是否互益",
            ]
            : module === "ziwei"
              ? [
                "命宫主星组合的志趣匹配",
                "交友宫（奴仆宫）的互动",
                "四化方向的互助程度",
              ]
              : [
                "两卦用神差异（兄弟爻状态）",
                "体用关系（平等互助的五行基础）",
                "世应关系中的对等性",
              ]),
          "互补点与共同兴趣",
          "友谊的持久度与维护建议",
          ...common,
        ],
      };

    case "colleague":
      return {
        relationHeader: header,
        focusPoints: [
          ...(module === "bazi"
            ? [
              "日主五行在事业上的互补",
              "官杀与财星互动（权力与合作关系）",
              "双方用神是否互益（事业助力）",
            ]
            : module === "ziwei"
              ? [
                "官禄宫的互动（事业合作契合度）",
                "命宫主星的工作风格匹配",
                "四化在事业宫的引动方向",
              ]
              : [
                "两卦用神差异（官鬼爻与事业信号）",
                "体用关系（合作中的主导与配合）",
                "动爻变化对合作关系的影响",
              ]),
          "合作模式（主导/配合/互补）",
          "潜在竞争与冲突点",
          "事业助力程度与相处距离建议",
          ...common,
        ],
      };

    case "other":
    default:
      return {
        relationHeader: header,
        focusPoints: [
          ...(module === "bazi"
            ? [
              "日主关系（天干合化、地支刑冲合害）",
              "五行互补性",
              "十神关系匹配度",
            ]
            : module === "ziwei"
              ? [
                "命宫主星匹配度",
                "四化飞宫互动",
                "关键宫位关联",
              ]
              : [
                "两卦用神差异",
                "体用关系",
                "动爻呼应",
              ]),
          "核心互补点与潜在冲突",
          ...common,
        ],
      };
  }
}

/* ── 构建对比提示词的公共区块 ─────────────────── */

interface BuildCompareSectionOpts {
  /** 当前命主姓名（可选） */
  currentName?: string;
  /** 选中的对方人物（可选） */
  comparePerson?: Person | null;
  /** 用户粘贴的对方命盘数据 */
  pastedData: string;
  /** 关系类型 */
  relationship: RelationshipType;
  /** 模块 */
  module: Module;
  /** 占位提示（当无数据时） */
  placeholder?: string;
}

/**
 * 构建"对方信息 + 关系类型 + 分析指引"区块，
 * 返回的字符串需由调用方拼接到 base markdown 之后。
 */
export function buildCompareSection(opts: BuildCompareSectionOpts): string {
  const {
    comparePerson,
    pastedData,
    relationship,
    module,
    placeholder = "（请在此粘贴对方的命盘数据）",
  } = opts;

  const lines: string[] = [];
  lines.push("");
  lines.push("## 对方信息（命主B）");

  if (comparePerson) {
    lines.push(formatPersonBasicInfo(comparePerson));
    lines.push("");
    lines.push("### 命盘数据");
    lines.push(pastedData.trim() || placeholder);
  } else {
    lines.push(pastedData.trim() || placeholder);
  }

  lines.push("");

  // 关系类型 + 分析指引
  const inst = getCompareInstructions(relationship, module);
  lines.push("## 对比分析指引");
  lines.push("");
  lines.push(`**${inst.relationHeader}**`);
  lines.push("");
  lines.push("请从以下维度展开分析：");
  inst.focusPoints.forEach((p, i) => {
    lines.push(`${i + 1}. ${p}`);
  });

  return lines.join("\n");
}

/* ── 对比 Tab 的 renderExtra 渲染 ─────────────── */

interface CompareTabExtraProps {
  currentPersonId?: number | null;
  comparePerson: Person | null;
  onComparePersonChange: (p: Person | null) => void;
  relationship: RelationshipType;
  onRelationshipChange: (r: RelationshipType) => void;
  /** 是否显示人物选择器（liuyao 不需要） */
  showPersonPicker?: boolean;
}

export function CompareTabExtra({
  currentPersonId,
  comparePerson,
  onComparePersonChange,
  relationship,
  onRelationshipChange,
  showPersonPicker = true,
}: CompareTabExtraProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {showPersonPicker && (
          <PersonPicker
            currentPersonId={currentPersonId}
            selectedPersonId={comparePerson?.id ?? null}
            onSelect={onComparePersonChange}
          />
        )}
        <RelationshipTypeSelector
          value={relationship}
          onChange={onRelationshipChange}
        />
      </div>
    </div>
  );
}
