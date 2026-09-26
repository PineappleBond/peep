/**
 * GuideOverlay - 用户引导浮层
 *
 * 功能：
 * - 高亮目标元素（遮罩其他区域）
 * - 显示说明气泡（标题 + 内容 + 进度）
 * - 导航按钮（上一步 / 下一步 / 跳过）
 * - 支持键盘导航（←/→/Esc）
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "../core/i18n";
import type { GuideStep } from "../core/guide";

type GuideOverlayProps = {
  /** 引导步骤列表 */
  steps: GuideStep[];
  /** 当前步骤索引 */
  currentStep: number;
  /** 跳转到指定步骤 */
  onGoTo: (step: number) => void;
  /** 完成引导 */
  onComplete: () => void;
  /** 跳过引导 */
  onSkip: () => void;
};

export function GuideOverlay({
  steps,
  currentStep,
  onGoTo,
  onComplete,
  onSkip,
}: GuideOverlayProps) {
  const { t } = useI18n();
  const step = steps[currentStep];
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const titleId = `guide-title-${currentStep}`;

  /* 计算目标元素的位置 */
  useEffect(() => {
    if (!step.target) {
      setHighlightRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setHighlightRect(null);
      return;
    }
    const updateRect = () => {
      const rect = el.getBoundingClientRect();
      setHighlightRect(rect);
    };
    updateRect();
    /* 滚动 / 窗口变化时重新计算 */
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [step]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      onGoTo(currentStep + 1);
    } else {
      onComplete();
    }
  }, [currentStep, steps.length, onGoTo, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      onGoTo(currentStep - 1);
    }
  }, [currentStep, onGoTo]);

  /* 键盘导航 */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [currentStep, handleNext, handlePrev, onSkip]);

  /* 计算气泡位置 */
  const getPopoverStyle = (): React.CSSProperties => {
    if (!highlightRect) {
      /* 无目标时居中显示 */
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "420px",
      };
    }
    const pos = step.position ?? "bottom";
    const gap = 16;
    const style: React.CSSProperties = { position: "fixed" };

    switch (pos) {
      case "top":
        style.bottom = window.innerHeight - highlightRect.top + gap;
        style.left = highlightRect.left + highlightRect.width / 2;
        style.transform = "translateX(-50%)";
        break;
      case "bottom":
        style.top = highlightRect.bottom + gap;
        style.left = highlightRect.left + highlightRect.width / 2;
        style.transform = "translateX(-50%)";
        break;
      case "left":
        style.top = highlightRect.top + highlightRect.height / 2;
        style.right = window.innerWidth - highlightRect.left + gap;
        style.transform = "translateY(-50%)";
        break;
      case "right":
        style.top = highlightRect.top + highlightRect.height / 2;
        style.left = highlightRect.right + gap;
        style.transform = "translateY(-50%)";
        break;
    }
    return style;
  };

  return (
    <div className="guide-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* 遮罩层（带镂空） */}
      {highlightRect && (
        <>
          {/* 上 */}
          <div
            className="guide-mask"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: highlightRect.top,
            }}
          />
          {/* 下 */}
          <div
            className="guide-mask"
            style={{
              top: highlightRect.bottom,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          {/* 左 */}
          <div
            className="guide-mask"
            style={{
              top: highlightRect.top,
              left: 0,
              width: highlightRect.left,
              height: highlightRect.height,
            }}
          />
          {/* 右 */}
          <div
            className="guide-mask"
            style={{
              top: highlightRect.top,
              left: highlightRect.right,
              right: 0,
              height: highlightRect.height,
            }}
          />
          {/* 高亮边框 */}
          <div
            className="guide-highlight"
            style={{
              top: highlightRect.top - 4,
              left: highlightRect.left - 4,
              width: highlightRect.width + 8,
              height: highlightRect.height + 8,
            }}
          />
        </>
      )}

      {/* 说明气泡 */}
      <div className="guide-popover" ref={popoverRef} style={getPopoverStyle()}>
        {/* 进度指示 */}
        <div className="guide-progress" aria-hidden="true">
          <span className="guide-progress-text">
            {currentStep + 1} / {steps.length}
          </span>
          <div className="guide-progress-bar">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`guide-progress-dot${idx === currentStep ? " active" : ""}${
                  idx < currentStep ? " done" : ""
                }`}
              />
            ))}
          </div>
        </div>

        {/* 标题 */}
        <h3 className="guide-title" id={titleId}>
          {step.title}
        </h3>

        {/* 内容 */}
        <p className="guide-content">{step.content}</p>

        {/* 按钮区 */}
        <div className="guide-actions">
          <button className="guide-btn guide-btn-skip" onClick={onSkip}>
            {t("guide.skip")}
          </button>
          <div className="guide-actions-right">
            {currentStep > 0 && (
              <button className="guide-btn guide-btn-prev" onClick={handlePrev}>
                {t("guide.prev")}
              </button>
            )}
            <button className="guide-btn guide-btn-next" onClick={handleNext}>
              {currentStep < steps.length - 1 ? t("guide.next") : t("guide.finish")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
