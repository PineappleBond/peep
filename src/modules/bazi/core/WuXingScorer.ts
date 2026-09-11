/**
 * 五行评分器 - 判断日主强弱
 *
 * 根据日干对应的五行，统计该五行（同我）及其所生五行（生我）的总分，
 * 与其余五行（异党）的总分做比较，判定身旺/身弱。
 */

const WU_XING = ["木", "火", "土", "金", "水"];

/** 天干 → 五行索引映射（甲乙→木，丙丁→火，戊己→土，庚辛→金，壬癸→水） */
const GAN_WU_XING_INDEX = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];

/** 五行相生关系：木→水（母），火→木（母），土→火（母），金→土（母），水→金（母） */
const GENERATES: Record<string, string> = {
  木: "水",
  火: "木",
  土: "火",
  金: "土",
  水: "金",
};

export interface DayMasterStrength {
  strong: boolean;
  day_wx: string;
  self_score: number;
  other_score: number;
  total: number;
}

export class WuXingScorer {
  /**
   * 判断日主强弱
   *
   * @param dayGanIdx - 日干在天干数组中的索引（0-9）
   * @param wxScore   - 各五行得分 { 木: x, 火: y, ... }
   */
  static judgeDayMasterStrength(
    dayGanIdx: number,
    wxScore: Record<string, number>,
  ): DayMasterStrength {
    const dayWx = WU_XING[GAN_WU_XING_INDEX[dayGanIdx]];
    const yinWx = GENERATES[dayWx]; // 生我之五行（母）

    // 同党 = 日主五行 + 母五行
    const self = (wxScore[dayWx] || 0) + (wxScore[yinWx] || 0);
    const total = Object.values(wxScore).reduce((a, b) => a + b, 0);
    const other = total - self;

    return {
      strong: self >= other,
      day_wx: dayWx,
      self_score: +self.toFixed(2),
      other_score: +other.toFixed(2),
      total: +total.toFixed(2),
    };
  }
}
