/**
 * LogoutButton 组件 - 退出登录按钮
 * 位于 Header 右上角，图标按钮，悬停提示
 */
import { useAuth } from "../core/auth/AuthContext";
import { useI18n } from "../core/i18n";
import { LogoutIcon } from "./icons/LogoutIcon";

export function LogoutButton() {
  const { t } = useI18n();
  const { logout } = useAuth();

  return (
    <button
      className="header-icon-button"
      onClick={logout}
      title={t("login.logout")}
      aria-label={t("login.logout")}
    >
      <LogoutIcon />
    </button>
  );
}
