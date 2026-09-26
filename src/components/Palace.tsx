import { useMemo, memo } from "react";
import { util } from "iztro";
import {
  abbrPalace,
  fixIndex,
  type Scope,
  type MutagenChar,
  type ScopeSelfMark,
} from "../core/utils";
import type { PalaceData, Zwds } from "../core/useZwds";
import { StarCell } from "./StarCell";
import { useI18n } from "../core/i18n";

type ScopeDataItem = {
  scope: Scope;
  palaceName: string;
  stars: Array<{ name: string }>;
  mutagens: Array<{ star: string; char: MutagenChar }>;
  selfMutagens: Array<{ star: string; char: MutagenChar; direction: "outward" | "inward" }>;
};

/**
 * 单个宫位卡片：显示宫名/地支/主星/辅星/杂曜/四化徽章/运限宫名/长生十二神等。
 * 使用 memo 优化，避免无关渲染。
 */
export const PalaceCard = memo(function PalaceCard({
  palace,
  z,
  focus,
  onFocus,
  onDetail,
  scopeData = [],
}: {
  palace: PalaceData;
  z: Zwds;
  focus: number;
  onFocus: (i: number) => void;
  onDetail?: (i: number) => void;
  scopeData?: ScopeDataItem[];
}) {
  const { horoscope, visible } = z;
  const { t } = useI18n();
  const i = palace.index;

  /* 自化（离心）：宫干四化命中本宫星耀；跟随流派 config */
  const selfMutagens = useMemo(
    () => util.getMutagensByHeavenlyStem(palace.heavenlyStem) as string[],
    [palace.heavenlyStem],
  );

  /* 运限宫名徽章：从 scopeData 获取 */
  const chips = scopeData.map(sd => ({
    key: sd.scope,
    cls: sd.scope,
    text: abbrPalace(sd.palaceName),
  }));

  /* 流耀：从 scopeData 获取 */
  const horoStarRows = scopeData
    .filter(sd => sd.stars.length > 0)
    .map(sd => ({ scope: sd.scope, stars: sd.stars }));

  /* 按星曜名分组自化标记，供 StarCell 消费 */
  const selfMarksByStar = useMemo(() => {
    const map: Record<string, ScopeSelfMark[]> = {};
    for (const sd of scopeData) {
      for (const m of sd.selfMutagens) {
        if (!map[m.star]) map[m.star] = [];
        map[m.star].push({ scope: sd.scope, char: m.char, direction: m.direction });
      }
    }
    return map;
  }, [scopeData]);

  /* 岁前/将前十二神：看流年时切换为流年位 */
  const sui =
    visible.yearly && horoscope ? horoscope.yearly.yearlyDecStar.suiqian12[i] : palace.suiqian12;
  const jiang =
    visible.yearly && horoscope
      ? horoscope.yearly.yearlyDecStar.jiangqian12[i]
      : palace.jiangqian12;

  const isFocus = focus === i;
  const isOpp = focus >= 0 && i === fixIndex(focus + 6);
  const isTrine = focus >= 0 && (i === fixIndex(focus + 4) || i === fixIndex(focus - 4));

  const cls = [
    "palace",
    isFocus ? "is-focus" : "",
    isOpp ? "is-opp" : "",
    isTrine ? "is-trine" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cls}
      style={{ gridArea: `g${i}` }}
      onClick={() => onFocus(i)}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFocus(i);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={t("palace.palaceLabel", { name: palace.name })}
      aria-pressed={isFocus}
    >
      {isFocus && onDetail && (
        <button
          className="p-detail-btn"
          aria-label={t("palace.detailAriaLabel")}
          onClick={e => {
            e.stopPropagation();
            onDetail(i);
          }}
        >
          {t("palace.detail")}
        </button>
      )}
      <div className="p-stars">
        <div className="p-major">
          {palace.majorStars.map(s => (
            <StarCell
              key={s.name}
              star={s}
              horoscope={horoscope}
              visible={visible}
              selfMutagens={selfMutagens}
              selfScopeMarks={selfMarksByStar[s.name]}
            />
          ))}
          {palace.minorStars.map(s => (
            <StarCell
              key={s.name}
              star={s}
              horoscope={horoscope}
              visible={visible}
              selfMutagens={selfMutagens}
              selfScopeMarks={selfMarksByStar[s.name]}
            />
          ))}
        </div>
        {palace.adjectiveStars.length > 0 && (
          <div className="p-adj">
            {palace.adjectiveStars.map(s => (
              <span key={s.name}>{s.name}</span>
            ))}
          </div>
        )}
        {horoStarRows.map(r => (
          <div key={r.scope} className={`p-horostars hs-${r.scope}`}>
            {r.stars.map(s => (
              <span key={s.name}>{s.name}</span>
            ))}
          </div>
        ))}
      </div>

      <div className="p-spacer" />

      {chips.length > 0 && (
        <div className="p-chips">
          {chips.map(c => (
            <i key={c.key} className={`chip chip-${c.cls}`}>
              {c.text}
            </i>
          ))}
        </div>
      )}

      <div className="p-foot">
        <div className="p-f-l">
          <span>{palace.changsheng12}</span>
          <span>{palace.boshi12}</span>
        </div>
        <div className="p-f-m">
          <div className="p-name">
            {palace.name}
            {palace.isBodyPalace && <em className="p-body">{t("palace.bodyPalace")}</em>}
            {palace.isOriginalPalace && <em className="p-origin">{t("palace.originPalace")}</em>}
          </div>
          <div className="p-range">{palace.decadal.range.join("-")}</div>
          <div className="p-ages" title={t("palace.agesHint", { ages: palace.ages.join(" ") })}>
            {palace.ages.slice(0, 5).join(" ")}
          </div>
        </div>
        <div className="p-f-r">
          <div className="p-f12">
            <span>{sui}</span>
            <span>{jiang}</span>
          </div>
          <div className="p-gz">
            {palace.heavenlyStem}
            {palace.earthlyBranch}
          </div>
        </div>
      </div>
    </div>
  );
});
