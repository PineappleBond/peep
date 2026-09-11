import { useState, useEffect, useMemo } from "react";
import { useHoroscopeStore } from "@/stores/horoscopeStore";
import { useBaziStore } from "@/stores/baziStore";
import { useSelectedPerson } from "@/hooks/useSelectedPerson";
import { calculateDaYun, calculateLiuNian, calculateLiuYue, calculateLiuRi, calculateLiuShi } from "@/modules/bazi/core";
import { personToBaziInput } from "@/lib/horoscope-utils";
import { HoroscopeRow, HoroscopeCell } from "@/components/shared/HoroscopeBarBase";
import { ChevronDown, ChevronUp } from "lucide-react";
import { solar2lunar } from "lunar-lite";
import { lsGet, lsSet, STORAGE_KEYS } from "@/lib/utils";

const LS_COLLAPSED_KEY = STORAGE_KEYS.HOROSCOPE_COLLAPSED;

/** 农历月份名称 */
const LUNAR_MONTH_NAMES = [
  "正月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "冬月", "腊月"
];

/** 农历日期名称 */
const LUNAR_DAY_NAMES = [
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
];

/** 获取农历月份名称 */
function getLunarMonthName(month: number): string {
  return LUNAR_MONTH_NAMES[month - 1] || "";
}

/** 获取农历日期名称 */
function getLunarDayName(day: number): string {
  return LUNAR_DAY_NAMES[day - 1] || "";
}

/** 将阳历日期转换为农历信息 */
function solarToLunar(year: number, month: number, day: number) {
  try {
    const date = new Date(year, month - 1, day);
    const lunar = solar2lunar(date);
    return {
      lunarYear: lunar.lunarYear,
      lunarMonth: lunar.lunarMonth,
      lunarDay: lunar.lunarDay,
      lunarMonthName: getLunarMonthName(lunar.lunarMonth),
      lunarDayName: getLunarDayName(lunar.lunarDay),
      isLeap: lunar.isLeap,
    };
  } catch {
    return null;
  }
}

/** 计算阳历月份中哪个农历月份占比更高 */
function getDominantLunarMonth(solarYear: number, solarMonth: number) {
  try {
    // 获取该阳历月的天数
    const daysInMonth = new Date(solarYear, solarMonth, 0).getDate();

    // 统计每个农历月份出现的天数
    const lunarMonthDays: Record<number, number> = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const lunarInfo = solarToLunar(solarYear, solarMonth, day);
      if (lunarInfo) {
        const key = lunarInfo.lunarMonth;
        lunarMonthDays[key] = (lunarMonthDays[key] || 0) + 1;
      }
    }

    // 找出占比最高的农历月份
    let maxMonth = 0;
    let maxDays = 0;
    for (const [month, days] of Object.entries(lunarMonthDays)) {
      if (days > maxDays) {
        maxDays = days;
        maxMonth = parseInt(month, 10);
      }
    }

    return {
      lunarMonth: maxMonth,
      lunarMonthName: getLunarMonthName(maxMonth),
      days: maxDays,
      totalDays: daysInMonth,
    };
  } catch {
    return null;
  }
}

function readCollapsed(): boolean {
  return lsGet<boolean>(LS_COLLAPSED_KEY, false);
}

