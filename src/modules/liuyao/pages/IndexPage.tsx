import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dices } from 'lucide-react';
import { useLiuyaoStore } from '@/stores/liuyaoStore';
import { useLiuyaoRecordStore } from '@/stores/liuyaoRecordStore';
import { useSelectedPerson } from '@/hooks/useSelectedPerson';
import { useLiuyaoRecords } from '../hooks/useLiuyaoRecords';
import { RecordList } from '../components/RecordList';
import { TimeFloors } from '../components/TimeFloors';
import { scenarioOf, SCENARIO_IDS } from '../core/scenarios/newRegistry';
import { liuyaoAPI } from '@/lib/peep-api-liuyao';
import { tossHexagram } from '..';
import { migrateLiuyaoRecordsFromLocalStorage } from '../utils/migrateRecords';
import type { ScenarioId } from '../core/types';
import type { 六爻结果 } from '@/lib/peep-api-liuyao';
import type { Granularity } from '@/modules/liuyao/core/timeFloors';

/** 格式化六爻记录时间戳为可读字符串 */
const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
};
function formatRecordTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', TIME_FORMAT_OPTIONS);
}

export function IndexPage() {
  const store = useLiuyaoStore();
  const { scenarioId, yongTarget, extras, question, background, setScenarioId, setYongTarget, setExtras, setQuestion, setBackground } = store;
  const { selectedPerson } = useSelectedPerson();
  const { records } = useLiuyaoRecords(null); // 不按人物过滤，与 RecordList 保持一致
  const { selectedRecordId, setSelectedRecord } = useLiuyaoRecordStore();

  const [showComposeMode, setShowComposeMode] = useState(false);
  const [chartResult, setChartResult] = useState<六爻结果 | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('year');

  // 一次性迁移 localStorage 数据到 IndexedDB
  useEffect(() => {
    migrateLiuyaoRecordsFromLocalStorage();
  }, []);

  const scenario = useMemo(() => scenarioOf(scenarioId), [scenarioId]);

  const selectedRecord = useMemo(() => {
    return records.find(r => r.id === selectedRecordId) || null;
  }, [records, selectedRecordId]);

  const handleToss = async () => {
    const newLines = tossHexagram();
    const now = new Date().toLocaleDateString("sv-SE");

    // 立即起卦并保存
    try {
      const id = await liuyaoAPI.create({
        lines: newLines,
        date: now,
        scenarioId,
        yongTarget,
        extras,
        question,
        background,
        personId: selectedPerson?.id,
        personName: selectedPerson?.name,
      });
      setSelectedRecord(id);
      setShowComposeMode(false);
    } catch (e) {
      console.error('Failed to create record:', e);
    }
  };

  // 加載選中記錄的完整結果（包含 granularity）
  useEffect(() => {
    if (selectedRecordId) {
      liuyaoAPI
        .get(selectedRecordId, granularity)
        .then((result) => {
          setChartResult(result ?? null);
        })
        .catch((err) => {
          console.error("[liuyao] Failed to load record:", err);
          setChartResult(null);
        });
    } else {
      setChartResult(null);
    }
  }, [selectedRecordId, granularity]);

  const handleGranularityChange = (g: Granularity) => {
    setGranularity(g);
  };

  const handleSelectRecord = (id: number) => {
    setSelectedRecord(id);
    setShowComposeMode(false);
  };

  const handleBackToList = () => {
    setSelectedRecord(null);
    setShowComposeMode(false);
  };

  // 如果选中了记录，显示纯卦象（保留完整的 Board 展示）
  if (selectedRecord) {
    const scenario = scenarioOf(selectedRecord.scenarioId as ScenarioId);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            ← 返回列表
          </Button>
          <div className="text-xs text-muted-foreground">
            {formatRecordTime(selectedRecord.timestamp)}
          </div>
        </div>

        {/* 记录信息 */}
        <div className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">场景：</span>
              <span>{scenario.title}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">起卦时间：</span>
              <span>{formatRecordTime(selectedRecord.timestamp)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">用神目标：</span>
              <span>{selectedRecord.yongTarget}</span>
            </div>
            {selectedRecord.personName && (
              <div>
                <span className="text-xs text-muted-foreground">关联人物：</span>
                <span>{selectedRecord.personName}</span>
              </div>
            )}
          </div>
          {selectedRecord.question && (
            <div>
              <span className="text-xs text-muted-foreground">占事：</span>
              <span className="text-sm">{selectedRecord.question}</span>
            </div>
          )}
          {selectedRecord.background && (
            <div>
              <span className="text-xs text-muted-foreground">背景信息：</span>
              <p className="text-sm mt-1 whitespace-pre-wrap">{selectedRecord.background}</p>
            </div>
          )}
        </div>

        {/* 時間樓層展示 */}
        {chartResult ? (
          <TimeFloors
            result={chartResult}
            granularity={granularity}
            onGranularityChange={handleGranularityChange}
          />
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">載入中...</div>
        )}
      </div>
    );
  }

  // 如果在新建模式，显示起卦表单
  if (showComposeMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBackToList}>
            ← 返回列表
          </Button>
          <Button variant="default" size="sm" onClick={handleToss}>
            <Dices className="w-3.5 h-3.5 mr-1" />
            摇卦并保存
          </Button>
        </div>

        <div className="border rounded-lg p-4 space-y-4">
          <div className="text-sm font-medium">起卦信息</div>

          {/* 场景选择 */}
          <div className="space-y-1.5">
            <Label className="text-xs">场景</Label>
            <Select value={scenarioId} onValueChange={(v) => setScenarioId(v as ScenarioId)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIO_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {scenarioOf(id).title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 用神目标 */}
          <div className="space-y-1.5">
            <Label className="text-xs">用神目标</Label>
            <Input
              placeholder="例：自占、父母、子女..."
              value={yongTarget}
              onChange={(e) => setYongTarget(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* 场景专属字段 */}
          {scenario.contextFields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs">{field.label}</Label>
              <Select
                value={extras[field.key] ?? field.default}
                onValueChange={(v) => setExtras({ ...extras, [field.key]: v })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {/* 占事输入 */}
          <div className="space-y-1.5">
            <Label className="text-xs">占事</Label>
            <Input
              placeholder="例：近期财运如何？"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* 背景信息 */}
          <div className="space-y-1.5">
            <Label className="text-xs">背景信息</Label>
            <textarea
              placeholder="补充更多背景信息..."
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="w-full h-20 px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* 关联人物 */}
          {selectedPerson && (
            <div className="space-y-1.5">
              <Label className="text-xs">关联人物</Label>
              <div className="text-sm px-2 py-1.5 bg-secondary rounded">
                {selectedPerson.name}
              </div>
            </div>
          )}

          <div className="pt-2 border-t text-xs text-muted-foreground">
            点击"摇卦并保存"将使用当前时间立即起卦
          </div>
        </div>
      </div>
    );
  }

  // 默认显示记录列表
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">六爻起卦</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            起卦记录 · 纯卦象显示
          </p>
        </div>
        <Button variant="default" size="sm" onClick={() => setShowComposeMode(true)}>
          <Dices className="w-3.5 h-3.5 mr-1" />
          摇卦
        </Button>
      </div>

      <RecordList onSelectRecord={handleSelectRecord} />
    </div>
  );
}
