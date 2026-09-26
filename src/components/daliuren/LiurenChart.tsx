/**
 * 大六壬盘面组件（右侧）
 *
 * 渲染完整盘面：四柱、月将、天地盘、四课、三传、十二天将、神煞、课经/毕法、占事信息
 */
import { memo } from "react";
import type { LiurenRecord } from "../../core/personDb";
import type { DaLiuRenResult } from "../../core/daliuren/types";
import { DI_ZHI } from "../../core/daliuren/constants";
import { LiurenEmpty } from "./LiurenEmpty";
import { useI18n } from "../../core/i18n";

interface LiurenChartProps {
  record: LiurenRecord | null;
}

/** 格式化地支为文字 */
function branchText(idx: number): string {
  return DI_ZHI[idx] ?? "?";
}

/** 四柱展示 */
const FourPillarsSection = memo(function FourPillarsSection({
  result,
}: {
  result: DaLiuRenResult;
}) {
  const { t } = useI18n();
  const { fourPillars: fp } = result;
  return (
    <section className="liuren-section" aria-label={t("daliuren.pillar")}>
      <h4 className="liuren-section-title">{t("daliuren.pillar")}</h4>
      <div className="liuren-four-pillars">
        <div className="liuren-pillar">
          <div className="liuren-pillar-label">{t("daliuren.year")}</div>
          <div className="liuren-pillar-value">{fp.yearPillar}</div>
        </div>
        <div className="liuren-pillar">
          <div className="liuren-pillar-label">{t("daliuren.month")}</div>
          <div className="liuren-pillar-value">{fp.monthPillar}</div>
        </div>
        <div className="liuren-pillar">
          <div className="liuren-pillar-label">{t("daliuren.day")}</div>
          <div className="liuren-pillar-value">{fp.dayPillar}</div>
        </div>
        <div className="liuren-pillar">
          <div className="liuren-pillar-label">{t("daliuren.hour")}</div>
          <div className="liuren-pillar-value">{fp.hourPillar}</div>
        </div>
      </div>
    </section>
  );
});

/** 月将展示 */
const MonthGeneralSection = memo(function MonthGeneralSection({
  result,
}: {
  result: DaLiuRenResult;
}) {
  const { t } = useI18n();
  return (
    <section className="liuren-section" aria-label={t("daliuren.monthGeneral")}>
      <h4 className="liuren-section-title">{t("daliuren.monthGeneral")}</h4>
      <div className="liuren-month-general">
        {t("daliuren.nameWithBranch", {
          name: result.monthGeneral.name,
          branch: branchText(result.monthGeneral.branch),
        })}
      </div>
    </section>
  );
});

