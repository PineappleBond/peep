import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import MarkdownViewer from "@/components/shared/MarkdownViewer";
import { lsSet, lsRemove, formatDateShort, formatRelativeTime } from "@/lib/utils";
import {
  Plus,
  Search,
  Users,
  Trash2,
  Compass,
  CircleDot,
  Dices,
  FileEdit,
  Pencil,
  X,
  Check,
  FileText,
  Crosshair,
  Eye,
  Edit3,
  RotateCcw,
  Archive,
} from "lucide-react";
import { db, type Person } from "@/lib/db";
import { SELECTED_PERSON_KEY } from "@/hooks/useSelectedPerson";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/modules/documents/types";

interface PersonForm {
  name: string;
  gender: "male" | "female";
  birthDate: string;
  birthTime: string;
  isLunar: boolean;
  note: string;
}

const emptyForm: PersonForm = {
  name: "",
  gender: "male",
  birthDate: "",
  birthTime: "",
  isLunar: false,
  note: "",
};

export default function PersonsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [notePreview, setNotePreview] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  // 从 URL 读取当前选中人物 ID
  const selectedIdStr = searchParams.get("personId");
  const selectedId = selectedIdStr ? Number(selectedIdStr) : null;

  const persons =
    useLiveQuery<Person[]>(
      async () => {
        const all = await db.persons.toArray();
        return all
          .filter((p) => (showDeleted ? p.deletedAt != null : !p.deletedAt))
          .sort((a, b) => b.createdAt - a.createdAt);
      },
      [showDeleted],
    ) ?? [];

  // 所有文档（用于统计每个人物的文档数）
  const allDocs =
    useLiveQuery(() => db.documents.toArray(), []) ?? [];

  // 每个人物的文档数（排除软删除）
  // allDocs 引用由 useLiveQuery 管理，数据不变时引用稳定
  const docCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const doc of allDocs) {
      if (doc.personId != null && !doc.deletedAt) {
        counts.set(doc.personId, (counts.get(doc.personId) ?? 0) + 1);
      }
    }
    return counts;
  }, [allDocs]);

  // 选中人物关联的文档（最近的）
  const relatedDocs = useMemo(() => {
    if (!selectedId) return [];
    return allDocs
      .filter((d) => d.personId === selectedId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);
  }, [allDocs, selectedId]);

  const selectedPerson = selectedId
    ? persons.find((p) => p.id === selectedId)
    : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return persons;
    return persons.filter((p) => p.name.toLowerCase().includes(q));
  }, [persons, search]);

  // 选中某个人物
  const selectPerson = (id: number) => {
    // 持久化到 localStorage
    lsSet(SELECTED_PERSON_KEY, String(id));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("personId", String(id));
      return next;
    }, { replace: true });
    setIsEditing(false);
    setIsEditingNote(false);
  };

  // 取消选择
  const clearSelection = () => {
    lsRemove(SELECTED_PERSON_KEY);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("personId");
      return next;
    }, { replace: true });
    setIsEditing(false);
    setIsEditingNote(false);
  };

  const openCreate = () => {
    setEditingPerson(null);
    setForm(emptyForm);
    setIsEditing(true);
  };

  const openEdit = (person: Person) => {
    setEditingPerson(person);
    setForm({
      name: person.name,
      gender: person.gender,
      birthDate: person.birthDate,
      birthTime: person.birthTime ?? "",
      isLunar: person.isLunar ?? false,
      note: person.note ?? "",
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("姓名不能为空");
      return;
    }
    if (!form.birthDate) {
      toast.error("请选择出生日期");
      return;
    }

    const now = Date.now();
    const payload = {
      name: form.name.trim(),
      gender: form.gender,
      birthDate: form.birthDate,
      birthTime: form.birthTime || undefined,
      isLunar: form.isLunar || undefined,
      note: form.note.trim() || undefined,
      updatedAt: now,
    };

    try {
      if (editingPerson?.id) {
        await db.persons.update(editingPerson.id, payload);
        toast.success("已更新");
        setIsEditing(false);
      } else {
        const id = await db.persons.add({ ...payload, createdAt: now });
        toast.success("已创建");
        setIsEditing(false);
        // 选中新创建的人物
        selectPerson(id as number);
      }
    } catch (err) {
      console.error("[PersonsPage] Save person failed:", err);
      toast.error("保存失败");
    }
  };

  const handleSaveNote = async () => {
    if (!selectedPerson?.id) return;
    const now = Date.now();
    try {
      await db.persons.update(selectedPerson.id, {
        note: noteDraft.trim() || undefined,
        updatedAt: now,
      });
      setIsEditingNote(false);
      toast.success("备注已保存");
    } catch {
      toast.error("保存失败");
    }
  };

  const startEditNote = () => {
    setNoteDraft(selectedPerson?.note ?? "");
    setIsEditingNote(true);
    setNotePreview(false);
  };

  // 备注自动保存（防抖 1.5s）
  const noteAutoSaveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    if (!isEditingNote || !selectedPerson?.id) return;
    if (noteAutoSaveTimer.current) clearTimeout(noteAutoSaveTimer.current);
    noteAutoSaveTimer.current = setTimeout(async () => {
      try {
        await db.persons.update(selectedPerson.id!, {
          note: noteDraft.trim() || undefined,
          updatedAt: Date.now(),
        });
      } catch (e) {
        console.warn("[PersonsPage] Note auto-save failed:", e);
      }
    }, 1500);
    return () => {
      if (noteAutoSaveTimer.current) clearTimeout(noteAutoSaveTimer.current);
    };
  }, [noteDraft, isEditingNote, selectedPerson?.id]);

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      // 软删除：设置 deletedAt 时间戳
      await db.persons.update(deleteTarget.id, { deletedAt: Date.now() });
      if (selectedId === deleteTarget.id) {
        clearSelection();
      }
      toast.success("已移至垃圾篓");
    } catch (err) {
      console.error("[PersonsPage] Soft delete failed:", err);
      toast.error("删除失败");
    } finally {
      setDeleteTarget(null);
    }
  };

  // 恢复已删除的人物
  const handleRestore = async (person: Person) => {
    try {
      await db.persons.update(person.id!, { deletedAt: null });
      toast.success("已恢复");
    } catch (err) {
      console.error("[PersonsPage] Restore failed:", err);
      toast.error("恢复失败");
    }
  };

  // 永久删除人物
  const handlePermanentlyDelete = async (person: Person) => {
    if (!person.id) return;
    try {
      // 使用事务保证原子性：要么全部成功，要么全部回滚
      await db.transaction("rw", db.documents, db.persons, async () => {
        // 批量清除关联文档的 personId
        await db.documents
          .where("personId")
          .equals(person.id)
          .modify({ personId: null, updatedAt: Date.now() });
        // 删除人物
        await db.persons.delete(person.id!);
      });
      toast.success("已永久删除");
    } catch (err) {
      console.error("[PersonsPage] Permanent delete failed:", err);
      toast.error("永久删除失败");
    }
  };

  // "设为当前研究" - 在工作台选中此人物
  const setAsCurrent = (personId: number) => {
    // 持久化到 localStorage
    lsSet(SELECTED_PERSON_KEY, String(personId));
    navigate(`/?personId=${personId}`);
  };

  return (
    <div className="flex h-full -m-3">
      {/* ── 左侧列表 ─────────────────────────────── */}
      <div className="w-72 border-r flex flex-col shrink-0">
        {/* 列表头部 */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <h1 className="text-sm font-semibold">人物库</h1>
          <div className="flex-1" />
          <Tabs
            value={showDeleted ? "trash" : "all"}
            onValueChange={(v) => setShowDeleted(v === "trash")}
            className="gap-0"
          >
            <TabsList className="h-7">
              <TabsTrigger value="all" className="text-xs px-2 py-0 h-5">全部</TabsTrigger>
              <TabsTrigger value="trash" className="text-xs px-2 py-0 h-5">垃圾篓</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="icon-xs" variant="ghost" onClick={openCreate} title="新建人物">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* 搜索 */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>
        </div>

        <Separator />

        {/* 列表 */}
        <div className="flex-1 min-h-0 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 px-4">
              {showDeleted ? <Archive className="h-8 w-8" /> : <Users className="h-8 w-8" />}
              <p className="text-xs text-center">
                {showDeleted
                  ? "垃圾篓为空"
                  : persons.length === 0
                    ? "还没有人物档案，点击 + 新建"
                    : "没有匹配的人物"}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filtered.map((person) => {
                const isSelected = selectedId === person.id;
                const count = docCounts.get(person.id!) ?? 0;
                return (
                  <div
                    key={person.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2 mx-1 rounded-md cursor-pointer transition-colors",
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                    onClick={() => selectPerson(person.id!)}
                  >
                    {/* 性别指示 */}
                    <div
                      className={cn(
                        "w-1.5 h-8 rounded-full shrink-0",
                        person.gender === "male"
                          ? "bg-sky-400 dark:bg-sky-500"
                          : "bg-pink-400 dark:bg-pink-500"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">
                          {person.name}
                        </span>
                        {person.isLunar && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5 leading-none">
                            农历
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{formatDateShort(person.birthDate)}</span>
                        {person.birthTime && <span>{person.birthTime}</span>}
                        {count > 0 && (
                          <span className="flex items-center gap-0.5">
                            <FileText className="h-2.5 w-2.5" />
                            {count}
                          </span>
                        )}
                      </div>
                    </div>
                    {showDeleted ? (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(person);
                          }}
                          title="恢复"
                        >
                          <RotateCcw className="h-3 w-3 text-green-600 dark:text-green-400" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePermanentlyDelete(person);
                          }}
                          title="永久删除"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatRelativeTime(person.updatedAt)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 右侧详情 ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {isEditing ? (
          /* ── 编辑表单 ────────────────────────────── */
          <EditForm
            form={form}
            setForm={setForm}
            isEditingPerson={editingPerson}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        ) : !selectedPerson ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Users className="h-12 w-12" />
            <div className="text-center">
              <p className="text-sm font-medium">选择一个人物</p>
              <p className="text-xs mt-1">从左侧列表选择，或创建新人物档案</p>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              新建人物
            </Button>
          </div>
        ) : (
          /* ── 详情视图 ────────────────────────────── */
          <div className="flex flex-col h-full">
            {/* 详情头部 */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-4">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0",
                  selectedPerson.gender === "male"
                    ? "bg-sky-500"
                    : "bg-pink-500"
                )}
              >
                {selectedPerson.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold truncate">
                    {selectedPerson.name}
                  </h2>
                  <Badge
                    variant="secondary"
                    className={
                      selectedPerson.gender === "male"
                        ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                        : "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300"
                    }
                  >
                    {selectedPerson.gender === "male" ? "男" : "女"}
                  </Badge>
                  {selectedPerson.isLunar && (
                    <Badge variant="outline">农历</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {formatDateShort(selectedPerson.birthDate)}
                  {selectedPerson.birthTime && ` ${selectedPerson.birthTime}`}
                  <span className="mx-2">·</span>
                  <span>更新于 {formatRelativeTime(selectedPerson.updatedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAsCurrent(selectedPerson.id!)}
                  title="在工作台中选中此人物"
                >
                  <Crosshair className="h-3.5 w-3.5 mr-1" />
                  设为当前
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => openEdit(selectedPerson)}
                  title="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(selectedPerson)}
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* 快速操作 */}
            <div className="flex items-center gap-2 px-6 py-3">
              <span className="text-xs text-muted-foreground">排盘：</span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => navigate(`/?tab=bazi&personId=${selectedPerson.id}`)}
              >
                <Compass className="h-3 w-3 mr-1" />
                八字
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => navigate(`/?tab=ziwei&personId=${selectedPerson.id}`)}
              >
                <CircleDot className="h-3 w-3 mr-1" />
                紫微
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => navigate(`/?tab=liuyao&personId=${selectedPerson.id}`)}
              >
                <Dices className="h-3 w-3 mr-1" />
                六爻
              </Button>
              <div className="flex-1" />
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  navigate(`/documents/new?personId=${selectedPerson.id}&type=notes`)
                }
              >
                <FileEdit className="h-3 w-3 mr-1" />
                写笔记
              </Button>
              {relatedDocs.length > 0 && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => navigate(`/documents?personId=${selectedPerson.id}`)}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  查看笔记({relatedDocs.length})
                </Button>
              )}
            </div>

            <Separator />

            {/* 内容区：备注 + 关联文档 */}
            <div className="flex-1 min-h-0 overflow-auto px-6 py-4 space-y-5">
              {/* 备注区 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-medium">备注</h3>
                  <div className="flex-1" />
                  {isEditingNote ? (
                    <div className="flex items-center gap-1">
                      <Button size="icon-xs" variant="ghost" onClick={() => setIsEditingNote(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                      <Button size="icon-xs" variant="ghost" onClick={handleSaveNote}>
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="icon-xs" variant="ghost" onClick={startEditNote} title="编辑备注">
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isEditingNote ? (
                  <div>
                    {/* 编辑/预览切换 */}
                    <div className="flex items-center gap-1 mb-2">
                      <Button
                        size="xs"
                        variant={notePreview ? "ghost" : "outline"}
                        onClick={() => setNotePreview(false)}
                        className="gap-1"
                      >
                        <Edit3 className="h-3 w-3" />
                        编辑
                      </Button>
                      <Button
                        size="xs"
                        variant={notePreview ? "outline" : "ghost"}
                        onClick={() => setNotePreview(true)}
                        className="gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        预览
                      </Button>
                    </div>
                    {notePreview ? (
                      <div className="min-h-[120px] p-3 border rounded-md bg-muted/20 text-sm">
                        {noteDraft.trim() ? (
                          <MarkdownViewer value={noteDraft} />
                        ) : (
                          <p className="text-muted-foreground italic text-xs">无可预览内容</p>
                        )}
                      </div>
                    ) : (
                      <Textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="输入备注（支持 Markdown）..."
                        rows={6}
                        className="text-sm resize-none font-mono"
                        autoFocus
                      />
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      支持 Markdown 格式 · Ctrl+B 加粗 · Ctrl+I 斜体 · Ctrl+K 链接
                    </p>
                  </div>
                ) : selectedPerson.note ? (
                  <div className="text-sm person-note-preview">
                    <MarkdownViewer value={selectedPerson.note} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">暂无备注</p>
                )}
              </div>

              {/* 关联文档 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-medium">
                    关联文档
                    {relatedDocs.length > 0 && (
                      <span className="text-muted-foreground font-normal ml-1">
                        ({relatedDocs.length})
                      </span>
                    )}
                  </h3>
                </div>
                {relatedDocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    暂无关联文档
                  </p>
                ) : (
                  <div className="space-y-1">
                    {relatedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors text-sm"
                        onClick={() => navigate(`/documents/edit/${doc.id}`)}
                      >
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1">{doc.title || "无标题"}</span>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">
                          {DOCUMENT_TYPE_LABELS[doc.type as DocumentType] ?? doc.type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatRelativeTime(doc.updatedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              确定要将{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              移至垃圾篓吗？你可以在垃圾篓中恢复它。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── 编辑表单组件 ─────────────────────────────── */
interface EditFormProps {
  form: PersonForm;
  setForm: (f: PersonForm) => void;
  isEditingPerson: Person | null;
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({ form, setForm, isEditingPerson, onSave, onCancel }: EditFormProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 pt-5 pb-4">
        <h2 className="text-lg font-bold">
          {isEditingPerson ? "编辑人物" : "新建人物"}
        </h2>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onCancel}>
          取消
        </Button>
        <Button size="sm" onClick={onSave}>
          <Check className="h-3.5 w-3.5 mr-1" />
          保存
        </Button>
      </div>
      <Separator />
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="grid gap-4 max-w-md">
          {/* 姓名 */}
          <div className="grid gap-1.5">
            <Label htmlFor="name">
              姓名 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="例如：张三"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* 性别 */}
          <div className="grid gap-1.5">
            <Label>性别</Label>
            <RadioGroup
              value={form.gender}
              onValueChange={(v) =>
                setForm({ ...form, gender: v as "male" | "female" })
              }
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="male" id="gender-male" />
                <Label htmlFor="gender-male" className="font-normal cursor-pointer">男</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="female" id="gender-female" />
                <Label htmlFor="gender-female" className="font-normal cursor-pointer">女</Label>
              </div>
            </RadioGroup>
          </div>

          {/* 出生日期/时间 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="birthDate">
                出生日期 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="birthTime">出生时间</Label>
              <Input
                id="birthTime"
                type="time"
                value={form.birthTime}
                onChange={(e) => setForm({ ...form, birthTime: e.target.value })}
              />
            </div>
          </div>

          {/* 农历/公历 */}
          <div className="grid gap-1.5">
            <Label>历法</Label>
            <RadioGroup
              value={form.isLunar ? "lunar" : "solar"}
              onValueChange={(v) =>
                setForm({ ...form, isLunar: v === "lunar" })
              }
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="solar" id="cal-solar" />
                <Label htmlFor="cal-solar" className="font-normal cursor-pointer">公历</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="lunar" id="cal-lunar" />
                <Label htmlFor="cal-lunar" className="font-normal cursor-pointer">农历</Label>
              </div>
            </RadioGroup>
            <p className="text-[11px] text-muted-foreground">
              {form.isLunar
                ? "输入的日期将被视为农历日期"
                : "输入的日期为公历（阳历）日期"}
            </p>
          </div>

          {/* 备注 */}
          <div className="grid gap-1.5">
            <Label htmlFor="note">备注</Label>
            <Textarea
              id="note"
              placeholder="备注信息（支持 Markdown）..."
              rows={6}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="text-sm resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              支持 Markdown 格式
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
