/**
 * 紫微斗数页面 - 从 App.tsx 迁移
 * 展示星盘、运限栏等
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useI18n } from "../core/i18n";
import { DEFAULT_BIRTH_INPUT, useZwds, type BirthInput } from "../core/useZwds";
import { Chart } from "../components/Chart";
import { HoroscopeBar } from "../components/HoroscopeBar";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { globalEvents } from "../core/events";
import { registerZiWeiCallbacks } from "../core/debugApi";
import type { Person } from "../core/personDb";
import { useDefaultPerson } from "../core/usePageInit";

// 导出对话框懒加载：仅用户点击导出时下载
const ExportDialog = lazy(() =>
  import("../components/ExportDialog").then(m => ({ default: m.ExportDialog })),
);

export function ZiweiPage() {
  const { t } = useI18n();
  const [input, setInput] = useState<BirthInput>(DEFAULT_BIRTH_INPUT);
  const [genId, setGenId] = useState(0);
  const z = useZwds(input);
  const zRef = useRef(z);
  zRef.current = z;
  const [exportOpen, setExportOpen] = useState(false);

  // 默认人物加载
  const { person } = useDefaultPerson();

  // 监听人物变更事件
  useEffect(() => {
    const handlePersonChanged = (p: Person) => {
      setInput(p);
      setGenId(g => g + 1);
    };

    globalEvents.on("person.changed", handlePersonChanged);
    return () => {
      globalEvents.off("person.changed", handlePersonChanged);
    };
  }, []);

  // 注册调试 API - getZwds
  useEffect(() => {
    registerZiWeiCallbacks({
      getZwds: () => zRef.current,
    });
  }, []);

  return (
    <div className="ziwei-page">
      {z.astrolabe ? (
        <ErrorBoundary>
          <div data-guide="ziwei-dial">
            <HoroscopeBar z={z} />
          </div>
          <div data-guide="ziwei-chart">
            <Chart z={z} genId={genId} />
          </div>
        </ErrorBoundary>
      ) : (
        <div className="err-box" role="alert">
          {t("ziwei.errorMessage")}
        </div>
      )}

      {/* 导出对话框 */}
      <div data-guide="ziwei-export">
        <Suspense>
          <ExportDialog
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            person={person}
            zwds={z}
          />
        </Suspense>
      </div>
    </div>
  );
}
