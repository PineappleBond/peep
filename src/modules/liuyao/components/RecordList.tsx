import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useLiuyaoRecords } from "../hooks/useLiuyaoRecords";
import { useLiuyaoRecordStore } from "@/stores/liuyaoRecordStore";
import { useHoroscopeStore } from "@/stores/horoscopeStore";
import { scenarioOf } from "../core/scenarios/newRegistry";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Trash2 } from "lucide-react";
import { formatDateTime, cn } from "@/lib/utils";
import type { ChartJSON, ScenarioId } from "../core/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface RecordListProps {
  onSelectRecord: (id: number) => void;
}

export function RecordList({ onSelectRecord }: RecordListProps) {
  const [showDeleted, setShowDeleted] = useState(false);
  const [permanentDeleteId, setPermanentDeleteId] = useState<number | null>(null);
  const { records, deleteRecord, restoreRecord, permanentlyDeleteRecord } = useLiuyaoRecords(
    null, // 不按人物过滤，显示所有记录
    showDeleted
  );
  const { selectedRecordId } = useLiuyaoRecordStore();
  const horoscope = useHoroscopeStore();

  // 预加载所有人物，用于判断关联人物是否已删除
  const personsMap = useLiveQuery(async () => {
    const persons = await db.persons.toArray();
    const map = new Map<number, { deletedAt?: number | null }>();
    for (const p of persons) {
      map.set(p.id!, { deletedAt: p.deletedAt });
    }
    return map;
  }, []);

  return (
    <div className="space-y-2">
      <Tabs
        value={showDeleted ? "trash" : "all"}
        onValueChange={(v) => setShowDeleted(v === "trash")}
        className="mb-3"
      >
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">全部记录</TabsTrigger>
          <TabsTrigger value="trash" className="flex-1">垃圾篓</TabsTrigger>
        </TabsList>
      </Tabs>

      {records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">{showDeleted ? "垃圾篓为空" : "暂无起卦记录"}</p>
          <p className="text-xs mt-2">
            {showDeleted ? "已删除的记录会出现在这里" : "点击\"摇卦\"开始第一次起卦"}
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground mb-3">
            共 {records.length} 条记录
            {horoscope.dayun && <span> · 大运：{horoscope.dayun.startYear}-{horoscope.dayun.endYear}年</span>}
            {horoscope.liunian && <span> · 流年：{horoscope.liunian.year}年</span>}
            {horoscope.liuyue && <span> · 流月：{horoscope.liuyue.month}月</span>}
            {horoscope.liuri && <span> · 流日：{horoscope.liuri.day}日</span>}
          </div>

          {records.map((record) => {
            const scenario = scenarioOf(record.scenarioId as ScenarioId);
            const isSelected = selectedRecordId === record.id;
            const chart = record.chart as ChartJSON | null;
            const person = record.personId ? personsMap?.get(record.personId) : undefined;
            const recordId = record.id!;

            return (
              <div
                key={recordId}
                onClick={() => onSelectRecord(recordId)}
                className={cn(
                  "border rounded-lg p-3 cursor-pointer transition-colors",
                  isSelected ? "border-primary bg-primary/5" : "hover:bg-accent"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium">{scenario.title}</span>
                      <span className="text-xs text-muted-foreground">{record.yongTarget}</span>
                      {record.personName && (
                        <span className="text-xs px-1.5 py-0.5 bg-secondary rounded">
                          {record.personName}
                        </span>
                      )}
                      {record.personName && person?.deletedAt && (
                        <Badge variant="destructive" className="text-xs">
                          关联人物已删除
                        </Badge>
                      )}
                    </div>

                    {record.question && (
                      <p className="text-sm text-muted-foreground mb-1 line-clamp-2">
                        {record.question}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDateTime(record.timestamp)}</span>
                      {chart && (
                        <>
                          <span>本卦：{chart.name}</span>
                          {chart.changed && <span>变卦：{chart.changed.name}</span>}
                        </>
                      )}
                    </div>
                  </div>

                  {showDeleted ? (
                    <div className="flex gap-1">
                      <Button
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreRecord(recordId);
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPermanentDeleteId(recordId);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRecord(recordId);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* 永久删除确认弹窗 */}
      <Dialog open={permanentDeleteId !== null} onOpenChange={(open) => !open && setPermanentDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              永久删除记录
            </DialogTitle>
            <DialogDescription>
              确定要永久删除此条起卦记录吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPermanentDeleteId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (permanentDeleteId !== null) {
                  permanentlyDeleteRecord(permanentDeleteId);
                }
                setPermanentDeleteId(null);
              }}
            >
              永久删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
