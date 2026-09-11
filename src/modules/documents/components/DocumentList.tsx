import { Link } from "react-router-dom";
import { useState } from "react";
import { FileText, Trash2, Clock, User, RotateCcw, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn, formatDateTime, truncate } from "@/lib/utils";
import type { DocumentRecord, Person } from "@/lib/db";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_COLORS,
  type DocumentType,
} from "../types";

interface DocumentListProps {
  documents: DocumentRecord[];
  onDelete: (id: number) => void;
  onRestore?: (id: number) => void;
  onPermanentlyDelete?: (id: number) => void;
  type?: DocumentType;
  /** 人物列表，用于显示关联人物名称 */
  persons?: Person[];
}

export default function DocumentList({
  documents,
  onDelete,
  onRestore,
  onPermanentlyDelete,
  type,
  persons = [],
}: DocumentListProps) {
  const isTrashView = !!onRestore || !!onPermanentlyDelete;

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {isTrashView ? (
          <>
            <Trash2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">垃圾篓为空</p>
            <p className="text-sm text-muted-foreground mt-1">
              已删除的文档会显示在这里
            </p>
          </>
        ) : (
          <>
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {type
                ? `暂无${DOCUMENT_TYPE_LABELS[type]}文档`
                : "暂无文档"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              点击 "新建文档" 开始创作
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1.5 pr-2">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            onDelete={onDelete}
            onRestore={onRestore}
            onPermanentlyDelete={onPermanentlyDelete}
            persons={persons}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function DocumentCard({
  doc,
  onDelete,
  onRestore,
  onPermanentlyDelete,
  persons,
}: {
  doc: DocumentRecord;
  onDelete: (id: number) => void;
  onRestore?: (id: number) => void;
  onPermanentlyDelete?: (id: number) => void;
  persons: Person[];
}) {
  const isTrashItem = !!doc.deletedAt;
  const person = doc.personId ? persons.find((p) => p.id === doc.personId) : null;
  const docId = doc.id!;
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** 文档元信息区：类型标签 + 标签 + 标题 + 摘要 */
  const docMeta = (
    <>
      <div className="flex items-center gap-1.5 mb-1">
        <Badge
          variant="outline"
          className={cn("text-xs", DOCUMENT_TYPE_COLORS[doc.type])}
        >
          {DOCUMENT_TYPE_LABELS[doc.type]}
        </Badge>
        {doc.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">
            {tag}
          </Badge>
        ))}
        {doc.tags.length > 2 && (
          <span className="text-xs text-muted-foreground">
            +{doc.tags.length - 2}
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium truncate">{doc.title || "无标题"}</h3>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
        {truncate(doc.content.replace(/[#*`>\-[\]]/g, ""), 120) || "暂无内容"}
      </p>
    </>
  );

  /** 底部信息行：时间 + 关联人物 */
  const footer = (
    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Clock className="h-2.5 w-2.5" />
        {isTrashItem
          ? `删除于 ${formatDateTime(doc.deletedAt!)}`
          : formatDateTime(doc.updatedAt)}
      </span>
      {person && (
        <span className="flex items-center gap-1">
          <User className="h-2.5 w-2.5" />
          {person.name}
        </span>
      )}
    </div>
  );

  /** 操作按钮区 */
  const actions = isTrashItem ? (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
      {onRestore && (
        <Button
          variant="ghost"
          size="icon-xs"
          title="恢复"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRestore(docId); }}
        >
          <RotateCcw className="h-3.5 w-3.5 text-primary" />
        </Button>
      )}
      {onPermanentlyDelete && (
        <Button
          variant="ghost"
          size="icon-xs"
          title="永久删除"
          onClick={(e) => {
            e.preventDefault(); e.stopPropagation();
            setConfirmDelete(true);
          }}
        >
          <Trash className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}
    </div>
  ) : (
    <Button
      variant="ghost"
      size="icon-xs"
      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(docId); }}
    >
      <Trash2 className="h-3.5 w-3.5 text-destructive" />
    </Button>
  );

  const content = (
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        {docMeta}
        {footer}
      </div>
      {actions}
    </div>
  );

  return (
    <>
      <Card className="group relative transition-shadow hover:shadow-md">
        <CardContent className="p-3">
          {isTrashItem ? content : (
            <Link to={`/documents/edit/${doc.id}`} className="block">
              {content}
            </Link>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              永久删除
            </DialogTitle>
            <DialogDescription>
              确定要永久删除此文档吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onPermanentlyDelete?.(docId);
                setConfirmDelete(false);
              }}
            >
              永久删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
