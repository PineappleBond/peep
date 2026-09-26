/**
 * Wiki 文档编辑组件
 * 支持新建和编辑两种模式，提供标题、正文、标签、关联文档输入
 */
import { useState, useEffect, useRef } from "react";
import type { WikiDocument } from "../../core/personDb";
import { listWikiDocs, getWikiLinks, getWikiDoc } from "../../core/wikiDb";
import { TagInput } from "../daliuren/TagInput";
import { useI18n } from "../../core/i18n";
import { useUnsavedChanges } from "../../core/useUnsavedChanges";
import { ConfirmDialog } from "../ConfirmDialog";
import { FieldError } from "../FieldError";
import {
  useFormValidation,
  requiredRule,
  type ValidationRules,
} from "../../core/useFormValidation";

/** Wiki 表单值类型 */
interface WikiFormValues {
  title: string;
  content: string;
}

/** Wiki 表单验证规则 */
const WIKI_VALIDATION_RULES: ValidationRules<WikiFormValues> = {
  title: [requiredRule("validation.titleRequired")],
};

export interface WikiEditorProps {
  /** 文档数据，undefined 表示新建模式 */
  doc?: WikiDocument;
  /** 关联人物 ID */
  personId: number;
  /** 已有标签列表（用于自动补全） */
  existingTags: string[];
  /** 保存回调 */
  onSave: (doc: WikiDocument, linkTargetIds: number[]) => Promise<void>;
  /** 取消回调 */
  onCancel: () => void;
}

