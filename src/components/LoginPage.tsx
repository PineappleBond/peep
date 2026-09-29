/**
 * LoginPage 组件 - GitHub 登录页面
 * 支持双主题，预留截图和应用介绍位置
 */
import { useAuth } from "../core/auth/AuthContext";
import { useI18n } from "../core/i18n";
import { GitHubIcon } from "./icons/GitHubIcon";
import { Spinner } from "./Spinner";

interface LoginPageProps {
  loading?: boolean;
}

export function LoginPage({ loading }: LoginPageProps) {
  const { t } = useI18n();
  const { login, error } = useAuth();

  return (
    <div className="login-page">
      <div className="login-container">
        {/* 左侧：品牌 + 登录 */}
        <div className="login-brand">
          <div className="login-header">
            <div className="login-logo">窥</div>
            <h1>{t("app.title")}</h1>
            <p className="login-subtitle">{t("login.subtitle")}</p>
          </div>

          <button className="login-button github" onClick={login} disabled={loading}>
            <GitHubIcon />
            <span>{t("login.github")}</span>
          </button>

          {error && (
            <div className="login-error" role="alert">
              {t(`login.error.${error.toLowerCase()}`)}
            </div>
          )}

          {loading && (
            <div className="login-loading">
              <Spinner size="sm" />
              <span>{t("login.processing")}</span>
            </div>
          )}

          <p className="login-footer">{t("login.privacy")}</p>
        </div>

        {/* 右侧：截图 + 应用介绍（预留） */}
        <div className="login-showcase">
          <div className="login-screenshot">{/* 预留：应用截图 */}</div>

          <div className="login-intro">
            <h2>{t("login.features.title")}</h2>
            <ul>
              <li>{t("login.features.item1")}</li>
              <li>{t("login.features.item2")}</li>
              <li>{t("login.features.item3")}</li>
              <li>{t("login.features.item4")}</li>
              <li>{t("login.features.item5")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
