import { useHoroscopeStore } from "@/stores/horoscopeStore";
import { ShenShaMatcher } from "../core/ShenShaMatcher";
import type { DetailedChart, PillarDetail } from "../detailedChartTypes";
import {
  TWELVE_STAGES, NAYIN, HIDDEN_STEMS, WX_NAME,
  elementOf, elementGlyph, elementName,
  getShiShen, calcKongWang,
} from "../core/domainConstants";

/* ──────────────── 常量（从 domainConstants 统一导入） ──────────────── */

const PILLAR_KEYS_MAP = { year: "year_pillar", month: "month_pillar", day: "day_pillar", hour: "hour_pillar" } as const;

function computeHoroscopeShenSha(
  chartData: any, gender: "male" | "female", label: string, stem: string, branch: string,
): string[] {
  const b = chartData?.bazi || {};
  const input: Record<string, { gan: string; zhi: string }> = {};
  for (const [cn, en] of Object.entries({ 年柱: "year_pillar", 月柱: "month_pillar", 日柱: "day_pillar", 时柱: "hour_pillar" })) {
    const p = b[en] || {};
    input[cn] = { gan: p.heavenly_stem || "", zhi: p.earthly_branch || "" };
  }
  const matcher = new ShenShaMatcher();
  const matches = matcher.matchAll(input, { [label]: { gan: stem, zhi: branch } }, { gender: gender === "male" ? "0" : "1" });
  const names: string[] = [];
  for (const r of matches) {
    for (const m of r.matches || []) {
      if (m.target_pillar === label && r.name && !names.includes(r.name)) names.push(r.name);
    }
  }
  return names;
}

/* ──────────────── 数据构建 ─────────────── */

