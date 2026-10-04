"use client";
import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { Offering } from "@/lib/types";
import { useSchool } from "./data";
import { useLocale } from "./providers";
export type WorkRow = {
  id: string;
  subject_id: string;
  class_id: string;
  total: number;
  recorded: number;
  published: number;
};
export function CoursePicker({
  offerings,
  selected,
  rows,
  onSelect,
  initiallyOpen,
  error,
  retry,
}: {
  offerings: Offering[];
  selected?: string;
  rows?: WorkRow[];
  onSelect: (id: string) => boolean;
  initiallyOpen: boolean;
  error?: string;
  retry: () => void;
}) {
  const { meta } = useSchool();
  const { locale, t } = useLocale();
  const th = locale === "th";
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(initiallyOpen);
  const info = (o: Offering) => {
    const subject = meta.subjects.find((s) => s.id === o.subject_id);
    return {
      code: subject?.code || "",
      name:
        (th ? subject?.name_th : subject?.name_en) || subject?.name_th || "—",
      room: meta.classes.find((c) => c.id === o.class_id)?.name || "—",
      work: rows?.find((r) => r.id === o.id),
    };
  };
  const current = offerings.find((o) => o.id === selected);
  const details = current && info(current);
  const matches = offerings
    .map((o) => ({ o, ...info(o) }))
    .filter((v) =>
      `${v.code} ${v.name} ${v.room}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        a.room.localeCompare(b.room, locale, { numeric: true }) ||
        a.code.localeCompare(b.code, locale, { numeric: true }),
    );
  return (
    <section className="panel course-picker">
      <button
        className="course-picker-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="course-options"
        onClick={() => setOpen(!open)}
      >
        <span>
          <span className="eyebrow">{t("selectOffering")}</span>
          <strong>
            {details
              ? `${details.code} · ${details.name}`
              : th
                ? "ค้นหาและเลือกรายวิชา"
                : "Find a course"}
          </strong>
          {details && (
            <span className="course-context">
              <span className="badge">{details.room}</span>
              <span>
                {details.work
                  ? `${details.work.recorded}/${details.work.total} ${t("recordedCount")}`
                  : "…"}
              </span>
            </span>
          )}
        </span>
        <span className="course-change">
          {th ? "เลือกวิชา" : "Change course"}
          <ChevronDown size={18} className={open ? "rotated" : ""} />
        </span>
      </button>
      {open && (
        <div className="course-picker-body" id="course-options">
          <label className="search-field">
            <Search size={18} />
            <input
              type="search"
              aria-label={
                th
                  ? "ค้นหาวิชา รหัสวิชา หรือห้องเรียน"
                  : "Search subject, code or classroom"
              }
              placeholder={
                th
                  ? "ค้นหาวิชา รหัสวิชา หรือห้องเรียน…"
                  : "Search subject, code or classroom…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="course-picker-count" aria-live="polite">
            {matches.length} {th ? "รายวิชา" : "courses"}
          </div>
          {error && (
            <p className="notice error">
              {error}{" "}
              <button className="button small" onClick={retry}>
                {t("retry")}
              </button>
            </p>
          )}
          <div className="course-options">
            {matches.map(({ o, code, name, room, work }) => (
              <button
                type="button"
                key={o.id}
                className={`course-option ${selected === o.id ? "selected" : ""}`}
                aria-pressed={selected === o.id}
                onClick={() => {
                  if (onSelect(o.id)) setOpen(false);
                }}
              >
                <span className="course-option-head">
                  <span className="badge">{room}</span>
                  <span className="muted">{code}</span>
                  {selected === o.id && <Check size={17} />}
                </span>
                <strong>{name}</strong>
                <span className="course-counts">
                  {work
                    ? `${work.recorded}/${work.total} ${t("recordedCount")} · ${work.published} ${t("published")}`
                    : th
                      ? "กำลังโหลดความคืบหน้า…"
                      : "Loading progress…"}
                </span>
                <progress
                  aria-label={`${name} ${room} ${t("recordedCount")}`}
                  max={Math.max(1, work?.total || 0)}
                  value={work?.recorded || 0}
                />
              </button>
            ))}
          </div>
          {!matches.length && (
            <p className="empty">
              {th ? "ไม่พบรายวิชาที่ตรงกับคำค้น" : "No matching courses"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