/** 天地盘展示（12 宫格） */
const HeavenEarthBoardSection = memo(function HeavenEarthBoardSection({
  result,
}: {
  result: DaLiuRenResult;
}) {
  const { t } = useI18n();
  // 地盘固定：子至亥（0-11），天盘旋转
  // 简化为 4x3 网格，每格显示：天盘/地盘 + 天将/六亲/遁干/纳音
  const gridPositions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <section className="liuren-section" aria-label={t("daliuren.heavenEarth")}>
      <h4 className="liuren-section-title">{t("daliuren.heavenEarth")}</h4>
      <div className="liuren-board-grid">
        {gridPositions.map(earthIdx => {
          const heavenIdx = result.heavenBoard[earthIdx];
          const general = result.twelveGenerals.find(g => g.position === earthIdx);
          const wangXiang = result.wangXiang[heavenIdx];
          const liuQin = result.liuQin[heavenIdx];
          const xunDun = result.xunDun[earthIdx];
          const naYin = result.naYin[earthIdx];

          return (
            <div key={earthIdx} className="liuren-board-cell">
              <div className="liuren-board-heaven">
                {branchText(heavenIdx)}
                {wangXiang && <span className="liuren-board-wangxiang">{wangXiang}</span>}
              </div>
              <div className="liuren-board-earth">{branchText(earthIdx)}</div>
              {general && <div className="liuren-board-general">{general.name}</div>}
              {liuQin && <div className="liuren-board-liuqin">{liuQin}</div>}
              {xunDun && <div className="liuren-board-xundun">{xunDun}</div>}
              {naYin && <div className="liuren-board-nayin">{naYin}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
});

/** 四课展示 */
const FourLessonsSection = memo(function FourLessonsSection({
  result,
}: {
  result: DaLiuRenResult;
}) {
  const { t } = useI18n();
  return (
    <section className="liuren-section" aria-label={t("daliuren.fourCourses")}>
      <h4 className="liuren-section-title">{t("daliuren.fourCourses")}</h4>
      <div className="liuren-four-lessons">
        {result.fourLessons.map((lesson, i) => (
          <div key={i} className="liuren-lesson">
            <div className="liuren-lesson-num">{i + 1}</div>
            <div className="liuren-lesson-upper">{branchText(lesson.upper)}</div>
            <div className="liuren-lesson-arrow">↓</div>
            <div className="liuren-lesson-lower">{branchText(lesson.lower)}</div>
          </div>
        ))}
      </div>
    </section>
  );
});

/** 三传展示 */
const ThreeTransmissionsSection = memo(function ThreeTransmissionsSection({
  result,
}: {
  result: DaLiuRenResult;
}) {
  const { t } = useI18n();
  const { threeTransmissions: tt } = result;
  return (
    <section className="liuren-section" aria-label={t("daliuren.threeTransmissions")}>
      <h4 className="liuren-section-title">{t("daliuren.threeTransmissions")}</h4>
      <div className="liuren-three-transmissions">
        <div className="liuren-transmission-method">{tt.method}</div>
        <div className="liuren-transmissions-row">
          <div className="liuren-transmission">
            <div className="liuren-transmission-label">{t("daliuren.firstTransmission")}</div>
            <div className="liuren-transmission-value">{branchText(tt.initial)}</div>
          </div>
          <div className="liuren-transmission-arrow">→</div>
          <div className="liuren-transmission">
            <div className="liuren-transmission-label">{t("daliuren.secondTransmission")}</div>
            <div className="liuren-transmission-value">{branchText(tt.middle)}</div>
          </div>
          <div className="liuren-transmission-arrow">→</div>
          <div className="liuren-transmission">
            <div className="liuren-transmission-label">{t("daliuren.thirdTransmission")}</div>
            <div className="liuren-transmission-value">{branchText(tt.final)}</div>
          </div>
        </div>
      </div>
    </section>
  );
});

/** 旬空展示 */
const XunKongSection = memo(function XunKongSection({ result }: { result: DaLiuRenResult }) {
  const { t } = useI18n();
  const { xunKong } = result;
  return (
    <section className="liuren-section" aria-label={t("daliuren.xunKong")}>
      <h4 className="liuren-section-title">{t("daliuren.xunKong")}</h4>
      <div className="liuren-xunkong">
        {t("common.labelValue", {
          label: t("daliuren.xunHead"),
          value: `${branchText(xunKong.xunHead)} ${t("common.labelValue", { label: t("daliuren.void"), value: `${branchText(xunKong.void1)} ${branchText(xunKong.void2)}` })}`,
        })}
      </div>
    </section>
  );
});

/** 十二天将展示 */
const TwelveGeneralsSection = memo(function TwelveGeneralsSection({
  result,
}: {
  result: DaLiuRenResult;
}) {
  const { t } = useI18n();
  return (
    <section className="liuren-section" aria-label={t("daliuren.twelveGenerals")}>
      <h4 className="liuren-section-title">{t("daliuren.twelveGenerals")}</h4>
      <div className="liuren-twelve-generals">
        {result.twelveGenerals.map(g => (
          <div key={g.position} className="liuren-general-item">
            <span className="liuren-general-branch">{branchText(g.position)}</span>
            <span className="liuren-general-name">{g.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
});

/** 神煞展示 */
const ShenShaSection = memo(function ShenShaSection({ result }: { result: DaLiuRenResult }) {
  const { t } = useI18n();
  const { shenSha } = result;
  if (shenSha.length === 0) return null;

  const jiShen = shenSha.filter(s => s.type === "吉");
  const xiongSha = shenSha.filter(s => s.type === "凶");

  return (
    <section className="liuren-section" aria-label={t("daliuren.shenSha")}>
      <h4 className="liuren-section-title">{t("daliuren.shenSha")}</h4>
      {jiShen.length > 0 && (
        <div className="liuren-shensha-group">
          <div className="liuren-shensha-label ji">{t("daliuren.jiShen")}</div>
          <div className="liuren-shensha-list">
            {jiShen.map((s, i) => (
              <span key={i} className="liuren-shensha-item ji" title={s.description}>
                {t("daliuren.nameWithBranch", { name: s.name, branch: branchText(s.branch) })}
              </span>
            ))}
          </div>
        </div>
      )}
      {xiongSha.length > 0 && (
        <div className="liuren-shensha-group">
          <div className="liuren-shensha-label xiong">{t("daliuren.xiongSha")}</div>
          <div className="liuren-shensha-list">
            {xiongSha.map((s, i) => (
              <span key={i} className="liuren-shensha-item xiong" title={s.description}>
                {t("daliuren.nameWithBranch", { name: s.name, branch: branchText(s.branch) })}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

/** 课经展示 */
const KeJingSection = memo(function KeJingSection({ result }: { result: DaLiuRenResult }) {
  const { t } = useI18n();
  const { keJing } = result;
  if (keJing.length === 0) return null;

  return (
    <section className="liuren-section" aria-label={t("daliuren.keJing")}>
      <h4 className="liuren-section-title">{t("daliuren.keJing")}</h4>
      <div className="liuren-kejing-list">
        {keJing.map((k, i) => (
          <div key={i} className="liuren-kejing-item">
            <div className="liuren-kejing-name">{k.rule.name}</div>
            <div className="liuren-kejing-desc">{k.rule.description}</div>
            {k.evidence.length > 0 && (
              <div className="liuren-kejing-evidence">
                {k.evidence.map((e, j) => (
                  <div key={j} className="liuren-kejing-evidence-item">
                    {e}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
});

/** 毕法展示 */
const BiFaSection = memo(function BiFaSection({ result }: { result: DaLiuRenResult }) {
  const { t } = useI18n();
  const { biFa } = result;
  if (biFa.length === 0) return null;

  return (
    <section className="liuren-section" aria-label={t("daliuren.biFa")}>
      <h4 className="liuren-section-title">{t("daliuren.biFa")}</h4>
      <div className="liuren-bifa-list">
        {biFa.map((b, i) => (
          <div key={i} className="liuren-bifa-item">
            <div className="liuren-bifa-name">{b.rule.name}</div>
            <div className="liuren-bifa-desc">{b.rule.description}</div>
            {b.evidence.length > 0 && (
              <div className="liuren-bifa-evidence">
                {b.evidence.map((e, j) => (
                  <div key={j} className="liuren-bifa-evidence-item">
                    {e}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
});

/** 占事信息展示 */
const QuestionInfoSection = memo(function QuestionInfoSection({
  record,
}: {
  record: LiurenRecord;
}) {
  const { t } = useI18n();
  return (
    <section className="liuren-section" aria-label={t("daliuren.questionInfo")}>
      <h4 className="liuren-section-title">{t("daliuren.questionInfo")}</h4>
      <div className="liuren-question-info">
        <div className="liuren-info-row">
          <span className="liuren-info-label">{t("daliuren.courseTime")}</span>
          <span className="liuren-info-value">{record.calculationTime}</span>
        </div>
        {record.question && (
          <div className="liuren-info-row">
            <span className="liuren-info-label">{t("daliuren.questionLabel")}</span>
            <span className="liuren-info-value">{record.question}</span>
          </div>
        )}
        {record.note && (
          <div className="liuren-info-row">
            <span className="liuren-info-label">{t("daliuren.noteLabel")}</span>
            <span className="liuren-info-value">{record.note}</span>
          </div>
        )}
        {record.background && (
          <div className="liuren-info-row">
            <span className="liuren-info-label">{t("daliuren.backgroundLabel")}</span>
            <span className="liuren-info-value liuren-info-background">{record.background}</span>
          </div>
        )}
        {record.tags.length > 0 && (
          <div className="liuren-info-row">
            <span className="liuren-info-label">{t("daliuren.tagsLabel")}</span>
            <span className="liuren-info-value">
              {record.tags.map(tag => (
                <span key={tag} className="liuren-info-tag">
                  {tag}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
    </section>
  );
});

export const LiurenChart = memo(function LiurenChart({ record }: LiurenChartProps) {
  if (!record) {
    return <LiurenEmpty />;
  }

  const { result } = record;

  return (
    <div className="liuren-chart">
      <QuestionInfoSection record={record} />
      <FourPillarsSection result={result} />
      <MonthGeneralSection result={result} />
      <XunKongSection result={result} />
      <HeavenEarthBoardSection result={result} />
      <FourLessonsSection result={result} />
      <ThreeTransmissionsSection result={result} />
      <TwelveGeneralsSection result={result} />
      <ShenShaSection result={result} />
      <KeJingSection result={result} />
      <BiFaSection result={result} />
    </div>
  );
});
