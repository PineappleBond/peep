/**
 * Layout 组件 - 全局布局
 * 包含背景光雾、Header（含 PersonSelector）、main、footer
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "./Header";
import { getDefaultPerson, listPersons, type Person } from "../core/personDb";
import { registerDebugApi } from "../core/debugApi";
import { globalEvents } from "../core/events";

const STORAGE_KEY = "zwds-current-person-id";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const [currentPersonId, setCurrentPersonId] = useState<number | null>(null);
  const currentPersonRef = useRef<Person | null>(null);

  // 初始化：加载默认人物
  useEffect(() => {
    const init = async () => {
      const savedId = localStorage.getItem(STORAGE_KEY);
      if (savedId) {
        const id = Number(savedId);
        setCurrentPersonId(id);
        const person = await getDefaultPerson();
        currentPersonRef.current = person;
        globalEvents.emit("person.changed", person);
      } else {
        const person = await getDefaultPerson();
        if (person.id) {
          setCurrentPersonId(person.id);
          localStorage.setItem(STORAGE_KEY, String(person.id));
        }
        currentPersonRef.current = person;
        globalEvents.emit("person.changed", person);
      }
    };
    init();
  }, []);

  // 注册调试 API 回调
  useEffect(() => {
    registerDebugApi({
      selectPerson: async (personId: number) => {
        const persons = await listPersons();
        const person = persons.find((p) => p.id === personId);
        if (person) {
          handleSelectPerson(person);
        }
      },
      getPerson: () => currentPersonRef.current,
      navigate: (path: string) => {
        navigate(path);
      },
    });
  }, [navigate]);

  const handleSelectPerson = (person: Person) => {
    if (person.id) {
      setCurrentPersonId(person.id);
      localStorage.setItem(STORAGE_KEY, String(person.id));
    }
    currentPersonRef.current = person;
    // 通知页面组件人物已变更
    globalEvents.emit("person.changed", person);
  };

  return (
    <div className="app">
      <div className="bg-fx" aria-hidden="true" />
      <Header currentPersonId={currentPersonId} onSelectPerson={handleSelectPerson} />
      <main>{children}</main>
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
