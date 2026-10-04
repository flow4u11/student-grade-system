"use client";
import { PasswordInput } from "./ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginBase } from "@/lib/accounts";
import { useBranding, useLocale, Preferences } from "./providers";
import { api, Field, Notice, useError } from "./ui";
export function RegisterTeacher() {
  const school = useBranding();
  const router = useRouter();
  const { t, locale } = useLocale();
  const th = locale === "th";
  const errorText = useError();
  const [first, setFirst] = useState(""),
    [last, setLast] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [created, setCreated] = useState<{
      username: string;
      password: string;
    } | null>(null);
  let base = "";
  try {
    base = loginBase(first, last);
  } catch {}
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const password = String(f.get("password"));
      const result = await api<{ username: string }>("/api/register", {
        first_name: first,
        last_name: last,
        first_name_th: f.get("first_name_th"),
        last_name_th: f.get("last_name_th"),
        password,
        code: f.get("code"),
        confirmed: f.has("confirmed"),
      });
      setCreated({ ...result, password });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function signIn() {
    if (!created) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", {
        kind: "teacher",
        identifier: created.username,
        password: created.password,
      });
      router.push("/teacher/profile");
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <main
      className="dialog-body"
      style={{ maxWidth: 680, margin: "32px auto" }}
    >
      <Preferences />
      <Link className="text-link" href="/login">
        ← {t("signIn")}
      </Link>
      <h1>{t("registerTeacher")}</h1>
      <p>{school.name}</p>
      <Notice error={error} />
      {created ? (
        <section className="panel dialog-body">
          <h2>{th ? "สร้างบัญชีแล้ว" : "Account created"}</h2>
          <p>
            {th
              ? "ชื่อบัญชีสำหรับเข้าสู่ระบบ กรุณาเก็บไว้"
              : "Keep your generated login identifier:"}
          </p>
          <input
            readOnly
            value={created.username}
            aria-label={th ? "ชื่อบัญชี" : "Login identifier"}
            onFocus={(e) => e.currentTarget.select()}
          />
          <p>
            {th
              ? "ขั้นต่อไป บอกวิชาและห้องที่สอนเพื่อให้ผู้ดูแลมอบหมายงาน"
              : "Next, tell your administrator which subjects and classrooms you teach."}
          </p>
          <button className="button primary" onClick={signIn} disabled={busy}>
            {th ? "เข้าสู่ระบบและตั้งค่าโปรไฟล์" : "Sign in and set up profile"}
          </button>
        </section>
      ) : (
        <>
          <p className="hint">
            {th
              ? "1. ขอรหัสเชิญจากผู้ดูแล → 2. กรอกชื่อและตั้งรหัสผ่าน → 3. ตั้งค่าโปรไฟล์"
              : "1. Get an invitation → 2. Enter your name and password → 3. Set up your profile"}
          </p>
          {!school.registration_open && (
            <div className="notice">
              {th
                ? "ยังไม่มีรหัสเชิญที่เปิดใช้งาน ผู้ดูแลสามารถกด ‘เชิญครู’ บนแถบด้านบนเพื่อสร้างรหัส แล้วส่งให้คุณนำมากรอกที่นี่"
                : "No active invitation. Ask your administrator to choose Invite teacher in the top bar and send you a code."}
            </div>
          )}
          <form className="panel dialog-body" onSubmit={submit}>
            <div className="form-grid">
              <Field label={th ? "ชื่อ (ภาษาไทย)" : "First name (Thai)"}>
                <input
                  name="first_name_th"
                  required
                  maxLength={120}
                  autoComplete="given-name"
                />
              </Field>
              <Field label={th ? "นามสกุล (ภาษาไทย)" : "Last name (Thai)"}>
                <input
                  name="last_name_th"
                  required
                  maxLength={120}
                  autoComplete="family-name"
                />
              </Field>

              <Field label={th ? "ชื่อ (ภาษาอังกฤษ)" : "First name (English)"}>
                <input
                  required
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  maxLength={120}
                  autoComplete="given-name"
                />
              </Field>
              <Field
                label={th ? "นามสกุล (ภาษาอังกฤษ)" : "Last name (English)"}
              >
                <input
                  required
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                  maxLength={120}
                  autoComplete="family-name"
                />
              </Field>
              <p className="hint wide">
                {base ? `${base}@${school.login_domain}` : "—"} ·{" "}
                {th
                  ? "หากซ้ำ ระบบจะเติมเลขท้ายให้อัตโนมัติ ชื่อนี้ใช้เข้าสู่ระบบ ไม่ใช่กล่องรับอีเมล"
                  : "A numeric suffix is added for duplicates. This is a login identifier, not an email mailbox."}
              </p>
              <Field
                label={t("password")}
                hint={th ? "อย่างน้อย 12 ตัวอักษร" : "At least 12 characters"}
              >
                <PasswordInput
                  name="password"
                  required
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </Field>
              <Field
                label={
                  th
                    ? "รหัสเชิญจากผู้ดูแล"
                    : "Invitation code from administrator"
                }
              >
                <PasswordInput
                  aria-label={
                    th
                      ? "รหัสเชิญจากผู้ดูแล"
                      : "Invitation code from administrator"
                  }
                  name="code"
                  required
                  type="password"
                  minLength={20}
                  maxLength={100}
                  autoComplete="off"
                />
              </Field>
              <label className="field check wide">
                <input name="confirmed" type="checkbox" required />
                <span>
                  {th
                    ? "ฉันตรวจชื่อทางการแล้ว และเข้าใจว่าชื่อ นามสกุล และชื่อบัญชีจะเปลี่ยนเองไม่ได้"
                    : "I checked my official name and understand that I cannot change my official name or login identifier myself."}
                </span>
              </label>
            </div>
            <button className="button primary" disabled={busy || !base}>
              {th ? "ยืนยันสมัครครู" : "Create teacher account"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
