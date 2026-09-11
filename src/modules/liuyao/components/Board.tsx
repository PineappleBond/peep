import { useState } from 'react';
import type { ChartJSON, LineValue, SixLines } from '../core/types';
import { cn } from '@/lib/utils';

interface Props {
  chart: ChartJSON;
  lines: SixLines;
  onChangeLines: (lines: SixLines) => void;
  yongPos: number | null;
}

function toggleYinYang(v: LineValue): LineValue {
  switch (v) {
    case 0: return 1;
    case 1: return 0;
    case 2: return 3;
    default: return 2;
  }
}

function toggleMoving(v: LineValue): LineValue {
  switch (v) {
    case 0: return 2;
    case 2: return 0;
    case 1: return 3;
    default: return 1;
  }
}

const POS_NAMES = ['初', '二', '三', '四', '五', '上'];
const POS_FULL = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

/** 从顶爻到初爻的渲染顺序 */
const RENDER_ORDER = [5, 4, 3, 2, 1, 0] as const;

/** 爻的状态文字描述 */
function lineStateLabel(line: { yang: boolean; moving: boolean; kong: boolean; kongState?: string | null }): string {
  const parts: string[] = [];
  parts.push(line.yang ? '阳爻' : '阴爻');
  if (line.moving) parts.push(line.yang ? '动化阴' : '动化阳');
  else parts.push('静爻');
  if (line.kong) parts.push(line.kongState === '填實' ? '填实' : line.kongState === '沖空' ? '冲空' : '逢空');
  return parts.join(' · ');
}

