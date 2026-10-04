"use client";
import { Select } from "./select";
import { academicYear } from "@/lib/presentation";
import { useState } from "react";
import { BookOpen, LogOut, ShieldCheck } from "lucide-react";
import { useLocale, Preferences } from "./providers";
import { api, Empty, Notice, useError } from "./ui";
import { gpa } from "@/lib/grading";
import type { Portal } from "@/lib/types";
export function StudentPortal({ data }: { data: Portal }) {
  const { t, locale } = useLocale();
  const errorText = useError();
  const [term, setTerm] = useState(
    data.enrollments.find((e) => e.active)?.term_id ||
      data.enrollments[0]?.term_id ||
      "",
  );
  const [error, setError] = useState("");
  const grades = data.grades.filter((g) => g.term_id === term);
  const enrollment = data.enrollments.find((e) => e.term_id === term);
  async function logout() {
    try {
      await api("/api/auth/logout", {});
      window.location.replace(new URL("/login", window.location.origin).href);
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <main className="student-page">
      <header className="student-header">
        <a className="brand" href="/student">
          <span className="brand-icon">
            <BookOpen size={22} />
          </span>
          <strong>{t("appName")}</strong>
        </a>
        <div>
          <Preferences />
          <button className="button small" onClick={logout}>
            <LogOut size={15} />
            {t("signOut")}
          </button>
        </div>
      </header>
      <Notice error={error} />
      <section className="student-hero">
        <div>
          <span className="eyebrow">{t("studentPortal")}</span>
          <h1>
            {data.student.first_name} {data.student.last_name}
          </h1>
          <p className="muted">{t("studentWelcome")}</p>
          <div className="identity">
            <span>
              {t("studentNumber")}: {data.student.student_number}
            </span>
            <span>
              {t("class")}: {enrollment?.class_name || "—"}
            </span>
          </div>
        </div>
        <div className="gpa-card">
          <small>{t("gpa")}</small>
          <strong>{gpa(grades) || "—"}</strong>
        </div>
      </section>
      <div className="toolbar">
        <label className="field" style={{ margin: 0 }}>
          <span>{t("term")}</span>
          <Select value={term} onChange={(e) => setTerm(e.target.value)}>
            {data.enrollments.map((e) => (
              <option key={e.term_id} value={e.term_id}>
                {academicYear(e.academic_year, locale)} · {e.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{t("myResults")}</h2>
            <p>{t("publishedNotice")}</p>
          </div>
          <ShieldCheck size={22} />
        </div>
        {!grades.length ? (
          <Empty description={t("noGrades")} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("subject")}</th>
                  <th>{t("score")}</th>
                  <th>{t("credits")}</th>
                  <th>{t("result")}</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g) => (
                  <tr key={g.code}>
                    <td>
                      <strong>{locale === "th" ? g.name_th : g.name_en}</strong>
                      <span className="subline">{g.code}</span>
                    </td>
                    <td data-label={t("score")}>
                      {g.score === null ? "—" : `${g.score} / ${g.max_score}`}
                    </td>
                    <td data-label={t("credits")}>{g.credits}</td>
                    <td data-label={t("result")}>
                      <span
                        className={`badge ${g.result === "FAIL" ? "amber" : "green"}`}
                      >
                        {g.result
                          ? t(g.result === "PASS" ? "pass" : "fail")
                          : g.grade_points?.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="hint">{t("gpaHint")}</p>
    </main>
  );
}
