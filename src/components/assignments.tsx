"use client";
import { Select } from "./select";
import { useState } from "react";
import { isAdmin } from "@/lib/permissions";
import { Search } from "lucide-react";
import { useLoad, useSchool } from "./data";
import { useLocale } from "./providers";
import { api, Loading, Notice, useError } from "./ui";
type Data = {
  teachers: {
    id: string;
    display_name: string;
    role: string;
    teaching_request: string;
    school_username: string | null;
  }[];
  assignments: { teacher_id: string; offering_id: string }[];
  homerooms: { teacher_id: string; term_id: string; class_id: string }[];
};
export function Assignments() {
  const { meta, term } = useSchool();
  const { t, locale } = useLocale();
  const th = locale === "th";
  const admin = isAdmin(meta.profile.role);
  const { data, error, reload } = useLoad<Data>(
    admin ? "/api/staff/assignments" : null,
  );
  const [teacher, setTeacher] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const errorText = useError();
  const courseOptions = meta.offerings
    .filter((o) => o.term_id === term && !o.archived)
    .map((o) => ({
      offering: o,
      subject: meta.subjects.find((s) => s.id === o.subject_id),
      classroom: meta.classes.find((c) => c.id === o.class_id),
    }));
  const matchingCourses = courseOptions.filter(({ subject, classroom }) =>
    `${subject?.code || ""} ${subject?.name_th || ""} ${subject?.name_en || ""} ${classroom?.name || ""}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  if (!admin) return <Notice error={t("forbidden")} />;
  async function assign(offering: string, assigned: boolean) {
    setBusy(true);
    setIssue("");
    try {
      await api("/api/staff/assignments", { teacher, offering, assigned });
      reload();
    } catch (e) {
      setIssue(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function homeroom(classroom: string, assigned: boolean) {
    setBusy(true);
    setIssue("");
    try {
      await api("/api/staff/homerooms", { teacher, term, classroom, assigned });
      reload();
    } catch (e) {
      setIssue(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("assignments")}</h1>
          <p>
            {th
              ? "เลือกครู แล้วเลือกวิชาที่อนุญาตให้ดูและกรอกคะแนนในภาคเรียนนี้"
              : "Choose a teacher and assign the courses they may view and grade this term."}
          </p>
        </div>
      </div>
      <Notice error={issue || (error && errorText(error))} />
      {!data ? (
        <Loading />
      ) : (
        <section className="panel dialog-body">
          <label className="field">
            <span>{t("teacher")}</span>
            <Select
              value={teacher}
              disabled={busy}
              onChange={(e) => setTeacher(e.target.value)}
            >
              <option value="">{th ? "เลือกครู" : "Choose a teacher"}</option>
              {data.teachers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} · {p.role}
                </option>
              ))}
            </Select>
          </label>
          {teacher && (
            <p className="notice">
              {data.teachers.find((p) => p.id === teacher)?.teaching_request ||
                (th
                  ? "ครูยังไม่ได้ระบุวิชาและห้องที่สอน"
                  : "No teaching request yet")}
            </p>
          )}
          <p className="hint">
            {th
              ? "ผู้ดูแลและ Developer เข้าถึงข้อมูลทั้งโรงเรียนได้อยู่แล้ว ครูที่ยังไม่ได้รับมอบหมายจะยังไม่เห็นข้อมูลนักเรียน"
              : "Administrators and Developers retain school-wide access. Unassigned teachers cannot see students."}
          </p>
          {teacher &&
            data.teachers.find((p) => p.id === teacher)?.role === "TEACHER" && (
              <fieldset className="classroom-picker">
                <legend>
                  {th
                    ? "ครูประจำชั้น · ภาคเรียนที่เลือก"
                    : "Homeroom teacher · selected term"}
                </legend>
                <p className="hint">
                  {th
                    ? "ดูนักเรียนและผลการเรียนทุกวิชาของห้องนี้ได้ แต่กรอก แก้ไข หรือประกาศผลได้เฉพาะวิชาที่มอบหมายให้สอนด้านล่าง"
                    : "Views every student and course in these classrooms. Grading and publishing require a course assignment below."}
                </p>
                <div className="classroom-options">
                  {meta.classes
                    .filter((c) => c.active)
                    .map((c) => (
                      <label className="classroom-option" key={c.id}>
                        <input
                          type="checkbox"
                          disabled={busy || !term}
                          checked={data.homerooms.some(
                            (h) =>
                              h.teacher_id === teacher &&
                              h.term_id === term &&
                              h.class_id === c.id,
                          )}
                          onChange={(e) => homeroom(c.id, e.target.checked)}
                        />
                        <span>{c.name}</span>
                      </label>
                    ))}
                </div>
              </fieldset>
            )}
          <h2>
            {th ? "วิชาที่มอบหมายเพิ่มเติม" : "Additional assigned courses"}
          </h2>
          {teacher && !!courseOptions.length && (
            <>
              <label className="search-field">
                <Search size={18} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={
                    th ? "ค้นหาวิชาที่มอบหมาย" : "Search courses to assign"
                  }
                  placeholder={
                    th
                      ? "ค้นหาชื่อวิชา รหัสวิชา หรือห้องเรียน…"
                      : "Search subject, code or classroom…"
                  }
                />
              </label>
              <p className="hint" aria-live="polite">
                {matchingCourses.length} / {courseOptions.length}{" "}
                {th ? "รายวิชา" : "courses"}
              </p>
            </>
          )}
          {teacher &&
            matchingCourses.map(({ offering: o, subject: s, classroom }) => {
              return (
                <label key={o.id} className="classroom-option">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={data.assignments.some(
                      (a) => a.teacher_id === teacher && a.offering_id === o.id,
                    )}
                    onChange={(e) => assign(o.id, e.target.checked)}
                  />
                  <span>
                    {s?.code} · {th ? s?.name_th : s?.name_en} ·{" "}
                    {classroom?.name}
                  </span>
                </label>
              );
            })}
          {teacher && !!courseOptions.length && !matchingCourses.length && (
            <p className="hint">
              {th ? "ไม่พบวิชาที่ตรงกับคำค้น" : "No matching courses"}
            </p>
          )}
          {teacher &&
            !meta.offerings.some((o) => o.term_id === term && !o.archived) && (
              <p>
                {th
                  ? "เพิ่มวิชาที่เปิดสอนในเมนูรายวิชาก่อน"
                  : "Create course offerings first."}
              </p>
            )}
        </section>
      )}
    </>
  );
}
