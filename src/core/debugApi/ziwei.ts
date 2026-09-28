/**
 * 调试 API - 紫微斗数相关接口
 *
 * 包含：parseDate, computeZiWeiData, ZiWei, computeScopeData, GetScopeData,
 *       computeAstrolabe, _setHoroscopeTime, setHoroscopeTimeWithRetry
 */

import { astro } from "iztro";
import type { GenderName } from "iztro/lib/i18n";
import type { Scope, Zwds, Person } from "./types";
import type { HbarData } from "../hbar";
import { MUTAGEN_TABLES } from "../utils";
import { getPerson } from "../personDb";
import { buildHbarData, clearHbarCaches } from "../hbar";
import { getChartDataForScope, type ScopeChartData } from "../analysis";
import { buildChartIndex } from "../chartIndex";
import { LRUCache, registerCache, clearAllCaches } from "../cache";
import { log, timer } from "./logger";
import { ZiWeiError, ParseDateError, ComputeScopeError, wrapError, ApiErrorCode } from "./errors";
import { getGetZwds, getGetPerson, getSelectPerson } from "./callbacks";
import { resolvePersonId } from "./person";
import { validateScope } from "./validate";
import {
  nextFrame,
  waitForPersonMatch,
  waitForAstrolabeStable,
  waitForPickMatch,
  waitForStateUpdate,
  navigateToPage,
} from "./helpers";
import type { ZiWeiComputedData, ZiWeiResult, ZiWeiOptions } from "./types";

/* ─────────────── 本命盘缓存 ─────────────── */

/**
 * computeAstrolabe 缓存：按"人物输入指纹"缓存 iztro 计算结果。
 * iztro 排盘是最昂贵的操作（约 20-100ms），相同输入时直接命中可节省大量时间。
 * 指纹 = 排盘相关字段的连接，不包含 name/id 等无关字段。
 */
const astrolabeCache = new LRUCache<string, ReturnType<typeof astro.withOptions>>({
  maxSize: 50,
  name: "computeAstrolabe",
});
registerCache("computeAstrolabe", astrolabeCache);

/** 清空本命盘缓存 */
export function clearAstrolabeCache(): void {
  astrolabeCache.clear();
}

/**
 * 生成人物的排盘指纹：由所有影响排盘结果的字段组成。
 * 字段变更时指纹改变，缓存自动失效。
 *
 * 使用对象而非数组，JSON 序列化后字段名参与指纹，进一步降低碰撞概率。
 * 注意：新增影响排盘的 Person/BirthInput 字段时，须同步更新此处的字段列表。
 */
function makeAstrolabeFingerprint(person: Person): string {
  // 影响排盘结果的全部字段：历法/日期/时辰/性别/闰月/算法/年界/四化表/日界/盘型
  return JSON.stringify({
    calendar: person.calendar,
    date: person.date,
    timeIndex: person.timeIndex,
    gender: person.gender,
    isLeapMonth: person.isLeapMonth ? 1 : 0,
    algorithm: person.algorithm,
    yearDivide: person.yearDivide,
    mutagenTable: person.mutagenTable,
    dayDivide: person.dayDivide,
    astroType: person.astroType,
  });
}

/**
 * 纯函数：从 Person 数据计算紫微斗数本命盘（不依赖 React 状态）
 *
 * @param person 人物数据（包含完整 BirthInput）
 * @returns iztro 本命盘对象
 * @throws ComputeScopeError 排盘失败时抛出，包含人物上下文和恢复建议
 */
export function computeAstrolabe(person: Person) {
  // 先查缓存：相同输入指纹直接返回，避免重复 iztro 计算
  const fp = makeAstrolabeFingerprint(person);
  const cached = astrolabeCache.get(fp);
  if (cached) {
    log("debug", "computeAstrolabe", "缓存命中", { fingerprint: fp });
    return cached;
  }

  try {
    const result = astro.withOptions({
      type: person.calendar,
      dateStr: person.date,
      timeIndex: person.timeIndex,
      gender: person.gender as unknown as GenderName,
      isLeapMonth: person.isLeapMonth,
      fixLeap: true,
      language: "zh-CN",
      astroType: person.algorithm === "zhongzhou" ? person.astroType : "heaven",
      config: {
        algorithm: person.algorithm,
        yearDivide: person.yearDivide,
        horoscopeDivide: person.yearDivide,
        dayDivide: person.dayDivide,
        mutagens: (MUTAGEN_TABLES[person.mutagenTable] ?? MUTAGEN_TABLES.default) as never,
      },
    });
    // 缓存结果
    astrolabeCache.set(fp, result);
    return result;
  } catch (e) {
    log("error", "computeAstrolabe", "排盘失败", e);
    throw new ComputeScopeError("本命盘计算失败", {
      personId: person.id,
      personName: person.name,
      context: {
        calendar: person.calendar,
        date: person.date,
        timeIndex: person.timeIndex,
        gender: person.gender,
        algorithm: person.algorithm,
      },
      suggestion: "请检查人物数据是否完整：出生年月日时、性别、历法类型、算法配置",
      cause: e,
    });
  }
}

