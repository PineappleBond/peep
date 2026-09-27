/**
 * 六爻卦象展示组件 - 左右对称式大表格
 * 结构：左侧动态旺衰列 + 本卦详情 + 变卦详情 + 右侧动态旺衰列（镜像）
 * 6 行，从上到下是上爻到初爻的顺序
 */
import { memo } from "react";
import type { LiuyaoRecord } from "../../core/personDb";
import type { VigorColumnData } from "../../core/liuyao/vigorColumns";
import type { ChartLine, ChangedLine } from "../../core/liuyao/core/types";
import { LiuyaoEmpty } from "./LiuyaoEmpty";

interface LiuyaoChartProps {
  record: LiuyaoRecord | null;
  vigorColumns: VigorColumnData | null;
}

export const LiuyaoChart = memo(function LiuyaoChart({ record, vigorColumns }: LiuyaoChartProps) {
  if (!record) {
    return <LiuyaoEmpty />;
  }

  const { chart, yong } = record;
  const { lines, changed, shi, ying } = chart;

  // 如果没有变卦，把本卦当变卦
  const changedLines = changed?.lines || lines;

  // 构建动态列索引（根据 visible 状态）
  const leftColIndices: number[] = [];
  const rightColIndices: number[] = [];
  if (vigorColumns) {
    if (vigorColumns.visible.yearly) leftColIndices.push(0);
    if (vigorColumns.visible.monthly) leftColIndices.push(1);
    if (vigorColumns.visible.daily) leftColIndices.push(2);
    if (vigorColumns.visible.hourly) leftColIndices.push(3);
    // 右侧镜像
    if (vigorColumns.visible.hourly) rightColIndices.push(4);
    if (vigorColumns.visible.daily) rightColIndices.push(5);
    if (vigorColumns.visible.monthly) rightColIndices.push(6);
    if (vigorColumns.visible.yearly) rightColIndices.push(7);
  }

  if (!vigorColumns) {
    return (
      <div className="liuyao-chart">
        <div className="liuyao-empty">请选择记录以查看卦象</div>
      </div>
    );
  }

  return (
    <div className="liuyao-chart">
      {/* 卦象基本信息 */}
      <div className="liuyao-chart-header">
        <h3>
          {chart.name} · {chart.palace}宫 · {chart.type}
        </h3>
        <div className="liuyao-meta-info">
          <div className="liuyao-meta-item">
            <span className="liuyao-meta-label">月建：</span>
            <span className="liuyao-meta-value">{chart.month.branch}</span>
          </div>
          <div className="liuyao-meta-item">
            <span className="liuyao-meta-label">日辰：</span>
            <span className="liuyao-meta-value">
              {chart.day.stem}
              {chart.day.branch}
            </span>
          </div>
          <div className="liuyao-meta-item">
            <span className="liuyao-meta-label">旬空：</span>
            <span className="liuyao-meta-value">
              {chart.day.kong[0]}
              {chart.day.kong[1]}
            </span>
          </div>
          <div className="liuyao-meta-item">
            <span className="liuyao-meta-label">世爻：</span>
            <span className="liuyao-meta-value">第{shi}爻</span>
          </div>
          <div className="liuyao-meta-item">
            <span className="liuyao-meta-label">应爻：</span>
            <span className="liuyao-meta-value">第{ying}爻</span>
          </div>
          {yong.hidden && (
            <div className="liuyao-meta-item">
              <span className="liuyao-meta-label">伏神：</span>
              <span className="liuyao-meta-value">
                {yong.hidden.stem}
                {yong.hidden.branch}（伏于第{yong.hidden.under}爻下）
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 对称式卦象大表格 */}
      <div className="liuyao-symmetric-table-wrapper">
        <table className="liuyao-symmetric-table">
          <thead>
            <tr>
              {/* 左侧动态旺衰列表头 */}
              {leftColIndices.map(idx => (
                <th
                  key={`left-${idx}`}
                  className="liuyao-time-col"
                  title={vigorColumns.columnRoles[idx]}
                >
                  {vigorColumns.columnRoles[idx]}（{vigorColumns.columnBranches[idx]}）
                </th>
              ))}
              {/* 本卦表头 */}
              <th className="liuyao-main-col" colSpan={8}>
                本卦
              </th>
              {/* 变卦表头 */}
              <th className="liuyao-main-col" colSpan={5}>
                变卦
              </th>
              {/* 右侧动态旺衰列表头（镜像） */}
              {rightColIndices.map(idx => (
                <th
                  key={`right-${idx}`}
                  className="liuyao-time-col"
                  title={vigorColumns.columnRoles[idx]}
                >
                  {vigorColumns.columnRoles[idx]}（{vigorColumns.columnBranches[idx]}）
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 6 行，从上到下是上爻到初爻（倒序：5, 4, 3, 2, 1, 0） */}
            {[5, 4, 3, 2, 1, 0].map(lineIdx => {
              const line = lines[lineIdx];
              const changedLine = changedLines[lineIdx];
              const isYong = yong.pos === line.pos;
              const isShi = shi === line.pos;
              const isYing = ying === line.pos;

              return (
                <tr key={line.pos} className="liuyao-line-row">
                  {/* 左侧动态旺衰列 */}
                  {leftColIndices.map(colIdx => (
                    <td key={`left-${colIdx}-${lineIdx}`} className="liuyao-time-col">
                      <span
                        className={`liuyao-vigor-${getVigorClass(vigorColumns.columns[colIdx][lineIdx])}`}
                      >
                        {vigorColumns.columns[colIdx][lineIdx]}
                      </span>
                    </td>
                  ))}

                  {/* 本卦详情（8 列） */}
                  <td className="liuyao-detail-col">{line.god}</td>
                  <td className="liuyao-detail-col">{line.rel}</td>
                  <td className="liuyao-detail-col">
                    {line.stem}
                    {line.elem}
                  </td>
                  <td className="liuyao-detail-col">
                    {line.branch}
                    {line.elem}
                  </td>
                  <td className="liuyao-detail-col">{line.yang ? "———" : " — —"}</td>
                  <td className="liuyao-detail-col">
                    {isShi && <span className="liuyao-shi-ying-mark">世</span>}
                    {isYing && <span className="liuyao-shi-ying-mark">应</span>}
                  </td>
                  <td className="liuyao-detail-col">
                    {yong.hidden && yong.hidden.under === lineIdx && (
                      <span className="liuyao-hidden-mark">伏</span>
                    )}
                  </td>
                  <td className="liuyao-detail-col">
                    {line.moving && <span className="liuyao-moving-mark">○</span>}
                    {isYong && <span className="liuyao-yong-marker">用</span>}
                  </td>

                  {/* 变卦详情（5 列） */}
                  <td className="liuyao-detail-col">{changedLine.yang ? "———" : " — —"}</td>
                  <td className="liuyao-detail-col">
                    {changedLine.branch}
                    {changedLine.elem}
                  </td>
                  <td className="liuyao-detail-col">
                    {changedLine.stem}
                    {changedLine.elem}
                  </td>
                  <td className="liuyao-detail-col">{changedLine.rel}</td>
                  <td className="liuyao-detail-col">{getChangedGod(changedLine, line.god)}</td>

                  {/* 右侧动态旺衰列（镜像）- 使用变卦的旺衰数据 */}
                  {rightColIndices.map(colIdx => (
                    <td key={`right-${colIdx}-${lineIdx}`} className="liuyao-time-col">
                      <span
                        className={`liuyao-vigor-${getVigorClass(vigorColumns.changedColumns[colIdx][lineIdx])}`}
                      >
                        {vigorColumns.changedColumns[colIdx][lineIdx]}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

/** 旺衰状态 → CSS 类名 */
function getVigorClass(state: string): string {
  switch (state) {
    case "旺":
      return "prosperous";
    case "相":
      return "phase";
    case "休":
      return "rest";
    case "囚":
      return "prison";
    case "死":
      return "death";
    default:
      return "rest";
  }
}

/** 变爻六神：如果没有变卦，沿用本卦六神；如果有变卦，暂时沿用本卦六神（六神不随变卦变化） */
function getChangedGod(_changedLine: ChangedLine, originalGod: string): string {
  // 六神（青龙、朱雀等）是占卜日期的天干决定的，不随变卦变化
  // 所以变爻的六神与本爻相同
  return originalGod;
}
