"use client";
import { PasswordInput } from "./ui";
import { useState } from "react";
import { BookOpen, ArrowRight, ShieldCheck, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useBranding, useLocale, Preferences } from "./providers";
import { api, Field, Notice, useError } from "./ui";
export function Login({
  studentEnabled = false,
  kind = "teacher",
}: {
  studentEnabled?: boolean;
  kind?: "teacher" | "student";
}) {
  const { t, locale } = useLocale();
  const school = useBranding();
  const errorText = useError();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const data = await api<{ redirect: string }>("/api/auth/login", {
        kind,
        identifier: f.get("identifier"),
        password: f.get("password"),
      });
      try {
        sessionStorage.setItem("school_welcome", kind);
      } catch {}
      window.location.assign(data.redirect);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <BookOpen size={25} />
          <strong>{school.name}</strong>
        </div>
        <div>
          <span className="eyebrow">{t("institution")}</span>
          <h1>{t("tagline")}</h1>
          <div className="ledger-art" aria-hidden="true">
            <div className="art-row">
              <span />
              <span />
              <span />
            </div>
            <div className="art-row">
              <span />
              <span />
              <span />
            </div>
            <div className="art-row">
              <span />
              <span />
              <span />
            </div>
            <div className="art-check">
              <GraduationCap size={46} />
            </div>
          </div>
        </div>
        <p className="story-foot">
          <ShieldCheck size={18} />
          {t("privacyNote")}
        </p>
      </section>
      <section className="login-panel">
        <Preferences />
        <div className="login-form">
          <span className="eyebrow">
            {t(kind === "teacher" ? "teacherPortal" : "studentPortal")}
          </span>
          <h2>{t("loginTitle")}</h2>
          <p className="muted">
            {kind === "student"
              ? locale === "th"
                ? "ใช้รหัสนักเรียน 5 หลัก และรหัส PIN ที่ครูตั้งให้ เพื่อดูผลการเรียนของตนเอง"
                : "Use your five-digit student ID and teacher-issued PIN to view your own results."
              : t("loginDescription")}
          </p>
          {!studentEnabled && kind === "teacher" && (
            <p className="notice">{t("teacherBeta")}</p>
          )}
          <form onSubmit={submit} key={kind}>
            <Field label={t(kind === "teacher" ? "email" : "studentNumber")}>
              <input
                required
                name="identifier"
                type={kind === "teacher" ? "email" : "text"}
                autoComplete="username"
                inputMode={kind === "student" ? "numeric" : undefined}
                pattern={kind === "student" ? "[0-9]{5}" : undefined}
                minLength={kind === "student" ? 5 : undefined}
                maxLength={kind === "student" ? 5 : 254}
                placeholder={kind === "teacher" ? "name@school.ac.th" : "00123"}
              />
            </Field>
            <Field label={t(kind === "teacher" ? "password" : "pin")}>
              <PasswordInput
                aria-label={t(kind === "teacher" ? "password" : "pin")}
                required
                name="password"
                type="password"
                autoComplete="current-password"
                inputMode={kind === "student" ? "numeric" : undefined}
                pattern={kind === "student" ? "[0-9]{6,12}" : undefined}
                minLength={kind === "student" ? 6 : undefined}
                maxLength={kind === "student" ? 12 : 128}
              />
            </Field>
            <Notice error={error} />
            <button className="button primary full" disabled={busy}>
              {busy ? t("loading") : t("signIn")}
              <ArrowRight size={18} />
            </button>
          </form>
          {kind === "teacher" && (
            <Link className="button full register-link" href="/register">
              {t("registerTeacher")}
            </Link>
          )}
          {(studentEnabled || kind === "student") && (
            <Link
              className="text-link"
              href={kind === "teacher" ? "/student/login" : "/login"}
            >
              {kind === "teacher"
                ? locale === "th"
                  ? "เข้าสู่ระบบสำหรับนักเรียน"
                  : "Student sign-in"
                : locale === "th"
                  ? "เข้าสู่ระบบสำหรับครู"
                  : "Teacher sign-in"}
            </Link>
          )}
          <p className="footnote">{t("loginHint")}</p>
        </div>
      </section>
    </main>
  );
}