/* ─────────────── 日期解析 ─────────────── */

/**
 * 解析时间：支持多种日期格式，失败时抛出 ParseDateError 并附带详细信息。
 *
 * 支持的格式：
 * - Date 实例（直接返回）
 * - 数字（时间戳，毫秒或秒）
 * - ISO 8601：2024-06-15T12:00:00、2024-06-15T12:00:00.000Z
 * - YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DD HH:mm
 * - YYYY-MM-DD HH（简写，自动补全分钟秒）
 * - YYYY-MM-DD（自动补全 00:00:00）
 * - 纯数字字符串（当作时间戳）
 */
export function parseDate(time: Date | number | string): Date {
  // 分支 1：Date 实例 → 直接返回或抛出
  if (time instanceof Date) {
    if (isNaN(time.getTime())) {
      throw new ParseDateError(time, ["Date 实例"], "Date 实例的值为 Invalid Date");
    }
    return time;
  }

  // 分支 2：数字时间戳（毫秒或秒） → 解析或抛出
  if (typeof time === "number") {
    // 小于 1e11 认为是秒级时间戳，自动转毫秒
    const ms = time < 1e11 ? time * 1000 : time;
    const d = new Date(ms);
    if (isNaN(d.getTime())) {
      throw new ParseDateError(time, ["时间戳 (毫秒)"], `时间戳 ${time} 解析为 Invalid Date`);
    }
    log("debug", "parseDate", "时间戳解析成功", { input: time, result: d.toISOString() });
    return d;
  }

  // 分支 3：字符串解析 → 根据格式走互斥子分支
  const str = String(time).trim();
  if (!str) {
    throw new ParseDateError(time, [], "输入为空字符串");
  }
  // 安全保护：限制输入长度，防止超长字符串导致正则/Date.parse DoS
  // 合理日期字符串不超过 30 字符，留足余量取 100
  if (str.length > 100) {
    throw new ParseDateError(
      time,
      [],
      `输入字符串过长（${str.length} 字符，上限 100），可能存在恶意输入`,
    );
  }

  // 子分支 3.1：纯数字字符串 → 当作时间戳
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    const ms = num < 1e11 ? num * 1000 : num;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      log("debug", "parseDate", "时间戳字符串解析成功", { input: str, result: d.toISOString() });
      return d;
    }
    throw new ParseDateError(
      time,
      ["纯数字字符串 (时间戳)"],
      `时间戳字符串 "${str}" 解析为 Invalid Date`,
    );
  }

  // 子分支 3.2：YYYY-MM-DD HH（补全分钟和秒） → 标准化后继续 ISO 解析
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}$/.test(str)) {
    const normalized = `${str}:00:00`;
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) {
      log("debug", "parseDate", "YYYY-MM-DD HH 解析成功", { input: str, result: d.toISOString() });
      return d;
    }
    throw new ParseDateError(
      time,
      ["YYYY-MM-DD HH → YYYY-MM-DD HH:00:00"],
      `日期时间字符串 "${str}" 解析为 Invalid Date`,
    );
  }

  // 子分支 3.3：YYYY-MM-DD（补全时间部分） → 标准化后继续 ISO 解析
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const normalized = `${str} 00:00:00`;
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) {
      log("debug", "parseDate", "YYYY-MM-DD 解析成功", { input: str, result: d.toISOString() });
      return d;
    }
    throw new ParseDateError(
      time,
      ["YYYY-MM-DD → YYYY-MM-DD 00:00:00"],
      `日期字符串 "${str}" 解析为 Invalid Date`,
    );
  }

  // 子分支 3.4：ISO 8601 或浏览器原生解析 → 兜底尝试
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    log("debug", "parseDate", "字符串解析成功", {
      input: time,
      format: "ISO 8601 / 浏览器原生 Date.parse",
      result: d.toISOString(),
    });
    return d;
  }

  // 所有格式均失败
  throw new ParseDateError(
    time,
    ["ISO 8601 / 浏览器原生 Date.parse"],
    `字符串 "${str}" 无法解析为有效日期`,
  );
}

