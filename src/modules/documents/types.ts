export type DocumentType = "recall" | "diary" | "notes";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  recall: "回忆录",
  diary: "日记",
  notes: "杂记",
};

export const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
  recall: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  diary: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  notes:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};
