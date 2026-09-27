/**
 * 六爻空状态组件
 */
import { useI18n } from "../../core/i18n";

export function LiuyaoEmpty() {
  const { t } = useI18n();
  return (
    <div className="liuyao-empty">
      <p>{t("liuyao.empty") || "请选择左侧列表中的记录查看卦象，或点击【新建起卦】开始"}</p>
    </div>
  );
}