/* ─────────────── 运限时间设置 ─────────────── */

/**
 * 设置运限时间：根据 Date 设置年月日时。
 * 纯同步函数，仅调用 actions 不验证结果。
 *
 * 改进：使用事务式批量更新（setPickBatch），一次性设置所有字段，
 * 避免 4 次独立 setPick 调用导致的竞态条件。
 * 同时使用 pickLocked 标志防止 useEffect 在此期间重置 pick。
 */
export function _setHoroscopeTime(
  z: Zwds,
  date: Date,
): { year: number; month: number; day: number; hour: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();

  // 转换为时辰索引（0-11）
  const hourIdx = Math.floor(((hour + 1) % 24) / 2);

  // hbar 流月/流日按阳历排列，所以 pick 直接用阳历值
  // 事务式更新：锁定 pick → 批量设置（lockPick 防止 useEffect 在事务期间重置 pick）
  z.actions.lockPick();
  z.actions.setPickBatch({ year, month, day, hour: hourIdx, leap: false });

  return { year, month, day, hour: hourIdx };
}

/**
 * 设置运限时间（带验证和重试）：
 * 1. 调用 _setHoroscopeTime 事务式设置 pick（锁定 + 批量更新）
 * 2. 等待 React 渲染
 * 3. 验证 pick 是否匹配预期（从 getZwds() 获取最新状态，避免快照过期）
 * 4. 如果不匹配（可能被其他操作覆盖），最多重试 2 次（指数退避）
 * 5. 无论成功失败，最终都解锁 pick
 */
