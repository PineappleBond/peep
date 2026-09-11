import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  FolderX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FolderNode } from "../hooks/useFolders";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface FolderTreeProps {
  tree: FolderNode[];
  expandedIds: Set<number>;
  /** null = "全部文档"，"__uncategorized__" = "未分类"，number = 具体文件夹 */
  selectedFolderId: number | "__uncategorized__" | null;
  /** 每个文件夹（含子树）中的文档总数 */
  totalCounts: Map<number, number>;
  /** 未分类文档数量 */
  uncategorizedCount: number;
  onToggleExpand: (id: number) => void;
  onSelect: (id: number | "__uncategorized__" | null) => void;
  onCreateFolder: (title: string, parentId: number | null) => Promise<number | void>;
  onRenameFolder: (id: number, title: string) => Promise<void>;
  onDeleteFolder: (id: number) => Promise<void>;
}

/** 未分类特殊值 */
export const UNCATEGORIZED_ID = "__uncategorized__";

export default function FolderTree({
  tree,
  expandedIds,
  selectedFolderId,
  totalCounts,
  uncategorizedCount,
  onToggleExpand,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: FolderTreeProps) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleCreateFolder = async (parentId: number | null) => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    await onCreateFolder(trimmed, parentId);
    setNewFolderName("");
    setShowNewFolder(false);
    setNewFolderParentId(null);
  };

  const handleRename = async (id: number) => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    await onRenameFolder(id, trimmed);
    setRenamingId(null);
    setRenameValue("");
  };

  const hasFolders = tree.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium text-muted-foreground">
          文件夹
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setShowNewFolder(true);
            setNewFolderParentId(null);
            setNewFolderName("");
          }}
          title="新建文件夹"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {/* "全部文档" */}
          <button
            className={cn(
              "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left rounded-md transition-colors",
              selectedFolderId === null
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted"
            )}
            onClick={() => onSelect(null)}
          >
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate flex-1">全部文档</span>
          </button>

          {/* "未分类" - 显示没有文件夹的文档数 */}
          <button
            className={cn(
              "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left rounded-md transition-colors",
              selectedFolderId === UNCATEGORIZED_ID
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted"
            )}
            onClick={() => onSelect(UNCATEGORIZED_ID)}
          >
            <FolderX className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate flex-1">未分类</span>
            {uncategorizedCount > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">
                {uncategorizedCount}
              </span>
            )}
          </button>

          {/* 新建文件夹输入框（根级） */}
          {showNewFolder && newFolderParentId === null && (
            <div className="px-3 py-1">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="文件夹名称"
                className="h-7 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder(null);
                  if (e.key === "Escape") setShowNewFolder(false);
                }}
                onBlur={() => {
                  if (!newFolderName.trim()) setShowNewFolder(false);
                }}
              />
            </div>
          )}

          {/* 文件夹树 */}
          {tree.map((node) => (
            <FolderTreeItem
              key={node.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              selectedFolderId={selectedFolderId}
              totalCounts={totalCounts}
              renamingId={renamingId}
              renameValue={renameValue}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onRenameValueChange={setRenameValue}
              onRenameSubmit={handleRename}
              onStartRename={(id, currentTitle) => {
                setRenamingId(id);
                setRenameValue(currentTitle);
              }}
              onCancelRename={() => setRenamingId(null)}
              onShowNewFolder={(parentId) => {
                setShowNewFolder(true);
                setNewFolderParentId(parentId);
                setNewFolderName("");
              }}
              onDeleteFolder={onDeleteFolder}
              showNewFolder={showNewFolder}
              newFolderParentId={newFolderParentId}
              newFolderName={newFolderName}
              onNewFolderNameChange={setNewFolderName}
              onNewFolderSubmit={handleCreateFolder}
              onNewFolderCancel={() => setShowNewFolder(false)}
            />
          ))}

          {/* 空状态提示 */}
          {!hasFolders && !showNewFolder && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              点击 + 新建文件夹
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface FolderTreeItemProps {
  node: FolderNode;
  depth: number;
  expandedIds: Set<number>;
  selectedFolderId: number | "__uncategorized__" | null;
  totalCounts: Map<number, number>;
  renamingId: number | null;
  renameValue: string;
  onToggleExpand: (id: number) => void;
  onSelect: (id: number | "__uncategorized__" | null) => void;
  onRenameValueChange: (v: string) => void;
  onRenameSubmit: (id: number) => void;
  onStartRename: (id: number, currentTitle: string) => void;
  onCancelRename: () => void;
  onShowNewFolder: (parentId: number) => void;
  onDeleteFolder: (id: number) => Promise<void>;
  showNewFolder: boolean;
  newFolderParentId: number | null;
  newFolderName: string;
  onNewFolderNameChange: (v: string) => void;
  onNewFolderSubmit: (parentId: number | null) => Promise<void>;
  onNewFolderCancel: () => void;
}

function FolderTreeItem({
  node,
  depth,
  expandedIds,
  selectedFolderId,
  totalCounts,
  renamingId,
  renameValue,
  onToggleExpand,
  onSelect,
  onRenameValueChange,
  onRenameSubmit,
  onStartRename,
  onCancelRename,
  onShowNewFolder,
  onDeleteFolder,
  showNewFolder,
  newFolderParentId,
  newFolderName,
  onNewFolderNameChange,
  onNewFolderSubmit,
  onNewFolderCancel,
}: FolderTreeItemProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedFolderId === node.id;
  const hasChildren = node.children.length > 0;
  const count = totalCounts.get(node.id) ?? node.documentCount;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div>
      <div
        className="flex items-center gap-1 group py-0.5"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* 展开/折叠 */}
        <button
          className="p-0.5 rounded hover:bg-muted shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(node.id);
          }}
          disabled={!hasChildren}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* 重命名模式 */}
        {renamingId === node.id ? (
          <Input
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            className="h-6 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit(node.id);
              if (e.key === "Escape") onCancelRename();
            }}
            onBlur={() => onRenameSubmit(node.id)}
          />
        ) : (
          <button
            className={cn(
              "flex items-center gap-1.5 flex-1 min-w-0 px-1.5 py-1 text-sm text-left rounded-md transition-colors",
              isSelected
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted"
            )}
            onClick={() => onSelect(node.id)}
            onDoubleClick={() => onStartRename(node.id, node.title)}
          >
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <span className="truncate">{node.title}</span>
            {count > 0 && (
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {count}
              </span>
            )}
          </button>
        )}

        {/* 操作菜单 */}
        {renamingId !== node.id && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onShowNewFolder(node.id)}>
                <Plus className="h-3.5 w-3.5 mr-2" />
                新建子文件夹
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStartRename(node.id, node.title)}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 新建子文件夹输入框 */}
      {showNewFolder && newFolderParentId === node.id && (
        <div
          className="px-3 py-1"
          style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
        >
          <Input
            value={newFolderName}
            onChange={(e) => onNewFolderNameChange(e.target.value)}
            placeholder="文件夹名称"
            className="h-7 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onNewFolderSubmit(node.id);
              if (e.key === "Escape") onNewFolderCancel();
            }}
            onBlur={() => {
              if (!newFolderName.trim()) onNewFolderCancel();
            }}
          />
        </div>
      )}

      {/* 递归渲染子文件夹 */}
      {isExpanded &&
        node.children.map((child) => (
          <FolderTreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedIds={expandedIds}
            selectedFolderId={selectedFolderId}
            totalCounts={totalCounts}
            renamingId={renamingId}
            renameValue={renameValue}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
            onRenameValueChange={onRenameValueChange}
            onRenameSubmit={onRenameSubmit}
            onStartRename={onStartRename}
            onCancelRename={onCancelRename}
            onShowNewFolder={onShowNewFolder}
            onDeleteFolder={onDeleteFolder}
            showNewFolder={showNewFolder}
            newFolderParentId={newFolderParentId}
            newFolderName={newFolderName}
            onNewFolderNameChange={onNewFolderNameChange}
            onNewFolderSubmit={onNewFolderSubmit}
            onNewFolderCancel={onNewFolderCancel}
          />
        ))}

      {/* 删除确认弹窗 */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              删除文件夹
            </DialogTitle>
            <DialogDescription>
              确定删除「{node.title}」？文件夹内文档将移至未分类。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await onDeleteFolder(node.id);
                setConfirmDelete(false);
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