export function GlobalHoroscopeSelector() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { selectedPerson } = useSelectedPerson();
  const { doChart, currentResult, currentInput } = useBaziStore();

  // 当选中人物变化时,自动排盘（但不自动选择时间维度）
  useEffect(() => {
    if (selectedPerson && !currentInput) {
      const input = personToBaziInput(selectedPerson);
      doChart(input);
    }
  }, [selectedPerson, currentInput, doChart]);

  const input = currentInput;
  const result = currentResult;

  const {
    dayun,
    liunian,
    liuyue,
    liuri,
    liushi,
    setDayun,
    setLiunian,
    setLiuyue,
    setLiuri,
    setLiushi,
    getPathSummary,
  } = useHoroscopeStore();

  // 计算大运
  const dayunList = useMemo(() => input && result ? calculateDaYun(input, result) : [], [input, result]);

  // 计算流年 - 仅在选择大运后才有意义
  const liunianList = useMemo(() =>
    dayun && result && input ? calculateLiuNian(result.dayMaster, input.year) : [],
    [dayun, result, input]
  );

  // 计算流月(基于选中的流年天干)
  const liuyueList = useMemo(() =>
    liunian ? calculateLiuYue(liunian.tianGan) : [],
    [liunian]
  );

  // 计算流日(基于选中的流年和流月)
  const liuriList = useMemo(() =>
    liunian && liuyue ? calculateLiuRi(liunian.year, liuyue.month) : [],
    [liunian, liuyue]
  );

  // 计算流时(基于选中的流日天干)
  const liushiList = useMemo(() =>
    liuri ? calculateLiuShi(liuri.tianGan) : [],
    [liuri]
  );

  // 预计算流月对应的农历月份信息（避免在 render loop 中重复调用 solar2lunar）
  const dominantLunarMap = useMemo(() => {
    if (!input || !liunian || liuyueList.length === 0) return {};
    const map: Record<number, ReturnType<typeof getDominantLunarMonth>> = {};
    for (const ly of liuyueList) {
      map[ly.month] = getDominantLunarMonth(liunian.year, ly.month);
    }
    return map;
  }, [input, liunian, liuyueList]);

  // 预计算流日对应的农历信息（避免在 render loop 中重复调用 solar2lunar）
  const lunarDayMap = useMemo(() => {
    if (!input || !liunian || !liuyue || liuriList.length === 0) return {};
    const map: Record<number, ReturnType<typeof solarToLunar>> = {};
    for (const lr of liuriList) {
      map[lr.day] = solarToLunar(liunian.year, liuyue.month, lr.day);
    }
    return map;
  }, [input, liunian, liuyue, liuriList]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    lsSet(LS_COLLAPSED_KEY, next);
  };

  const pathSummary = getPathSummary();

  // 如果没有排盘数据,显示提示
  if (!input || !result) {
    return (
      <section className="border rounded-lg bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground text-center">
          请先选择或录入人物信息
        </p>
      </section>
    );
  }

  return (
    <section className="border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-muted-foreground shrink-0">时间选择</span>
          {pathSummary.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto whitespace-nowrap">
              {pathSummary.map((item, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground/50">›</span>}
                  <span className="text-foreground">{item}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={toggleCollapsed}
          className="p-1 hover:bg-accent rounded transition-colors shrink-0"
          title={collapsed ? "展开" : "折叠"}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {/* Content - 所有维度展开显示 */}
      {!collapsed && (
        <div className="p-4 space-y-3">
          {/* 大运 */}
          <HoroscopeRow label="大运" scope="decadal" on={!!dayun} activeKey={dayun?.startAge ?? ""}>
            {dayunList.map((dy, i) => (
              <HoroscopeCell
                key={i}
                main={`${dy.startAge}-${dy.startAge + 9}岁`}
                sub={`${dy.tianGan}${dy.diZhi}`}
                scope="decadal"
                active={dayun?.startAge === dy.startAge}
                onClick={() => {
                  if (dayun?.startAge === dy.startAge) {
                    setDayun(null);
                  } else {
                    setDayun(dy);
                  }
                }}
              />
            ))}
          </HoroscopeRow>

          {/* 流年 - 只有选择了大运才显示 */}
          {dayun && (
            <HoroscopeRow label="流年" scope="yearly" on={!!liunian} activeKey={liunian?.year ?? ""}>
              {liunianList.map((ln) => (
                <HoroscopeCell
                  key={ln.year}
                  main={`${ln.year}`}
                  sub={`${ln.tianGan}${ln.diZhi}·${ln.age}岁`}
                  scope="yearly"
                  active={liunian?.year === ln.year}
                  onClick={() => {
                    if (liunian?.year === ln.year) {
                      setLiunian(null);
                    } else {
                      setLiunian(ln);
                    }
                  }}
                />
              ))}
            </HoroscopeRow>
          )}
          {/* 流月 - 只有选择了流年才显示 */}
          {liunian && (
            <HoroscopeRow label="流月" scope="monthly" on={!!liuyue} activeKey={liuyue?.month ?? ""}>
              {liuyueList.map((ly) => {
                const dominantLunar = dominantLunarMap[ly.month] ?? null;
                return (
                  <HoroscopeCell
                    key={ly.month}
                    main={`${ly.month}月${dominantLunar ? `/${dominantLunar.lunarMonthName}` : ""}`}
                    sub={`${ly.tianGan}${ly.diZhi}`}
                    scope="monthly"
                    active={liuyue?.month === ly.month}
                    onClick={() => {
                      if (liuyue?.month === ly.month) {
                        setLiuyue(null);
                      } else {
                        setLiuyue(ly);
                      }
                    }}
                  />
                );
              })}
            </HoroscopeRow>
          )}

          {/* 流日 - 只有选择了流月才显示 */}
          {liuyue && (
            <HoroscopeRow label="流日" scope="daily" on={!!liuri} activeKey={liuri?.day ?? ""} wrap>
              {liuriList.map((lr) => {
                const lunarInfo = lunarDayMap[lr.day] ?? null;
                // 如果是初一，显示农历月份；否则显示农历日期
                const lunarSubLabel = lunarInfo
                  ? (lunarInfo.lunarDay === 1 ? lunarInfo.lunarMonthName : lunarInfo.lunarDayName)
                  : "";
                return (
                  <HoroscopeCell
                    key={lr.day}
                    main={`${lr.day}日${lunarSubLabel ? `/${lunarSubLabel}` : ""}`}
                    sub={`${lr.tianGan}${lr.diZhi}`}
                    scope="daily"
                    active={liuri?.day === lr.day}
                    onClick={() => {
                      if (liuri?.day === lr.day) {
                        setLiuri(null);
                      } else {
                        setLiuri(lr);
                      }
                    }}
                  />
                );
              })}
            </HoroscopeRow>
          )}

          {/* 流时 - 只有选择了流日才显示 */}
          {liuri && (
            <HoroscopeRow label="流时" scope="hourly" on={!!liushi} activeKey={liushi?.label ?? ""}>
              {liushiList.map((ls) => (
                <HoroscopeCell
                  key={ls.label}
                  main={ls.label}
                  sub={`${ls.tianGan}${ls.diZhi}`}
                  scope="hourly"
                  active={liushi?.label === ls.label}
                  onClick={() => {
                    if (liushi?.label === ls.label) {
                      setLiushi(null);
                    } else {
                      setLiushi(ls);
                    }
                  }}
                />
              ))}
            </HoroscopeRow>
          )}
        </div>
      )}
    </section>
  );
}