export async function setHoroscopeTimeWithRetry(
  z: Zwds,
  date: Date,
  maxRetries = 2,
): Promise<void> {
  const getZwds = getGetZwds();
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const expected = _setHoroscopeTime(z, date);

    // 等待 React 处理状态更新（双 rAF）
    await nextFrame();
    await nextFrame();

    // 验证 pick 是否匹配预期（waitForPickMatch 内部已从 getZwds 获取最新状态）
    const matched = await waitForPickMatch(z, expected, 300);

    if (matched) {
      // 成功：解锁 pick，恢复正常 useEffect 行为
      z.actions.unlockPick();
      if (attempt > 0) {
        log("info", "ZiWei", `setHoroscopeTime 重试 ${attempt} 次后成功`, { expected });
      } else {
        log("debug", "ZiWei", "setHoroscopeTime 验证通过", { expected });
      }
      return;
    }

    // pick 不匹配，可能被其他操作覆盖——记录并重试
    // 使用最新的 z 读取实际状态（避免快照过期导致日志信息不准确）
    const freshZ = getZwds?.();
    const actualPick = freshZ?.pick ?? z.pick;
    log("warn", "ZiWei", `setHoroscopeTime 验证失败`, {
      attempt: attempt + 1,
      pickMatched: matched,
      expected,
      actual: actualPick,
    });

    if (attempt < maxRetries) {
      // 指数退避：50ms, 100ms
      const delayMs = 50 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // 所有重试均失败：解锁 pick 并抛出错误
  z.actions.unlockPick();

  // 使用最新的 z 读取实际状态
  const freshZ = getZwds?.();
  const actualPick = freshZ?.pick ?? z.pick;
  throw new ZiWeiError(
    `setHoroscopeTime 重试 ${maxRetries} 次后仍失败：pick=${JSON.stringify(actualPick)}，期望=${JSON.stringify(date)}`,
    "setHoroscopeTime",
    {
      context: { maxRetries, expectedPick: date.toISOString(), actualPick },
      suggestion: "pick 值持续被其他操作覆盖，可能是 React 状态更新冲突。请尝试刷新页面后重试",
      errorCode: ApiErrorCode.TIMEOUT,
    },
  );
}

/* ─────────────── 核心计算函数 ─────────────── */

/**
 * 纯计算函数：从 Zwds 状态提取 hbar（运限拨盘）和 chart（运限盘面）数据。
 *
 * 不包含任何 UI 操控逻辑，也不依赖 React 状态——只读取传入 Zwds 对象中
 * 已有的 astrolabe / horoscope / pick / visible 字段。
 *
 * ZiWei（skipUI=true）和 GetScopeData 都可以通过此函数复用计算逻辑，
 * 避免重复的 buildHbarData / getChartDataForScope 样板代码。
 *
 * @param z Zwds 对象（已包含 astrolabe / horoscope / pick / visible）
 * @param scope 运限级别（可选；不传则 chart 返回 null）
 * @returns hbar 和 chart 数据
 *
 * @example
 * ```typescript
 * // 从已排好的 Zwds 状态中提取运限数据
 * const zwds = getZwdsState();
 * if (zwds) {
 *   const { hbar, chart } = computeZiWeiData(zwds, "yearly");
 *   // hbar: 运限拨盘数据（大运/流年/流月/流日/流时列表）
 *   // chart: 流年盘面数据（十二宫星曜、四化等）
 *   console.log("大运列表:", hbar?.decadalList);
 *   console.log("流年命宫:", chart?.palaces.find(p => p.isMingPalace));
 * }
 * ```
 */
export function computeZiWeiData(z: Zwds, scope?: Scope): ZiWeiComputedData {
  const stop = timer("computeZiWeiData");

  // 构建 hbar：运限拨盘数据（大运/流年/流月/流日/流时列表）
  const hbarBase = buildHbarData(z.astrolabe, z.birthLunarYear, z.pick);
  const hbar = hbarBase ? { ...hbarBase, visible: { ...z.visible } } : null;

  // 构建 chart：指定 scope 的运限盘面数据
  // 共享 chartIndex：buildChartIndex 内部按 astrolabe 弱引用缓存，多次调用零开销
  let chart: ScopeChartData | null = null;
  if (scope && z.astrolabe && z.horoscope) {
    const ix = buildChartIndex(z.astrolabe);
    chart = getChartDataForScope({
      astrolabe: z.astrolabe,
      horoscope: z.horoscope,
      scope,
      chartIndex: ix,
    });
  }

  stop();
  return { hbar, chart };
}

/**
 * 核心调试接口：切换人物 + 运限级别 + 时间，同时操控 UI 并返回数据。
 *
 * 职责分为两层：
 * - UI 操控层（skipUI=false 时）：导航页面、切换人物、设置时间、设置运限级别
 * - 数据计算层（computeZiWeiData）：从 Zwds 状态提取 hbar/chart 数据
 *
 * skipUI=true 时：跳过所有 UI 操控，直接读取当前 Zwds 状态并计算数据，
 * 等价于纯计算路径，可在任意上下文调用（例如 RTC Agent 或自动化测试）。
 *
 * @param personId 人物 ID（可选，不传则使用默认人物；skipUI=true 时忽略）
 * @param scope 运限级别（decadal/yearly/monthly/daily/hourly）
 * @param time 可选时间参数（Date 或时间戳），用于设置运限时间（skipUI=true 时忽略）
 * @param options 可选配置项（目前支持 skipUI）
 * @returns 包含人物信息、运限拨盘数据和运限盘面数据的完整结果
 */
export async function ZiWei(
  personId?: number,
  scope?: Scope,
  time?: Date | number | string,
  options?: ZiWeiOptions,
): Promise<ZiWeiResult> {
  const stop = timer("ZiWei");
  const maxRetries = 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 解析人物 ID（不传则用默认）
      const resolvedId = await resolvePersonId(personId);
      // 输入校验——使用统一的验证工具
      if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
        throw new ZiWeiError(`personId 无效：${resolvedId}，需为正整数`, "ZiWei", {
          context: { personId, resolvedId },
          suggestion: "请传入有效的人物 ID（正整数），或不传以使用默认人物",
          errorCode: ApiErrorCode.INVALID_INPUT,
        });
      }
      // 使用统一的 scope 验证
      validateScope(scope, "ZiWei");

      log("info", "ZiWei", "开始执行", {
        personId,
        scope,
        time,
        attempt: attempt + 1,
        skipUI: !!options?.skipUI,
      });

      // skipUI 模式：跳过所有 UI 操控，直接读取当前 Zwds 状态并计算数据
      if (options?.skipUI) {
        const getZwds = getGetZwds();
        const getPerson = getGetPerson();
        if (!getZwds || !getPerson) {
          throw new ZiWeiError("调试 API 未初始化，请确认 App 已加载", "ZiWei", {
            context: { getZwdsReady: !!getZwds, getPersonReady: !!getPerson },
            suggestion: "请确认 App.tsx 已完成挂载，或等待页面加载完成后重试",
            errorCode: ApiErrorCode.NOT_INITIALIZED,
          });
        }
        const z = getZwds();
        if (!z) {
          throw new ZiWeiError("排盘数据未就绪", "ZiWei", {
            suggestion: "排盘引擎尚未初始化，请确认人物已选择后再调用",
            errorCode: ApiErrorCode.NOT_INITIALIZED,
          });
        }
        const { hbar, chart } = computeZiWeiData(z, scope);
        const person = getPerson();
        log("info", "ZiWei", "skipUI 模式执行成功", {
          personId: person?.id,
          scope,
          hasChart: !!chart,
        });
        stop();
        return { person, hbar, chart };
      }

      // 正常模式：执行 UI 操控（导航、切换人物、设置时间、设置运限级别）
      await navigateToPage("/", "ziwei");

      // 导航完成后再获取回调
      const selectPerson = getSelectPerson();
      const getZwds = getGetZwds();
      const getPerson = getGetPerson();

      if (!selectPerson || !getZwds || !getPerson) {
        throw new ZiWeiError("调试 API 未初始化，请确认 App 已加载", "ZiWei", {
          context: {
            selectPersonReady: !!selectPerson,
            getZwdsReady: !!getZwds,
            getPersonReady: !!getPerson,
          },
          suggestion: "请确认 App.tsx 已完成挂载，或等待页面加载完成后重试",
          errorCode: ApiErrorCode.NOT_INITIALIZED,
        });
      }

      // 1. 切换人物（操控 UI）
      await selectPerson(resolvedId);

      const z = getZwds();
      if (!z) {
        throw new ZiWeiError("排盘数据未就绪", "ZiWei", {
          context: { personId: resolvedId },
          suggestion: "排盘引擎尚未初始化，请稍后重试。如持续出现请检查人物出生数据是否完整",
          errorCode: ApiErrorCode.NOT_INITIALIZED,
        });
      }

      // 等待 astrolabe 更新完成
      await waitForPersonMatch(resolvedId, 2000);
      await waitForAstrolabeStable(z, 2000);

      // 手动重置 pick 到"今天"（不依赖 useEffect，解决同一人物再次调用时 useEffect 不触发的问题）
      z.actions.resetToday();
      // 等待 React 渲染完成
      await waitForStateUpdate();

      // 重新获取最新 z（React 渲染后状态已更新）
      const freshZ = getZwds() ?? z;
      log("debug", "ZiWei", "pick 已重置", { pick: freshZ.pick });

      // 2. 设置时间（在 useEffect 重置完成之后，带验证和重试）
      if (time) {
        const date = parseDate(time);
        await setHoroscopeTimeWithRetry(freshZ, date);
      }

      // 3. 设置运限级别（只显示目标 scope，其他全部关闭）
      // dispatch 是稳定引用，通过 actions 调用不受快照过期影响
      if (scope) {
        freshZ.actions.showScope(scope);
      }

      // 4. 等待所有状态更新完成（轮询 + rAF 确保 React 状态和渲染完成）
      await waitForStateUpdate();

      // 5. 获取数据（重新获取最新 z，确保 pick/astrolabe/horoscope 均为最新值）
      const latestZ = getZwds() ?? freshZ;
      const person = getPerson();
      const { hbar, chart } = computeZiWeiData(latestZ, scope);

      log("info", "ZiWei", "执行成功", { personId: person?.id, scope, hasChart: !!chart });
      stop();
      return { person, hbar, chart };
    } catch (err) {
      lastError = err;

      // 自定义错误（ParseDateError / ZiWeiError）：不重试，直接抛出
      if (err instanceof ZiWeiError) {
        log("error", "ZiWei", "执行失败（不重试）", {
          errorType: err.name,
          message: err.message.split("\n")[0],
          attempt: attempt + 1,
        });
        stop();
        throw wrapError("ZiWei", err, ZiWeiError);
      }

      // 超时/临时性错误：记录并重试
      const isTimeout = err instanceof Error && /超时|timeout/i.test(err.message);
      if (isTimeout && attempt < maxRetries) {
        log("warn", "ZiWei", `检测到超时错误，第 ${attempt + 1} 次重试`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
        continue;
      }

      // 其他错误：不重试
      log("error", "ZiWei", "执行失败", err);
      stop();
      throw wrapError("ZiWei", err, ZiWeiError);
    }
  }

  // 所有重试均失败（仅超时错误会到达这里）
  stop();
  throw new ZiWeiError(`ZiWei 重试 ${maxRetries} 次后仍失败`, "ZiWei", {
    context: { personId, scope, time, attempts: maxRetries + 1 },
    suggestion: "连续多次超时，请检查设备性能或刷新页面后重试",
    cause: lastError,
    errorCode: ApiErrorCode.TIMEOUT,
  });
}

