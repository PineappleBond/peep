/**
 * peep.liuyao API 实现
 *
 * 六爻模块的完整 API：CRUD + 计算工具
 */

import { db, type LiuyaoRecord } from "@/lib/db";
import { buildChart as coreBuildChart, tossHexagram as coreTossHexagram } from "@/modules/liuyao/core/chart";
import type { ChartInput } from "@/modules/liuyao/core/chart";
import type {
  ChartJSON,
  ScenarioId,
  Stem,
  Branch,
  Element,
  Relative,
  SixGod,
  Palace,
  HexType,
  KongState,
  YongTarget,
} from "@/modules/liuyao/core/types";
import { SCENARIOS, SCENARIO_IDS } from "@/modules/liuyao/core/scenarios/newRegistry";
import type { VigorState, Granularity } from "@/modules/liuyao/core/timeFloors";
import { vigorOf, buildTimeFloors } from "@/modules/liuyao/core/timeFloors";

// ── 类型定义 ─────────────────────────────────────────────

/** 单个时间项 */
export interface 时间项 {
  /** 干支+单位，如「丙午年」「甲子月」 */
  标题: string;
  /** 旺相休囚死 */
  旺衰: VigorState;
}

/** 时间对（每个楼层包含两个时间项） */
export interface 时间对 {
  /** 上层时间（如太岁、月建、日辰） */
  上层: 时间项;
  /** 本层时间（如月建、日辰、时辰） */
  本层: 时间项;
}

/** 本卦爻信息 */
export interface 本卦爻 {
  /** 爻位 1-6 */
  爻位: 1 | 2 | 3 | 4 | 5 | 6;
  /** 阴阳 */
  阳: boolean;
  /** 是否动爻 */
  动: boolean;
  /** 天干 */
  天干: Stem;
  /** 地支 */
  地支: Branch;
  /** 五行 */
  五行: Element;
  /** 六亲 */
  六亲: Relative;
  /** 六神 */
  六神: SixGod;
  /** 是否旬空 */
  空: boolean;
  /** 旬空状态 */
  空状态: KongState;
  /** 是否世爻 */
  世: boolean;
  /** 是否应爻 */
  应: boolean;
  /** 楼层列表（每个元素是一个楼层的两个时间项） */
  楼层: 时间对[];
  /** 伏藏信息 */
  伏藏?: { 天干: Stem; 地支: Branch; 五行: Element; 六亲: Relative };
}

/** 变爻信息 */
export interface 变爻 {
  /** 爻位 1-6 */
  爻位: 1 | 2 | 3 | 4 | 5 | 6;
  /** 阴阳 */
  阳: boolean;
  /** 天干 */
  天干: Stem;
  /** 地支 */
  地支: Branch;
  /** 五行 */
  五行: Element;
  /** 六亲 */
  六亲: Relative;
  /** 六神（从本卦动爻继承） */
  六神: SixGod;
  /** 楼层列表（变爻对各时间的 vigor） */
  楼层: 时间对[];
}

/** 完整结果 */
export interface 六爻结果 {
  // ── 起卦信息 ──
  编号: number;
  时间戳: number;
  日期: string;
  占事: string;
  背景?: string;
  场景: ScenarioId;
  用神: YongTarget;
  附加: Record<string, string>;
  人物编号?: number;
  人物姓名?: string;
  创建时间: Date;

  // ── 本卦 ──
  本卦: {
    卦名: string;
    宫: Palace;
    宫五行: Element;
    类型: HexType;
    世: number;
    应: number;
    爻: 本卦爻[];
  };

  // ── 变卦 ──
  变卦: {
    卦名: string;
    爻: 变爻[];
  } | null;
}

// ── 工具函数 ─────────────────────────────────────────────