/** 从原始 chartData + store 数据构建 DetailedChart（纯函数，可被 API 层复用） */
// eslint-disable-next-line react/only-export-components
export function buildDetailedChart(
  chartData: any,
  dayun: any,
  liunian: any,
  liuyue: any,
  liuri: any,
  liushi: any,
  gender: "male" | "female",
): DetailedChart {
  const d = chartData;
  const b = d?.bazi || {};
  const s = d?.shi_shen || {};
  const h = d?.hidden_stems || {};
  const dayStem = d.day_master?.stem || "";
  const dayStar = gender === "female" ? "元女" : "元男";
  const dmWx = elementOf(dayStem);
  const dayMaster = dmWx ? `${dayStem}${WX_NAME[dmWx]}` : dayStem;

  /** 构建四柱 PillarDetail */
  function buildPillar(name: "year" | "month" | "day" | "hour", label: string): PillarDetail {
    const key = PILLAR_KEYS_MAP[name];
    const pillar = b[key];
    const stem = pillar?.heavenly_stem || "";
    const branch = pillar?.earthly_branch || "";
    const hiddenRaw = (h[name] || []) as any[];
    return {
      label,
      element: elementOf(stem),
      branchElement: elementOf(branch),
      zhuXing: name === "day" ? dayStar : s[name + "_stem"] || "—",
      tianGan: stem,
      diZhi: branch,
      cangGan: hiddenRaw.map((x: any) => ({
        stem: x.stem,
        element: x.element ? WX_NAME[elementOf(x.stem)] || elementOf(x.stem) : elementOf(x.stem),
      })),
      wuXing: elementName(stem),
      shiShen: name === "day" ? "日元" : s[name + "_stem"] || "—",
      shiJian: `${d.year || ""}年`,
      fuXing: hiddenRaw.map((x: any) => x.shi_shen).filter(Boolean),
      xingYun: d.xing_yun?.[name] || "—",
      ziZuo: d.zi_zuo?.[name] || "—",
      kongWang: d.kong_wang?.[name] || "—",
      naYin: d.nayin?.[name] || "—",
      shenSha: (() => {
        const items = d.shen_sha?.[name] || [];
        return Array.isArray(items) ? items : String(items || "").split("、").filter(Boolean);
      })(),
    };
  }

  /** 构建运限 PillarDetail */
  function buildHoroscopePillar(opts: {
    label: string; stem: string; branch: string; timeInfo: string;
    hiddenStems?: Array<{ stem: string; shi_shen: string }>;
    nayin?: string; shensha?: string[];
  }): PillarDetail {
    const { label, stem, branch, timeInfo } = opts;
    const pillar = stem + branch;
    const branchHidden = HIDDEN_STEMS[branch] || [];
    const hidden = opts.hiddenStems ?? branchHidden.map(s => ({ stem: s, shi_shen: getShiShen(dayStem, s) }));
    return {
      label,
      element: elementOf(stem),
      branchElement: elementOf(branch),
      zhuXing: getShiShen(dayStem, stem) || "—",
      tianGan: stem,
      diZhi: branch,
      cangGan: hidden.map(x => ({ stem: x.stem, element: elementOf(x.stem) })),
      wuXing: elementName(stem),
      shiShen: getShiShen(dayStem, stem),
      shiJian: timeInfo,
      fuXing: hidden.map(x => x.shi_shen).filter(Boolean),
      xingYun: TWELVE_STAGES[stem]?.[branch] || "—",
      ziZuo: TWELVE_STAGES[stem]?.[branch] || "—",
      kongWang: calcKongWang(pillar),
      naYin: opts.nayin || NAYIN[pillar] || "—",
      shenSha: opts.shensha || [],
    };
  }

  const columns: PillarDetail[] = [];

  // 大运
  if (dayun && d.da_yun) {
    const idx = d.da_yun.findIndex((dy: any) => dy.heavenly_stem === dayun.tianGan && dy.earthly_branch === dayun.diZhi);
    const data = idx >= 0 ? d.da_yun[idx] : null;
    if (data) {
      columns.push(buildHoroscopePillar({
        label: "大运", stem: dayun.tianGan, branch: dayun.diZhi,
        timeInfo: `${dayun.startAge}-${dayun.startAge + 9}岁`,
        hiddenStems: data.hidden_stems, nayin: data.nayin, shensha: data.shen_sha || [],
      }));
    }
  }

  // 流年
  if (liunian && d.da_yun) {
    const dyIdx = d.da_yun.findIndex((dy: any) => {
      const startAge = dy.start_age ?? 0;
      return liunian.age >= startAge && liunian.age < startAge + 10;
    });
    if (dyIdx >= 0) {
      const lnData = d.da_yun[dyIdx].liu_nian?.find((ln: any) => Number(ln.year) === liunian.year);
      if (lnData) {
        columns.push(buildHoroscopePillar({
          label: "流年", stem: liunian.tianGan, branch: liunian.diZhi,
          timeInfo: `${liunian.year}年 ${liunian.age}岁`,
          hiddenStems: lnData.hidden_stems, nayin: lnData.nayin,
          shensha: d.shen_sha_full?.liunian?.[dyIdx]?.[liunian.year]?.[1] || [],
        }));
      }
    }
  }

  // 流月
  if (liuyue) {
    columns.push(buildHoroscopePillar({
      label: "流月", stem: liuyue.tianGan, branch: liuyue.diZhi,
      timeInfo: `${liuyue.month}月`,
      shensha: computeHoroscopeShenSha(d, gender, "流月", liuyue.tianGan, liuyue.diZhi),
    }));
  }

  // 流日
  if (liuri) {
    columns.push(buildHoroscopePillar({
      label: "流日", stem: liuri.tianGan, branch: liuri.diZhi,
      timeInfo: `${liuri.day}日`,
      shensha: computeHoroscopeShenSha(d, gender, "流日", liuri.tianGan, liuri.diZhi),
    }));
  }

  // 流时
  if (liushi) {
    columns.push(buildHoroscopePillar({
      label: "流时", stem: liushi.tianGan, branch: liushi.diZhi,
      timeInfo: liushi.label,
      shensha: computeHoroscopeShenSha(d, gender, "流时", liushi.tianGan, liushi.diZhi),
    }));
  }

  // 四柱
  columns.push(buildPillar("year", "年柱"));
  columns.push(buildPillar("month", "月柱"));
  columns.push(buildPillar("day", "日柱"));
  columns.push(buildPillar("hour", "时柱"));

  return {
    dayMaster,
    wuXingLack: "", // 由调用方按需填充
    currentFortune: "", // 由调用方按需填充
    columns,
  };
}

/* ──────────────── 组件 ──────────────── */

interface ZhenyiChartWithHighlightProps {
  chartData: any;
  gender?: "male" | "female";
}

