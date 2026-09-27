/**
 * 新建起卦 Dialog
 * - 表单：占事问题（必填）、备注、背景信息、tags、六爻值输入
 * - 起卦方式：手动输入 or 摇卦（模拟铜钱）
 * - 提交：调用 buildChart + locateYong，保存记录
 */
import { useState, useEffect, useRef } from "react";
import { Dialog } from "../Dialog";
import { LiuyaoFormFields, EMPTY_LIUYAO_FORM, type LiuyaoFormValues } from "./LiuyaoFormFields";
import { buildChart, locateYong } from "../../core/liuyao/core/chart";
import type { SixLines, YongTarget, LineValue } from "../../core/liuyao/core/types";
import { formatDate, formatDateTime } from "../../core/utils";
import { saveLiuyaoRecord } from "../../core/liuyaoDb";
import type { LiuyaoRecord, Person } from "../../core/personDb";
import { useI18n } from "../../core/i18n";
import { toast } from "../../core/toast";
import {
  useFormValidation,
  requiredRule,
  type ValidationRules,
} from "../../core/useFormValidation";

/** 六爻表单验证规则 */
const LIUYAO_VALIDATION_RULES: ValidationRules<LiuyaoFormValues> = {
  question: [requiredRule("validation.questionRequired")],
};

/** 起卦方式 */
type DivinationMethod = "manual" | "toss";

interface LiuyaoCreateDialogProps {
  open: boolean;
  onClose: () => void;
  person: Person;
  onSaved: () => void;
  /** 调试 API：预填充的表单数据 */
  initialData?: {
    question: string;
    note: string;
    background: string;
    tags: string[];
    lines?: SixLines;
    yongTarget?: YongTarget;
  };
  /** 调试 API：提交触发计数器 */
  submitTrigger?: number;
}

/**
 * 简单哈希函数：将字符串转换为数字种子
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 简单伪随机数生成器（Linear Congruential Generator）
 * 基于种子生成可重复的随机序列
 */
function createSeededRandom(seed: number) {
  let state = seed;
  const a = 1664525;
  const c = 1013904223;
  const m = 4294967296; // 2^32

  return function () {
    state = (a * state + c) % m;
    return state / m; // 返回 0-1 之间的浮点数
  };
}

/**
 * 模拟摇卦：摇 6 次铜钱，每次 3 枚
 * @param seed 随机种子（由表单信息+时间生成）
 * @returns 6 个爻值 [初爻, 二爻, 三爻, 四爻, 五爻, 上爻]
 */
function tossHexagram(seed: number): SixLines {
  const random = createSeededRandom(seed);
  const lines: LineValue[] = [];

  for (let i = 0; i < 6; i++) {
    // 模拟 3 枚铜钱：每枚正面=3（阳），反面=2（阴）
    const coin1 = random() < 0.5 ? 3 : 2;
    const coin2 = random() < 0.5 ? 3 : 2;
    const coin3 = random() < 0.5 ? 3 : 2;
    const sum = coin1 + coin2 + coin3;

    // 转换为爻值：6=老阴(0), 7=少阳(1), 8=少阴(2), 9=老阳(3)
    let lineValue: LineValue;
    if (sum === 6)
      lineValue = 0; // 老阴
    else if (sum === 7)
      lineValue = 1; // 少阳
    else if (sum === 8)
      lineValue = 2; // 少阴
    else lineValue = 3; // 老阳 (sum === 9)

    lines.push(lineValue);
  }

  return lines as SixLines;
}

