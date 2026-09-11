import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTags } from "../hooks/useTags";

interface TagManagerProps {
  documentId?: number;
  currentTags?: string[];
  onTagsChange?: (tags: string[]) => void;
}

export default function TagManager({
  documentId,
  currentTags = [],
  onTagsChange,
}: TagManagerProps) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const { allTags, addTagToDocument, removeTagFromDocument } = useTags();
  const isNew = !documentId;

  const handleAddTag = async (tag: string) => {
    if (isNew) return;
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (currentTags.includes(trimmed)) return;

    await addTagToDocument(documentId!, trimmed);
    onTagsChange?.([...currentTags, trimmed]);
    setNewTag("");
  };

  const handleRemoveTag = async (tag: string) => {
    if (isNew) return;
    await removeTagFromDocument(documentId!, tag);
    onTagsChange?.(currentTags.filter((t) => t !== tag));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1" disabled={isNew} title={isNew ? "保存文档后可添加标签" : undefined}>
          <Plus className="h-3 w-3" />
          {isNew ? "保存后加标签" : "标签管理"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>标签管理</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Current tags */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">当前标签</p>
            <div className="flex flex-wrap gap-2">
              {currentTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  {documentId && (
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
              {currentTags.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无标签</p>
              )}
            </div>
          </div>

          {/* Add new tag */}
          {documentId && (
            <div className="flex gap-2">
              <Input
                placeholder="输入标签名"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddTag(newTag);
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => handleAddTag(newTag)}
                disabled={!newTag.trim()}
              >
                添加
              </Button>
            </div>
          )}

          {/* All existing tags */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">所有标签</p>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">
              {allTags.map(({ name, count }) => (
                <Badge
                  key={name}
                  variant={currentTags.includes(name) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    if (documentId && !currentTags.includes(name)) {
                      handleAddTag(name);
                    }
                  }}
                >
                  {name} ({count})
                </Badge>
              ))}
              {allTags.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无标签</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
