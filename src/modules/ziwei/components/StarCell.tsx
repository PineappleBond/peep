import { memo, useState } from "react";
import { MUTAGEN_CHARS, SCOPES, type Scope } from "../core/utils";
import type { Horoscope } from "../core/useZwds";

type StarLike = {
  name: string;
  type?: string;
  brightness?: string;
  mutagen?: string;
};

/** 星耀类型的中文说明 */
const STAR_TYPE_LABEL: Record<string, string> = {
  major: "主星",
  soft: "吉星",
  tough: "煞星",
  lucun: "禄存",
  tianma: "天马",
  flower: "桃花",
  helper: "辅星",
  adjective: "杂耀",
};

/** 单颗星：竖排星名 + 亮度 + 生年四化（实心）/ 自化（虚线）/ 运限四化（描边按限色） */
export const StarCell = memo(function StarCell({
  star,
  horoscope,
  visible,
  selfMutagens,
}: {
  star: StarLike;
  horoscope?: Horoscope | null;
  visible?: Record<Scope, boolean>;
  /** 本宫宫干四化表（[禄权科忌] 星名），用于自化 */
  selfMutagens?: string[];
}) {
  const [showTip, setShowTip] = useState(false);

  const scopeMuts: { scope: Scope; char: string }[] = [];
  if (horoscope && visible) {
    for (const s of SCOPES) {
      if (!visible[s]) continue;
      const k = (horoscope[s].mutagen as string[]).indexOf(star.name);
      if (k >= 0) scopeMuts.push({ scope: s, char: MUTAGEN_CHARS[k] });
    }
  }

  const selfIdx = selfMutagens ? selfMutagens.indexOf(star.name) : -1;
  const selfChar = selfIdx >= 0 ? MUTAGEN_CHARS[selfIdx] : null;

  const typeLabel = STAR_TYPE_LABEL[star.type ?? "adjective"] ?? "星耀";
  const mutParts: string[] = [];
  if (star.mutagen) mutParts.push(`生年${star.mutagen}`);
  if (selfChar) mutParts.push(`自化${selfChar}`);
  scopeMuts.forEach(m => {
    const scopeLabel = m.scope === "decadal" ? "大限" : m.scope === "yearly" ? "流年" : m.scope === "monthly" ? "流月" : m.scope === "daily" ? "流日" : "流时";
    mutParts.push(`${scopeLabel}${m.char}`);
  });

  return (
    <div
      className={`star star-${star.type ?? "adjective"}`}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span className="star-name">{star.name}</span>
      <span className="star-bright">{star.brightness || "　"}</span>
      {(star.mutagen || selfChar || scopeMuts.length > 0) && (
        <span className="star-muts">
          {star.mutagen && (
            <b className="mut mut-natal" data-m={star.mutagen}>
              {star.mutagen}
            </b>
          )}
          {selfChar && (
            <b
              className="mut mut-self"
              data-m={selfChar}
              title={`自化${selfChar}（宫干四化入本宫·离心）`}
            >
              {selfChar}
            </b>
          )}
          {scopeMuts.map((m) => (
            <b key={m.scope} className={`mut mut-scope mut-${m.scope}`} data-m={m.char}>
              {m.char}
            </b>
          ))}
        </span>
      )}
      {showTip && (
        <div className="star-tooltip">
          <div className="star-tip-name">{star.name}</div>
          <div className="star-tip-meta">
            <span>{typeLabel}</span>
            {star.brightness && <span>亮度：{star.brightness}</span>}
          </div>
          {mutParts.length > 0 && (
            <div className="star-tip-mut">{mutParts.join(" · ")}</div>
          )}
        </div>
      )}
    </div>
  );
});
