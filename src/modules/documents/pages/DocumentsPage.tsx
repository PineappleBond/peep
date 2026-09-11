import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Search, Filter, Users, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DocumentList from "../components/DocumentList";
import FolderTree, { UNCATEGORIZED_ID } from "../components/FolderTree";
import { useDocuments } from "../hooks/useDocuments";
import { useTags } from "../hooks/useTags";
import { useFolders } from "../hooks/useFolders";
import { usePersons } from "@/hooks/usePersons";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "../types";

const validTypes: (DocumentType | "trash")[] = ["recall", "diary", "notes", "trash"];

export default function DocumentsPage() {
  const { type } = useParams<{ type?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentType =
    type && validTypes.includes(type as DocumentType | "trash")
      ? (type as DocumentType | "trash")
      : undefined;

  const isTrashView = currentType === "trash";

  // 支持从 URL 参数 personId 初始化过滤器
  const urlPersonId = searchParams.get("personId");
  const [filterPersonId, setFilterPersonId] = useState<number | null>(
    urlPersonId ? Number(urlPersonId) : null
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 当 URL 中的 personId 变化时，同步过滤器
  useEffect(() => {
    const pid = searchParams.get("personId");
    if (pid) setFilterPersonId(Number(pid));
  }, [searchParams]);

  const { persons } = usePersons();
  const { allTags: allTagsRaw } = useTags();
  const allTags = allTagsRaw.map((t) => t.name);

  const {
    tree,
    expandedIds,
    selectedFolderId,
    toggleExpand,
    selectFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    folders,
  } = useFolders();

  // 获取文档列表：一次查询同时满足统计和显示需求，避免两次 useLiveQuery 重复加载
  const {
    documents: allDocumentsForCounts,
    searchQuery,
    setSearchQuery,
    selectedTags,
    setSelectedTags,
    deleteDocument,
    restoreDocument,
    permanentlyDeleteDocument,
  } = useDocuments(
    undefined, // 不过滤类型 —— 统计和文件夹计数需要全量数据
    filterPersonId ?? undefined,
    undefined,
    isTrashView
  );

  // 在已加载的全量数据上按类型二次过滤（纯内存操作，零额外查询）
  const documents = useMemo(() => {
    if (!currentType || currentType === "trash") return allDocumentsForCounts;
    return allDocumentsForCounts.filter((d) => d.type === currentType);
  }, [allDocumentsForCounts, currentType]);

  // 未分类文档数（无文件夹的文档）
  const uncategorizedCount = useMemo(
    () => allDocumentsForCounts.filter((d) => !d.folderId).length,
    [allDocumentsForCounts]
  );

  // 每个文件夹（含子树）的文档总数
  const folderTotalCounts = useMemo(() => {
    const counts = new Map<number, number>();
    if (!allDocumentsForCounts || !folders) return counts;

    const countForFolder = (folderId: number): number => {
      let count = allDocumentsForCounts.filter((d) => d.folderId === folderId).length;
      const childFolders = folders.filter((f) => f.parentId === folderId);
      for (const child of childFolders) {
        count += countForFolder(child.id!);
      }
      return count;
    };

    for (const f of folders) {
      counts.set(f.id!, countForFolder(f.id!));
    }
    return counts;
  }, [allDocumentsForCounts, folders]);

  // 将文件夹树的选择映射到实际过滤后的文档列表
  const displayedDocuments = useMemo(() => {
    if (selectedFolderId === null) {
      // "全部文档" - 显示所有过滤后的文档
      return documents;
    }
    if (selectedFolderId === UNCATEGORIZED_ID) {
      // "未分类" - 只显示无文件夹的文档
      return documents.filter((d) => !d.folderId);
    }
    // 特定文件夹 - 只显示该文件夹内的文档
    return documents.filter((d) => d.folderId === selectedFolderId);
  }, [documents, selectedFolderId]);

  const handleCreateNew = () => {
    const params = new URLSearchParams();
    if (currentType) params.set("type", currentType);
    if (selectedFolderId && selectedFolderId !== UNCATEGORIZED_ID) {
      params.set("folderId", String(selectedFolderId));
    }
    navigate(`/documents/new?${params.toString()}`);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="flex h-full -m-3">
      {/* 文件夹侧边栏 */}
      {sidebarOpen && (
        <>
          <div className="w-52 border-r shrink-0">
            <FolderTree
              tree={tree}
              expandedIds={expandedIds}
              selectedFolderId={selectedFolderId}
              totalCounts={folderTotalCounts}
              uncategorizedCount={uncategorizedCount}
              onToggleExpand={toggleExpand}
              onSelect={selectFolder}
              onCreateFolder={createFolder}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
            />
          </div>
          <Separator orientation="vertical" />
        </>
      )}

      {/* 主内容区 */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 pt-2 flex-wrap">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "收起侧栏" : "展开侧栏"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-3.5 w-3.5" />
            ) : (
              <PanelLeft className="h-3.5 w-3.5" />
            )}
          </Button>
          <h1 className="text-base font-bold">笔记</h1>
          <div className="flex-1" />
          <div className="relative w-44">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索文档..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>
          <Button size="sm" onClick={handleCreateNew}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            新建文档
          </Button>
        </div>

        {/* Person filter */}
        {persons.length > 0 && (
          <div className="flex items-center gap-2 px-3 pt-1.5 flex-wrap">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={filterPersonId !== null ? String(filterPersonId) : "__all__"}
              onValueChange={(v) => {
                if (v === "__all__") setFilterPersonId(null);
                else setFilterPersonId(Number(v));
              }}
            >
              <SelectTrigger className="w-[140px] h-7 text-xs">
                <SelectValue placeholder="全部人物" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部人物</SelectItem>
                {persons.map((person) => (
                  <SelectItem key={person.id} value={String(person.id)}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterPersonId !== null && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setFilterPersonId(null)}
              >
                清除
              </Button>
            )}
          </div>
        )}

        {/* Type tabs */}
        <div className="px-3 pt-1.5">
          <Tabs
            value={currentType ?? "all"}
            onValueChange={(v) => {
              if (v === "all") navigate("/documents");
              else navigate(`/documents/${v}`);
            }}
          >
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              {validTypes.filter(t => t !== "trash").map((t) => (
                <TabsTrigger key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t as DocumentType]}
                </TabsTrigger>
              ))}
              <TabsTrigger value="trash">垃圾篓</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 pt-1.5 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer hover:bg-accent text-xs"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setSelectedTags([])}
              >
                清除
              </Button>
            )}
          </div>
        )}

        <Separator className="mt-2" />

        {/* Document list */}
        <div className="flex-1 min-h-0 px-3 py-2">
          <DocumentList
            documents={displayedDocuments}
            onDelete={deleteDocument}
            onRestore={isTrashView ? restoreDocument : undefined}
            onPermanentlyDelete={isTrashView ? permanentlyDeleteDocument : undefined}
            type={isTrashView ? undefined : currentType as DocumentType}
            persons={persons}
          />
        </div>
      </div>
    </div>
  );
}
