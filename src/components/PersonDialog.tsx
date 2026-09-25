/**
 * 人物新增/编辑弹窗：包含完整 BirthInput 表单
 * 视觉风格匹配项目主题
 */
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  LUNAR_DAYS,
  LUNAR_MONTHS,
  SCHOOL_MUTAGEN_TABLE,
  SCHOOL_YEAR_DIVIDE,
  TIME_OPTIONS,
  applyTrueSolar,
} from "../core/utils";
import { daysInLunarMonth, leapMonthOf, lunarStrToSolarStr } from "../core/lunar";
import {
  ALL_PROVINCE_NAMES,
  getCityNamesOfProvince,
  getDistrictNamesOfCity,
} from "../core/cities";
import {
  browserTimezone,
  formatOffset,
  listTimezones,
  resolveBirthPlace,
  zoneOffsetMinutes,
} from "../core/place";
import type { BirthInput } from "../core/useZwds";
import { DEFAULT_BIRTH_INPUT } from "../core/useZwds";
import { Dialog } from "./Dialog";

type PersonDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (input: BirthInput, isDefault: boolean) => void;
  /** 编辑模式传入现有数据（含 isDefault），新增模式传 undefined */
  initialData?: import("../core/personDb").Person;
  /** 弹窗标题 */
  title?: string;
};

