/**
 * 六爻卦象展示组件 - 对称式表格布局
 * 左侧 4 列（时间旺衰）+ 本卦 6 爻 + 变卦 6 爻 + 右侧 4 列（反向时间旺衰）
 */
import { memo } from "react";
import type { LiuyaoRecord } from "../../core/personDb";
import type { VigorColumnData } from "../../core/liuyao/vigorColumns";
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

  return (
    <div className="liuyao-chart">
      {/* 卦象基本信息 */}
      <div className="liuyao-chart-header">
        <h3>{chart.name}</h3>
        <div className="liuyao-meta-info">
          <div className="liuyao-meta-item">
            <span className="liuyao-meta-label">宫位：</span>
            <span className="liuyao-meta-value">{chart.palace}宫</span>
          </div>
          <div className="liuyao-meta-item">
            <span className="liuyao-meta-label">类型：</span>
            <span className="liuyao-meta-value">{chart.type}</span>
          </div>
          <div className="liuyao-meta-item">
            <span className="liuyao-meta-label">世爻：</span>
            <span className="liuyao-meta-value">第{chart.shi}爻</span>
          </div>
          <div className="liuyao-meta-item">
            <span className="liuyao-meta-label">应爻：</span>
            <span className="liuyao-meta-value">第{chart.ying}爻</span>
          </div>
        </div>
      </div>

      {/* 对称式卦象表格 */}
      <div className="liuyao-symmetric-table-wrapper">
        <table className="liuyao-symmetric-table">
          <thead>
            <tr>
              {/* 左侧旺衰列表头 */}
              {vigorColumns && (
                <>
                  <th className="liuyao-time-col">太岁</th>
                  <th className="liuyao-time-col">月建</th>
                  <th className="liuyao-time-col">日辰</th>
                  <th className="liuyao-time-col">时辰</th>
                </>
              )}
              <th>本卦</th>
              <th>变卦</th>
              {/* 右侧旺衰列表头（镜像） */}
              {vigorColumns && (
                <>
                  <th className="liuyao-time-col">时辰</th>
                  <th className="liuyao-time-col">日辰</th>
                  <th className="liuyao-time-col">月建</th>
                  <th className="liuyao-time-col">太岁</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {chart.lines.map((line, idx) => {
              const changedLine = chart.changed?.lines[idx];
              const isYong = yong.pos === line.pos;
              return (
                <tr key={line.pos} className="liuyao-line-row">
                  {/* 左侧旺衰列 */}
                  {vigorColumns && (
                    <>
                      <td className="liuyao-time-col">
                        <span
                          className={`liuyao-vigor-${getVigorClass(vigorColumns.columns[0][idx])}`}
                        >
                          {vigorColumns.columns[0][idx]}
                        </span>
                      </td>
                      <td className="liuyao-time-col">
                        <span
                          className={`liuyao-vigor-${getVigorClass(vigorColumns.columns[1][idx])}`}
                        >
                          {vigorColumns.columns[1][idx]}
                        </span>
                      </td>
                      <td className="liuyao-time-col">
                        <span
                          className={`liuyao-vigor-${getVigorClass(vigorColumns.columns[2][idx])}`}
                        >
                          {vigorColumns.columns[2][idx]}
                        </span>
                      </td>
                      <td className="liuyao-time-col">
                        <span
                          className={`liuyao-vigor-${getVigorClass(vigorColumns.columns[3][idx])}`}
                        >
                          {vigorColumns.columns[3][idx]}
                        </span>
                      </td>
                    </>
                  )}
                  {/* 本卦爻 */}
                  <td>
                    <div>
                      {line.god} · {line.rel}
                    </div>
                    <div>
                      {line.stem}
                      {line.branch}（{line.elem}）
                    </div>
                    <div>{line.yang ? "———" : " — —"}</div>
                    {line.moving && <span className="liuyao-moving-line" title="动爻" />}
                    {isYong && <span className="liuyao-yong-marker">用神</span>}
                    {line.kongState && (
                      <span className="liuyao-kong-state" title={`旬空：${line.kongState}`}>
                        空
                      </span>
                    )}
                    {chart.shi === line.pos && <span title="世爻">世</span>}
                    {chart.ying === line.pos && <span title="应爻">应</span>}
                  </td>
                  {/* 变卦爻 */}
                  <td>
                    {changedLine ? (
                      <>
                        <div>{changedLine.rel}</div>
                        <div>
                          {changedLine.stem}
                          {changedLine.branch}（{changedLine.elem}）
                        </div>
                        <div>{changedLine.yang ? "———" : " — —"}</div>
                      </>
                    ) : (
                      <div style={{ color: "var(--dim)" }}>-</div>
                    )}
                  </td>
                  {/* 右侧旺衰列（镜像） */}
                  {vigorColumns && (
                    <>
                      <td className="liuyao-time-col">
                        <span
                          className={`liuyao-vigor-${getVigorClass(vigorColumns.columns[4][idx])}`}
                        >
                          {vigorColumns.columns[4][idx]}
                        </span>
                      </td>
                      <td className="liuyao-time-col">
                        <span
                          className={`liuyao-vigor-${getVigorClass(vigorColumns.columns[5][idx])}`}
                        >
                          {vigorColumns.columns[5][idx]}
                        </span>
                      </td>
                      <td className="liuyao-time-col">
                        <span
                          className={`liuyao-vigor-${getVigorClass(vigorColumns.columns[6][idx])}`}
                        >
                          {vigorColumns.columns[6][idx]}
                        </span>
                      </td>
                      <td className="liuyao-time-col">
                        <span
                          className={`liuyao-vigor-${getVigorClass(vigorColumns.columns[7][idx])}`}
                        >
                          {vigorColumns.columns[7][idx]}
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 元信息区 */}
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