export function Board({ chart, lines, onChangeLines, yongPos }: Props) {
  const setLine = (idx: number, v: LineValue) => {
    const next = [...lines] as SixLines;
    next[idx] = v;
    onChangeLines(next);
  };

  const [detailIdx, setDetailIdx] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {/* Compact header — all meta in one/two lines */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="text-primary font-semibold">{chart.name}</span>
        <span className="text-muted-foreground text-xs">
          {chart.palace}宫（{chart.palaceElem}）· {chart.type}
        </span>
        <span className="text-muted-foreground text-xs ml-auto">
          月建 <b className="text-foreground">{chart.month.branch}</b>（{chart.month.elem}）
          {' · '}
          日辰 <b className="text-foreground">{chart.day.stem}{chart.day.branch}</b>（{chart.day.elem}）
          {' · '}
          旬空 <b className="text-foreground">{chart.day.kong.join('')}</b>
        </span>
      </div>

      {/* Yao grid — full width, no time rail */}
      <div className="flex flex-col gap-px bg-border rounded-lg overflow-hidden border border-border">
        {RENDER_ORDER.map((idx) => {
          const line = chart.lines[idx];
          const pos = idx + 1;
          const isYong = yongPos === pos;
          const isShi = chart.shi === pos;
          const isYing = chart.ying === pos;
          const isDetail = detailIdx === idx;

          return (
            <div key={pos}>
              <div
                className={cn(
                  'grid grid-cols-[40px_minmax(100px,1.2fr)_1fr_auto] items-center gap-2 px-2.5 py-1.5 bg-card text-sm transition-colors cursor-pointer',
                  isYong && 'liuyao-yong-row',
                  isDetail && 'liuyao-detail-row',
                )}
                onClick={() => setDetailIdx(isDetail ? null : idx)}
              >
                {/* Six God */}
                <span className="text-muted-foreground text-xs liuyao-god" title={`六神：${line.god}`}>{line.god}</span>

                {/* Relation + Ganzhi + Element */}
                <span className="text-sm tabular-nums">
                  <span className="text-primary font-medium mr-1">{line.rel}</span>
                  <span>{line.stem}{line.branch}</span>
                  <span className="text-muted-foreground text-xs ml-0.5">{line.elem}</span>
                  {line.kong && (
                    <span className="liuyao-kong-tag text-[10px] text-muted-foreground border border-dashed border-border rounded px-0.5 ml-1">
                      {line.kongState === '填實' ? '填实' : line.kongState === '沖空' ? '冲空' : '空'}
                    </span>
                  )}
                </span>

                {/* Yao shape — clickable, stop propagation */}
                <span
                  className="flex gap-2 h-4 items-center cursor-pointer"
                  title="点击切换阴阳"
                  onClick={(e) => { e.stopPropagation(); setLine(idx, toggleYinYang(lines[idx])); }}
                >
                  {line.yang ? (
                    <span className={cn('h-2.5 rounded-sm flex-1 transition-colors', line.moving ? 'liuyao-moving' : 'bg-foreground/70 hover:bg-primary')} />
                  ) : (
                    <>
                      <span className={cn('h-2.5 rounded-sm flex-1 transition-colors', line.moving ? 'liuyao-moving' : 'bg-foreground/70 hover:bg-primary')} />
                      <span className="w-5" />
                      <span className={cn('h-2.5 rounded-sm flex-1 transition-colors', line.moving ? 'liuyao-moving' : 'bg-foreground/70 hover:bg-primary')} />
                    </>
                  )}
                </span>

                {/* Right side: shi/ying + moving checkbox */}
                <span className="flex items-center gap-1.5">
                  {isShi && (
                    <span className="liuyao-shi">世</span>
                  )}
                  {isYing && (
                    <span className="liuyao-ying">应</span>
                  )}
                  <label
                    className="flex items-center gap-0.5 text-[11px] text-muted-foreground cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    title="动爻"
                  >
                    <input
                      type="checkbox"
                      className="accent-red-500 w-3 h-3 cursor-pointer"
                      checked={line.moving}
                      onChange={() => setLine(idx, toggleMoving(lines[idx]))}
                    />
                    <span className={line.moving ? 'text-red-500 font-medium' : ''}>动</span>
                  </label>
                </span>
              </div>

              {/* Expanded detail row */}
              {isDetail && (
                <div className="liuyao-line-detail px-3 py-2 text-xs bg-card border-t border-border/50">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">爻位：<strong>{POS_FULL[idx]}</strong></span>
                    <span className="text-muted-foreground">状态：<strong>{lineStateLabel(line)}</strong></span>
                    <span className="text-muted-foreground">六亲：<strong className="text-primary">{line.rel}</strong></span>
                    <span className="text-muted-foreground">六神：<strong>{line.god}</strong></span>
                    <span className="text-muted-foreground">干支：<strong>{line.stem}{line.branch}</strong></span>
                    <span className="text-muted-foreground">五行：<strong>{line.elem}</strong></span>
                    {isShi && <span className="text-amber-600 dark:text-amber-400">此爻为世</span>}
                    {isYing && <span className="text-muted-foreground">此爻为应</span>}
                    {isYong && <span className="text-amber-600 dark:text-amber-400 font-medium">用神所在</span>}
                  </div>
                  {chart.changed && line.moving && (
                    <div className="mt-1.5 pt-1.5 border-t border-dashed border-border/50">
                      <span className="text-red-500">
                        变爻：{chart.changed.lines[idx].stem}{chart.changed.lines[idx].branch}（{chart.changed.lines[idx].elem}）· {chart.changed.lines[idx].rel}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Changed hexagram — vertical layout */}
      {chart.changed && (
        <div className="liuyao-changed-gua border border-dashed border-red-300 dark:border-red-800 rounded-lg p-2.5 space-y-1.5">
          <div className="text-xs font-medium text-red-500 flex items-center gap-1.5">
            <span className="liuyao-changed-dot" />
            变卦：{chart.changed.name}
          </div>
          <div className="flex flex-col gap-1">
            {RENDER_ORDER.map((idx) => {
              const cl = chart.changed!.lines[idx];
              const orig = chart.lines[idx];
              const isChanged = orig.moving;
              return (
                <div
                  key={idx}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors',
                    isChanged && 'liuyao-changed-line bg-red-50 dark:bg-red-950/20',
                  )}
                >
                  <span className="text-muted-foreground w-8">{POS_NAMES[idx]}</span>
                  <span className={cn('flex gap-1.5 h-3 flex-1')}>
                    {cl.yang ? (
                      <span className="h-2 rounded-sm liuyao-changed-yao flex-1" />
                    ) : (
                      <>
                        <span className="h-2 rounded-sm liuyao-changed-yao flex-1" />
                        <span className="w-3" />
                        <span className="h-2 rounded-sm liuyao-changed-yao flex-1" />
                      </>
                    )}
                  </span>
                  <span className="text-muted-foreground w-16 text-right">
                    {cl.stem}{cl.branch}
                  </span>
                  <span className="text-primary text-[11px] w-12">{cl.rel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Yong summary */}
      {yongPos !== null && (
        <div className="liuyao-yong-summary text-xs px-1">
          用神：<span className="text-foreground font-medium">{chart.lines[yongPos - 1].rel}</span>
          {' '}在第{yongPos}爻（{chart.lines[yongPos - 1].stem}{chart.lines[yongPos - 1].branch}
          {chart.lines[yongPos - 1].elem}）
          {chart.lines[yongPos - 1].kong && ' · 逢空'}
          {chart.lines[yongPos - 1].moving && ' · 动'}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground px-1">
        点爻行展开详情 · 点爻形切换阴阳 · 勾「动」标动爻 · 金框＝用神
      </div>
    </div>
  );
}