export function PersonDialog({
  open,
  onClose,
  onSave,
  initialData,
  title = initialData ? "编辑人物" : "新增人物",
}: PersonDialogProps) {
  const [draft, setDraft] = useState<BirthInput>(initialData || DEFAULT_BIRTH_INPUT);
  const [isDefault, setIsDefault] = useState(initialData?.isDefault ?? false);

  useEffect(() => {
    if (open) {
      setDraft(initialData || DEFAULT_BIRTH_INPUT);
      setIsDefault(initialData?.isDefault ?? false);
    }
  }, [open, initialData]);

  const set = <K extends keyof BirthInput>(k: K, v: BirthInput[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  /** 切流派：年界与四化表自动跟随该派默认 */
  const setAlgorithm = (alg: BirthInput["algorithm"]) =>
    setDraft((d) => ({
      ...d,
      algorithm: alg,
      yearDivide: SCHOOL_YEAR_DIVIDE[alg],
      mutagenTable: SCHOOL_MUTAGEN_TABLE[alg],
      astroType: alg === "zhongzhou" ? d.astroType : "heaven",
    }));

  /* ── 农历年/月/日 三级下拉 ── */
  const lunarYMD = useMemo(() => {
    const [y, m, d] = draft.date.split(/[-/.]/).map(Number);
    return { y: y || 2000, m: m || 1, d: d || 1 };
  }, [draft.date]);
  const lunarLeapMonth = useMemo(
    () => (draft.calendar === "lunar" ? leapMonthOf(lunarYMD.y) : 0),
    [draft.calendar, lunarYMD.y]
  );
  const lunarMaxDay = useMemo(
    () =>
      draft.calendar === "lunar"
        ? daysInLunarMonth(lunarYMD.y, lunarYMD.m, draft.isLeapMonth && lunarLeapMonth === lunarYMD.m)
        : 30,
    [draft.calendar, lunarYMD, draft.isLeapMonth, lunarLeapMonth]
  );

  const setLunar = (y: number, m: number, d: number, leap: boolean) => {
    const validLeap = leap && leapMonthOf(y) === m;
    const maxD = daysInLunarMonth(y, m, validLeap);
    setDraft((dr) => ({
      ...dr,
      date: `${y}-${m}-${Math.min(d, maxD)}`,
      isLeapMonth: validLeap,
    }));
  };

  /** 勾选真太阳时 */
  const toggleTrueSolar = (on: boolean) =>
    setDraft((d) => ({
      ...d,
      useTrueSolar: on,
      exactTime: on && !d.exactTime ? "12:00" : d.exactTime,
    }));

  /** 省 → 市 → 区 三级联动 */
  const setProvince = (p: string) =>
    setDraft((d) => {
      const cities = getCityNamesOfProvince(p);
      const city = cities[0] ?? "";
      const districts = getDistrictNamesOfCity(p, city);
      return { ...d, province: p, city, district: districts[0] ?? "" };
    });

  const setCity = (c: string) =>
    setDraft((d) => {
      const districts = getDistrictNamesOfCity(d.province, c);
      return { ...d, city: c, district: districts[0] ?? "" };
    });

  const cityNames = useMemo(() => getCityNamesOfProvince(draft.province), [draft.province]);
  const districtNames = useMemo(
    () => getDistrictNamesOfCity(draft.province, draft.city),
    [draft.province, draft.city]
  );
  const timezones = useMemo(listTimezones, []);

  const solarStr = useMemo(
    () =>
      draft.calendar === "lunar" ? lunarStrToSolarStr(draft.date, draft.isLeapMonth) : draft.date,
    [draft.calendar, draft.date, draft.isLeapMonth]
  );

  const resolvedPlace = useMemo(() => {
    if (!draft.useTrueSolar || !solarStr) return null;
    return resolveBirthPlace(draft, solarStr, draft.exactTime || "12:00");
  }, [draft, solarStr]);

  const dstWarn = useMemo(() => {
    if (draft.placeMode === "overseas" && draft.useTrueSolar) return null;
    if (!solarStr) return null;
    const [y, m, d] = solarStr.split(/[-/.]/).map(Number);
    if (!y || y < 1986 || y > 1991) return null;
    const [hh, mi] = (draft.useTrueSolar && draft.exactTime ? draft.exactTime : "12:00")
      .split(":")
      .map(Number);
    return zoneOffsetMinutes("Asia/Shanghai", y, m || 1, d || 1, hh || 12, mi || 0) === 540
      ? `${y} 年该时段中国大陆实行夏令时（钟表拨快 1 小时）`
      : null;
  }, [draft.placeMode, draft.useTrueSolar, draft.exactTime, solarStr]);

  const derivedIdx = useMemo(() => {
    if (!draft.useTrueSolar || !draft.exactTime || !solarStr || !resolvedPlace) return null;
    return (
      applyTrueSolar(
        solarStr,
        draft.exactTime,
        resolvedPlace.longitude,
        resolvedPlace.clockOffsetMinutes
      )?.timeIndex ?? null
    );
  }, [draft.useTrueSolar, draft.exactTime, solarStr, resolvedPlace]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(draft, isDefault);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} width={680}>
      <form className="person-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="fld">
            <span>姓名</span>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="请输入姓名"
              maxLength={12}
              required
            />
          </label>

          <label className="fld">
            <span>常居地</span>
            <input
              className="residence"
              value={draft.residence}
              onChange={(e) => set("residence", e.target.value)}
              placeholder="可选，如 广东深圳"
              maxLength={24}
            />
          </label>

          <div className="seg" role="group" aria-label="性别">
            {(["男", "女"] as const).map((g) => (
              <button
                type="button"
                key={g}
                className={draft.gender === g ? "on" : ""}
                onClick={() => set("gender", g)}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="seg" role="group" aria-label="历法">
            {(["solar", "lunar"] as const).map((cal) => (
              <button
                type="button"
                key={cal}
                className={draft.calendar === cal ? "on" : ""}
                onClick={() =>
                  setDraft((d) => {
                    if (d.calendar === cal) return d;
                    const [y, m, dd] = d.date.split(/[-/.]/).map(Number);
                    if (!y || !m || !dd) return { ...d, calendar: cal };
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const date =
                      cal === "solar"
                        ? `${y}-${pad(m)}-${pad(Math.min(dd, 31))}`
                        : `${y}-${m}-${Math.min(dd, daysInLunarMonth(y, m, false))}`;
                    return { ...d, calendar: cal, date, isLeapMonth: false };
                  })
                }
              >
                {cal === "solar" ? "阳历" : "农历"}
              </button>
            ))}
          </div>

          {draft.calendar === "solar" ? (
            <label className="fld">
              <span>阳历生日</span>
              <input
                type="date"
                required
                min="1900-02-01"
                max="2100-12-31"
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </label>
          ) : (
            <>
              <label className="fld">
                <span>农历年</span>
                <select
                  value={lunarYMD.y}
                  onChange={(e) => setLunar(Number(e.target.value), lunarYMD.m, lunarYMD.d, draft.isLeapMonth)}
                >
                  {Array.from({ length: 201 }, (_, i) => 1900 + i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fld">
                <span>月</span>
                <select
                  value={`${lunarYMD.m}${draft.isLeapMonth && lunarLeapMonth === lunarYMD.m ? "L" : ""}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    const leap = v.endsWith("L");
                    setLunar(lunarYMD.y, Number(leap ? v.slice(0, -1) : v), lunarYMD.d, leap);
                  }}
                >
                  {LUNAR_MONTHS.flatMap((label, i) => {
                    const m = i + 1;
                    const opts = [
                      <option key={m} value={m}>
                        {label}
                      </option>,
                    ];
                    if (lunarLeapMonth === m) {
                      opts.push(
                        <option key={`${m}L`} value={`${m}L`}>
                          闰{label}
                        </option>
                      );
                    }
                    return opts;
                  })}
                </select>
              </label>
              <label className="fld">
                <span>日</span>
                <select
                  value={Math.min(lunarYMD.d, lunarMaxDay)}
                  onChange={(e) => setLunar(lunarYMD.y, lunarYMD.m, Number(e.target.value), draft.isLeapMonth)}
                >
                  {Array.from({ length: lunarMaxDay }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {LUNAR_DAYS[d - 1]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="fld">
            <span>时辰</span>
            <select
              value={derivedIdx ?? draft.timeIndex}
              disabled={derivedIdx != null}
              title={derivedIdx != null ? "已由真太阳时校正自动推定" : undefined}
              onChange={(e) => set("timeIndex", Number(e.target.value))}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t.index} value={t.index}>
                  {t.label} {t.range}
                </option>
              ))}
            </select>
          </label>

          <label className="fld">
            <span>流派</span>
            <select
              value={draft.algorithm}
              onChange={(e) => setAlgorithm(e.target.value as BirthInput["algorithm"])}
            >
              <option value="default">通行版（南派）</option>
              <option value="zhongzhou">中州派</option>
            </select>
          </label>

          <label className="fld">
            <span>年界</span>
            <select
              value={draft.yearDivide}
              onChange={(e) => set("yearDivide", e.target.value as BirthInput["yearDivide"])}
            >
              <option value="normal">
                正月初一{draft.algorithm === "default" ? "（南派默认）" : ""}
              </option>
              <option value="exact">
                立春{draft.algorithm === "zhongzhou" ? "（中州默认）" : ""}
              </option>
            </select>
          </label>

          <label className="fld">
            <span>四化表</span>
            <select
              value={draft.mutagenTable}
              onChange={(e) => set("mutagenTable", e.target.value as BirthInput["mutagenTable"])}
            >
              <option value="default">
                通行四化{draft.algorithm === "default" ? "（南派默认）" : ""}
              </option>
              <option value="zhongzhou">
                中州四化·天府化科{draft.algorithm === "zhongzhou" ? "（中州默认）" : ""}
              </option>
            </select>
          </label>

          <label className="fld">
            <span>子时界</span>
            <select
              value={draft.dayDivide}
              onChange={(e) => set("dayDivide", e.target.value as BirthInput["dayDivide"])}
            >
              <option value="forward">晚子归次日（默认）</option>
              <option value="current">晚子归当日</option>
            </select>
          </label>

          {draft.algorithm === "zhongzhou" && (
            <label className="fld">
              <span>盘型</span>
              <select
                value={draft.astroType}
                onChange={(e) => set("astroType", e.target.value as BirthInput["astroType"])}
              >
                <option value="heaven">天盘</option>
                <option value="earth">地盘</option>
                <option value="human">人盘</option>
              </select>
            </label>
          )}

          <label className="ck">
            <input
              type="checkbox"
              checked={draft.useTrueSolar}
              onChange={(e) => toggleTrueSolar(e.target.checked)}
            />
            真太阳时
          </label>
        </div>

        {dstWarn && (
          <div className="dst-hint">
            ⚠ {dstWarn}——若出生记录为当时钟表时间，请将时刻减 1 小时后输入。
          </div>
        )}

        {draft.useTrueSolar && (
          <div className="ts-row">
            <label className="fld">
              <span>出生时刻</span>
              <input
                type="time"
                required
                value={draft.exactTime}
                onChange={(e) => set("exactTime", e.target.value)}
              />
            </label>

            <div className="seg" role="group" aria-label="出生地">
              <button
                type="button"
                className={draft.placeMode !== "overseas" ? "on" : ""}
                onClick={() => set("placeMode", "china")}
              >
                中国
              </button>
              <button
                type="button"
                className={draft.placeMode === "overseas" ? "on" : ""}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    placeMode: "overseas",
                    timezone: d.timezone || browserTimezone(),
                  }))
                }
              >
                海外
              </button>
            </div>

            {draft.placeMode === "overseas" ? (
              <label className="fld">
                <span>时区</span>
                <select
                  className="tz-select"
                  value={draft.timezone || browserTimezone()}
                  onChange={(e) => set("timezone", e.target.value)}
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="fld">
                  <span>省份</span>
                  <select value={draft.province} onChange={(e) => setProvince(e.target.value)}>
                    {ALL_PROVINCE_NAMES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fld">
                  <span>城市</span>
                  <select value={draft.city} onChange={(e) => setCity(e.target.value)}>
                    {cityNames.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fld">
                  <span>区县</span>
                  <select value={draft.district} onChange={(e) => set("district", e.target.value)}>
                    {districtNames.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {resolvedPlace && (
              <span className="ts-lng">
                经度 {resolvedPlace.longitude}° ·{" "}
                {draft.placeMode === "overseas"
                  ? `钟表基准 ${formatOffset(resolvedPlace.clockOffsetMinutes)}`
                  : "钟表基准东八区"}{" "}
                · 经度偏移{" "}
                {Math.round(resolvedPlace.longitude * 4 - resolvedPlace.clockOffsetMinutes)} 分
              </span>
            )}
          </div>
        )}

        <label className="ck" title="设为默认人物，应用启动时自动起盘">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          设为默认人物
        </label>

        <div className="dlg-foot">
          <button type="button" className="btn-cancel" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn-save">
            保存
          </button>
        </div>
      </form>
    </Dialog>
  );
}
