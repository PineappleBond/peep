import { useState, type ReactNode } from "react";
import { Copy, Check, MessageSquare, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";

// Magic numbers
const COPIED_RESET_DELAY = 2000; // 复制成功提示重置延时（毫秒）

// Error messages
const COPY_ERROR_MESSAGE = "复制失败，请手动选择文本复制";

export interface PromptTab {
  key: string;
  label: string;
  /** Short hint shown above the preview area */
  hint: string;
  /** Optional extra input rendered inside the tab content */
  input?: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    rows?: number;
    /** Custom content rendered above the textarea */
    renderExtra?: ReactNode;
    /** Hide the label + textarea (only show renderExtra) */
    hideTextarea?: boolean;
  };
}

interface Props {
  title?: string;
  tabs: PromptTab[];
  /** Record mapping tab key -> full prompt text */
  prompts: Record<string, string>;
  defaultTab?: string;
  maxPreviewChars?: number;
}

const DEFAULT_PREVIEW = 2000;

export function AiPromptPanel({
  title = "AI 提示词",
  tabs,
  prompts,
  defaultTab,
  maxPreviewChars = DEFAULT_PREVIEW,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.key ?? "");
  const [copied, setCopied] = useState(false);

  const currentPrompt = prompts[activeTab] ?? "";
  const charCount = currentPrompt.length;

  const handleCopy = async () => {
    try {
      const ok = await copyToClipboard(currentPrompt);
      if (ok) {
        setCopied(true);
        toast.success("提示词已复制");
        setTimeout(() => setCopied(false), COPIED_RESET_DELAY);
      } else {
        toast.error(COPY_ERROR_MESSAGE);
      }
    } catch (e) {
      console.error("[AiPromptPanel] Copy failed:", e);
      toast.error(COPY_ERROR_MESSAGE);
    }
  };

  if (tabs.length === 0) return null;

  return (
    <Card className="border-primary/10">
      <CardHeader
        className="pb-0 pt-2 px-3 cursor-pointer select-none"
        onClick={() => setCollapsed((v) => !v)}
      >
        <CardTitle className="flex items-center gap-2 text-xs">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <span>{title}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 ml-auto text-muted-foreground transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
        </CardTitle>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-2 pt-2 px-3 pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="flex-1 text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {tabs.map((tab) => (
              <TabsContent key={tab.key} value={tab.key}>
                <p className="text-xs text-muted-foreground">{tab.hint}</p>
                {tab.input && (
                  <div className="space-y-1 mt-1.5">
                    {tab.input.renderExtra}
                    {!tab.input.hideTextarea && (
                      <>
                        <label className="text-xs">{tab.input.label}</label>
                        <textarea
                          placeholder={tab.input.placeholder}
                          value={tab.input.value}
                          onChange={(e) => tab.input!.onChange(e.target.value)}
                          rows={tab.input.rows ?? 2}
                          className="flex w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                        />
                      </>
                    )}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {/* Preview & Copy */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>预览（前 {maxPreviewChars.toLocaleString()} 字符）</span>
              <span>{charCount.toLocaleString("zh-CN")} 字符</span>
            </div>
            <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
              {currentPrompt.slice(0, maxPreviewChars)}
              {charCount > maxPreviewChars
                ? `\n……（预览前 ${maxPreviewChars.toLocaleString()} 字，完整内容请点击复制）`
                : ""}
            </pre>
          </div>

          <Button onClick={handleCopy} className="w-full" size="sm">
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                复制提示词
              </>
            )}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
