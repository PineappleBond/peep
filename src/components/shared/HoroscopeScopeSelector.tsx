import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import type { DocumentRecord } from "@/lib/db";
import type { HoroscopeLevel } from "@/stores/horoscopeStore";

interface HoroscopeScopeSelectorProps {
  value: DocumentRecord["horoscopeScope"];
  onChange: (scope: DocumentRecord["horoscopeScope"]) => void;
}

const LEVEL_LABELS: Record<HoroscopeLevel, string> = {
  dayun: "大运",
  liunian: "流年",
  liuyue: "流月",
  liuri: "流日",
  liushi: "流时",
};

/**
 * 文档关联时间选择器
 * 简化版,只支持选择单个时间点(起始和结束相同)
 */
export function HoroscopeScopeSelector({ value, onChange }: HoroscopeScopeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [level, setLevel] = useState<HoroscopeLevel>(value?.startLevel || "liunian");
  const [valueStr, setValueStr] = useState(value?.startValue || "");
  const [ganzhi, setGanzhi] = useState(value?.ganzhi || "");

  // External value 变化时同步内部状态（如父组件重置 scope）
  /* eslint-disable react/set-state-in-effect */
  useEffect(() => {
    setLevel(value?.startLevel || "liunian");
    setValueStr(value?.startValue || "");
    setGanzhi(value?.ganzhi || "");
  }, [value]);
  /* eslint-enable react/set-state-in-effect */

  const handleSave = () => {
    if (!valueStr) {
      onChange(null);
    } else {
      onChange({
        startLevel: level,
        endLevel: level,
        startValue: valueStr,
        endValue: valueStr,
        ganzhi: ganzhi || undefined,
      });
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Calendar className="h-3 w-3 mr-1" />
          {value ? `已关联: ${LEVEL_LABELS[value.startLevel]} ${value.startValue}${value.ganzhi ? ` ${value.ganzhi}` : ""}` : "关联时间"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleClear}
          >
            清除
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="border rounded-lg p-3 space-y-3 bg-card">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">时间级别</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as HoroscopeLevel)}
              className="w-full text-sm border rounded px-2 py-1 bg-background"
            >
              {Object.entries(LEVEL_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">时间值</label>
            <input
              type="text"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              placeholder={level === "dayun" ? "如: 20-29" : level === "liunian" ? "如: 2024" : "如: 3"}
              className="w-full text-sm border rounded px-2 py-1 bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">干支(可选)</label>
            <input
              type="text"
              value={ganzhi}
              onChange={(e) => setGanzhi(e.target.value)}
              placeholder="如: 甲辰"
              className="w-full text-sm border rounded px-2 py-1 bg-background"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setIsOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={handleSave}
            >
              保存
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