/**
 * 纯函数：根据阳历日期获取人物的运限数据（大运/流年/流月/流日/流时）
 *
 * 不依赖 React 状态，可在任意上下文调用（调试 API、RTC Agent 等）。
 * 计算失败时抛出 ComputeScopeError（包含人物信息和日期上下文），不再静默返回 null。
 * 对于临时性错误（如 iztro 内部异常）自动重试最多 2 次。
 *
 * @param person 人物数据（包含完整 BirthInput）
 * @param solarDate 阳历日期（Date 对象或 YYYY-MM-DD 格式字符串）
 * @returns 运限拨盘完整数据（buildHbarData 返回 null 时仍可能为 null，表示无运限数据）
 * @throws ComputeScopeError 本命盘计算或日期解析失败时抛出
 */
export function computeScopeData(person: Person, solarDate: Date | string): HbarData | null {
  const stop = timer("computeScopeData");
  try {
    // 本命盘计算（computeAstrolabe 失败时抛 ComputeScopeError）
    const astrolabe = computeAstrolabe(person);

    // 日期解析：使用 parseDate 确保多格式支持，失败时抛 ParseDateError
    const d = parseDate(solarDate);
    if (isNaN(d.getTime())) {
      throw new ParseDateError(solarDate, ["Date.parse"], "解析结果为 Invalid Date");
    }

    const birthLunarYear = astrolabe.rawDates.lunarDate.lunarYear;
    // hbar 流月/流日按阳历排列，所以 pick 直接用阳历值
    const pick = {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: Math.floor((d.getHours() + 1) / 2) % 12,
      leap: false,
    };

    // 确保 pick.year 不早于出生农历年
    if (pick.year < birthLunarYear) {
      pick.year = birthLunarYear;
    }

    const result = buildHbarData(astrolabe, birthLunarYear, pick);
    log("info", "computeScopeData", "计算成功", {
      personId: person.id,
      personName: person.name,
      birthLunarYear,
      pick,
      hasResult: !!result,
    });
    stop();
    return result;
  } catch (err) {
    // 自定义错误（ComputeScopeError / ParseDateError）直接抛出
    if (err instanceof ZiWeiError) {
      stop();
      throw err;
    }
    // 意外错误：包装为 ComputeScopeError
    stop();
    throw new ComputeScopeError("运限计算失败", {
      personId: person.id,
      personName: person.name,
      solarDate: String(solarDate),
      suggestion: "请检查人物数据完整性和日期格式。如问题持续，请排查 iztro 引擎版本",
      cause: err,
    });
  }
}

