import { useEffect, useState } from "react";
import { DEFAULT_BIRTH_INPUT, useZwds, BirthInput } from "./core/useZwds";
import { Chart } from "./components/Chart";
import { HoroscopeBar } from "./components/HoroscopeBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PersonSelector } from "./components/PersonSelector";
import { getDefaultPerson, type Person } from "./core/personDb";

const STORAGE_KEY = "zwds-current-person-id";

// 清理旧版持久化
try {
  localStorage.removeItem("zwds-input-v2");
  localStorage.removeItem("zwds-nav-v1");
  localStorage.removeItem("zwds-kline-domain");
  localStorage.removeItem("zwds-archive-v1");
} catch {
  /* ignore */
}

function App() {
  const [currentPersonId, setCurrentPersonId] = useState<number | null>(null);
  const [input, setInput] = useState<BirthInput>(DEFAULT_BIRTH_INPUT);
  const [genId, setGenId] = useState(0);
  const z = useZwds(input);

  // 初始化：加载默认人物
  useEffect(() => {
    const init = async () => {
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId) {
        const id = Number(savedId);
        setCurrentPersonId(id);
        // 这里应该从 DB 加载，但先用默认值
        const person = await getDefaultPerson();
        setInput(person);
      } else {
        const person = await getDefaultPerson();
        if (person.id) {
          setCurrentPersonId(person.id);
          localStorage.setItem(STORAGE_KEY, String(person.id));
        }
        setInput(person);
      }
    };
    init();
  }, []);

  // 开发调试句柄
  if (import.meta.env.DEV) {
    (window as unknown as { __zwds: typeof z }).__zwds = z;
  }

  const handleSelectPerson = (person: Person) => {
    if (person.id) {
      setCurrentPersonId(person.id);
      localStorage.setItem(STORAGE_KEY, String(person.id));
    }
    setInput(person);
    setGenId((g) => g + 1);
  };

  return (
    <div className="app">
      <div className="bg-fx" aria-hidden="true" />

      <header className="top">
        <h1>紫微斗数</h1>
        <span className="top-sub">玄机排盘 · iztro 引擎 · 自研盘面</span>
        <div className="top-actions">
          <PersonSelector currentId={currentPersonId} onSelect={handleSelectPerson} />
        </div>
      </header>

      {z.astrolabe ? (
        <ErrorBoundary>
          <Chart z={z} genId={genId} />
          <HoroscopeBar z={z} />
        </ErrorBoundary>
      ) : (
        <div className="err-box">
          排盘失败：请检查出生日期与时辰（支持 1900 ~ 2100 年，农历请勿超出当月天数）。
        </div>
      )}

      <footer className="foot">
        算法引擎{" "}
        <a href="https://github.com/SylarLong/iztro" target="_blank" rel="noreferrer">
          iztro
        </a>{" "}
        · 盘面 react-zwds · 星盘仅供学习研究
      </footer>
    </div>
  );
}

export default App;
