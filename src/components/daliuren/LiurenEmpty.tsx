/**
 * 大六壬空状态组件
 * 使用通用 EmptyState 组件
 */
import { useI18n } from "../../core/i18n";
import { EmptyState } from "../EmptyState";

export function LiurenEmpty() {
  const { t } = useI18n();
  return (
    <EmptyState
      icon="☰"
      title={t("daliuren.title")}
      description={t("daliuren.empty")}
      className="liuren-chart-empty"
    />
  );
}