export function ZhenyiChartWithHighlight({ chartData, gender = "male" }: ZhenyiChartWithHighlightProps) {
  const { dayun, liunian, liuyue, liuri, liushi, getPathSummary } = useHoroscopeStore();

  if (!chartData) return null;

  const chart = buildDetailedChart(chartData, dayun, liunian, liuyue, liuri, liushi, gender);
  const pathSummary = getPathSummary();

  return (
    <div className="space-y-3">
      {/* 运势摘要面板 */}
      {pathSummary.length > 0 && (
        <div className="border rounded-lg bg-accent/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">当前运势:</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
              {pathSummary.map((item, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground/50">›</span>}
                  <span className="text-foreground font-medium">{item}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chart Table */}
      <div className="zy-chart">
        <div className="zy-chart-table">

          {/* Header row */}
          <div className="zy-row zy-row-head">
            <span className="zy-label">日期</span>
            {chart.columns.map((col, i) => (
              <span key={`h-${i}`} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                {col.label}
              </span>
            ))}
          </div>

          {/* 主星 */}
          <div className="zy-row">
            <span className="zy-label">主星</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                {col.zhuXing || "—"}
              </span>
            ))}
          </div>

          {/* 天干 */}
          <div className="zy-row">
            <span className="zy-label">天干</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell zy-ganzhi ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                <span className="zy-ganzhi-token">
                  <b className={`zy-ganzhi-char ${col.element}`}>{col.tianGan}</b>
                  <i className="zy-wx-icon">{elementGlyph(col.tianGan)}</i>
                </span>
              </span>
            ))}
          </div>

          {/* 地支 */}
          <div className="zy-row">
            <span className="zy-label">地支</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell zy-ganzhi ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                <span className="zy-ganzhi-token">
                  <b className={`zy-ganzhi-char ${col.branchElement}`}>{col.diZhi}</b>
                  <i className="zy-wx-icon">{elementGlyph(col.diZhi)}</i>
                </span>
              </span>
            ))}
          </div>

          {/* 藏干 */}
          <div className="zy-row">
            <span className="zy-label">藏干</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                {col.cangGan.length ? col.cangGan.map((item, j) => (
                  <i key={j} className="zy-hidden-item">
                    <b className={item.element}>{item.stem}{WX_NAME[item.element] || item.element}</b>
                  </i>
                )) : "—"}
              </span>
            ))}
          </div>

          {/* 五行 */}
          <div className="zy-row">
            <span className="zy-label">五行</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""} ${col.element ? `wx-${col.element}` : ""}`}>
                {col.wuXing || "—"}
              </span>
            ))}
          </div>

          {/* 十神 */}
          <div className="zy-row">
            <span className="zy-label">十神</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                {col.shiShen || "—"}
              </span>
            ))}
          </div>

          {/* 时间 */}
          <div className="zy-row">
            <span className="zy-label">时间</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""} text-muted-foreground text-xs`}>
                {col.shiJian || "—"}
              </span>
            ))}
          </div>

          {/* 副星 */}
          <div className="zy-row">
            <span className="zy-label">副星</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                {col.fuXing.length ? col.fuXing.map((x, j) => (
                  <i key={j} className="zy-stack-item">{x}</i>
                )) : "—"}
              </span>
            ))}
          </div>

          {/* 星运 */}
          <div className="zy-row">
            <span className="zy-label">星运</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                {col.xingYun || "—"}
              </span>
            ))}
          </div>

          {/* 自坐 */}
          <div className="zy-row">
            <span className="zy-label">自坐</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                {col.ziZuo || "—"}
              </span>
            ))}
          </div>

          {/* 空亡 */}
          <div className="zy-row">
            <span className="zy-label">空亡</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                {col.kongWang || "—"}
              </span>
            ))}
          </div>

          {/* 纳音 */}
          <div className="zy-row">
            <span className="zy-label">纳音</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                {col.naYin || "—"}
              </span>
            ))}
          </div>

          {/* 神煞 */}
          <div className="zy-row">
            <span className="zy-label">神煞</span>
            {chart.columns.map((col, i) => (
              <span key={i} className={`zy-cell zy-shensha-cell ${col.label === "日柱" ? "zy-day-col" : ""}`}>
                {col.shenSha.length ? col.shenSha.map((x, j) => (
                  <span key={j} className="zy-sha-item">{x}</span>
                )) : "—"}
              </span>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
