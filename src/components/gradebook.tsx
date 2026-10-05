"use client";
import { Select } from "./select";
import { CoursePicker, type WorkRow } from "./course-picker";
import { ResetCourseGrades } from "./reset-course-grades";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Save, Send } from "lucide-react";
import { useLoad, useSchool } from "./data";
import { useLocale } from "./providers";
import { api, Empty, Loading, Notice, useError } from "./ui";
import { gradePreview, passPreview, validDecimal } from "@/lib/grading";
import { gradeTone } from "@/lib/grade-tone";
import type { Enrollment, Grade, Offering } from "@/lib/types";
export function Gradebook() {
  const { meta, term, unsaved, setUnsaved } = useSchool();
  const { t, locale } = useLocale();
  const errorText = useError();
  const query = useSearchParams();
  const [selected, setSelected] = useState(query.get("offering") || "");
  const options = meta.offerings.filter(
    (o) => o.term_id === term && !o.archived,
  );
  const offering = options.find((o) => o.id === selected) || options[0];
  const { data, error, reload, revision, refreshing } = useLoad<{
    enrollments: Enrollment[];
    grades: Grade[];
    can_edit?: boolean;
  }>(offering ? `/api/staff/gradebook?offering=${offering.id}` : null);
  const work = useLoad<{ rows: WorkRow[] }>(
    term ? `/api/staff/work?term=${term}` : null,
  );
  const [message, setMessage] = useState("");
  function select(value: string) {
    if (unsaved && !window.confirm(t("discard"))) return false;
    setUnsaved(false);
    setMessage("");
    setSelected(value);
    return true;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("academics")}</span>
          <h1>{t("gradebook")}</h1>
          <p>{t("gradebookDescription")}</p>
        </div>
        {offering && (
          <a
            className="button"
            href={`/api/staff/gradebook-export?offering=${offering.id}&locale=${locale}`}
          >
            <Download size={16} />
            {t("export")}
          </a>
        )}
      </div>
      <div className="mode-switch">
        <span className="button primary">{t("bySubject")}</span>
        <Link
          className="button"
          href={
            query.get("student")
              ? `/teacher/students/${query.get("student")}?term=${term}`
              : "/teacher/students"
          }
        >
          {t("byStudent")}
        </Link>
        <Link className="text-link" href="/teacher/guide">
          {t("guideLink")}
        </Link>
      </div>
      <CoursePicker
        key={term}
        offerings={options}
        selected={offering?.id}
        rows={work.data?.rows}
        onSelect={select}
        initiallyOpen={!query.get("offering")}
        error={work.error && errorText(work.error)}
        retry={work.reload}
      />
      <Notice error={error && errorText(error)} message={message} />
      {!offering ? (
        <Empty />
      ) : error ? (
        <button className="button" onClick={reload}>
          {t("retry")}
        </button>
      ) : !data ? (
        <Loading />
      ) : (
        <GradeGrid
          key={`${offering.id}:${revision}`}
          offering={offering}
          refreshing={refreshing}
          data={data}
          onSaved={() => {
            setUnsaved(false);
            setMessage(t("saved"));
            reload();
            work.reload();
          }}
        />
      )}
      <p className="hint">{t("gradeHelp")}</p>
      <p className="hint">{t("publishedLocked")}</p>
    </>
  );
}
function GradeGrid({
  offering: o,
  data,
  onSaved,
  refreshing,
}: {
  offering: Offering;
  data: { enrollments: Enrollment[]; grades: Grade[]; can_edit?: boolean };
  onSaved: () => void;
  refreshing: boolean;
}) {
  const { meta, setUnsaved } = useSchool();
  const { t, locale } = useLocale();
  const readOnly = data.can_edit === false || o.can_edit === false;
  const errorText = useError();
  const [drafts, setDrafts] = useState<
    Record<string, { score: string; result: string }>
  >({});
  const [working, setBusy] = useState(false);
  const busy = working || refreshing;
  const [error, setError] = useState("");
  const inputs = useRef<(HTMLInputElement | HTMLButtonElement | null)[]>([]);
  const scheme = meta.schemes.find((s) => s.id === o.scheme_id);
  const manual = o.grading_type === "PASS_FAIL" && o.pass_mode === "MANUAL";
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (
        dirty &&
        a &&
        a.getAttribute("href") &&
        !a.getAttribute("href")!.startsWith("#") &&
        !window.confirm(t("discard"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, t]);
  useEffect(() => () => setUnsaved(false), [setUnsaved]);
  const changes = Object.entries(drafts).map(([student_id, v]) => ({
    student_id,
    version: data.grades.find((g) => g.student_id === student_id)?.version || 0,
    score: manual ? null : v.score,
    result: manual ? (v.result as "PASS" | "FAIL") : null,
  }));
  const invalid = changes.some((v) =>
    manual
      ? !["PASS", "FAIL"].includes(v.result || "")
      : !validDecimal(v.score || "") || Number(v.score) > o.max_score,
  );
  function change(sid: string, key: "score" | "result", value: string) {
    if (readOnly) return;
    const g = data.grades.find((g) => g.student_id === sid);
    const original = {
      score: g?.score === null || g?.score === undefined ? "" : String(g.score),
      result: g?.result || "",
    };
    const next = {
      ...drafts,
      [sid]: { ...(drafts[sid] || original), [key]: value },
    };
    if (
      next[sid].score === original.score &&
      next[sid].result === original.result
    )
      delete next[sid];
    setDrafts(next);
    setUnsaved(!!Object.keys(next).length);
  }
  async function save() {
    if (readOnly || !dirty || invalid) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/staff/save-grades", { offering_id: o.id, rows: changes });
      setUnsaved(false);
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function publish(publish: boolean) {
    if (readOnly) return;
    if (!window.confirm(t(publish ? "confirmPublish" : "confirmUnpublish")))
      return;
    setBusy(true);
    setError("");
    try {
      await api("/api/staff/publish-grades", {
        offering_id: o.id,
        rows: data.grades.map((g) => ({
          student_id: g.student_id,
          version: g.version,
        })),
        publish,
      });
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!data.enrollments.length) return <Empty />;
  return (
    <>
      <Notice error={error} />
      {readOnly && (
        <p className="notice">
          {locale === "th"
            ? "ดูผลการเรียนในฐานะครูประจำชั้น วิชานี้ไม่ได้มอบหมายให้คุณสอน จึงดูได้อย่างเดียว"
            : "Homeroom view: this course is not assigned to you and is read only."}
        </p>
      )}
      <section className="panel">
        <div className="grade-toolbar">
          <span className={`status ${dirty ? "dirty" : ""}`} aria-live="polite">
            {t(dirty ? "unsaved" : "allSaved")}{" "}
            {dirty ? `(${changes.length})` : ""}
          </span>
          <button
            className="button primary"
            onClick={save}
            disabled={readOnly || busy || !dirty || invalid}
          >
            <Save size={15} />
            {t(busy ? "saving" : "saveGrades")}
          </button>
          <button
            className="button"
            onClick={() => publish(true)}
            disabled={readOnly || busy || dirty || !data.grades.length}
          >
            <Send size={15} />
            {t("publish")}
          </button>
          <button
            className="button"
            onClick={() => publish(false)}
            disabled={
              readOnly ||
              busy ||
              dirty ||
              !data.grades.some((g) => g.state === "PUBLISHED")
            }
          >
            {t("unpublish")}
          </button>
          {!readOnly && (
            <ResetCourseGrades
              offering={o.id}
              rows={data.grades}
              disabled={busy || dirty || !data.grades.length}
              onSaved={onSaved}
            />
          )}
        </div>
        {invalid && <Notice error={t("invalidScore")} />}
        <div className="table-wrap">
          <table className="gradebook-table">
            <thead>
              <tr>
                <th>{t("rollNumber")}</th>
                <th>{t("studentNumber")}</th>
                <th>{t("name")}</th>
                <th>
                  {manual ? t("result") : `${t("score")} / ${o.max_score}`}
                </th>
                <th>{t("grade")}</th>
                <th>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {data.enrollments.map((e, i) => {
                const g = data.grades.find(
                  (g) => g.student_id === e.student_id,
                );
                const v = drafts[e.student_id] || {
                  score:
                    g?.score === null || g?.score === undefined
                      ? ""
                      : String(g.score),
                  result: g?.result || "",
                };
                const preview = manual
                  ? v.result
                  : o.grading_type === "NUMERIC_GRADE"
                    ? gradePreview(
                        v.score,
                        o.max_score,
                        scheme?.grade_scheme_rules || [],
                      )
                    : passPreview(v.score, o.max_score, o.pass_threshold);
                const invalid = v.score !== "" && !manual && preview === null;
                const enter = (event: React.KeyboardEvent) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    const step = event.shiftKey ? -1 : 1;
                    for (
                      let index = i + step;
                      index >= 0 && index < inputs.current.length;
                      index += step
                    ) {
                      const next = inputs.current[index];
                      if (!next || next.disabled) continue;
                      next.focus();
                      if (next instanceof HTMLInputElement) next.select();
                      break;
                    }
                  }
                };
                return (
                  <tr
                    key={e.student_id}
                    className={drafts[e.student_id] ? "dirty-row" : ""}
                  >
                    <td>{e.roll_number ?? "—"}</td>
                    <td className="id-text">{e.students.student_number}</td>
                    <td>
                      <Link
                        className="student-name-link"
                        href={`/teacher/students/${e.student_id}?term=${o.term_id}`}
                      >
                        {e.students.first_name} {e.students.last_name}
                      </Link>
                      {!e.students.active && (
                        <small className="subline">{t("inactive")}</small>
                      )}
                    </td>
                    <td>
                      {manual ? (
                        <Select
                          aria-label={`${t("result")} ${e.students.student_number}`}
                          ref={(el) => {
                            inputs.current[i] = el;
                          }}
                          value={v.result}
                          disabled={
                            busy ||
                            readOnly ||
                            !e.students.active ||
                            g?.state === "PUBLISHED"
                          }
                          onKeyDown={enter}
                          onChange={(event) =>
                            change(e.student_id, "result", event.target.value)
                          }
                        >
                          <option value="">—</option>
                          <option value="PASS">{t("pass")}</option>
                          <option value="FAIL">{t("fail")}</option>
                        </Select>
                      ) : (
                        <input
                          ref={(el) => {
                            inputs.current[i] = el;
                          }}
                          aria-label={`${t("score")} ${e.students.student_number}`}
                          aria-invalid={invalid}
                          className={`grade-input ${invalid ? "invalid" : ""}`}
                          type="text"
                          inputMode="decimal"
                          value={v.score}
                          maxLength={12}
                          disabled={
                            busy ||
                            readOnly ||
                            !e.students.active ||
                            g?.state === "PUBLISHED"
                          }
                          onKeyDown={enter}
                          onChange={(event) =>
                            change(e.student_id, "score", event.target.value)
                          }
                        />
                      )}
                    </td>
                    <td>
                      <strong className={gradeTone(preview)}>
                        {preview === null || preview === ""
                          ? "—"
                          : preview === "PASS"
                            ? t("pass")
                            : preview === "FAIL"
                              ? t("fail")
                              : Number(preview).toFixed(1)}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`badge ${g?.state === "PUBLISHED" && !drafts[e.student_id] ? "green" : "amber"}`}
                      >
                        {t(
                          drafts[e.student_id]
                            ? "draft"
                            : g?.state === "PUBLISHED"
                              ? "published"
                              : g
                                ? "draft"
                                : "notRecorded",
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
