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

interface LiurenChartProps {
  record: LiurenRecord | null;
}

/** 格式化地支为文字 */
function branchText(idx: number): string {
  return DI_ZHI[idx] ?? "?";
}

/** 四柱展示 */
function FourPillarsSection({ result }: { result: DaLiuRenResult }) {
  const { fourPillars: fp } = result;
  return (
    <section className="liuren-section" aria-label="四柱">
      <h4 className="liuren-section-title">四柱</h4>
      <div className="liuren-four-pillars">
        <div className="liuren-pillar">
          <div className="liuren-pillar-label">年</div>
          <div className="liuren-pillar-value">{fp.yearPillar}</div>
        </div>
        <div className="liuren-pillar">
          <div className="liuren-pillar-label">月</div>
          <div className="liuren-pillar-value">{fp.monthPillar}</div>
        </div>
        <div className="liuren-pillar">
          <div className="liuren-pillar-label">日</div>
          <div className="liuren-pillar-value">{fp.dayPillar}</div>
        </div>
        <div className="liuren-pillar">
          <div className="liuren-pillar-label">时</div>
          <div className="liuren-pillar-value">{fp.hourPillar}</div>
        </div>
      </div>
    </section>
  );
}

/** 月将展示 */
function MonthGeneralSection({ result }: { result: DaLiuRenResult }) {
  return (
    <section className="liuren-section" aria-label="月将">
      <h4 className="liuren-section-title">月将</h4>
      <div className="liuren-month-general">
        {result.monthGeneral.name}（{branchText(result.monthGeneral.branch)}）
      </div>
    </section>
  );
}

