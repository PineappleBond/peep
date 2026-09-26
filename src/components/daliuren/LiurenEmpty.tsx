/**
 * 大六壬空状态组件
 */
import { useI18n } from "../../core/i18n";

export function LiurenEmpty() {
  const { t } = useI18n();
  return (
    <div className="liuren-chart-empty">
      <div className="liuren-chart-empty-icon" aria-hidden="true">☰</div>
      <h3 className="liuren-chart-empty-title">{t("daliuren.title")}</h3>
      <p className="liuren-chart-empty-desc">
        {t("daliuren.empty")}
      </p>
    </div>
  );
}
