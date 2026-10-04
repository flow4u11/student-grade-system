"use client";
import { Select } from "./select";
import { ResetCourseGrades } from "./reset-course-grades";
import { isAdmin } from "@/lib/permissions";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, UserRound, Send } from "lucide-react";
import { useLoad, useSchool, useNavigationData } from "./data";
import { useLocale } from "./providers";
import { api, Empty, Loading, Notice, useError } from "./ui";
import { RecordEditor } from "./record-editor";
import { DeleteRecord } from "./delete-record";
import { gpa, gradePreview, passPreview, validDecimal } from "@/lib/grading";
import type { Grade, Offering, Student } from "@/lib/types";
type ProfileData = {
  student: Student & {
    enrollments: {
      term_id: string;
      class_id: string;
      roll_number: number | null;
    }[];
  };
  offerings: Offering[];
  grades: Grade[];
  neighbors: { previous?: string | null; next?: string | null };
};
type Draft = { score: string; result: string };
gsap.registerPlugin(useGSAP);
export function StudentProfile({ id }: { id: string }) {
  const { term, studentDirection } = useSchool();
  const stage = useRef<HTMLDivElement>(null);
  const { t } = useLocale();
  const errorText = useError();
  const { data, error, reload, revision, refreshing } = useLoad<ProfileData>(
    term ? `/api/staff/student-profile?student=${id}&term=${term}` : null,
  );
  const ready = Boolean(data);
  useGSAP(
    () => {
      if (!stage.current || !ready) return;
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          stage.current,
          { x: studentDirection === "next" ? 20 : -20, opacity: 0.72 },
          {
            x: 0,
            opacity: 1,
            duration: 0.26,
            ease: "power3.out",
            clearProps: "transform,opacity",
          },
        );
      });
      return () => media.revert();
    },
    { scope: stage, dependencies: [id, term, ready], revertOnUpdate: true },
  );
  if (!term) return <Empty description={t("noTermProfile")} />;
  if (error)
    return (
      <>
        <Notice error={errorText(error)} />
        <button className="button" onClick={reload}>
          {t("retry")}
        </button>
        <Link className="button" href="/teacher/students">
          {t("backStudents")}
        </Link>
      </>
    );
  if (!data) return <Loading />;
  return (
    <div ref={stage} className="student-transition">
      <ProfileGrades
        key={`${id}:${term}:${revision}`}
        data={data}
        reload={reload}
        refreshing={refreshing}
      />
    </div>
  );
}
function ProfileGrades({
  data,
  reload,
  refreshing,
}: {
  data: ProfileData;
  reload: () => void;
  refreshing: boolean;
}) {
  const router = useRouter();
  const {
    meta,
    term,
    setUnsaved,
    refresh: refreshMeta,
    setStudentDirection,
  } = useSchool();
  const { prime } = useNavigationData();
  const stage = useRef<HTMLFieldSetElement>(null);
  const { contextSafe } = useGSAP({ scope: stage });
  function slideOut(direction: "next" | "previous") {
    return contextSafe(() => {
      if (
        !stage.current ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return Promise.resolve();
      return new Promise<void>((resolve) => {
        gsap.to(stage.current, {
          x: direction === "next" ? -16 : 16,
          opacity: 0.65,
          duration: 0.14,
          ease: "power2.inOut",
          onComplete: resolve,
          onInterrupt: resolve,
          overwrite: true,
        });
      });
    })();
  }
  const { t, locale } = useLocale();
  const errorText = useError();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({}),
    [working, setBusy] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState<"next" | "previous" | null>(null);
  const busy = working || refreshing || !!moving;
  const inputs = useRef<(HTMLInputElement | HTMLButtonElement | null)[]>([]);
  const navigationActive = useRef(true);
  const student = data.student;
  const gpaRows = data.grades.map((g) => ({
    ...data.offerings.find((o) => o.id === g.offering_id)!,
    ...g,
  }));
  const profileGpa = gpa(gpaRows);
  const counted = gpaRows.filter(
    (g) =>
      g.state === "PUBLISHED" &&
      g.grading_type === "NUMERIC_GRADE" &&
      g.include_in_gpa &&
      g.credits > 0 &&
      g.grade_points !== null,
  ).length;
  const cls = meta.classes.find(
    (c) =>
      c.id === student.enrollments.find((e) => e.term_id === term)?.class_id,
  );
  const offerings = [...data.offerings].sort((a, b) =>
    (
      meta.subjects.find((s) => s.id === a.subject_id)?.code || ""
    ).localeCompare(
      meta.subjects.find((s) => s.id === b.subject_id)?.code || "",
      locale,
      { numeric: true },
    ),
  );
  const original = (id: string): Draft => {
    const g = data.grades.find((g) => g.offering_id === id);
    return {
      score: g?.score == null ? "" : String(g.score),
      result: g?.result || "",
    };
  };
  const manual = (o: Offering) =>
    o.grading_type === "PASS_FAIL" && o.pass_mode === "MANUAL";
  const dirty = Object.keys(drafts).length > 0;
  const invalid = Object.entries(drafts).some(([id, v]) => {
    const o = offerings.find((o) => o.id === id)!;
    return manual(o)
      ? !["PASS", "FAIL"].includes(v.result)
      : !validDecimal(v.score) || Number(v.score) > o.max_score;
  });
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (
        dirty &&
        a?.getAttribute("href") &&
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
  useEffect(() => {
    navigationActive.current = true;
    return () => {
      navigationActive.current = false;
      setUnsaved(false);
    };
  }, [setUnsaved]);
  function change(id: string, key: keyof Draft, value: string) {
    const next = {
      ...drafts,
      [id]: { ...(drafts[id] || original(id)), [key]: value },
    };
    const base = original(id);
    if (next[id].score === base.score && next[id].result === base.result)
      delete next[id];
    setDrafts(next);
    setUnsaved(Object.keys(next).length > 0);
  }
  function refresh() {
    if (dirty && !window.confirm(t("discard"))) return;
    setUnsaved(false);
    reload();
  }
  async function navigate(direction: "next" | "previous") {
    const id = data.neighbors[direction];
    if (!id || busy || (dirty && !window.confirm(t("discard")))) return;
    setError("");
    setMoving(direction);
    try {
      router.prefetch(`/teacher/students/${id}?term=${term}`);
      // Fetch before the route changes: keep the current student visible until
      // the next student's authorized data is ready for a single slide.
      await prime(`/api/staff/student-profile?student=${id}&term=${term}`);
      if (!navigationActive.current) return;
      await slideOut(direction);
      if (!navigationActive.current) return;
      setStudentDirection(direction);
      setUnsaved(false);
      router.push(`/teacher/students/${id}?term=${term}`, { scroll: false });
    } catch (e) {
      if (!navigationActive.current) return;
      setMoving(null);
      setError(errorText(e));
    }
  }
  async function write(publish?: boolean) {
    if (publish === undefined && (!dirty || invalid)) return;
    if (
      publish !== undefined &&
      !window.confirm(t(publish ? "confirmPublish" : "confirmUnpublish"))
    )
      return;
    setBusy(true);
    setError("");
    const rows =
      publish === undefined
        ? Object.entries(drafts).map(([offering_id, v]) => ({
            offering_id,
            version:
              data.grades.find((g) => g.offering_id === offering_id)?.version ||
              0,
            score: manual(offerings.find((o) => o.id === offering_id)!)
              ? null
              : v.score,
            result: manual(offerings.find((o) => o.id === offering_id)!)
              ? v.result
              : null,
          }))
        : data.grades
            .filter((g) =>
              publish ? g.state !== "PUBLISHED" : g.state === "PUBLISHED",
            )
            .map((g) => ({ offering_id: g.offering_id, version: g.version }));
    try {
      await api(
        `/api/staff/${publish === undefined ? "save-student-grades" : "publish-student-grades"}`,
        {
          student_id: student.id,
          term_id: term,
          rows,
          ...(publish === undefined ? {} : { publish }),
        },
      );
      setUnsaved(false);
      reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset
      ref={stage}
      className="student-stage"
      disabled={busy}
      aria-busy={busy}
    >
      <Link className="text-link back-link" href="/teacher/students">
        <ArrowLeft size={16} />
        {t("backStudents")}
      </Link>
      <div className="profile-hero student-hero">
        <span className="profile-avatar">
          <UserRound size={30} />
        </span>
        <div>
          <span className="eyebrow">{t("studentProfile")}</span>
          <h1>
            {student.first_name} {student.last_name}
          </h1>
          <div className="identity">
            <span>
              {t("studentNumber")} {student.student_number}
            </span>
            <span className="badge green">{cls?.name || "—"}</span>
            <span className="badge">
              {t(student.active ? "active" : "inactive")}
            </span>
          </div>
        </div>
        <strong
          className="gpa-minimal"
          tabIndex={0}
          aria-label={`GPA ${profileGpa ?? "—"} · ${counted} ${t("gpaSubjects")}${!isAdmin(meta.profile.role) && !meta.homerooms.some((h) => h.term_id === term && h.class_id === student.enrollments.find((e) => e.term_id === term)?.class_id) ? ` · ${t("assignedResultsOnly")}` : ""}`}
        >
          GPA {profileGpa ?? "—"}
          <span className="gpa-tooltip">
            {counted} {t("gpaSubjects")}
          </span>
        </strong>
        {
          <div className="row-actions">
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                if (!dirty || window.confirm(t("discard"))) {
                  if (dirty) {
                    setDrafts({});
                    setUnsaved(false);
                  }
                  setEditing(true);
                }
              }}
            >
              {t("profileEdit")}
            </button>
            {!dirty && isAdmin(meta.profile.role) && (
              <DeleteRecord
                kind="students"
                id={student.id}
                label={`${student.first_name} ${student.last_name}`}
                onDeleted={() => router.push("/teacher/students")}
              />
            )}
          </div>
        }
      </div>
      <div className="grading-navigation">
        <div
          className="student-stepper"
          aria-label={
            locale === "th" ? "เปลี่ยนนักเรียน" : "Student navigation"
          }
        >
          <button
            className="button"
            type="button"
            disabled={busy || !data.neighbors.previous}
            onClick={() => navigate("previous")}
          >
            ← {locale === "th" ? "คนก่อนหน้า" : "Previous student"}
          </button>
          <button
            className="button"
            type="button"
            disabled={busy || !data.neighbors.next}
            onClick={() => navigate("next")}
          >
            {locale === "th" ? "นักเรียนคนถัดไป" : "Next student"} →
          </button>
        </div>
        <div className="mode-switch">
          <Link
            className="button"
            href={`/teacher/gradebook?student=${student.id}&term=${term}&offering=${offerings[0]?.id || ""}`}
          >
            {t("bySubject")}
          </Link>
          <span className="button primary">{t("byStudent")}</span>
          <Link className="text-link" href="/teacher/guide">
            {t("guideLink")}
          </Link>
        </div>
      </div>
      <p className="hint grading-hint">{t("studentGradesHint")}</p>
      <Notice error={error} />
      {error && (
        <button className="button" onClick={refresh}>
          {t("reloadGrades")}
        </button>
      )}
      {!offerings.length ? (
        <section className="panel">
          <Empty description={t("noStudentSubjects")} />
          {isAdmin(meta.profile.role) && (
            <div className="empty-actions">
              <Link className="button primary" href="/teacher/subjects">
                {t("offerings")}
              </Link>
            </div>
          )}
        </section>
      ) : (
        <section className="panel profile-grade-panel">
          <div className="grade-toolbar sticky-save">
            <span
              className={`status ${dirty ? "dirty" : ""}`}
              aria-live="polite"
            >
              {t(dirty ? "unsaved" : "allSaved")}
              {dirty ? ` (${Object.keys(drafts).length})` : ""}
            </span>
            <button
              className="button primary"
              disabled={busy || !dirty || invalid || !student.active}
              onClick={() => write()}
            >
              <Save size={16} />
              {t(busy ? "saving" : "saveAllSubjects")}
            </button>
            <button
              className="button"
              disabled={
                busy || dirty || !data.grades.some((g) => g.state === "DRAFT")
              }
              onClick={() => write(true)}
            >
              <Send size={16} />
              {t("publish")}
            </button>
            <button
              className="button"
              disabled={
                busy ||
                dirty ||
                !data.grades.some((g) => g.state === "PUBLISHED")
              }
              onClick={() => write(false)}
            >
              {t("unpublish")}
            </button>
          </div>
          {invalid && <Notice error={t("invalidScore")} />}
          <div className="table-wrap">
            <table className="profile-grade-table">
              <thead>
                <tr>
                  <th>{t("subject")}</th>
                  <th>
                    {t("score")} / {t("result")}
                  </th>
                  <th>{t("grade")}</th>
                  <th>{t("status")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((o, i) => {
                  const sub = meta.subjects.find((s) => s.id === o.subject_id);
                  const g = data.grades.find((g) => g.offering_id === o.id);
                  const value = drafts[o.id] || original(o.id);
                  const scheme = meta.schemes.find((s) => s.id === o.scheme_id);
                  const preview = manual(o)
                    ? value.result
                    : o.grading_type === "NUMERIC_GRADE"
                      ? gradePreview(
                          value.score,
                          o.max_score,
                          scheme?.grade_scheme_rules || [],
                        )
                      : passPreview(value.score, o.max_score, o.pass_threshold);
                  const bad =
                    !!drafts[o.id] &&
                    (manual(o) ? !value.result : preview === null);
                  const enter = (e: React.KeyboardEvent) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const next = inputs.current[i + (e.shiftKey ? -1 : 1)];
                      next?.focus();
                      if (next instanceof HTMLInputElement) next.select();
                    }
                  };
                  const label = `${t(manual(o) ? "result" : "score")} ${sub?.code}`;
                  return (
                    <tr key={o.id} className={drafts[o.id] ? "dirty-row" : ""}>
                      <td>
                        <strong>
                          {locale === "th" ? sub?.name_th : sub?.name_en}
                        </strong>
                        <span className="subline">
                          {sub?.code} · {o.credits} {t("credits")}{" "}
                          {o.archived && ` · ${t("archived")}`}
                        </span>
                      </td>
                      <td data-label={t("score")}>
                        {manual(o) ? (
                          <Select
                            aria-label={label}
                            aria-invalid={bad}
                            disabled={
                              busy ||
                              !student.active ||
                              o.archived ||
                              g?.state === "PUBLISHED"
                            }
                            value={value.result}
                            ref={(el) => {
                              inputs.current[i] = el;
                            }}
                            onKeyDown={enter}
                            onChange={(e) =>
                              change(o.id, "result", e.target.value)
                            }
                          >
                            <option value="">—</option>
                            <option value="PASS">{t("pass")}</option>
                            <option value="FAIL">{t("fail")}</option>
                          </Select>
                        ) : (
                          <div className="score-cell">
                            <input
                              className={`grade-input ${bad ? "invalid" : ""}`}
                              aria-label={label}
                              aria-invalid={bad}
                              type="text"
                              inputMode="decimal"
                              maxLength={12}
                              disabled={
                                busy ||
                                !student.active ||
                                o.archived ||
                                g?.state === "PUBLISHED"
                              }
                              value={value.score}
                              ref={(el) => {
                                inputs.current[i] = el;
                              }}
                              onKeyDown={enter}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) =>
                                change(o.id, "score", e.target.value)
                              }
                            />
                            <span>/ {o.max_score}</span>
                          </div>
                        )}
                      </td>
                      <td data-label={t("grade")}>
                        <strong className="grade-preview">
                          {preview === null || preview === ""
                            ? "—"
                            : preview === "PASS"
                              ? t("pass")
                              : preview === "FAIL"
                                ? t("fail")
                                : Number(preview).toFixed(1)}
                        </strong>
                      </td>
                      <td data-label={t("status")}>
                        <span
                          className={`badge ${g?.state === "PUBLISHED" && !drafts[o.id] ? "green" : "amber"}`}
                        >
                          {t(
                            drafts[o.id]
                              ? "draft"
                              : g?.state === "PUBLISHED"
                                ? "published"
                                : g
                                  ? "draft"
                                  : "notRecorded",
                          )}
                        </span>
                      </td>
                      <td>
                        {g && (
                          <ResetCourseGrades
                            offering={o.id}
                            learner={student.id}
                            version={g.version}
                            disabled={busy || dirty}
                            onSaved={reload}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="panel-footnote">{t("saveDraftHint")}</p>
        </section>
      )}
      {editing && (
        <RecordEditor
          kind="students"
          record={{
            ...student,
            class_id: cls?.id || "",
            roll_number:
              student.enrollments.find((e) => e.term_id === term)
                ?.roll_number ?? null,
            term_id: term,
          }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
            refreshMeta();
          }}
        />
      )}
    </fieldset>
  );
}