export function LiuyaoCreateDialog({
  open,
  onClose,
  person,
  onSaved,
  initialData,
  submitTrigger,
}: LiuyaoCreateDialogProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<LiuyaoFormValues>(EMPTY_LIUYAO_FORM);
  const [lines, setLines] = useState<SixLines>([1, 1, 1, 1, 1, 1]); // 默认少阳
  const [yongTarget, setYongTarget] = useState<YongTarget>("自占");
  const [divinationMethod, setDivinationMethod] = useState<DivinationMethod>("manual");
  const [hasTossed, setHasTossed] = useState(false); // 追踪用户是否手动摇过卦
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validation = useFormValidation<LiuyaoFormValues>(LIUYAO_VALIDATION_RULES);

  const updateValues = (patch: Partial<LiuyaoFormValues>) => {
    setValues(prev => {
      const next = { ...prev, ...patch };
      for (const key of Object.keys(patch) as (keyof LiuyaoFormValues)[]) {
        if (validation.touched[key]) {
          requestAnimationFrame(() => validation.validateField(key, next));
        }
      }
      return next;
    });
  };

  const handleBlur = (field: keyof LiuyaoFormValues) => {
    validation.touchField(field);
    validation.validateField(field, values);
  };

  // 摇卦：根据表单信息+时间生成随机种子
  const handleToss = () => {
    const seedStr = `${values.question}-${values.background}-${values.note}-${Date.now()}`;
    const seed = hashString(seedStr);
    const newLines = tossHexagram(seed);
    setLines(newLines);
    setHasTossed(true); // 标记用户已手动摇卦
    toast.success(t("liuyao.tossSuccess") || "摇卦完成");
  };

  // 预填充表单
  useEffect(() => {
    if (open && initialData) {
      setValues({
        question: initialData.question,
        note: initialData.note,
        background: initialData.background,
        tags: initialData.tags,
      });
      if (initialData.lines) {
        setLines(initialData.lines);
        setDivinationMethod("manual");
      }
      if (initialData.yongTarget) setYongTarget(initialData.yongTarget);
    }
  }, [open, initialData]);

  // 调试 API：自动提交
  const prevSubmitTriggerRef = useRef<number | undefined>(undefined);
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (
      submitTrigger !== undefined &&
      submitTrigger !== prevSubmitTriggerRef.current &&
      open &&
      !saving
    ) {
      prevSubmitTriggerRef.current = submitTrigger;
      setTimeout(() => {
        handleSubmit();
      }, 50);
    }
  }, [submitTrigger, open, saving]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const resetForm = () => {
    setValues(EMPTY_LIUYAO_FORM);
    setLines([1, 1, 1, 1, 1, 1]);
    setYongTarget("自占");
    setDivinationMethod("manual");
    setHasTossed(false);
    setServerError(null);
    validation.reset();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setServerError(null);

    if (!validation.validateAll(values)) {
      return;
    }

    setSaving(true);

    try {
      const now = new Date();
      const dateStr = formatDate(now);
      const timeStr = formatDateTime(now.getTime(), true).split(" ")[1];
      const divinationTime = `${dateStr}T${timeStr}`;

      // 如果是摇卦模式且用户未手动摇卦，在保存时自动摇卦
      let finalLines = lines;
      if (divinationMethod === "toss" && !hasTossed) {
        const seedStr = `${values.question}-${values.background}-${values.note}-${Date.now()}`;
        const seed = hashString(seedStr);
        finalLines = tossHexagram(seed);
      }

      // 排盘
      const chart = buildChart({ lines: finalLines, date: dateStr });
      const yong = locateYong(chart, yongTarget);

      const record: LiuyaoRecord = {
        personId: person.id!,
        divinationTime,
        question: values.question.trim(),
        background: values.background.trim(),
        note: values.note.trim(),
        tags: values.tags,
        lines: finalLines,
        chart,
        yongTarget,
        yong,
        savedAt: Date.now(),
      };

      await saveLiuyaoRecord(record);
      toast.success(t("liuyao.saveSuccess") || "起卦记录已保存");
      onSaved();
      handleClose();
    } catch (err) {
      console.error("[LiuyaoCreateDialog] 排盘失败", err);
      setServerError(err instanceof Error ? err.message : "排盘失败，请检查输入");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("liuyao.create") || "新建起卦"}
      footer={
        <>
          <button className="btn-secondary" onClick={handleClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </>
      }
    >
      {serverError && <div className="form-error-banner">{serverError}</div>}
      <LiuyaoFormFields
        values={values}
        onChange={updateValues}
        disabled={saving}
        errors={validation.errors}
        shouldShowError={validation.shouldShowError}
        onBlur={handleBlur}
      />

      {/* 起卦方式选择 */}
      <div className="liuyao-form-field">
        <label>{t("liuyao.divinationMethod") || "起卦方式"}</label>
        <div className="liuyao-method-selector">
          <button
            type="button"
            className={`liuyao-method-btn ${divinationMethod === "manual" ? "active" : ""}`}
            onClick={() => setDivinationMethod("manual")}
            disabled={saving}
          >
            {t("liuyao.manualDivination") || "手动输入"}
          </button>
          <button
            type="button"
            className={`liuyao-method-btn ${divinationMethod === "toss" ? "active" : ""}`}
            onClick={() => setDivinationMethod("toss")}
            disabled={saving}
          >
            {t("liuyao.tossDivination") || "摇卦"}
          </button>
        </div>
      </div>

      {/* 六爻值输入（手动模式） */}
      {divinationMethod === "manual" && (
        <div className="liuyao-form-field">
          <label>{t("liuyao.linesInput") || "六爻值（0=老阴, 1=少阳, 2=少阴, 3=老阳）"}</label>
          <div className="liuyao-lines-input">
            {[5, 4, 3, 2, 1, 0].map(idx => (
              <div key={idx} className="liuyao-line-input-group">
                <label>第{idx + 1}爻</label>
                <select
                  value={lines[idx]}
                  onChange={e => {
                    const newLines = [...lines] as SixLines;
                    newLines[idx] = Number(e.target.value) as LineValue;
                    setLines(newLines);
                  }}
                  disabled={saving}
                >
                  <option value={0}>0 (老阴)</option>
                  <option value={1}>1 (少阳)</option>
                  <option value={2}>2 (少阴)</option>
                  <option value={3}>3 (老阳)</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 摇卦按钮（摇卦模式） */}
      {divinationMethod === "toss" && (
        <div className="liuyao-form-field">
          <label>{t("liuyao.tossAction") || "摇卦"}</label>
          <button type="button" className="liuyao-toss-btn" onClick={handleToss} disabled={saving}>
            {t("liuyao.tossButton") || "🪙 摇卦（模拟铜钱）"}
          </button>
          <div className="liuyao-toss-result">
            <div className="liuyao-toss-label">当前卦象：</div>
            <div className="liuyao-lines-display">
              {[5, 4, 3, 2, 1, 0].map(idx => (
                <div key={idx} className="liuyao-line-display">
                  <span className="liuyao-line-pos">第{idx + 1}爻：</span>
                  <span className="liuyao-line-value">
                    {lines[idx] === 0 && "老阴 ⚋⚋"}
                    {lines[idx] === 1 && "少阳 ———"}
                    {lines[idx] === 2 && "少阴 ⚋ —"}
                    {lines[idx] === 3 && "老阳 ⚋⚋⚋"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 求测对象 */}
      <div className="liuyao-form-field">
        <label htmlFor="liuyao-yong-target">{t("liuyao.yongTarget") || "求测对象"}</label>
        <select
          id="liuyao-yong-target"
          value={yongTarget}
          onChange={e => setYongTarget(e.target.value as YongTarget)}
          disabled={saving}
        >
          <option value="自占">自占</option>
          <option value="父母">父母</option>
          <option value="子女">子女</option>
          <option value="配偶">配偶</option>
          <option value="兄弟">兄弟</option>
          <option value="医药">医药</option>
        </select>
      </div>
    </Dialog>
  );
}
