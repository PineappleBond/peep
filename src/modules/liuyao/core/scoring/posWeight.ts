/** v1.3 爻位權重：上爻／五爻略高，初爻略低（傳統重上輕初簡化） */
export const POS_WEIGHT: Record<number, number> = {
  1: 0.92, 2: 0.96, 3: 1.0, 4: 1.04, 5: 1.08, 6: 1.12,
};

export function posWeightOf(pos: number): number {
  return POS_WEIGHT[pos] ?? 1;
}
