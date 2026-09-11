import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useBaziStore } from "@/stores/baziStore";
import { useSelectedPerson } from "@/hooks/useSelectedPerson";
import { ZhenyiChartWithHighlight } from "../components/ZhenyiChartWithHighlight";
import { personToBaziInput } from "@/lib/horoscope-utils";
import type { BaziInput } from "../types";

export default function BaziPage() {
  const { doChart, currentResult, chartData } = useBaziStore();
  const { selectedPerson } = useSelectedPerson();

  const [formData, setFormData] = useState<{
    year: number | "";
    month: number | "";
    day: number | "";
    hour: number | "";
    minute: number | "";
    gender: "male" | "female";
    name: string;
    yearDivide: "lichun" | "zhengyue";
  }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    hour: new Date().getHours(),
    minute: new Date().getMinutes(),
    gender: "male",
    name: "",
    yearDivide: "lichun",
  });

  const [showResult, setShowResult] = useState(false);

  // Extracted calculation logic
  const runCalculation = useCallback((data: typeof formData) => {
    if (data.year === "" || data.year < 1900 || data.year > 2100) {
      toast.error("请输入1900-2100年之间的年份");
      return false;
    }
    if (data.month === "" || data.month < 1 || data.month > 12) {
      toast.error("请输入有效的月份");
      return false;
    }
    if (data.day === "" || data.day < 1 || data.day > 31) {
      toast.error("请输入有效的日期");
      return false;
    }
    if (data.hour === "" || data.hour < 0 || data.hour > 23) {
      toast.error("请输入有效的小时");
      return false;
    }

    const input: BaziInput = {
      year: data.year,
      month: data.month,
      day: data.day,
      hour: data.hour,
      minute: data.minute === "" ? 0 : data.minute,
      gender: data.gender,
      yearDivide: data.yearDivide,
    };

    const success = doChart(input);
    if (!success) {
      toast.error("排盘失败，请检查输入数据");
      return false;
    }
    setShowResult(true);
    toast.success("排盘成功");
    return true;
  }, [doChart]);

  // Load data from selected person (URL ?personId=X) and auto-calculate.
  // Depend on selectedPerson (stable from useLiveQuery when data unchanged)
  // rather than selectedPerson?.id to satisfy exhaustive-deps.
  useEffect(() => {
    if (selectedPerson) {
      const input = personToBaziInput(selectedPerson);
      const newData = {
        year: input.year,
        month: input.month,
        day: input.day,
        hour: input.hour,
        minute: input.minute ?? 0,
        gender: input.gender ?? "male",
        name: selectedPerson.name,
        yearDivide: input.yearDivide ?? "lichun",
      };
      setFormData(newData);
      runCalculation(newData);
    }
  }, [selectedPerson, runCalculation]);

  const result = showResult ? currentResult : null;

  return (
    <div className="space-y-2">
      {/* Results */}
      {showResult && result && (
        <div className="space-y-2">
          {/* Combined Chart Summary */}

          {/* 真一式详细命盘 */}
          {chartData && (
            <Card>
              <CardHeader className="pb-1 pt-2 px-3">
                <CardTitle className="text-xs">详细命盘</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <ZhenyiChartWithHighlight chartData={chartData} gender={formData.gender} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
