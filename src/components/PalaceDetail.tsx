import { useEffect, useMemo, useRef, memo } from "react";
import { SCOPES, SCOPE_META } from "../core/utils";
import { getSelfMarksForScope, buildChartIndex } from "../core/analysis";
import type { Zwds } from "../core/useZwds";
import { useI18n } from "../core/i18n";

/** 宫位详情弹层：三方四正快照 + 飞宫四化/自化 + 相关格局 + 夹宫 + 借星 */
export const PalaceDetail = memo(function PalaceDetail({
  z,
  index,
  onClose,
}: {
  z: Zwds;
  index: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const a = z.astrolabe;
  const an = z.analysis;

  /* 生成稳定的标题 id，供 aria-labelledby 引用 */
  const titleId = `pd-title-${index}`;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* 焦点陷阱：Tab / Shift+Tab 在弹层内循环 */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        el => el.offsetParent !== null,
      ); // 仅可见元素
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    panel.addEventListener("keydown", onKey);
    return () => panel.removeEventListener("keydown", onKey);
  }, []);

  /* 打开时自动聚焦弹层内第一个可聚焦元素 */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const first = panel.querySelector<HTMLElement>(focusableSelector);
    first?.focus();
  }, []);

  /* 运限自化：按 visible scope 计算 —— 移到条件 return 之前以满足 hooks 规则 */
  const scopeSelfMarks = useMemo(() => {
    if (!a || !z.horoscope) return [];
    const chartIndex = buildChartIndex(a);
    const visibleScopes = SCOPES.filter(s => {
      if (s === "decadal" && z.activeDecadeIdx === -1) return false; // 童限跳过
      return z.visible[s];
    });
    return visibleScopes.map(scope => {
      const palaceIdx = z.horoscope![scope].index;
      const stem = z.horoscope![scope].heavenlyStem as string;
      const marks = getSelfMarksForScope(palaceIdx, stem, a, chartIndex);
      return { scope, outward: marks.outward, inward: marks.inward };
    });
  }, [a, z.horoscope, z.visible, z.activeDecadeIdx]);

  if (!a || !an) return null;
  const palace = a.palaces[index];
  if (!palace) return null;

  const snap = an.sanfang.find(s => s.palaceIndex === index);
  const fly = an.flyMatrix.palaces.find(p => p.palaceIndex === index);
  const jiChain = an.mutagenChains.ji.find(c => c.headIndex === index);
  const luChain = an.mutagenChains.lu.find(c => c.headIndex === index);
  const jia = an.jiaGong.filter(j => j.palaceIndex === index);
  // 该宫格局；全盘级格局（如日月反背，where 不以任何宫名开头）兜底归入命宫弹层
  const patterns = an.patterns.filter(p => {
    if (p.where.startsWith(`${palace.name}(`)) return true;
    if (palace.name === "命宫") {
      return !a.palaces.some(x => p.where.startsWith(`${x.name}(`));
    }
    return false;
  });

  return (
    <div
      className="pd-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div className="pd-panel" ref={panelRef} onClick={e => e.stopPropagation()}>
        <div className="pd-head">
          <b id={titleId} tabIndex={-1}>
            {palace.name}
            <i className="pd-gz">
              {palace.heavenlyStem}
              {palace.earthlyBranch}
            </i>
            {palace.isBodyPalace && <em className="p-body">{t("palace.bodyPalace")}</em>}
            {palace.isOriginalPalace && <em className="p-origin">{t("palace.originPalace")}</em>}
          </b>
          <button
            className="pd-close"
            onClick={onClose}
            title={t("detail.close")}
            aria-label={t("detail.closeAria")}
          >
            ✕
          </button>
        </div>

        {snap && (
          <section>
            <h4>{t("detail.sanFang")}</h4>
            <ul className="pd-seats">
              {snap.seats.map((s, k) => (
                <li key={k}>
                  <i className={`pd-role pd-role-${k === 0 ? "self" : k === 1 ? "opp" : "trine"}`}>
                    {s.role}
                  </i>
                  <b>{t("center.nameWithBranch", { name: s.palaceName, branch: s.branch })}</b>
                  <span>{s.majors}</span>
                </li>
              ))}
            </ul>
            {snap.borrowed && <p className="pd-borrow">{snap.borrowed}</p>}
            <div className="pd-tags">
              <p>
                <i className="pd-k pd-k-good">{t("detail.auspicious")}</i>
                {snap.auspicious.join(t("common.listSep")) || t("common.none")}
              </p>
              <p>
                <i className="pd-k pd-k-bad">{t("detail.inauspicious")}</i>
                {snap.inauspicious.join(t("common.listSep")) || t("common.none")}
              </p>
              <p>
                <i className="pd-k pd-k-mut">{t("detail.natalMutagens")}</i>
                {snap.natalMutagens.join(t("common.listSep")) || t("common.none")}
              </p>
            </div>
          </section>
        )}

        {fly && (
          <section>
            <h4>{t("detail.flyMutagens", { stem: fly.stem })}</h4>
            <ul className="pd-flies">
              {fly.flies.map(f => (
                <li key={f.mutagen}>
                  <i className="pd-mut" data-m={f.mutagen}>
                    {f.mutagen}
                  </i>
                  <span>
                    {f.star} → {f.isSelf ? t("detail.selfMutagenOutward") : f.toName}
                    {f.isOpposite ? t("detail.clashPalace") : ""}
                  </span>
                </li>
              ))}
            </ul>
            {fly.selfInward.length > 0 && (
              <p className="pd-inward">
                {t("common.labelValue", {
                  label: t("detail.inwardSelf"),
                  value: fly.selfInward.join(t("common.listSep")),
                })}
              </p>
            )}
          </section>
        )}

        {(jiChain || luChain) && (
          <section>
            <h4>{t("detail.chainTitle")}</h4>
            {jiChain && (
              <p className="pd-chain pd-chain-ji">
                <i>{t("detail.jiChain")}</i>
                {jiChain.text}
              </p>
            )}
            {luChain && (
              <p className="pd-chain pd-chain-lu">
                <i>{t("detail.luChain")}</i>
                {luChain.text}
              </p>
            )}
          </section>
        )}

        {patterns.length > 0 && (
          <section>
            <h4>{t("detail.patterns")}</h4>
            {patterns.map((p, k) => (
              <div className="pd-pattern" key={k}>
                <b>
                  {p.name}
                  <i className={`pd-kind pd-kind-${p.kind}`}>{p.kind}</i>
                </b>
                <p>{p.basis}</p>
                <p className="pd-meaning">{p.meaning}</p>
                {p.classic && <p className="pd-classic">{p.classic}</p>}
                {p.flaw && <p className="pd-flaw">⚠ {p.flaw}</p>}
              </div>
            ))}
          </section>
        )}

        {jia.length > 0 && (
          <section>
            <h4>{t("detail.flanking")}</h4>
            {jia.map((j, k) => (
              <p key={k} className="pd-jia">
                <i className={`pd-kind pd-kind-${j.good ? t("detail.good") : t("detail.bad")}`}>
                  {j.kind}
                </i>
                {j.detail}
              </p>
            ))}
          </section>
        )}

        {scopeSelfMarks.length > 0 && (
          <section>
            <h4>{t("detail.decadalSelf")}</h4>
            {scopeSelfMarks.map(s => (
              <p key={s.scope}>
                <span className={`pat-scope pat-scope-${s.scope}`}>
                  {SCOPE_META[s.scope].rowLabel}
                </span>
                {t("common.labelValue", {
                  label: t("detail.outwardLabel"),
                  value: s.outward.length
                    ? s.outward
                        .map(m => `${m.star}${t("common.huaChar")}${m.char}`)
                        .join(t("common.listSep"))
                    : t("common.none"),
                })}
                {" / "}
                {t("common.labelValue", {
                  label: t("detail.inwardLabel"),
                  value: s.inward.length
                    ? s.inward
                        .map(m => `${m.star}${t("common.huaChar")}${m.char}`)
                        .join(t("common.listSep"))
                    : t("common.none"),
                })}
              </p>
            ))}
          </section>
        )}
      </div>
    </div>
  );
});
