"use client";
import { PasswordInput } from "./ui";
import { useState } from "react";
import { BookOpen, ArrowRight, ShieldCheck, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useBranding, useLocale, Preferences } from "./providers";
import { api, Field, Notice, useError } from "./ui";
export function Login({ studentEnabled = true }: { studentEnabled?: boolean }) {
  const { t } = useLocale();
  const school = useBranding();
  const errorText = useError();
  const [kind, setKind] = useState<"teacher" | "student">("teacher");
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
          <p className="muted">{t("loginDescription")}</p>
          {!studentEnabled && <p className="notice">{t("teacherBeta")}</p>}
          {studentEnabled && (
            <div className="segmented">
              {(["teacher", "student"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={k === kind}
                  className={k === kind ? "selected" : ""}
                  onClick={() => {
                    setKind(k);
                    setError("");
                  }}
                >
                  {t(k)}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={submit} key={kind}>
            <Field label={t(kind === "teacher" ? "email" : "studentNumber")}>
              <input
                required
                name="identifier"
                type={kind === "teacher" ? "email" : "text"}
                autoComplete="username"
                maxLength={254}
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
                maxLength={128}
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
          <p className="footnote">{t("loginHint")}</p>
        </div>
      </section>
    </main>
  );
}
