/**
 * FloorCard —— 單張撲克牌卡片
 *
 * 佈局（CSS Grid）：
 *   左側：item1 | item2（上層時間影響，對稱）
 *   中間：神 | 亲 | 干支 | 五行 | 爻 | 世应 | 伏 | 動
 *   中間右：變爻 | 變五行 | 變干支 | 变亲 | 变神
 *   右側：item2 | item1（本層時間影響，對稱）
 *
 * floorIndex 决定显示哪一层的 时间对
 */

import { useMemo } from 'react';
import type { 六爻结果, 变爻 } from '@/lib/peep-api-liuyao';
import type { VigorState } from '@/modules/liuyao/core/timeFloors';
import { cn } from '@/lib/utils';

interface Props {
  result: 六爻结果;
  floorIndex: number;
}

const VIGOR_STYLES: Record<VigorState, string> = {
  '旺': 'text-amber-600 dark:text-amber-400 font-semibold',
  '相': 'text-green-600 dark:text-green-400',
  '休': 'text-sky-600 dark:text-sky-400',
  '囚': 'text-orange-600 dark:text-orange-400',
  '死': 'text-rose-600 dark:text-rose-400 font-semibold',
};

/** 爻象繪製：陽爻 ━━━ / 陰爻 ━ ━ */
function YaoShape({ yang, moving, changed }: { yang: boolean; moving: boolean; changed?: boolean }) {
  const cls = cn(
    'h-1.5 rounded-sm flex-1',
    moving && !changed && 'bg-red-500',
    changed && 'bg-red-400',
    !moving && !changed && 'bg-foreground/70',
  );
  if (yang) {
    return <span className={cls} />;
  }
  return (
    <span className="flex gap-1.5 flex-1">
      <span className={cls} />
      <span className="w-2 shrink-0" />
      <span className={cls} />
    </span>
  );
}

const POS_NAMES = ['初', '二', '三', '四', '五', '上'];