/** 解析日期字符串（YYYY-MM-DD 格式） */
function parseDate(s: string): { y: number; m: number; d: number } {
  const parts = s.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${s}. Expected: YYYY-MM-DD`);
  }
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    throw new Error(`Invalid date values: ${s}`);
  }
  return { y, m, d };
}

/** 纯函数：从 record 构建完整结果 */
export function buildLiuyaoChart(record: LiuyaoRecord, granularity: Granularity = 'year'): 六爻结果 {
  // 基础卦（起卦那一刻）
  const baseChart = coreBuildChart({
    lines: record.lines as ChartInput["lines"],
    date: record.date,
  });

  // 解析起卦日期
  const { y, m, d } = parseDate(record.date);
  const anchor = new Date(y, m - 1, d);

  // 生成楼层列表
  const floors = buildTimeFloors(anchor, granularity);

  // 预计算每个楼层的卦象
  const floorCharts = floors.map((floor) =>
    coreBuildChart({
      lines: record.lines as ChartInput["lines"],
      date: floor.date,
      monthBranchOverride: floor.monthBranchOverride,
      dayGanzhiOverride: floor.dayGanzhiOverride,
    })
  );

  // 构建本卦爻的 楼层
  const 本卦爻列表: 本卦爻[] = baseChart.lines.map((line, lineIdx) => {
    const 楼层: 时间对[] = floors.map((floor, floorIdx) => {
      const floorLine = floorCharts[floorIdx].lines[lineIdx];
      return {
        上层: {
          标题: floor.upperTime.label,
          旺衰: vigorOf(floor.upperTime.elem, floorLine.elem),
        },
        本层: {
          标题: floor.thisTime.label,
          旺衰: vigorOf(floor.thisTime.elem, floorLine.elem),
        },
      };
    });

    return {
      爻位: line.pos,
      阳: line.yang,
      动: line.moving,
      天干: line.stem,
      地支: line.branch,
      五行: line.elem,
      六亲: line.rel,
      六神: line.god,
      空: line.kong,
      空状态: line.kongState,
      世: baseChart.shi === line.pos,
      应: baseChart.ying === line.pos,
      楼层,
    };
  });

  // 构建变爻的 楼层（只有动爻才有变爻）
  const 变爻列表: 变爻[] | null = baseChart.changed
    ? baseChart.changed.lines.map((changedLine) => {
        const lineIdx = changedLine.pos - 1;
        const 楼层: 时间对[] = floors.map((floor, floorIdx) => {
          const floorChanged = floorCharts[floorIdx].changed?.lines[lineIdx];
          // 变爻的五行可能与本爻不同
          const changedElem = floorChanged?.elem ?? changedLine.elem;
          return {
            上层: {
              标题: floor.upperTime.label,
              旺衰: vigorOf(floor.upperTime.elem, changedElem),
            },
            本层: {
              标题: floor.thisTime.label,
              旺衰: vigorOf(floor.thisTime.elem, changedElem),
            },
          };
        });

        return {
          爻位: changedLine.pos,
          阳: changedLine.yang,
          天干: changedLine.stem,
          地支: changedLine.branch,
          五行: changedLine.elem,
          六亲: changedLine.rel,
          六神: baseChart.lines[lineIdx].god,
          楼层,
        };
      })
    : null;

  return {
    // 起卦信息
    编号: record.id!,
    时间戳: record.timestamp,
    日期: record.date,
    占事: record.question,
    背景: record.background,
    场景: record.scenarioId as ScenarioId,
    用神: record.yongTarget as YongTarget,
    附加: record.extras,
    人物编号: record.personId ?? undefined,
    人物姓名: record.personName,
    创建时间: new Date(record.createdAt),

    // 本卦
    本卦: {
      卦名: baseChart.name,
      宫: baseChart.palace,
      宫五行: baseChart.palaceElem,
      类型: baseChart.type,
      世: baseChart.shi,
      应: baseChart.ying,
      爻: 本卦爻列表,
    },

    // 变卦
    变卦: 变爻列表 ? { 卦名: baseChart.changed!.name, 爻: 变爻列表 } : null,
  };
}

export const liuyaoAPI = {
  // ── CRUD ──────────────────────────────────────────

  async create(input: Partial<LiuyaoRecord> & {
    lines?: [number, number, number, number, number, number];
  }): Promise<number> {
    const now = Date.now();
    // 如果没有提供 lines，自动起卦
    const lines = input.lines ?? coreTossHexagram();
    // 使用 sv-SE locale 格式（ISO 8601），与 store 中 todayISO() 保持一致
    const dateStr = input.date ?? new Date(now).toLocaleDateString("sv-SE");
    // 让 Dexie 自动生成自增 id
    const id = await db.liuyaoRecords.add({
      timestamp: now,
      date: dateStr,
      lines,
      scenarioId: input.scenarioId ?? "other",
      yongTarget: input.yongTarget ?? "自占",
      extras: input.extras ?? {},
      question: input.question ?? "",
      background: input.background,
      chart: null as unknown as ChartJSON,
      personId: input.personId,
      personName: input.personName,
      createdAt: now,
    });
    return id!;
  },

  async update(id: number, changes: Partial<LiuyaoRecord>): Promise<void> {
    await db.liuyaoRecords.update(id, { ...changes, updatedAt: Date.now() });
  },

  async delete(id: number): Promise<void> {
    await db.liuyaoRecords.update(id, { deletedAt: Date.now() });
  },

  async get(id: number, granularity: Granularity = 'year'): Promise<六爻结果 | undefined> {
    const record = await db.liuyaoRecords.get(id);
    if (!record || record.deletedAt) return undefined;
    return buildLiuyaoChart(record, granularity);
  },

  async list(opts?: { personId?: number }): Promise<LiuyaoRecord[]> {
    let results = await db.liuyaoRecords.orderBy("timestamp").reverse().toArray();
    results = results.filter((r) => !r.deletedAt);
    if (opts?.personId !== undefined) {
      results = results.filter((r) => r.personId === opts.personId);
    }
    return results;
  },

  // ── 计算工具（无 UI） ─────────────────────────────

  buildChart(input: ChartInput): ChartJSON {
    return coreBuildChart(input);
  },

  tossHexagram(): [number, number, number, number, number, number] {
    return coreTossHexagram();
  },

  scenarios(): Array<{ id: ScenarioId; title: string; disclaimer?: string }> {
    return SCENARIO_IDS.map((id) => {
      const def = SCENARIOS[id];
      return { id, title: def.title, disclaimer: def.disclaimer };
    });
  },
};
