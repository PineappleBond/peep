/**
 * AppContext 上下文测试：
 * 验证 AppProvider / useAppContext / useAppSelector / dialogReducer 的正确性
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import {
  AppProvider,
  useAppContext,
  useAppSelector,
  dialogReducer,
  type DialogState,
} from "../core/appContext";

describe("dialogReducer", () => {
  const initial: DialogState = {
    importOpen: false,
    syncOpen: false,
    paletteOpen: false,
    themeEditorOpen: false,
  };

  it("OPEN_IMPORT 打开导入对话框", () => {
    const next = dialogReducer(initial, { type: "OPEN_IMPORT" });
    expect(next.importOpen).toBe(true);
    expect(next.syncOpen).toBe(false);
  });

  it("TOGGLE_PALETTE 切换命令面板", () => {
    const next1 = dialogReducer(initial, { type: "TOGGLE_PALETTE" });
    expect(next1.paletteOpen).toBe(true);
    const next2 = dialogReducer(next1, { type: "TOGGLE_PALETTE" });
    expect(next2.paletteOpen).toBe(false);
  });

  it("未知 action 返回原状态", () => {
    const next = dialogReducer(initial, { type: "UNKNOWN" as never });
    expect(next).toEqual(initial);
  });
});

describe("AppProvider + useAppContext", () => {
  it("在 Provider 内可读取主题和人物", () => {
    function Consumer() {
      const ctx = useAppContext();
      return (
        <div>
          theme={ctx.theme},person={ctx.currentPersonId ?? "none"}
        </div>
      );
    }
    const html = renderToString(
      <AppProvider
        theme="dark"
        onCycleTheme={() => {}}
        onOpenThemeEditor={() => {}}
        currentPersonId={42}
        onSelectPerson={() => {}}
        onOpenImport={() => {}}
        onOpenSync={() => {}}
        dialogState={{
          importOpen: false,
          syncOpen: false,
          paletteOpen: false,
          themeEditorOpen: false,
        }}
        dialogDispatch={() => {}}
        pluginMenus={[]}
      >
        <Consumer />
      </AppProvider>,
    );
    expect(html).toContain("dark");
    expect(html).toContain("42");
  });

  it("useAppSelector 可提取特定字段", () => {
    function Consumer() {
      const theme = useAppSelector(ctx => ctx.theme);
      return <div>{theme}</div>;
    }
    const html = renderToString(
      <AppProvider
        theme="light"
        onCycleTheme={() => {}}
        onOpenThemeEditor={() => {}}
        currentPersonId={null}
        onSelectPerson={() => {}}
        onOpenImport={() => {}}
        onOpenSync={() => {}}
        dialogState={{
          importOpen: false,
          syncOpen: false,
          paletteOpen: false,
          themeEditorOpen: false,
        }}
        dialogDispatch={() => {}}
        pluginMenus={[]}
      >
        <Consumer />
      </AppProvider>,
    );
    expect(html).toContain("light");
  });
});