export function FloorCard({ result, floorIndex }: Props) {
  const { 本卦: origin, 变卦: changed } = result;

  // 建立变爻索引（爻位 -> 变爻）
  const changedMap = useMemo(() => {
    if (!changed) return new Map<number, 变爻>();
    const map = new Map<number, 变爻>();
    changed.爻.forEach((l) => map.set(l.爻位, l));
    return map;
  }, [changed]);

  const order = [5, 4, 3, 2, 1, 0]; // 上爻 → 初爻（由上而下）

  // 获取第一爻的第一层作为标题参考
  const firstLine = origin.爻[0];
  const firstPair = firstLine?.楼层[floorIndex];
  if (!firstPair) return null;

  return (
    <div className="flex flex-col m-auto min-w-[720px] bg-card text-foreground select-none">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/60 bg-muted/30 shrink-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-semibold text-sm">{origin.卦名}</span>
          <span className="text-xs text-muted-foreground">
            {origin.宫}宫（{origin.宫五行}）· {origin.类型}
          </span>
          {changed && (
            <span className="text-xs text-muted-foreground">
              → {changed.卦名}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {firstPair.上层.标题} · {firstPair.本层.标题}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[60px_60px_28px_32px_48px_32px_36px_32px_24px_20px_36px_32px_48px_32px_28px_60px_60px] text-[10px] text-center border-b border-border/40 bg-muted/20 shrink-0 min-w-[720px]">
        {/* 左侧时间 */}
        <div className="py-1 text-muted-foreground border-r border-border/30">
          {firstPair.上层.标题}
        </div>
        <div className="py-1 text-muted-foreground border-r border-border/30">
          {firstPair.本层.标题}
        </div>
        {/* 本卦信息 */}
        <div className="py-1 text-muted-foreground">神</div>
        <div className="py-1 text-muted-foreground">亲</div>
        <div className="py-1 text-muted-foreground">干支</div>
        <div className="py-1 text-muted-foreground">五行</div>
        <div className="py-1 text-muted-foreground">爻</div>
        <div className="py-1 text-muted-foreground">世應</div>
        <div className="py-1 text-muted-foreground">伏</div>
        <div className="py-1 text-muted-foreground">動</div>
        {/* 變爻信息 */}
        <div className="py-1 text-muted-foreground">變</div>
        <div className="py-1 text-muted-foreground">五行</div>
        <div className="py-1 text-muted-foreground">干支</div>
        <div className="py-1 text-muted-foreground">亲</div>
        <div className="py-1 text-muted-foreground">神</div>
        {/* 右侧时间（对称） */}
        <div className="py-1 text-muted-foreground border-l border-border/30">
          {firstPair.本层.标题}
        </div>
        <div className="py-1 text-muted-foreground">
          {firstPair.上层.标题}
        </div>
      </div>

      {/* Lines (top to bottom: 6 → 1) */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[60px_60px_28px_32px_48px_32px_36px_32px_24px_20px_36px_32px_48px_32px_28px_60px_60px] min-w-[720px]">
          {order.map((idx) => {
            const line = origin.爻[idx];
            const originPair = line.楼层[floorIndex];
            if (!originPair) return null;

            const changedLine = changedMap.get(line.爻位);
            // 变爻的楼层（用于右侧旺衰）
            const changedPair = changedLine?.楼层[floorIndex];
            const isShi = origin.世 === line.爻位;
            const isYing = origin.应 === line.爻位;

            return (
              <div
                key={idx}
                className={cn(
                  'contents',
                  line.动 && '[&>*]:bg-red-50/40 dark:[&>*]:bg-red-950/15',
                )}
              >
                {/* Col 1: 左侧上层旺衰（本爻） */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px]">
                  <span className={cn(VIGOR_STYLES[originPair.上层.旺衰])}>{originPair.上层.旺衰}</span>
                </div>

                {/* Col 2: 左侧本层旺衰（本爻） */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px]">
                  <span className={cn(VIGOR_STYLES[originPair.本层.旺衰])}>{originPair.本层.旺衰}</span>
                </div>

                {/* Col 3: 六神 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px]">
                  <span className="text-muted-foreground">{line.六神}</span>
                </div>

                {/* Col 4: 六亲 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px]">
                  <span className="text-primary font-medium">{line.六亲}</span>
                </div>

                {/* Col 5: 干支 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px] tabular-nums">
                  {line.天干}{line.地支}
                </div>

                {/* Col 6: 五行 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px]">
                  <span className="text-muted-foreground">{line.五行}</span>
                </div>

                {/* Col 7: 爻象 */}
                <div className="flex items-center gap-0.5 px-1 border-b border-r border-border/30">
                  <YaoShape yang={line.阳} moving={line.动} />
                </div>

                {/* Col 8: 世应 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[10px]">
                  <span className="text-muted-foreground">{POS_NAMES[idx]}</span>
                  {isShi && <span className="liuyao-shi ml-0.5">世</span>}
                  {isYing && <span className="liuyao-ying ml-0.5">應</span>}
                </div>

                {/* Col 9: 伏藏 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[9px]">
                  {line.伏藏 ? (
                    <span className="text-muted-foreground border border-dashed border-border rounded px-0.5">
                      {line.伏藏.天干}{line.伏藏.地支}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </div>

                {/* Col 10: 动 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[10px]">
                  {line.动 && <span className="text-red-500">○</span>}
                  {line.空 && (
                    <span className="text-[8px] text-muted-foreground border border-dashed border-border rounded px-0.5 ml-0.5">
                      {line.空状态 === '填實' ? '填' : line.空状态 === '沖空' ? '沖' : '空'}
                    </span>
                  )}
                </div>

                {/* Col 11: 变爻象 */}
                <div className="flex items-center justify-center border-b border-r border-border/30">
                  {changedLine ? (
                    <YaoShape yang={changedLine.阳} moving={false} changed />
                  ) : (
                    <span className="text-muted-foreground/30 text-[10px]">—</span>
                  )}
                </div>

                {/* Col 12: 变五行 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px]">
                  {changedLine ? (
                    <span className="text-muted-foreground">{changedLine.五行}</span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </div>

                {/* Col 13: 变干支 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px] tabular-nums">
                  {changedLine ? (
                    <>{changedLine.天干}{changedLine.地支}</>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </div>

                {/* Col 14: 变六亲 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px]">
                  {changedLine ? (
                    <span className="text-primary font-medium">{changedLine.六亲}</span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </div>

                {/* Col 15: 变六神 */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px]">
                  {changedLine ? (
                    <span className="text-muted-foreground">{changedLine.六神}</span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </div>

                {/* Col 16: 右侧本层旺衰（变爻） */}
                <div className="flex items-center justify-center border-b border-r border-border/30 text-[11px]">
                  {changedPair ? (
                    <span className={cn(VIGOR_STYLES[changedPair.本层.旺衰])}>{changedPair.本层.旺衰}</span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </div>

                {/* Col 17: 右侧上层旺衰（变爻） */}
                <div className="flex items-center justify-center border-b border-border/30 text-[11px]">
                  {changedPair ? (
                    <span className={cn(VIGOR_STYLES[changedPair.上层.旺衰])}>{changedPair.上层.旺衰}</span>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
