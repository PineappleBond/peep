/**
 * 人物新增/编辑弹窗：包含完整 BirthInput 表单
 * 视觉风格匹配项目主题
 */
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  LUNAR_DAYS,
  LUNAR_MONTHS,
  SCHOOL_MUTAGEN_TABLE,
  SCHOOL_YEAR_DIVIDE,
  TIME_OPTIONS,
  applyTrueSolar,
} from "../core/utils";
import { daysInLunarMonth, leapMonthOf, lunarStrToSolarStr } from "../core/lunar";
import { ALL_PROVINCE_NAMES, getCityNamesOfProvince, getDistrictNamesOfCity } from "../core/cities";
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
import { useI18n } from "../core/i18n";

type PersonDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (input: BirthInput, isDefault: boolean) => void;
  /** 编辑模式传入现有数据（含 isDefault），新增模式传 undefined */
  initialData?: import("../core/personDb").Person;
  /** 弹窗标题 */
  title?: string;
};

export function PersonDialog({ open, onClose, onSave, initialData, title }: PersonDialogProps) {
  const { t } = useI18n();
  const resolvedTitle = title ?? (initialData ? t("person.editPerson") : t("person.addPerson"));
  const [draft, setDraft] = useState<BirthInput>(initialData || DEFAULT_BIRTH_INPUT);
  const [isDefault, setIsDefault] = useState(initialData?.isDefault ?? false);

  useEffect(() => {
    if (open) {
      setDraft(initialData || DEFAULT_BIRTH_INPUT);
      setIsDefault(initialData?.isDefault ?? false);
    }
  }, [open, initialData]);

  const set = <K extends keyof BirthInput>(k: K, v: BirthInput[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  /** 切流派：年界与四化表自动跟随该派默认 */
  const setAlgorithm = (alg: BirthInput["algorithm"]) =>
    setDraft(d => ({
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
        ? daysInLunarMonth(
            lunarYMD.y,
            lunarYMD.m,
            draft.isLeapMonth && lunarLeapMonth === lunarYMD.m
          )
        : 30,
    [draft.calendar, lunarYMD, draft.isLeapMonth, lunarLeapMonth]
  );

  const setLunar = (y: number, m: number, d: number, leap: boolean) => {
    const validLeap = leap && leapMonthOf(y) === m;
    const maxD = daysInLunarMonth(y, m, validLeap);
    setDraft(dr => ({
      ...dr,
      date: `${y}-${m}-${Math.min(d, maxD)}`,
      isLeapMonth: validLeap,
    }));
  };

  /** 勾选真太阳时 */
  const toggleTrueSolar = (on: boolean) =>
    setDraft(d => ({
      ...d,
      useTrueSolar: on,
      exactTime: on && !d.exactTime ? "12:00" : d.exactTime,
    }));

  /** 省 → 市 → 区 三级联动 */
  const setProvince = (p: string) =>
    setDraft(d => {
      const cities = getCityNamesOfProvince(p);
      const city = cities[0] ?? "";
      const districts = getDistrictNamesOfCity(p, city);
      return { ...d, province: p, city, district: districts[0] ?? "" };
    });

  const setCity = (c: string) =>
    setDraft(d => {
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
      ? t("person.dstWarn", { year: String(y) })
      : null;
  }, [draft.placeMode, draft.useTrueSolar, draft.exactTime, solarStr, t]);

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
    // 客户端兜底校验（HTML5 校验可能因浏览器差异被绕过）
    if (!draft.date || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(draft.date)) {
      alert(t("person.invalidDateFormat"));
      return;
    }
    if (draft.timeIndex < 0 || draft.timeIndex > 12) {
      alert(t("person.timeIndexOutOfRange"));
      return;
    }
    if (draft.useTrueSolar && !draft.exactTime) {
      alert(t("person.trueSolarRequiresTime"));
      return;
    }
    if (draft.useTrueSolar && draft.placeMode === "overseas" && !draft.timezone) {
      alert(t("person.overseasRequiresTimezone"));
      return;
    }
    onSave(draft, isDefault);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={resolvedTitle} width={680}>
      <form className="person-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="fld">
            <span>{t("person.name")}</span>
            <input
              value={draft.name}
              onChange={e => set("name", e.target.value)}
              placeholder={t("person.namePlaceholder")}
              maxLength={12}
              required
            />
          </label>

          <label className="fld">
            <span>{t("person.residence")}</span>
            <input
              className="residence"
              value={draft.residence}
              onChange={e => set("residence", e.target.value)}
              placeholder={t("person.residencePlaceholder")}
              maxLength={24}
            />
          </label>

          <div className="seg" role="group" aria-label={t("person.gender")}>
            {(["男", "女"] as const).map(g => (
              <button
                type="button"
                key={g}
                className={draft.gender === g ? "on" : ""}
                onClick={() => set("gender", g)}
                aria-pressed={draft.gender === g}
              >
                {g === "男" ? t("common.male") : t("common.female")}
              </button>
            ))}
          </div>

          <div className="seg" role="group" aria-label={t("person.calendar")}>
            {(["solar", "lunar"] as const).map(cal => (
              <button
                type="button"
                key={cal}
                className={draft.calendar === cal ? "on" : ""}
                onClick={() =>
                  setDraft(d => {
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
                aria-pressed={draft.calendar === cal}
              >
                {cal === "solar" ? t("person.solar") : t("person.lunar")}
              </button>
            ))}
          </div>

          {draft.calendar === "solar" ? (
            <label className="fld">
              <span>{t("person.solarBirthday")}</span>
              <input
                type="date"
                required
                min="1900-02-01"
                max="2100-12-31"
                value={draft.date}
                onChange={e => set("date", e.target.value)}
              />
            </label>
          ) : (
            <>
              <label className="fld">
                <span>{t("person.lunarYear")}</span>
                <select
                  value={lunarYMD.y}
                  onChange={e =>
                    setLunar(Number(e.target.value), lunarYMD.m, lunarYMD.d, draft.isLeapMonth)
                  }
                >
                  {Array.from({ length: 201 }, (_, i) => 1900 + i).map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fld">
                <span>{t("person.month")}</span>
                <select
                  value={`${lunarYMD.m}${draft.isLeapMonth && lunarLeapMonth === lunarYMD.m ? "L" : ""}`}
                  onChange={e => {
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
                          {t("person.leapMonth", { label })}
                        </option>
                      );
                    }
                    return opts;
                  })}
                </select>
              </label>
              <label className="fld">
                <span>{t("person.day")}</span>
                <select
                  value={Math.min(lunarYMD.d, lunarMaxDay)}
                  onChange={e =>
                    setLunar(lunarYMD.y, lunarYMD.m, Number(e.target.value), draft.isLeapMonth)
                  }
                >
                  {Array.from({ length: lunarMaxDay }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>
                      {LUNAR_DAYS[d - 1]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="fld">
            <span>{t("person.time")}</span>
            <select
              value={derivedIdx ?? draft.timeIndex}
              disabled={derivedIdx != null}
              title={derivedIdx != null ? t("person.trueSolarAuto") : undefined}
              onChange={e => set("timeIndex", Number(e.target.value))}
            >
              {TIME_OPTIONS.map(item => (
                <option key={item.index} value={item.index}>
                  {item.label} {item.range}
                </option>
              ))}
            </select>
          </label>

          <label className="fld">
            <span>{t("person.school")}</span>
            <select
              value={draft.algorithm}
              onChange={e => setAlgorithm(e.target.value as BirthInput["algorithm"])}
            >
              <option value="default">{t("person.schoolDefault")}</option>
              <option value="zhongzhou">{t("person.schoolZhongzhou")}</option>
            </select>
          </label>

          <label className="fld">
            <span>{t("person.yearDivide")}</span>
            <select
              value={draft.yearDivide}
              onChange={e => set("yearDivide", e.target.value as BirthInput["yearDivide"])}
            >
              <option value="normal">
                {t("person.yearDivideNormal")}
                {draft.algorithm === "default" ? t("person.yearDivideNormalDefault") : ""}
              </option>
              <option value="exact">
                {t("person.yearDivideExact")}
                {draft.algorithm === "zhongzhou" ? t("person.yearDivideExactDefault") : ""}
              </option>
            </select>
          </label>

          <label className="fld">
            <span>{t("person.mutagenTable")}</span>
            <select
              value={draft.mutagenTable}
              onChange={e => set("mutagenTable", e.target.value as BirthInput["mutagenTable"])}
            >
              <option value="default">
                {t("person.mutagenDefault")}
                {draft.algorithm === "default" ? t("person.yearDivideNormalDefault") : ""}
              </option>
              <option value="zhongzhou">
                {t("person.mutagenZhongzhou")}
                {draft.algorithm === "zhongzhou" ? t("person.yearDivideExactDefault") : ""}
              </option>
            </select>
          </label>

          <label className="fld">
            <span>{t("person.dayDivide")}</span>
            <select
              value={draft.dayDivide}
              onChange={e => set("dayDivide", e.target.value as BirthInput["dayDivide"])}
            >
              <option value="forward">{t("person.dayDivideForward")}</option>
              <option value="current">{t("person.dayDivideCurrent")}</option>
            </select>
          </label>

          {draft.algorithm === "zhongzhou" && (
            <label className="fld">
              <span>{t("person.astroType")}</span>
              <select
                value={draft.astroType}
                onChange={e => set("astroType", e.target.value as BirthInput["astroType"])}
              >
                <option value="heaven">{t("person.astroHeaven")}</option>
                <option value="earth">{t("person.astroEarth")}</option>
                <option value="human">{t("person.astroHuman")}</option>
              </select>
            </label>
          )}

          <label className="ck">
            <input
              type="checkbox"
              checked={draft.useTrueSolar}
              onChange={e => toggleTrueSolar(e.target.checked)}
            />
            {t("person.trueSolar")}
          </label>
        </div>

        {dstWarn && (
          <div className="dst-hint">
            ⚠ {dstWarn}
            {t("person.dstHint")}
          </div>
        )}

        {draft.useTrueSolar && (
          <div className="ts-row">
            <label className="fld">
              <span>{t("person.birthTime")}</span>
              <input
                type="time"
                required
                value={draft.exactTime}
                onChange={e => set("exactTime", e.target.value)}
              />
            </label>

            <div className="seg" role="group" aria-label={t("person.birthPlace")}>
              <button
                type="button"
                className={draft.placeMode !== "overseas" ? "on" : ""}
                onClick={() => set("placeMode", "china")}
                aria-pressed={draft.placeMode !== "overseas"}
              >
                {t("person.china")}
              </button>
              <button
                type="button"
                className={draft.placeMode === "overseas" ? "on" : ""}
                onClick={() =>
                  setDraft(d => ({
                    ...d,
                    placeMode: "overseas",
                    timezone: d.timezone || browserTimezone(),
                  }))
                }
                aria-pressed={draft.placeMode === "overseas"}
              >
                {t("person.overseas")}
              </button>
            </div>

            {draft.placeMode === "overseas" ? (
              <label className="fld">
                <span>{t("person.timezone")}</span>
                <select
                  className="tz-select"
                  value={draft.timezone || browserTimezone()}
                  onChange={e => set("timezone", e.target.value)}
                >
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="fld">
                  <span>{t("person.province")}</span>
                  <select value={draft.province} onChange={e => setProvince(e.target.value)}>
                    {ALL_PROVINCE_NAMES.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fld">
                  <span>{t("person.city")}</span>
                  <select value={draft.city} onChange={e => setCity(e.target.value)}>
                    {cityNames.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="fld">
                  <span>{t("person.district")}</span>
                  <select value={draft.district} onChange={e => set("district", e.target.value)}>
                    {districtNames.map(d => (
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
                {t("person.longitude", { value: resolvedPlace.longitude })} ·{" "}
                {draft.placeMode === "overseas"
                  ? t("person.clockBase", {
                      offset: formatOffset(resolvedPlace.clockOffsetMinutes),
                    })
                  : t("person.clockBaseUTC8")}{" "}
                · {t("person.lngOffset")}{" "}
                {Math.round(resolvedPlace.longitude * 4 - resolvedPlace.clockOffsetMinutes)}{" "}
                {t("person.lngOffsetUnit")}
              </span>
            )}
          </div>
        )}

        <label className="ck" title={t("person.setDefault")}>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={e => setIsDefault(e.target.checked)}
          />
          {t("person.setDefault")}
        </label>

        <div className="dlg-foot">
          <button type="button" className="btn-cancel" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn-save">
            {t("common.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
