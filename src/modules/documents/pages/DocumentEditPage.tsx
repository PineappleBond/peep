import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, X, FolderOpen, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
// Lazy-load the heavy ByteMD editor — only fetched when document edit page is opened
const MarkdownEditor = lazy(() => import("../components/MarkdownEditor"));
import TagManager from "../components/TagManager";
import { useDocuments } from "../hooks/useDocuments";
import { useFolders } from "../hooks/useFolders";
import { usePersons } from "@/hooks/usePersons";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "../types";
import { HoroscopeScopeSelector } from "@/components/shared/HoroscopeScopeSelector";
import type { DocumentRecord } from "@/lib/db";

const validTypes: DocumentType[] = ["recall", "diary", "notes"];

export default function DocumentEditPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = idParam === undefined;
  const id = idParam ? Number(idParam) : undefined;

  const { createDocument, updateDocument, getDocument } = useDocuments();
  const { folders } = useFolders();
  const { persons } = usePersons();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docType, setDocType] = useState<DocumentType>(
    (searchParams.get("type") as DocumentType) || "notes"
  );
  const [tags, setTags] = useState<string[]>([]);
  const [personId, setPersonId] = useState<number | null>(
    searchParams.get("personId") ? Number(searchParams.get("personId")) : null
  );
  const [folderId, setFolderId] = useState<number | null>(
    searchParams.get("folderId") ? Number(searchParams.get("folderId")) : null
  );
  const [horoscopeScope, setHoroscopeScope] = useState<DocumentRecord["horoscopeScope"]>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  // Load existing document
  useEffect(() => {
    if (!isNew && id) {
      getDocument(id)
        .then((doc) => {
          if (doc) {
            setTitle(doc.title);
            setContent(doc.content);
            setDocType(doc.type);
            setTags(doc.tags);
            setPersonId(doc.personId ?? null);
            setFolderId(doc.folderId ?? null);
            setHoroscopeScope(doc.horoscopeScope ?? null);
          } else {
            navigate("/documents");
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("[DocumentEditPage] Failed to load document:", err);
          setLoading(false);
          navigate("/documents");
        });
    } else {
      setLoading(false);
    }
  }, [id, isNew, getDocument, navigate]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (isNew) {
        const newId = await createDocument({
          type: docType,
          title: title || "无标题",
          content,
          tags,
          personId,
          folderId,
          horoscopeScope,
        });
        navigate(`/documents/edit/${newId}`, { replace: true });
      } else if (id) {
        await updateDocument(id, {
          title: title || "无标题",
          content,
          type: docType,
          tags,
          personId,
          folderId,
          horoscopeScope,
        });
      }
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    isNew,
    id,
    title,
    content,
    docType,
    tags,
    personId,
    folderId,
    horoscopeScope,
    createDocument,
    updateDocument,
    navigate,
  ]);

  // Auto-save with debounce
  useEffect(() => {
    if (loading || (!isNew && !id)) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => clearTimeout(timer);
  }, [title, content, docType, tags, personId, folderId, handleSave, loading, isNew, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入标题..."
          className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto min-w-[200px] flex-1"
        />

        <div className="flex-1" />

        {/* 人物选择 */}
        <div className="flex items-center gap-1">
          <Select
            value={personId !== null ? String(personId) : "__none__"}
            onValueChange={(v) => {
              setPersonId(v === "__none__" ? null : Number(v));
            }}
          >
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue placeholder="关联人物" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">无关联</SelectItem>
              {persons.map((person) => (
                <SelectItem key={person.id} value={String(person.id)}>
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {personId !== null && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => navigate(`/persons?personId=${personId}`)}
              title="查看人物详情"
            >
              <UserCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* 文件夹选择 */}
        <Select
          value={folderId !== null ? String(folderId) : "__root__"}
          onValueChange={(v) => {
            setFolderId(v === "__root__" ? null : Number(v));
          }}
        >
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue placeholder="文件夹" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__root__">
              <span className="flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                根目录
              </span>
            </SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={String(folder.id)}>
                {folder.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={docType}
          onValueChange={(v) => setDocType(v as DocumentType)}
        >
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {validTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 关联时间 */}
        <HoroscopeScopeSelector value={horoscopeScope} onChange={setHoroscopeScope} />

        <TagManager
          documentId={id}
          currentTags={tags}
          onTagsChange={setTags}
        />

        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>

      {/* Tags display */}
      {tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button onClick={() => setTags(tags.filter((t) => t !== tag))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">加载编辑器...</p>
          </div>
        }>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="开始书写你的想法..."
          />
        </Suspense>
      </div>
    </div>
  );
}
