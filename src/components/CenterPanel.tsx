import { memo } from "react";
import { BRANCHES, SCOPES, SCOPE_META, bodyPalaceBranchOf, isYangStem } from "../core/utils";
import type { Zwds } from "../core/useZwds";

const PILLAR_LABELS = ["年", "月", "日", "时"];

/**
 * 中宫面板：显示命造信息/五行局/四柱干支/观测点/运限层级切换/飞宫模式开关/自化标记。
 * 位于 4×4 盘面正中央。
 */
export const CenterPanel = memo(function CenterPanel({
  z,
  flyMode = false,
  onToggleFly,
}: {
  z: Zwds;
  flyMode?: boolean;
  onToggleFly?: () => void;
}) {
  const a = z.astrolabe;
  if (!a) return <div className="center" style={{ gridArea: "c" }} />;

  const h = z.horoscope;
  const pillars = a.chineseDate.split(" ");
  const yearStem = pillars[0]?.charAt(0) ?? "";
  const zao = a.gender === "女" ? "坤造" : "乾造";
  const yinyang = `${isYangStem(yearStem) ? "阳" : "阴"}${a.gender}`;
  const qiyun = z.decades[0]?.range[0];
  const allOff = SCOPES.every((s) => !z.visible[s]);
  const origin = a.palaces.find((p) => p.isOriginalPalace);
  const ts = z.trueSolar;

  return (
    <div className="center" style={{ gridArea: "c" }}>
      <div className="center-head">
        <h2>紫微斗数</h2>
        <span className="center-sub">ZI WEI · 玄机盘</span>
      </div>

      <div className="center-info">
        <div className="ci">
          <b>命造</b>
          <span>
            {z.input.name || "无名"} · {zao} {yinyang}
          </span>
        </div>
        <div className="ci">
          <b>五行局</b>
          <span>
            {a.fiveElementsClass}
            {qiyun ? ` · ${qiyun}岁上运` : ""}
          </span>
        </div>
        <div className="ci">
          <b>阳历</b>
          <span>{a.solarDate}</span>
        </div>
        <div className="ci">
          <b>农历</b>
          <span>{a.lunarDate}</span>
        </div>
        <div className="ci">
          <b>时辰</b>
          <span>
            {a.time}（{a.timeRange}）
          </span>
        </div>
        <div className="ci">
          <b>生肖·星座</b>
          <span>
            {a.zodiac} · {a.sign}
          </span>
        </div>
        {z.input.residence && (
          <div className="ci">
            <b>常居</b>
            <span title="常居住地：不参与排盘，随 AI 导出供地域参考">{z.input.residence}</span>
          </div>
        )}
        {ts && (
          <div className="ci ci-wide">
            <b>真太阳时</b>
            <span title={`出生地 ${ts.place} · 经度 ${ts.longitude}° · 均时差 ${ts.eotMinutes.toFixed(1)} 分`}>
              {ts.place} · {ts.trueDate} {ts.trueTime}（钟表 {ts.clockTime}，
              {ts.offsetMinutes >= 0 ? "+" : ""}
              {ts.offsetMinutes.toFixed(1)}分）
            </span>
          </div>
        )}
        <div className="ci">
          <b>命主·身主</b>
          <span>
            {a.soul} · {a.body}
          </span>
        </div>
        <div className="ci">
          <b>命宫·身宫</b>
          <span>
            {a.earthlyBranchOfSoulPalace} · {bodyPalaceBranchOf(a.palaces, a.earthlyBranchOfBodyPalace)}
          </span>
        </div>
        {origin && (
          <div className="ci">
            <b>来因宫</b>
            <span>
              {origin.name}（{origin.earthlyBranch}）
            </span>
          </div>
        )}
      </div>

      <div className="pillars">
        {pillars.map((p, i) => (
          <div className="pillar" key={i}>
            <i>{PILLAR_LABELS[i]}</i>
            <b>{p.charAt(0)}</b>
            <b>{p.charAt(1)}</b>
          </div>
        ))}
      </div>

      {h && (
        <div className="target-line">
          <span className="tl-tag">观测</span>
          公历 {h.solarDate} · 农历 {h.lunarDate} · {BRANCHES[z.pick.hour]}时 · 虚岁
          {h.age.nominalAge}
        </div>
      )}

      <div className="depth-row">
        <button className={`db db-natal ${allOff ? "on" : ""}`} onClick={z.actions.showNatal} title="只看本命盘" aria-pressed={allOff}>
          本
        </button>
        {SCOPES.map((s) => (
          <button
            key={s}
            className={`db db-${s} ${z.visible[s] ? "on" : ""}`}
            onClick={() => z.actions.toggleScope(s)}
            title={SCOPE_META[s].rowLabel}
            aria-pressed={z.visible[s]}
          >
            {SCOPE_META[s].label}
          </button>
        ))}
        <button className="db db-today" onClick={z.actions.resetToday} title="回到今天">
          今
        </button>
        {onToggleFly && (
          <button
            className={`db db-fly ${flyMode ? "on" : ""}`}
            onClick={onToggleFly}
            title="飞宫模式：点任一宫，显示该宫宫干四化飞入何宫（禄绿·权蓝·科金·忌紫）；再点关闭恢复三方四正连线"
            aria-pressed={flyMode}
          >
            飞
          </button>
        )}
        <button
          className="db db-self on"
          title="自化模式：显示运限离心（向外放射）与向心（指向本宫）自化箭头，颜色区分运限级别"
          aria-pressed={true}
        >
          化
        </button>
      </div>
    </div>
  );
});
