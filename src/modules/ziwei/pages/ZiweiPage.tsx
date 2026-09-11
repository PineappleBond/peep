import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSelectedPerson } from "@/hooks/useSelectedPerson";
import { lsGet, lsSet } from "@/lib/utils";
import { useZwds, DEFAULT_BIRTH_INPUT, type BirthInput } from "../core/useZwds";
import { Chart } from "../components/Chart";
import { ErrorBoundary } from "../components/ErrorBoundary";

const STORAGE_KEY = "zwds-input-v2";

/** 演示盘：在中性默认参数上叠加示例生辰 */
const DEFAULT_INPUT: BirthInput = {
  ...DEFAULT_BIRTH_INPUT,
  name: "演示",
  date: "2000-08-16",
  timeIndex: 2,
};

function loadInput(): BirthInput {
  const saved = lsGet<Partial<BirthInput> | null>(STORAGE_KEY, null);
  return saved ? { ...DEFAULT_INPUT, ...saved } : DEFAULT_INPUT;
}

function saveInput(v: BirthInput) {
  lsSet(STORAGE_KEY, v);
}

export default function ZiweiPage() {
  const { selectedPerson } = useSelectedPerson();

  const [input, setInput] = useState<BirthInput>(loadInput);
  const [genId, setGenId] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const z = useZwds(input);

  // Expose to window for debugging (DEV only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __zwds: typeof z }).__zwds = z;
    }
  }, [z]);

  // Auto-load data when URL personId changes
  useEffect(() => {
    if (!selectedPerson) return;

    let timeIndex = 0;
    if (selectedPerson.birthTime) {
      const timeParts = selectedPerson.birthTime.split(":");
      const hour = parseInt(timeParts[0], 10) || 0;
      if (hour === 23 || hour === 0) timeIndex = 0;
      else timeIndex = Math.floor((hour + 1) / 2);
    }

    const newInput: BirthInput = {
      ...DEFAULT_BIRTH_INPUT,
      name: selectedPerson.name,
      gender: selectedPerson.gender === "male" ? "男" : "女",
      date: selectedPerson.birthDate,
      timeIndex,
    };

    setInput(newInput);
    setGenId((g) => g + 1);
    saveInput(newInput);
    setManualMode(false);
    toast.success(`已加载 ${selectedPerson.name} 的信息`);
  }, [selectedPerson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const showForm = manualMode || !selectedPerson;

  return (
    <div className="space-y-2 zwds-theme">
      {z.astrolabe ? (
        <ErrorBoundary>
          <Chart z={z} genId={genId} />
          {/* 运限选择器已移至全局日期选择器 */}

        </ErrorBoundary>
      ) : showForm ? (
        <div className="text-sm text-muted-foreground text-center py-4">
          请输入出生信息后点击"起盘"
        </div>
      ) : null}
    </div>
  );
}