export function WikiEditor({ doc, personId, existingTags, onSave, onCancel }: WikiEditorProps) {
  const { t } = useI18n();
  // 表单状态
  const [formValues, setFormValues] = useState<WikiFormValues>({ title: "", content: "" });
  const [tags, setTags] = useState<string[]>([]);
  const [linkTargetIds, setLinkTargetIds] = useState<number[]>([]);
  const [linkSearchText, setLinkSearchText] = useState("");
  const [linkSearchResults, setLinkSearchResults] = useState<WikiDocument[]>([]);
  /** 已关联文档的标题映射（id -> title） */
  const [linkTargetTitles, setLinkTargetTitles] = useState<Record<number, string>>({});

  // 统一表单验证
  const validation = useFormValidation<WikiFormValues>(WIKI_VALIDATION_RULES);

  // UI 状态
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  /** 是否有未保存的修改（用于离开前确认） */
  const [dirty, setDirty] = useState(false);
  /** 取消编辑时的二次确认弹窗 */
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // Refs
  const linkSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 未保存变更：阻止浏览器意外关闭/刷新
  useUnsavedChanges(dirty);

  // 初始化：编辑模式加载数据（含已关联文档及标题），新建模式清空
  useEffect(() => {
    if (doc) {
      setFormValues({ title: doc.title, content: doc.content });
      setTags(doc.tags);
      // 加载已关联的文档 ID 及其标题
      (async () => {
        try {
          if (doc.id == null) return;
          const targetIds = await getWikiLinks(doc.id);
          setLinkTargetIds(targetIds);
          // 批量查询标题
          const docs = await Promise.all(targetIds.map(id => getWikiDoc(id)));
          const titles: Record<number, string> = {};
          docs.forEach((d, i) => {
            if (d) titles[targetIds[i]] = d.title;
          });
          setLinkTargetTitles(titles);
        } catch (err) {
          console.error("[WikiEditor] 加载关联文档信息失败", err);
          // 降级：不阻断编辑，但清空关联数据
          setLinkTargetIds([]);
          setLinkTargetTitles({});
        }
      })();
    } else {
      setFormValues({ title: "", content: "" });
      setTags([]);
      setLinkTargetIds([]);
      setLinkTargetTitles({});
    }
    // 初始加载后重置 dirty 状态（避免加载本身触发）
    setDirty(false);
    setCancelConfirmOpen(false);
    setServerError(null);
    validation.reset();
  }, [doc]);

  // 用户编辑任意字段后标记 dirty
  useEffect(() => {
    if (saving) return;
    const handle = setTimeout(() => {
      // 只要表单有内容（标题或正文不为空），就视为有修改
      if (formValues.title.trim() || formValues.content.trim()) setDirty(true);
    }, 300);
    return () => clearTimeout(handle);
  }, [formValues.title, formValues.content, tags, linkTargetIds, saving]);

  /** 更新表单值并实时验证 */
  const updateFormValues = (patch: Partial<WikiFormValues>) => {
    setFormValues(prev => {
      const next = { ...prev, ...patch };
      // 如果字段已触碰过，实时验证
      for (const key of Object.keys(patch) as (keyof WikiFormValues)[]) {
        if (validation.touched[key]) {
          requestAnimationFrame(() => validation.validateField(key, next));
        }
      }
      return next;
    });
  };

  /** 字段失焦时触发验证 */
  const handleBlur = (field: keyof WikiFormValues) => {
    validation.touchField(field);
    validation.validateField(field, formValues);
  };

  // 关联文档搜索（防抖）
  useEffect(() => {
    if (linkSearchTimeoutRef.current) {
      clearTimeout(linkSearchTimeoutRef.current);
    }

    if (!linkSearchText.trim()) {
      setLinkSearchResults([]);
      return;
    }

    linkSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await listWikiDocs(personId, {
          searchText: linkSearchText,
          pageSize: 10,
        });
        // 排除当前文档（编辑模式）和已选择的文档
        const filtered = result.docs.filter(
          d => d.id !== doc?.id && !linkTargetIds.includes(d.id!),
        );
        setLinkSearchResults(filtered);
      } catch (e) {
        console.error("搜索文档失败", e);
        setLinkSearchResults([]);
      }
    }, 300);

    return () => {
      if (linkSearchTimeoutRef.current) {
        clearTimeout(linkSearchTimeoutRef.current);
      }
    };
  }, [linkSearchText, personId, doc?.id, linkTargetIds]);

  // 添加关联文档
  const addLinkTarget = async (targetId: number) => {
    if (!linkTargetIds.includes(targetId)) {
      setLinkTargetIds([...linkTargetIds, targetId]);
      // 查询标题并缓存
      try {
        const targetDoc = await getWikiDoc(targetId);
        if (targetDoc) {
          setLinkTargetTitles(prev => ({ ...prev, [targetId]: targetDoc.title }));
        }
      } catch (err) {
        console.error("[WikiEditor] 查询关联文档标题失败", err);
      }
    }
    setLinkSearchText("");
    setLinkSearchResults([]);
  };

  // 移除关联文档
  const removeLinkTarget = (targetId: number) => {
    setLinkTargetIds(linkTargetIds.filter(id => id !== targetId));
  };

  // 保存
  const handleSave = async () => {
    setServerError(null);

    // 使用统一验证
    if (!validation.validateAll(formValues)) {
      return;
    }

    setSaving(true);

    try {
      const now = Date.now();
      const wikiDoc: WikiDocument = {
        ...(doc?.id != null ? { id: doc.id } : {}),
        personId,
        title: formValues.title.trim(),
        content: formValues.content.trim(),
        tags,
        savedAt: doc?.savedAt ?? now,
        updatedAt: now,
      };

      await onSave(wikiDoc, linkTargetIds);
      setDirty(false);
      onCancel();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // 取消：有未保存修改时弹二次确认
  const handleCancelClick = () => {
    if (dirty) {
      setCancelConfirmOpen(true);
    } else {
      onCancel();
    }
  };

  // 确认放弃修改
  const handleConfirmDiscard = () => {
    setDirty(false);
    setCancelConfirmOpen(false);
    onCancel();
  };

  // 取消关闭确认弹窗
  const handleCancelDiscard = () => {
    setCancelConfirmOpen(false);
  };

  return (
    <div className="wiki-editor">
      {/* 服务端/业务逻辑错误 */}
      {serverError && (
        <div className="wiki-editor-error" role="alert">
          {serverError}
        </div>
      )}

      {/* 标题输入 */}
      <div
        className={`wiki-editor-field${validation.shouldShowError("title") ? " field-has-error" : ""}`}
      >
        <input
          type="text"
          className="wiki-editor-title"
          value={formValues.title}
          onChange={e => updateFormValues({ title: e.target.value })}
          onBlur={() => handleBlur("title")}
          placeholder={t("wiki.editor.docTitlePlaceholder")}
          maxLength={200}
          autoFocus
          aria-label={t("wiki.editor.docTitle")}
        />
        <FieldError
          shouldShow={validation.shouldShowError("title")}
          message={validation.errors.title ? t(validation.errors.title) : null}
        />
      </div>

      {/* 正文编辑 */}
      <div className="wiki-editor-field">
        <textarea
          className="wiki-editor-textarea"
          value={formValues.content}
          onChange={e => updateFormValues({ content: e.target.value })}
          placeholder={t("wiki.editor.contentPlaceholder")}
          rows={20}
          maxLength={100000}
          aria-label={t("wiki.editor.docContent")}
        />
      </div>

      {/* 标签输入 */}
      <div className="wiki-editor-field">
        <label className="wiki-editor-label" id="wiki-tags-label">
          {t("wiki.editor.tags")}
        </label>
        <TagInput
          value={tags}
          onChange={setTags}
          suggestions={existingTags}
          disabled={saving}
          aria-labelledby="wiki-tags-label"
        />
      </div>

      {/* 关联文档选择 */}
      <div className="wiki-editor-field">
        <label className="wiki-editor-label" id="wiki-related-label">
          {t("wiki.editor.relatedDocs")}
        </label>
        <div className="wiki-editor-link-section">
          {/* 搜索框 */}
          <input
            type="text"
            className="wiki-editor-link-search"
            value={linkSearchText}
            onChange={e => setLinkSearchText(e.target.value)}
            placeholder={t("wiki.editor.searchRelated")}
            aria-label={t("wiki.editor.searchRelatedAria")}
          />

          {/* 搜索结果列表 */}
          {linkSearchResults.length > 0 && (
            <div
              className="wiki-link-search-results"
              role="listbox"
              aria-label={t("wiki.editor.searchResults")}
            >
              {linkSearchResults.map(result => (
                <div
                  key={result.id}
                  className="wiki-link-search-item"
                  onClick={() => addLinkTarget(result.id!)}
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      addLinkTarget(result.id!);
                    }
                  }}
                >
                  <span className="wiki-link-title">{result.title}</span>
                  <span className="wiki-link-tags">{result.tags.slice(0, 3).join(", ")}</span>
                </div>
              ))}
            </div>
          )}

          {/* 已关联文档列表 */}
          {linkTargetIds.length > 0 && (
            <div className="wiki-link-selected">
              {linkTargetIds.map(id => (
                <div key={id} className="wiki-link-selected-item">
                  <span>{linkTargetTitles[id] || t("wiki.editor.docRef", { id })}</span>
                  <button
                    type="button"
                    className="wiki-link-remove"
                    onClick={() => removeLinkTarget(id)}
                    aria-label={t("wiki.editor.removeRelation")}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="wiki-editor-footer">
        <button className="btn-cancel" onClick={handleCancelClick} disabled={saving}>
          {t("wiki.editor.cancel")}
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? t("wiki.editor.saving") : t("wiki.editor.save")}
        </button>
      </div>

      {/* 未保存修改二次确认 */}
      <ConfirmDialog
        open={cancelConfirmOpen}
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelDiscard}
        title={t("wiki.editor.discardTitle")}
        message={t("wiki.editor.discardMessage")}
        confirmText={t("wiki.editor.discardConfirm")}
        cancelText={t("wiki.editor.discardCancel")}
      />
    </div>
  );
}
