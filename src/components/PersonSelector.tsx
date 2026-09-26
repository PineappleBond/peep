/**
 * Header 人物选择器：下拉选择 + 新增/编辑/删除
 */
import { useEffect, useState } from "react";
import type { Person } from "../core/personDb";
import { listPersons, savePerson, deletePerson, getDefaultPerson } from "../core/personDb";
import type { BirthInput } from "../core/useZwds";
import { PersonDialog } from "./PersonDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { useI18n } from "../core/i18n";
import { toast } from "../core/toast";

type PersonSelectorProps = {
  /** 当前选中人物 ID */
  currentId: number | null;
  /** 选择人物回调 */
  onSelect: (person: Person) => void;
};

export function PersonSelector({ currentId, onSelect }: PersonSelectorProps) {
  const { t } = useI18n();
  const [persons, setPersons] = useState<Person[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<Person | null>(null);
  /** 人物列表加载中 */
  const [loading, setLoading] = useState(true);

  const loadPersons = async () => {
    setLoading(true);
    try {
      const list = await listPersons();
      setPersons(list);
    } catch (err) {
      console.error("[PersonSelector] 加载人物列表失败", err);
      // 降级：显示空列表，避免整个组件崩溃
      setPersons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersons();
  }, []);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    const person = persons.find(p => p.id === id);
    if (person) onSelect(person);
  };

  const handleAdd = () => {
    setEditingPerson(undefined);
    setDialogOpen(true);
  };

  const handleEdit = () => {
    const current = persons.find(p => p.id === currentId);
    if (current) {
      setEditingPerson(current);
      setDialogOpen(true);
    }
  };

  const handleSave = async (input: BirthInput, isDefault: boolean) => {
    try {
      const saved = await savePerson(editingPerson?.id, input, isDefault);
      onSelect(saved);
      await loadPersons();
      toast.success(t("common.saveSuccess"));
    } catch (err) {
      console.error("[PersonSelector] 保存人物失败", err);
      toast.error(err instanceof Error ? err.message : t("person.saveFailed"));
    }
  };

  const handleDeleteClick = () => {
    const current = persons.find(p => p.id === currentId);
    if (current) setConfirmDelete(current);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete?.id) return;
    try {
      await deletePerson(confirmDelete.id);
      const defaultPerson = await getDefaultPerson();
      onSelect(defaultPerson);
      setConfirmDelete(null);
      await loadPersons();
      toast.success(t("common.deleteSuccess"));
    } catch (err) {
      console.error("[PersonSelector] 删除人物失败", err);
      toast.error(err instanceof Error ? err.message : t("person.deleteFailed"));
    }
  };

  const currentPerson = persons.find(p => p.id === currentId);
  const canDelete = currentPerson && !currentPerson.isDefault;

  return (
    <>
      <div className="person-sel">
        <select
          value={currentId || ""}
          onChange={handleSelect}
          className="person-select"
          aria-label={t("person.selectPerson")}
          disabled={loading}
        >
          {loading ? (
            <option value="">{t("common.loading")}</option>
          ) : (
            persons.map(p => (
              <option key={p.id} value={p.id}>
                {p.name || t("person.unnamed")} ·{" "}
                {p.gender === "男" ? t("common.male") : t("common.female")}
              </option>
            ))
          )}
        </select>
        <button
          className="person-btn"
          onClick={handleAdd}
          aria-label={t("person.addPerson")}
          disabled={loading}
        >
          +
        </button>
        <button
          className="person-btn"
          onClick={handleEdit}
          aria-label={t("person.editCurrent")}
          disabled={loading}
        >
          ✎
        </button>
        <button
          className="person-btn person-del"
          onClick={handleDeleteClick}
          disabled={!canDelete || loading}
          aria-label={canDelete ? t("person.deleteCurrent") : t("person.defaultCannotDelete")}
          title={canDelete ? t("person.deleteCurrent") : t("person.defaultCannotDelete")}
        >
          ✕
        </button>
      </div>

      <PersonDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initialData={editingPerson}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
        title={t("person.deletePerson")}
        message={t("person.confirmDelete", { name: confirmDelete?.name || t("person.unnamed") })}
        confirmText={t("person.confirmDeleteText")}
        cancelText={t("common.cancel")}
      />
    </>
  );
}
