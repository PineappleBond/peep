import { memo } from "react";
import { BRANCHES, SCOPES, SCOPE_META, bodyPalaceBranchOf, isYangStem } from "../core/utils";
import type { Zwds } from "../core/useZwds";
import { useI18n } from "../core/i18n";

const PILLAR_LABEL_KEYS = ["center.pillarYear", "center.pillarMonth", "center.pillarDay", "center.pillarHour"];

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
  const { t } = useI18n();
  const a = z.astrolabe;
  if (!a) return <div className="center" style={{ gridArea: "c" }} />;

  const h = z.horoscope;
  const pillars = a.chineseDate.split(" ");
  const yearStem = pillars[0]?.charAt(0) ?? "";
  const zao = a.gender === "女" ? t("center.kunZao") : t("center.qianZao");
  const yinyang = `${isYangStem(yearStem) ? t("center.yang") : t("center.yin")}${a.gender === "男" ? t("common.male") : t("common.female")}`;
  const qiyun = z.decades[0]?.range[0];
  const allOff = SCOPES.every((s) => !z.visible[s]);
  const origin = a.palaces.find((p) => p.isOriginalPalace);
  const ts = z.trueSolar;

  return (
    <div className="center" style={{ gridArea: "c" }}>
      <div className="center-head">
        <h2>{t("center.title")}</h2>
        <span className="center-sub">{t("center.subtitle")}</span>
      </div>

      <div className="center-info">
        <div className="ci">
          <b>{t("center.destiny")}</b>
          <span>
            {z.input.name || t("common.unnamed")} · {zao} {yinyang}
          </span>
        </div>
        <div className="ci">
          <b>{t("center.fiveElements")}</b>
          <span>
            {a.fiveElementsClass}
            {qiyun ? ` · ${t("center.qiyun", { age: qiyun })}` : ""}
          </span>
        </div>
        <div className="ci">
          <b>{t("center.solar")}</b>
          <span>{a.solarDate}</span>
        </div>
        <div className="ci">
          <b>{t("center.lunar")}</b>
          <span>{a.lunarDate}</span>
        </div>
        <div className="ci">
          <b>{t("center.time")}</b>
          <span>
            {t("center.timeWithRange", { time: a.time, range: a.timeRange })}
          </span>
        </div>
        <div className="ci">
          <b>{t("center.zodiacSign")}</b>
          <span>
            {a.zodiac} · {a.sign}
          </span>
        </div>
        {z.input.residence && (
          <div className="ci">
            <b>{t("center.residence")}</b>
            <span title={t("center.residenceHint")}>{z.input.residence}</span>
          </div>
        )}
        {ts && (
          <div className="ci ci-wide">
            <b>{t("center.trueSolar")}</b>
            <span title={t("center.trueSolarHint", { place: ts.place, longitude: ts.longitude, eot: ts.eotMinutes.toFixed(1) })}>
              {t("center.trueSolarDetail", {
                place: ts.place,
                trueDate: ts.trueDate,
                trueTime: ts.trueTime,
                clockTime: ts.clockTime,
                offset: `${ts.offsetMinutes >= 0 ? "+" : ""}${ts.offsetMinutes.toFixed(1)}`,
                unit: t("person.lngOffsetUnit"),
              })}
            </span>
          </div>
        )}
        <div className="ci">
          <b>{t("center.soulBody")}</b>
          <span>
            {a.soul} · {a.body}
          </span>
        </div>
        <div className="ci">
          <b>{t("center.soulBodyPalace")}</b>
          <span>
            {a.earthlyBranchOfSoulPalace} · {bodyPalaceBranchOf(a.palaces, a.earthlyBranchOfBodyPalace)}
          </span>
        </div>
        {origin && (
          <div className="ci">
            <b>{t("center.originPalace")}</b>
            <span>
              {t("center.nameWithBranch", { name: origin.name, branch: origin.earthlyBranch })}
            </span>
          </div>
        )}
      </div>

      <div className="pillars">
        {pillars.map((p, i) => (
          <div className="pillar" key={i}>
            <i>{t(PILLAR_LABEL_KEYS[i])}</i>
            <b>{p.charAt(0)}</b>
            <b>{p.charAt(1)}</b>
          </div>
        ))}
      </div>

      {h && (
        <div className="target-line">
          <span className="tl-tag">{t("center.observe")}</span>
          {t("center.solarDate")} {h.solarDate} · {t("center.lunarDate")} {h.lunarDate} · {BRANCHES[z.pick.hour]}{t("center.hour")} · {t("center.nominalAge")}
          {h.age.nominalAge}
        </div>
      )}

      <div className="depth-row">
        <button className={`db db-natal ${allOff ? "on" : ""}`} onClick={z.actions.showNatal} title={t("center.natalOnly")} aria-pressed={allOff}>
          {t("center.natal")}
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
        <button className="db db-today" onClick={z.actions.resetToday} title={t("center.today")}>
          {t("center.todayLabel")}
        </button>
        {onToggleFly && (
          <button
            className={`db db-fly ${flyMode ? "on" : ""}`}
            onClick={onToggleFly}
            title={t("center.flyMode")}
            aria-pressed={flyMode}
          >
            {t("center.fly")}
          </button>
        )}
        <button
          className="db db-self on"
          title={t("center.selfMutagenMode")}
          aria-pressed={true}
        >
          {t("center.selfMutagen")}
        </button>
      </div>
    </div>
  );
});
