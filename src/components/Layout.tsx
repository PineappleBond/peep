/**
 * Layout 组件 - 全局布局
 * 包含背景光雾、Header（含 PersonSelector）、main、footer
 */
import { useEffect, useRef, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "./Header";
import { ToastHost } from "./ToastHost";
import { ShortcutHelp } from "./ShortcutHelp";
import { getDefaultPerson, listPersons, type Person } from "../core/personDb";
import { registerDebugApi } from "../core/debugApi";
import { globalEvents } from "../core/events";
import { useI18n } from "../core/i18n";
import { registerShortcuts, toggleHelp } from "../core/shortcuts";

const STORAGE_KEY = "zwds-current-person-id";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [currentPersonId, setCurrentPersonId] = useState<number | null>(null);
  const currentPersonRef = useRef<Person | null>(null);

  // 初始化：加载默认人物
  useEffect(() => {
    const init = async () => {
      try {
        let savedId: string | null = null;
        try {
          savedId = localStorage.getItem(STORAGE_KEY);
        } catch (err) {
          console.warn("[Layout] 读取 localStorage 失败（可能已被禁用）", err);
        }

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
            try {
              localStorage.setItem(STORAGE_KEY, String(person.id));
            } catch (err) {
              console.warn("[Layout] 写入 localStorage 失败（存储已满或被禁用）", err);
            }
          }
          currentPersonRef.current = person;
          globalEvents.emit("person.changed", person);
        }
      } catch (err) {
        console.error("[Layout] 初始化人物失败", err);
      }
    };
    init();
  }, []);

  const handleSelectPerson = useCallback((person: Person) => {
    if (person.id) {
      setCurrentPersonId(person.id);
      try {
        localStorage.setItem(STORAGE_KEY, String(person.id));
      } catch (err) {
        console.warn("[Layout] 写入 localStorage 失败（存储已满或被禁用）", err);
      }
    }
    currentPersonRef.current = person;
    // 通知页面组件人物已变更
    globalEvents.emit("person.changed", person);
  }, []);

  // 注册调试 API 回调
  useEffect(() => {
    registerDebugApi({
      selectPerson: async (personId: number) => {
        const persons = await listPersons();
        const person = persons.find(p => p.id === personId);
        if (person) {
          handleSelectPerson(person);
        }
      },
      getPerson: () => currentPersonRef.current,
      navigate: (path: string) => {
        navigate(path);
      },
    });
  }, [navigate, handleSelectPerson]);

  // ── 全局导航快捷键 + 帮助弹窗 ────────────────────────────
  useEffect(() => {
    const unreg = registerShortcuts([
      {
        key: "1",
        description: t("nav.ziwei"),
        group: "shortcut.group.nav",
        handler: () => navigate("/"),
      },
      {
        key: "2",
        description: t("nav.daliuren"),
        group: "shortcut.group.nav",
        handler: () => navigate("/liuren"),
      },
      {
        key: "3",
        description: t("nav.wiki"),
        group: "shortcut.group.nav",
        handler: () => navigate("/wiki"),
      },
      {
        key: "?",
        description: t("shortcut.showHelp"),
        group: "shortcut.group.general",
        handler: () => toggleHelp(),
      },
    ]);
    return unreg;
  }, [navigate, t]);

  return (
    <div className="app">
      {/* 可访问性：跳过导航链接，键盘用户可直达主内容 */}
      <a href="#main-content" className="skip-link">
        {t("nav.skipNav")}
      </a>
      <div className="bg-fx" aria-hidden="true" />
      <Header currentPersonId={currentPersonId} onSelectPerson={handleSelectPerson} />
      <main id="main-content">{children}</main>
      <footer className="foot">
        {t("layout.engine")}{" "}
        <a
          href="https://github.com/SylarLong/iztro"
          target="_blank"
          rel="noreferrer"
          aria-label={t("layout.engineLabel")}
        >
          iztro
        </a>{" "}
        · {t("layout.chartNote")}
      </footer>
      {/* Toast 通知宿主：全局浮动层，渲染在 app 内以便继承主题 */}
      <ToastHost />
      {/* 快捷键帮助弹窗 */}
      <ShortcutHelp />
    </div>
  );
}
