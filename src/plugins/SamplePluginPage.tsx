/**
 * 示例插件页面 —— 展示插件能力
 */
import { useEffect, useState } from "react";
import { pluginManager } from "../core/pluginSystem";

const PLUGIN_ID = "sample-plugin";

export function SamplePluginPage() {
  const [count, setCount] = useState<number>(0);
  const [greeting, setGreeting] = useState<string>("");

  useEffect(() => {
    // 读取本插件持久化的计数
    const stored = localStorage.getItem(`zwds-plugin:${PLUGIN_ID}:counter`);
    if (stored) {
      try {
        setCount(JSON.parse(stored) as number);
      } catch {
        /* ignore */
      }
    }
    // 读取上次保存的问候语
    const greet = localStorage.getItem(`zwds-plugin:${PLUGIN_ID}:greeting`);
    if (greet) setGreeting(greet.replace(/^"|"$/g, ""));
  }, []);

  const increment = () => {
    const next = count + 1;
    setCount(next);
    localStorage.setItem(`zwds-plugin:${PLUGIN_ID}:counter`, String(next));
  };

  const greet = () => {
    const msg = `你好，访客！当前时间：${new Date().toLocaleTimeString()}`;
    setGreeting(msg);
    localStorage.setItem(`zwds-plugin:${PLUGIN_ID}:greeting`, JSON.stringify(msg));
  };

  const emitDemo = () => {
    const record = pluginManager.get(PLUGIN_ID);
    if (!record) return;
    record.ctx.events.emit("demo-click", { at: Date.now() });
  };

  return (
    <div className="plugin-sample-page">
      <h2>示例插件页面</h2>
      <p className="plugin-sample-desc">
        本页面由 <code>sample-plugin</code> 插件注入，用于演示插件系统的核心扩展能力。
      </p>

      <section className="plugin-sample-section">
        <h3>1. 持久化存储</h3>
        <p>插件专属存储（按 id 隔离，不与宿主冲突）：</p>
        <div className="plugin-sample-row">
          <button onClick={increment}>计数器：{count}</button>
          <button onClick={greet}>生成问候</button>
        </div>
        {greeting && <p className="plugin-sample-greeting">{greeting}</p>}
      </section>

      <section className="plugin-sample-section">
        <h3>2. 事件总线</h3>
        <p>
          触发命名空间事件 <code>sample-plugin:demo-click</code>：
        </p>
        <button onClick={emitDemo}>触发事件</button>
        <p className="plugin-sample-hint">
          打开浏览器控制台，在 <code>window.__zwdsPlugins</code> 查看调试信息。
        </p>
      </section>

      <section className="plugin-sample-section">
        <h3>3. 扩展点</h3>
        <ul>
          <li>菜单扩展：本页面入口已注入到 Header 导航区</li>
          <li>
            路由扩展：<code>/sample-plugin</code> 路径由插件注册
          </li>
          <li>组件扩展：页面底部 footer 区注入了本插件的徽章</li>
        </ul>
      </section>
    </div>
  );
}
