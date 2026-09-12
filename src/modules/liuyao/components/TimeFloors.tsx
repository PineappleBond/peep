/**
 * TimeFloors —— 撲克牌式時間樓層展示
 *
 * 功能：
 *   - 粒度選擇（年→月 / 月→日 / 日→時）
 *   - 撲克牌堆疊效果：展開卡片在中間，上下都露出邊緣
 *   - 點擊露出部分切換樓層
 *   - 不支持滾動，只支持點擊
 */

import { useCallback, useState } from 'react';
import type { 六爻结果 } from '@/lib/peep-api-liuyao';
import type { Granularity } from '@/modules/liuyao/core/timeFloors';
import { FloorCard } from './FloorCard';

interface Props {
  result: 六爻结果;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}

const PEEK_HEIGHT = 36;
const MAX_VISIBLE = 3; // 上下各顯示最多3張

const GRANULARITY_LABELS: Record<Granularity, string> = {
  year: '年→月',
  month: '月→日',
  day: '日→時',
};

export function TimeFloors({ result, granularity, onGranularityChange }: Props) {
  const [expandedIndex, setExpandedIndex] = useState(0);

  // 樓層數量 = 第一爻的 layers 長度
  const floorCount = result.本卦.爻[0]?.楼层.length ?? 0;

  const goNext = useCallback(() => {
    setExpandedIndex((i) => (i >= floorCount - 1 ? i : i + 1));
  }, [floorCount]);

  const goPrev = useCallback(() => {
    setExpandedIndex((i) => (i <= 0 ? i : i - 1));
  }, []);

  const selectFloor = useCallback((idx: number) => {
    setExpandedIndex(idx);
  }, []);

  // 粒度變化時重置索引
  const changeGranularity = useCallback((g: Granularity) => {
    onGranularityChange(g);
    setExpandedIndex(0);
  }, [onGranularityChange]);

  if (floorCount === 0) {
    return <div className="text-sm text-muted-foreground">無樓層可顯示</div>;
  }

  // 計算上方可見 peek 卡片
  const aboveCount = Math.min(expandedIndex, MAX_VISIBLE);
  const abovePeeks: { floorIndex: number; slot: number }[] = [];
  for (let i = 0; i < aboveCount; i++) {
    const floorIdx = expandedIndex - aboveCount + i;
    if (floorIdx >= 0) {
      abovePeeks.push({ floorIndex: floorIdx, slot: i });
    }
  }

  // 計算下方可見 peek 卡片
  const belowRemaining = floorCount - 1 - expandedIndex;
  const belowCount = Math.min(belowRemaining, MAX_VISIBLE);
  const belowPeeks: { floorIndex: number; slot: number }[] = [];
  for (let i = 0; i < belowCount; i++) {
    const floorIdx = expandedIndex + 1 + i;
    if (floorIdx < floorCount) {
      belowPeeks.push({ floorIndex: floorIdx, slot: i });
    }
  }

  // 獲取樓層標題（用於 peek 卡片）
  const getFloorTitle = (floorIndex: number): string => {
    const line = result.本卦.爻[0];
    const pair = line?.楼层[floorIndex];
    return pair ? `${pair.上层.标题} · ${pair.本层.标题}` : '';
  };

  // 容器高度
  const expandedMinHeight = 340;
  const containerHeight =
    abovePeeks.length * PEEK_HEIGHT +
    expandedMinHeight +
    belowPeeks.length * PEEK_HEIGHT +
    8;

  return (
    <div className="space-y-2">
      {/* 粒度切換 */}
      <div className="flex items-center gap-1 px-1">
        {(['year', 'month', 'day'] as Granularity[]).map((g) => (
          <button
            key={g}
            onClick={() => changeGranularity(g)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              granularity === g
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            {GRANULARITY_LABELS[g]}
          </button>
        ))}
      </div>

      {/* 撲克牌堆疊容器 */}
      <div
        className="relative select-none"
        style={{ height: `${containerHeight}px` }}
      >
        {/* 上方 peek 卡片 */}
        {abovePeeks.map(({ floorIndex, slot }) => (
          <div
            key={`peek-above-${floorIndex}`}
            className="absolute left-2 right-2 rounded-t-lg border border-b-0 border-border/60 overflow-hidden bg-card hover:bg-muted/60 transition-all cursor-pointer shadow-sm"
            style={{
              top: `${slot * PEEK_HEIGHT}px`,
              height: `${PEEK_HEIGHT}px`,
              zIndex: slot + 1,
              transform: `translateX(${(abovePeeks.length - slot) * 4}px) scale(${0.98 - (abovePeeks.length - slot) * 0.01})`,
            }}
            onClick={() => selectFloor(floorIndex)}
          >
            <div className="px-3 py-1 flex items-center gap-2 h-full">
              <span className="text-xs font-medium truncate">{getFloorTitle(floorIndex)}</span>
            </div>
          </div>
        ))}

        {/* 展開卡片（完整顯示） */}
        <div
          className="absolute left-0 right-0 rounded-lg border border-border shadow-lg overflow-auto bg-card flex"
          style={{
            top: `${abovePeeks.length * PEEK_HEIGHT}px`,
            height: `${expandedMinHeight}px`,
            zIndex: 100,
          }}
        >
          <FloorCard result={result} floorIndex={expandedIndex} />
        </div>

        {/* 下方 peek 卡片 */}
        {belowPeeks.map(({ floorIndex, slot }) => (
          <div
            key={`peek-below-${floorIndex}`}
            className="absolute left-2 right-2 rounded-b-lg border border-t-0 border-border/60 overflow-hidden bg-card hover:bg-muted/60 transition-all cursor-pointer shadow-sm"
            style={{
              bottom: `${slot * PEEK_HEIGHT}px`,
              height: `${PEEK_HEIGHT}px`,
              zIndex: slot + 1,
              transform: `translateX(${(slot + 1) * 4}px) scale(${0.98 - slot * 0.01})`,
            }}
            onClick={() => selectFloor(floorIndex)}
          >
            <div className="px-3 py-1 flex items-center gap-2 h-full">
              <span className="text-xs font-medium truncate">{getFloorTitle(floorIndex)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 導航按鈕 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <button
          onClick={goPrev}
          disabled={expandedIndex === 0}
          className="px-3 py-1.5 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← 上一層
        </button>
        <span className="tabular-nums">
          {expandedIndex + 1} / {floorCount}
        </span>
        <button
          onClick={goNext}
          disabled={expandedIndex >= floorCount - 1}
          className="px-3 py-1.5 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          下一層 →
        </button>
      </div>
    </div>
  );
}
