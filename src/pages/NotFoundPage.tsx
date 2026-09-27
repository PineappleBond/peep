/**
 * NotFoundPage - 404 未找到页面
 *
 * 设计：
 * - 展示清晰的 404 状态，提供返回首页的选项
 * - 支持国际化
 * - 提供自动倒计时跳转（5 秒），用户可取消
 * - 保持可访问性（role=main、focus 管理）
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../core/i18n";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/** 自动跳转倒计时秒数 */
const REDIRECT_SECONDS = 5;

export function NotFoundPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [cancelled, setCancelled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useDocumentTitle(t("notFound.title"));

  // 倒计时自动跳转
  useEffect(() => {
    if (cancelled) return;
    if (countdown <= 0) {
      navigate("/", { replace: true });
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown(c => c - 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown, cancelled, navigate]);

  // 取消自动跳转
  const handleCancel = () => {
    setCancelled(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className="not-found-page" role="main">
      <div className="not-found-content">
        <div className="not-found-code" aria-hidden="true">
          404
        </div>
        <h2 className="not-found-title">{t("notFound.title")}</h2>
        <p className="not-found-desc">{t("notFound.description")}</p>
        <div className="not-found-countdown" aria-live="polite">
          {!cancelled ? (
            <>
              <span>{t("notFound.autoRedirect", { seconds: String(countdown) })}</span>
              <button
                type="button"
                className="not-found-cancel"
                onClick={handleCancel}
                aria-label={t("notFound.cancelRedirect")}
              >
                {t("notFound.cancelRedirect")}
              </button>
            </>
          ) : (
            <span>{t("notFound.stayHere")}</span>
          )}
        </div>
        <div className="not-found-actions">
          <Link to="/" className="not-found-home-link">
            {t("notFound.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
