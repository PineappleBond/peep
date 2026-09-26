/**
 * 插件系统单元测试
 *
 * 覆盖：
 * - 注册/注销插件
 * - 生命周期（install/enable/disable/uninstall）
 * - 静态与动态扩展注册
 * - PluginContext API（toast/storage/events）
 * - 聚合视图（extensions view）
 * - 订阅机制（useSyncExternalStore 兼容）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pluginManager, registerAndEnable } from "./pluginSystem";
import type { Plugin, PluginContext } from "./pluginTypes";

/** 测试用插件工厂 */
function makePlugin(id: string, overrides: Partial<Plugin> = {}): Plugin {
  return {
    manifest: {
      id,
      name: `测试插件-${id}`,
      version: "0.0.1",
      description: "测试用",
    },
    ...overrides,
  };
}

describe("pluginSystem", () => {
  beforeEach(() => {
    // 清空已注册插件：通过遍历并卸载
    for (const r of pluginManager.list()) {
      pluginManager.unregister(r.manifest.id);
    }
    // 清理 localStorage 中可能的测试数据
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("zwds-plugin:")) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch {
      /* localStorage 不可用时忽略 */
    }
  });

  describe("register / unregister", () => {
    it("注册插件后 list() 能列出", () => {
      pluginManager.register(makePlugin("a"));
      expect(pluginManager.list().map(r => r.manifest.id)).toEqual(["a"]);
    });

    it("重复注册抛出错误", () => {
      pluginManager.register(makePlugin("a"));
      expect(() => pluginManager.register(makePlugin("a"))).toThrow(/已注册/);
    });

    it("unregister 移除插件", async () => {
      pluginManager.register(makePlugin("a"));
      await pluginManager.unregister("a");
      expect(pluginManager.list()).toHaveLength(0);
    });
  });

  describe("生命周期", () => {
    it("install → enable → disable 按顺序调用钩子", async () => {
      const install = vi.fn();
      const enable = vi.fn();
      const disable = vi.fn();
      const uninstall = vi.fn();
      pluginManager.register(makePlugin("lc", { install, enable, disable, uninstall }));
      await pluginManager.install("lc");
      expect(install).toHaveBeenCalledTimes(1);
      await pluginManager.enable("lc");
      expect(enable).toHaveBeenCalledTimes(1);
      await pluginManager.disable("lc");
      expect(disable).toHaveBeenCalledTimes(1);
      await pluginManager.unregister("lc");
      expect(uninstall).toHaveBeenCalledTimes(1);
    });

    it("install 失败时状态变为 error", async () => {
      pluginManager.register(
        makePlugin("err", {
          install: () => {
            throw new Error("boom");
          },
        }),
      );
      await pluginManager.install("err");
      const r = pluginManager.get("err");
      expect(r?.status).toBe("error");
      expect(r?.error).toMatch(/boom/);
    });

    it("registerAndEnable 一次性完成注册+安装+启用", async () => {
      const install = vi.fn();
      const enable = vi.fn();
      await registerAndEnable(makePlugin("rae", { install, enable }));
      expect(install).toHaveBeenCalledTimes(1);
      expect(enable).toHaveBeenCalledTimes(1);
      expect(pluginManager.get("rae")?.status).toBe("enabled");
    });
  });

  describe("扩展注册", () => {
    it("静态 menus/routes/components 被聚合到 extensions view", async () => {
      const Dummy = () => null;
      await registerAndEnable(
        makePlugin("static", {
          menus: [{ path: "/x", label: "X" }],
          routes: [{ path: "/x", element: Dummy }],
          components: [{ slot: "layout.footer", component: Dummy }],
        }),
      );
      const ext = pluginManager.getExtensions();
      expect(ext.menus).toHaveLength(1);
      expect(ext.routes).toHaveLength(1);
      expect(ext.slotComponents["layout.footer"]).toHaveLength(1);
    });

    it("动态 registerMenu/registerRoute/registerComponent 通过 ctx 注入", async () => {
      const Dummy = () => null;
      let capturedCtx: PluginContext | undefined;
      await registerAndEnable(
        makePlugin("dyn", {
          install(ctx) {
            capturedCtx = ctx;
            ctx.registerMenu({ path: "/y", label: "Y" });
            ctx.registerRoute({ path: "/y", element: Dummy });
            ctx.registerComponent({ slot: "layout.footer", component: Dummy });
          },
        }),
      );
      expect(capturedCtx).toBeDefined();
      const ext = pluginManager.getExtensions();
      expect(ext.menus.map(m => m.path)).toContain("/y");
      expect(ext.routes.map(r => r.path)).toContain("/y");
      expect(ext.slotComponents["layout.footer"].map(c => c.pluginId)).toContain("dyn");
    });

    it("禁用插件的扩展不出现在 view", async () => {
      await registerAndEnable(makePlugin("dis", { menus: [{ path: "/d", label: "D" }] }));
      expect(pluginManager.getExtensions().menus).toHaveLength(1);
      await pluginManager.disable("dis");
      expect(pluginManager.getExtensions().menus).toHaveLength(0);
    });
  });

  describe("PluginContext.storage", () => {
    // 在 Node 测试环境下模拟 localStorage
    let memStore: Record<string, string>;
    beforeEach(() => {
      memStore = {};
      const mockStorage = {
        getItem: (k: string) => (k in memStore ? memStore[k] : null),
        setItem: (k: string, v: string) => {
          memStore[k] = v;
        },
        removeItem: (k: string) => {
          delete memStore[k];
        },
        get length() {
          return Object.keys(memStore).length;
        },
        key: (i: number) => Object.keys(memStore)[i] ?? null,
        clear: () => {
          memStore = {};
        },
      };
      vi.stubGlobal("localStorage", mockStorage);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("按插件 id 隔离键前缀", async () => {
      let ctx1: PluginContext | undefined;
      let ctx2: PluginContext | undefined;
      await registerAndEnable(
        makePlugin("s1", {
          install(ctx) {
            ctx1 = ctx;
          },
        }),
      );
      await registerAndEnable(
        makePlugin("s2", {
          install(ctx) {
            ctx2 = ctx;
          },
        }),
      );
      ctx1!.storage.set("k", "v1");
      ctx2!.storage.set("k", "v2");
      expect(ctx1!.storage.get("k")).toBe("v1");
      expect(ctx2!.storage.get("k")).toBe("v2");
      // 验证底层 key 隔离
      expect(memStore["zwds-plugin:s1:k"]).toBe('"v1"');
      expect(memStore["zwds-plugin:s2:k"]).toBe('"v2"');
    });

    it("remove 后 get 返回 fallback", async () => {
      let ctx: PluginContext | undefined;
      await registerAndEnable(
        makePlugin("sr", {
          install(c) {
            ctx = c;
          },
        }),
      );
      ctx!.storage.set("k", 123);
      ctx!.storage.remove("k");
      expect(ctx!.storage.get("k", "fallback")).toBe("fallback");
    });
  });

  describe("PluginContext.events", () => {
    it("命名空间事件 on/emit 工作", async () => {
      let ctx: PluginContext | undefined;
      await registerAndEnable(
        makePlugin("ev", {
          install(c) {
            ctx = c;
          },
        }),
      );
      const handler = vi.fn();
      ctx!.events.on("hello", handler);
      ctx!.events.emit("hello", 42);
      expect(handler).toHaveBeenCalledWith(42);
    });

    it("全局事件可被其他插件监听", async () => {
      let ctxA: PluginContext | undefined;
      let ctxB: PluginContext | undefined;
      await registerAndEnable(
        makePlugin("pa", {
          install(c) {
            ctxA = c;
          },
        }),
      );
      await registerAndEnable(
        makePlugin("pb", {
          install(c) {
            ctxB = c;
          },
        }),
      );
      const handler = vi.fn();
      ctxB!.events.onGlobal("pa:broadcast", handler);
      ctxA!.events.emit("broadcast", { x: 1 });
      expect(handler).toHaveBeenCalledWith({ x: 1 });
    });
  });

  describe("菜单排序", () => {
    it("按 order 升序排列", async () => {
      await registerAndEnable(
        makePlugin("m1", { menus: [{ path: "/a", label: "A", order: 200 }] }),
      );
      await registerAndEnable(makePlugin("m2", { menus: [{ path: "/b", label: "B", order: 50 }] }));
      const menus = pluginManager.getExtensions().menus;
      expect(menus[0].path).toBe("/b");
      expect(menus[1].path).toBe("/a");
    });
  });

  describe("订阅机制", () => {
    it("subscribe 在变更时被调用", async () => {
      const listener = vi.fn();
      pluginManager.subscribe(listener);
      await registerAndEnable(makePlugin("sub"));
      expect(listener).toHaveBeenCalled();
    });

    it("getSnapshot 返回完整快照", async () => {
      await registerAndEnable(makePlugin("snap"));
      const snap = pluginManager.getSnapshot();
      expect(snap.plugins.map(p => p.manifest.id)).toContain("snap");
      expect(snap.extensions).toBeDefined();
    });

    it("unsubscribe 后不再被调用", async () => {
      const listener = vi.fn();
      const unsub = pluginManager.subscribe(listener);
      unsub();
      await registerAndEnable(makePlugin("unsub"));
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