/**
 * 调试接口：根据阳历日期 + 人物 ID 获取运限数据（大运/流年/流月/流日/流时）。
 *
 * 纯计算接口，不操控 UI，可在任意上下文调用。
 *
 * @param solarDate 阳历日期（Date 对象或 YYYY-MM-DD / YYYY-MM-DD HH:mm 格式字符串）
 * @param personId 人物 ID（可选，不传则使用默认人物）
 * @returns 运限拨盘完整数据（包含大运/流年/流月/流日/流时列表）
 */
export async function GetScopeData(
  solarDate: Date | string,
  personId?: number,
): Promise<HbarData | null> {
  const stop = timer("GetScopeData");
  try {
    const resolvedId = await resolvePersonId(personId);
    log("info", "GetScopeData", "开始计算", { solarDate, personId: resolvedId });

    const person = await getPerson(resolvedId);
    if (!person) {
      throw new ZiWeiError(`人物 ${resolvedId} 不存在`, "GetScopeData", {
        context: { personId: resolvedId },
        suggestion: "请检查人物 ID 是否正确。可调用 PersonList() 查看可用的人物列表",
        errorCode: ApiErrorCode.NOT_FOUND,
      });
    }

    const result = computeScopeData(person, solarDate);
    log("info", "GetScopeData", "计算完成", { personId: resolvedId, hasResult: !!result });
    stop();
    return result;
  } catch (err) {
    log("error", "GetScopeData", "计算失败", err);
    throw wrapError("GetScopeData", err, ZiWeiError);
  }
}

/**
 * 重置紫微相关状态：清空缓存
 */
export function resetZiWeiState(): void {
  astrolabeCache.clear();
  clearAllCaches();
  clearHbarCaches();
  log("info", "init", "紫微相关缓存已清空");
}
