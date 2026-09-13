import { lazy, Suspense, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Compass, CircleDot, Dices } from "lucide-react";
import { GlobalHoroscopeSelector } from "@/components/shared/GlobalHoroscopeSelector";
import { lsGet, lsSet, STORAGE_KEYS } from "@/lib/utils";

// Tab-level code splitting: each module is a separate chunk, only loaded when needed
const BaziPage = lazy(() => import("@/modules/bazi/pages/BaziPage"));
const ZiweiPage = lazy(() => import("@/modules/ziwei/pages/ZiweiPage"));
const LiuyaoIndexPage = lazy(() => import("@/modules/liuyao/pages/IndexPage").then(m => ({ default: m.IndexPage })));

type TabKey = "bazi" | "ziwei" | "liuyao";

const VALID_TABS: TabKey[] = ["bazi", "ziwei", "liuyao"];
const LS_TAB_KEY = STORAGE_KEYS.WORKBENCH_TAB;

function readSavedTab(): TabKey {
  const saved = lsGet<TabKey>(LS_TAB_KEY, "bazi");
  // 校验 localStorage 值有效性，防止损坏数据导致空白页面
  return VALID_TABS.includes(saved) ? saved : "bazi";
}

function TabFallback() {
  return (
    <div className="flex items-center justify-center h-32">
      <p className="text-muted-foreground text-xs">加载中...</p>
    </div>
  );
}

export default function WorkbenchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  // URL 参数优先；若无，使用 localStorage 记忆值
  const activeTab: TabKey = useMemo(() => {
    if (tabParam && VALID_TABS.includes(tabParam as TabKey)) return tabParam as TabKey;
    return readSavedTab();
  }, [tabParam]);

  const handleTabChange = (v: string) => {
    // 同步写入 localStorage
    lsSet(LS_TAB_KEY, v);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", v);
      return next;
    }, { replace: true });
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* 全局日期选择器 */}
      <GlobalHoroscopeSelector />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="bazi">
            <Compass className="h-3.5 w-3.5 mr-1.5" />
            八字排盘
          </TabsTrigger>
          <TabsTrigger value="ziwei">
            <CircleDot className="h-3.5 w-3.5 mr-1.5" />
            紫微斗数
          </TabsTrigger>
          <TabsTrigger value="liuyao">
            <Dices className="h-3.5 w-3.5 mr-1.5" />
            六爻起卦
          </TabsTrigger>
        </TabsList>

        {/* Only mount the active tab — avoids mounting all 3 heavy modules simultaneously */}
        <div className="flex-1 mt-2">
          <Suspense fallback={<TabFallback />}>
            {activeTab === "bazi" && <BaziPage />}
            {activeTab === "ziwei" && <ZiweiPage />}
            {activeTab === "liuyao" && <LiuyaoIndexPage />}
          </Suspense>
        </div>
      </Tabs>
    </div>
  );
}
