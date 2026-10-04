"use client";
import { Select } from "./select";
import { useState } from "react";
import { isAdmin } from "@/lib/permissions";
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
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const errorText = useError();
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
                    ? "เข้าถึงรายชื่อนักเรียนและทุกวิชาของห้องที่เลือกได้ แม้ไม่ได้มอบหมายรายวิชาแยก"
                    : "Accesses students and every course in these classrooms without separate course assignments."}
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
          {teacher &&
            meta.offerings
              .filter((o) => o.term_id === term && !o.archived)
              .map((o) => {
                const s = meta.subjects.find((s) => s.id === o.subject_id);
                return (
                  <label key={o.id} className="classroom-option">
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={data.assignments.some(
                        (a) =>
                          a.teacher_id === teacher && a.offering_id === o.id,
                      )}
                      onChange={(e) => assign(o.id, e.target.checked)}
                    />
                    <span>
                      {s?.code} · {th ? s?.name_th : s?.name_en} ·{" "}
                      {meta.classes.find((c) => c.id === o.class_id)?.name}
                    </span>
                  </label>
                );
              })}
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
