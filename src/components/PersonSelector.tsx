/**
 * Header 人物选择器：下拉选择 + 新增/编辑/删除
 */
import { useEffect, useState } from "react";
import type { Person } from "../core/personDb";
import {
  listPersons,
  savePerson,
  deletePerson,
  getDefaultPerson,
} from "../core/personDb";
import type { BirthInput } from "../core/useZwds";
import { PersonDialog } from "./PersonDialog";
import { ConfirmDialog } from "./ConfirmDialog";

type PersonSelectorProps = {
  /** 当前选中人物 ID */
  currentId: number | null;
  /** 选择人物回调 */
  onSelect: (person: Person) => void;
};

export function PersonSelector({ currentId, onSelect }: PersonSelectorProps) {
  const [persons, setPersons] = useState<Person[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<Person | null>(null);

  const loadPersons = async () => {
    try {
      const list = await listPersons();
      setPersons(list);
    } catch (err) {
      console.error("[PersonSelector] 加载人物列表失败", err);
      // 降级：显示空列表，避免整个组件崩溃
      setPersons([]);
    }
  };

  useEffect(() => {
    loadPersons();
  }, []);

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    const person = persons.find((p) => p.id === id);
    if (person) onSelect(person);
  };

  const handleAdd = () => {
    setEditingPerson(undefined);
    setDialogOpen(true);
  };

  const handleEdit = () => {
    const current = persons.find((p) => p.id === currentId);
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
    } catch (err) {
      console.error("[PersonSelector] 保存人物失败", err);
      alert(err instanceof Error ? err.message : "保存失败，请重试");
    }
  };

  const handleDeleteClick = () => {
    const current = persons.find((p) => p.id === currentId);
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
    } catch (err) {
      console.error("[PersonSelector] 删除人物失败", err);
      alert(err instanceof Error ? err.message : "删除失败，请重试");
    }
  };

  const currentPerson = persons.find((p) => p.id === currentId);
  const canDelete = currentPerson && !currentPerson.isDefault;

  return (
    <>
      <div className="person-sel">
        <select
          value={currentId || ""}
          onChange={handleSelect}
          className="person-select"
        >
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || "无名"} · {p.gender}
            </option>
          ))}
        </select>
        <button className="person-btn" onClick={handleAdd} title="新增人物">
          +
        </button>
        <button className="person-btn" onClick={handleEdit} title="编辑当前人物">
          ✎
        </button>
        <button
          className="person-btn person-del"
          onClick={handleDeleteClick}
          disabled={!canDelete}
          title={canDelete ? "删除当前人物" : "默认人物不可删除"}
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
        title="删除人物"
        message={`确定删除人物「${confirmDelete?.name || "无名"}」吗？此操作不可撤销。`}
        confirmText="确定删除"
        cancelText="取消"
      />
    </>
  );
}
