import type { Grade, RuleEngineResult, ScoreJSON } from '../types';

export interface ScoringConfig {
  /** 每單位 delta 對總分的貢獻倍率（可調參數，見 §7 解析度風險） */
  k: number;
  base: number;
  min: number;
  max: number;
}

export const DEFAULT_SCORING: ScoringConfig = { k: 8, base: 50, min: 3, max: 97 };

export function gradeOf(total: number): Grade {
  if (total >= 70) return '吉';
  if (total >= 55) return '偏吉';
  if (total >= 45) return '平';
  if (total >= 30) return '偏凶';
  return '凶';
}

/** M3 評分：50 + Σdelta×k×posWeight，clamp 後給等級；用神伏藏時暫停（total=null） */
export function score(result: RuleEngineResult, cfg: ScoringConfig = DEFAULT_SCORING): ScoreJSON {
  const breakdown = result.hits
    .filter((h) => h.delta !== 0)
    .map((h) => {
      const w = h.posWeight ?? 1;
      return {
        ruleId: h.id,
        name: h.name,
        delta: h.delta,
        contribution: h.delta * cfg.k * w,
      };
    });

  if (result.scoringSuspended) {
    return { total: null, grade: null, breakdown };
  }

  const raw = cfg.base + breakdown.reduce((sum, b) => sum + b.contribution, 0);
  const total = Math.min(cfg.max, Math.max(cfg.min, Math.round(raw)));
  return { total, grade: gradeOf(total), breakdown };
}