/** 天地盘展示（12 宫格） */
function HeavenEarthBoardSection({ result }: { result: DaLiuRenResult }) {
  // 地盘固定：子至亥（0-11），天盘旋转
  // 简化为 4x3 网格，每格显示：天盘/地盘 + 天将/六亲/遁干/纳音
  const gridPositions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <section className="liuren-section" aria-label="天地盘">
      <h4 className="liuren-section-title">天地盘</h4>
      <div className="liuren-board-grid">
        {gridPositions.map((earthIdx) => {
          const heavenIdx = result.heavenBoard[earthIdx];
          const general = result.twelveGenerals.find(
            (g) => g.position === earthIdx
          );
          const wangXiang = result.wangXiang[heavenIdx];
          const liuQin = result.liuQin[heavenIdx];
          const xunDun = result.xunDun[earthIdx];
          const naYin = result.naYin[earthIdx];

          return (
            <div key={earthIdx} className="liuren-board-cell">
              <div className="liuren-board-heaven">
                {branchText(heavenIdx)}
                {wangXiang && (
                  <span className="liuren-board-wangxiang">{wangXiang}</span>
                )}
              </div>
              <div className="liuren-board-earth">{branchText(earthIdx)}</div>
              {general && (
                <div className="liuren-board-general">{general.name}</div>
              )}
              {liuQin && (
                <div className="liuren-board-liuqin">{liuQin}</div>
              )}
              {xunDun && (
                <div className="liuren-board-xundun">{xunDun}</div>
              )}
              {naYin && (
                <div className="liuren-board-nayin">{naYin}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 四课展示 */
function FourLessonsSection({ result }: { result: DaLiuRenResult }) {
  return (
    <section className="liuren-section" aria-label="四课">
      <h4 className="liuren-section-title">四课</h4>
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
}

/** 三传展示 */
function ThreeTransmissionsSection({ result }: { result: DaLiuRenResult }) {
  const { threeTransmissions: tt } = result;
  return (
    <section className="liuren-section" aria-label="三传">
      <h4 className="liuren-section-title">三传</h4>
      <div className="liuren-three-transmissions">
        <div className="liuren-transmission-method">{tt.method}</div>
        <div className="liuren-transmissions-row">
          <div className="liuren-transmission">
            <div className="liuren-transmission-label">初传</div>
            <div className="liuren-transmission-value">{branchText(tt.initial)}</div>
          </div>
          <div className="liuren-transmission-arrow">→</div>
          <div className="liuren-transmission">
            <div className="liuren-transmission-label">中传</div>
            <div className="liuren-transmission-value">{branchText(tt.middle)}</div>
          </div>
          <div className="liuren-transmission-arrow">→</div>
          <div className="liuren-transmission">
            <div className="liuren-transmission-label">末传</div>
            <div className="liuren-transmission-value">{branchText(tt.final)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 旬空展示 */
function XunKongSection({ result }: { result: DaLiuRenResult }) {
  const { xunKong } = result;
  return (
    <section className="liuren-section" aria-label="旬空">
      <h4 className="liuren-section-title">旬空</h4>
      <div className="liuren-xunkong">
        旬首：{branchText(xunKong.xunHead)} 空亡：{branchText(xunKong.void1)} {branchText(xunKong.void2)}
      </div>
    </section>
  );
}

/** 十二天将展示 */
function TwelveGeneralsSection({ result }: { result: DaLiuRenResult }) {
  return (
    <section className="liuren-section" aria-label="十二天将">
      <h4 className="liuren-section-title">十二天将</h4>
      <div className="liuren-twelve-generals">
        {result.twelveGenerals.map((g) => (
          <div key={g.position} className="liuren-general-item">
            <span className="liuren-general-branch">{branchText(g.position)}</span>
            <span className="liuren-general-name">{g.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 神煞展示 */
function ShenShaSection({ result }: { result: DaLiuRenResult }) {
  const { shenSha } = result;
  if (shenSha.length === 0) return null;

  const jiShen = shenSha.filter((s) => s.type === "吉");
  const xiongSha = shenSha.filter((s) => s.type === "凶");

  return (
    <section className="liuren-section" aria-label="神煞">
      <h4 className="liuren-section-title">神煞</h4>
      {jiShen.length > 0 && (
        <div className="liuren-shensha-group">
          <div className="liuren-shensha-label ji">吉神</div>
          <div className="liuren-shensha-list">
            {jiShen.map((s, i) => (
              <span key={i} className="liuren-shensha-item ji" title={s.description}>
                {s.name}（{branchText(s.branch)}）
              </span>
            ))}
          </div>
        </div>
      )}
      {xiongSha.length > 0 && (
        <div className="liuren-shensha-group">
          <div className="liuren-shensha-label xiong">凶煞</div>
          <div className="liuren-shensha-list">
            {xiongSha.map((s, i) => (
              <span key={i} className="liuren-shensha-item xiong" title={s.description}>
                {s.name}（{branchText(s.branch)}）
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** 课经展示 */
function KeJingSection({ result }: { result: DaLiuRenResult }) {
  const { keJing } = result;
  if (keJing.length === 0) return null;

  return (
    <section className="liuren-section" aria-label="课经">
      <h4 className="liuren-section-title">课经</h4>
      <div className="liuren-kejing-list">
        {keJing.map((k, i) => (
          <div key={i} className="liuren-kejing-item">
            <div className="liuren-kejing-name">{k.rule.name}</div>
            <div className="liuren-kejing-desc">{k.rule.description}</div>
            {k.evidence.length > 0 && (
              <div className="liuren-kejing-evidence">
                {k.evidence.map((e, j) => (
                  <div key={j} className="liuren-kejing-evidence-item">{e}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** 毕法展示 */
function BiFaSection({ result }: { result: DaLiuRenResult }) {
  const { biFa } = result;
  if (biFa.length === 0) return null;

  return (
    <section className="liuren-section" aria-label="毕法">
      <h4 className="liuren-section-title">毕法</h4>
      <div className="liuren-bifa-list">
        {biFa.map((b, i) => (
          <div key={i} className="liuren-bifa-item">
            <div className="liuren-bifa-name">{b.rule.name}</div>
            <div className="liuren-bifa-desc">{b.rule.description}</div>
            {b.evidence.length > 0 && (
              <div className="liuren-bifa-evidence">
                {b.evidence.map((e, j) => (
                  <div key={j} className="liuren-bifa-evidence-item">{e}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** 占事信息展示 */
function QuestionInfoSection({ record }: { record: LiurenRecord }) {
  return (
    <section className="liuren-section" aria-label="占事信息">
      <h4 className="liuren-section-title">占事信息</h4>
      <div className="liuren-question-info">
        <div className="liuren-info-row">
          <span className="liuren-info-label">起课时间</span>
          <span className="liuren-info-value">{record.calculationTime}</span>
        </div>
        {record.question && (
          <div className="liuren-info-row">
            <span className="liuren-info-label">占事</span>
            <span className="liuren-info-value">{record.question}</span>
          </div>
        )}
        {record.note && (
          <div className="liuren-info-row">
            <span className="liuren-info-label">备注</span>
            <span className="liuren-info-value">{record.note}</span>
          </div>
        )}
        {record.background && (
          <div className="liuren-info-row">
            <span className="liuren-info-label">背景</span>
            <span className="liuren-info-value liuren-info-background">
              {record.background}
            </span>
          </div>
        )}
        {record.tags.length > 0 && (
          <div className="liuren-info-row">
            <span className="liuren-info-label">标签</span>
            <span className="liuren-info-value">
              {record.tags.map((t) => (
                <span key={t} className="liuren-info-tag">{t}</span>
              ))}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

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
