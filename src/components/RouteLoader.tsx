/**
 * RouteLoader - 顶部路由加载进度条
 *
 * 设计：
 * - 监听 React Router 的路由切换事件，在路由切换时显示顶部细线进度条
 * - 使用 CSS transition 实现平滑的进度推进与淡出效果
 * - 进度模型：启动 → 30% → 70%（Suspense 完成前）→ 100% → 隐藏
 * - 无第三方依赖（不引入 nprogress）
 * - 纯展示组件，挂载在 Layout 内；z-index 足够高覆盖内容
 *
 * 与 Suspense 配合：
 * - 监听路由切换 start → 启动定时器推动进度到 30%/70%
 * - 监听路由切换 complete → 立即跳到 100% 并延迟隐藏
 * - 懒加载组件若瞬间加载完成，则直接走完进度
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/** 进度条颜色（跟随主题 --cyan） */
const BAR_COLOR = "var(--cyan)";

export function RouteLoader() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef(0);

  // 清理定时器
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // 启动进度：路由切换时调用
  const startLoading = () => {
    clearTimer();
    stageRef.current = 1;
    setVisible(true);
    setProgress(15);
    // 推进到 30%
    timerRef.current = setTimeout(() => {
      if (stageRef.current === 1) {
        setProgress(40);
        // 推进到 70%
        timerRef.current = setTimeout(() => {
          if (stageRef.current === 1) {
            setProgress(70);
          }
        }, 200);
      }
    }, 80);
  };

  // 完成加载：隐藏进度条
  const finishLoading = () => {
    clearTimer();
    stageRef.current = 2;
    setProgress(100);
    // 等待 CSS transition 完成后隐藏
    timerRef.current = setTimeout(() => {
      setVisible(false);
      // 重置 progress 到 0（无动画）
      setTimeout(() => {
        if (stageRef.current === 2) {
          setProgress(0);
          stageRef.current = 0;
        }
      }, 300);
    }, 250);
  };

  // 路由变化时触发进度条
  useEffect(() => {
    startLoading();
    // 短延迟后完成——给 Suspense 一点时间，同时也让懒加载 chunk 瞬间完成时能走完进度
    const completeTimer = setTimeout(() => {
      finishLoading();
    }, 120);
    return () => {
      clearTimeout(completeTimer);
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // 组件卸载时清理
  useEffect(() => {
    return () => clearTimer();
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="route-loader"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-label="页面加载中"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        zIndex: 9999,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: BAR_COLOR,
          boxShadow: `0 0 8px ${BAR_COLOR}, 0 0 2px ${BAR_COLOR}`,
          transition: progress === 0 ? "none" : "width 220ms cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
