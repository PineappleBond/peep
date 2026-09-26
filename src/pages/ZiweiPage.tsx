/**
 * 紫微斗数页面 - 从 App.tsx 迁移
 * 展示星盘、运限栏等
 */
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../core/i18n";
import { DEFAULT_BIRTH_INPUT, useZwds, type BirthInput } from "../core/useZwds";
import { Chart } from "../components/Chart";
import { HoroscopeBar } from "../components/HoroscopeBar";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { globalEvents } from "../core/events";
import { registerZiWeiCallbacks } from "../core/debugApi";
import type { Person } from "../core/personDb";

export function ZiweiPage() {
  const { t } = useI18n();
  const [input, setInput] = useState<BirthInput>(DEFAULT_BIRTH_INPUT);
  const [genId, setGenId] = useState(0);
  const z = useZwds(input);
  const zRef = useRef(z);
  zRef.current = z;

  // 监听人物变更事件
  useEffect(() => {
    const handlePersonChanged = (person: Person) => {
      setInput(person);
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
    <>
      {z.astrolabe ? (
        <ErrorBoundary>
          <HoroscopeBar z={z} />
          <Chart z={z} genId={genId} />
        </ErrorBoundary>
      ) : (
        <div className="err-box" role="alert">
          {t("ziwei.errorMessage")}
        </div>
      )}
    </>
  );
}
