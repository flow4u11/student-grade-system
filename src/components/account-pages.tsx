"use client";
import { Select } from "./select";
import Image from "next/image";
import { AppearanceFields, DisplaySettings } from "./appearance-settings";
import { Camera, UserRound } from "lucide-react";
import { ResetGrades } from "./reset-grades";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import type { Database } from "@/lib/database.types";
import { APP_VERSION } from "@/lib/version";
import { useLoad, useSchool } from "./data";
import { useBranding, useLocale } from "./providers";
import { api, Field, Loading, Notice, useError } from "./ui";
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Settings = Database["public"]["Tables"]["school_settings"]["Row"];
type Feedback = Database["public"]["Tables"]["feedback"]["Row"];
export function TeacherProfile() {
  const { t, locale } = useLocale();
  const th = locale === "th";
  const { meta, setAvatarUrl } = useSchool();
  const photoInput = useRef<HTMLInputElement>(null);
  const { data, error, reload } = useLoad<
    Profile & { avatar_url: string | null }
  >("/api/account/profile");
  const [busy, setBusy] = useState(false),
    [issue, setIssue] = useState(""),
    [saved, setSaved] = useState(false);
  const errorText = useError();
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = {
      ...Object.fromEntries(new FormData(e.currentTarget)),
      avatar: data?.avatar || "teacher",
    };
    setBusy(true);
    setIssue("");
    try {
      await api("/api/account/profile", value);
      setSaved(true);
      reload();
    } catch (e) {
      setIssue(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setIssue("");
    setSaved(false);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("tooLarge");
      const form = new FormData();
      form.set("photo", file);
      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const updated = await api<Profile & { avatar_url: string | null }>(
        "/api/account/profile",
      );
      setAvatarUrl(updated.avatar_url);
      setSaved(true);
    } catch (err) {
      setIssue(errorText(err));
    } finally {
      setBusy(false);
      input.value = "";
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("teacherProfile")}</h1>
          <p>
            {th
              ? "ชื่อทางการและชื่อบัญชีใช้ระบุตัวครู หากต้องการแก้ไขให้ติดต่อผู้ดูแล"
              : "Contact your administrator to correct your official name or login identifier."}
          </p>
        </div>
      </div>
      <Notice
        error={issue || (error && errorText(error))}
        message={saved ? t("saved") : undefined}
      />
      {!data ? (
        <Loading />
      ) : (
        <form
          className="panel dialog-body profile-form"
          onSubmit={save}
          key={data.updated_at}
        >
          <div className="profile-hero">
            <button
              type="button"
              className="profile-avatar avatar-upload"
              disabled={busy}
              onClick={() => photoInput.current?.click()}
              aria-label={th ? "เปลี่ยนรูปโปรไฟล์" : "Change profile photo"}
              title={
                th
                  ? "กดเพื่อเปลี่ยนรูป · JPG, PNG, WebP ไม่เกิน 2 MB"
                  : "Change photo · JPG, PNG, WebP up to 2 MB"
              }
            >
              {meta.profile.avatar_url || data.avatar_url ? (
                <Image
                  unoptimized
                  src={meta.profile.avatar_url || data.avatar_url!}
                  width={64}
                  height={64}
                  alt={th ? "รูปโปรไฟล์" : "Profile photo"}
                />
              ) : (
                <UserRound size={32} />
              )}
              <span className="avatar-camera">
                <Camera size={15} />
              </span>
            </button>
            <input
              className="hidden-photo-input"
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={upload}
              aria-label={th ? "ไฟล์รูปโปรไฟล์" : "Profile photo file"}
            />
            <div>
              <h2>
                {data.official_first_name_th
                  ? `${data.official_first_name_th} ${data.official_last_name_th}`
                  : data.official_first_name
                    ? `${data.official_first_name} ${data.official_last_name}`
                    : data.display_name}
              </h2>
              <p className="id-text">{data.school_username}</p>
              <span className="badge">{data.role}</span>
            </div>
          </div>
          {!data.onboarding_complete && (
            <p className="notice">
              {th
                ? "ยินดีต้อนรับคุณครู บอกวิชาและห้องที่สอนด้านล่างเพื่อให้ผู้ดูแลมอบหมายงาน ช่องอื่นข้ามได้"
                : "Welcome! Tell your administrator which subjects and classrooms you teach. Other fields are optional."}
            </p>
          )}
          <div className="form-grid">
            {(
              [
                ["nickname", th ? "ชื่อเล่น" : "Nickname"],
                ["contact_email", th ? "อีเมลติดต่อ" : "Contact email"],
                ["contact_phone", th ? "เบอร์โทร" : "Phone"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <input
                  name={k}
                  type={k === "contact_email" ? "email" : "text"}
                  maxLength={
                    k === "nickname" ? 60 : k === "contact_phone" ? 40 : 254
                  }
                  defaultValue={data[k]}
                />
              </Field>
            ))}
            <div className="wide">
              <Field
                label={
                  th ? "วิชาและห้องที่สอน" : "Subjects and classrooms taught"
                }
                hint={
                  th
                    ? "เช่น คณิตศาสตร์ ม.3/1, ม.3/2 — ผู้ดูแลจะเป็นผู้มอบหมายสิทธิ์ให้"
                    : "For example: Mathematics, M.3/1 and M.3/2. Your administrator grants access separately."
                }
              >
                <textarea
                  name="teaching_request"
                  maxLength={500}
                  defaultValue={data.teaching_request}
                  rows={3}
                />
              </Field>
            </div>
            <div className="wide">
              <Field
                label={th ? "เกี่ยวกับฉัน (ไม่บังคับ)" : "About me (optional)"}
              >
                <textarea
                  name="bio"
                  maxLength={500}
                  defaultValue={data.bio}
                  rows={3}
                />
              </Field>
            </div>
          </div>
          <div className="dialog-actions">
            <button className="button primary" disabled={busy}>
              {t(busy ? "saving" : "save")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
export function SchoolSettings() {
  const { meta } = useSchool();
  const { t, locale } = useLocale();
  const th = locale === "th";
  const admin = isAdmin(meta.profile.role);
  const router = useRouter();
  const { data, error, reload } = useLoad<{
    settings: Settings;
    invite: { expires_at: string; remaining: number } | null;
  }>(admin ? "/api/account/settings" : null);
  const [busy, setBusy] = useState(false),
    [issue, setIssue] = useState(""),
    [message, setMessage] = useState(""),
    [code, setCode] = useState("");
  const errorText = useError();
  if (!admin)
    return (
      <>
        <div className="page-heading">
          <div>
            <h1>{th ? "ตั้งค่า" : "Settings"}</h1>
            <p>School Ledger · v{APP_VERSION}</p>
          </div>
        </div>
        <DisplaySettings />
      </>
    );
  async function send(action: string, value: unknown) {
    setBusy(true);
    setIssue("");
    setMessage("");
    try {
      const r = await api<{ code?: string }>(`/api/account/${action}`, value);
      if (r.code) setCode(r.code);
      else if (action === "close-registration") setCode("");
      setMessage(t("saved"));
      reload();
      router.refresh();
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
          <h1>{t("schoolSettings")}</h1>
          <p>School Ledger · v{APP_VERSION}</p>
        </div>
      </div>
      <DisplaySettings />
      <Notice error={issue || (error && errorText(error))} message={message} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <form
            className="panel dialog-body"
            key={JSON.stringify(data.settings)}
            onSubmit={(e) => {
              e.preventDefault();
              void send(
                "settings",
                Object.fromEntries(new FormData(e.currentTarget)),
              );
            }}
          >
            <AppearanceFields initial={data.settings} />
            <fieldset className="settings-section">
              <legend>{th ? "ข้อมูลโรงเรียน" : "School information"}</legend>
              <div className="form-grid">
                {(
                  [
                    ["name", th ? "ชื่อโรงเรียน" : "School name"],
                    ["short_name", th ? "ชื่อย่อ" : "Short name"],
                    [
                      "login_domain",
                      th ? "โดเมนสำหรับชื่อบัญชี" : "School login domain",
                    ],
                    [
                      "logo_url",
                      th
                        ? "ลิงก์โลโก้ HTTPS (ไม่บังคับ)"
                        : "HTTPS logo URL (optional)",
                    ],
                  ] as const
                ).map(([k, label]) => (
                  <Field key={k} label={label}>
                    <input
                      name={k}
                      required={k !== "logo_url"}
                      type={k === "logo_url" ? "url" : "text"}
                      maxLength={
                        k === "logo_url"
                          ? 500
                          : k === "short_name"
                            ? 40
                            : k === "name"
                              ? 120
                              : 180
                      }
                      defaultValue={data.settings[k]}
                    />
                  </Field>
                ))}
                <p className="hint wide">
                  {th
                    ? "การเปลี่ยนโดเมนใช้กับบัญชีใหม่เท่านั้น ชื่อบัญชีนี้ไม่ได้สร้างกล่องรับอีเมล"
                    : "A domain change affects new accounts only. Login identifiers do not create email mailboxes."}
                </p>
              </div>
            </fieldset>
            <fieldset className="settings-section">
              <legend>
                {th ? "ค่าเริ่มต้นการเรียน" : "Academic defaults"}
              </legend>
              <div className="form-grid">
                <Field label={th ? "ภาษาเริ่มต้น" : "Default language"}>
                  <Select
                    name="default_language"
                    defaultValue={data.settings.default_language}
                  >
                    <option value="th">ไทย</option>
                    <option value="en">English</option>
                  </Select>
                </Field>
                <Field label={t("scheme")}>
                  <Select
                    name="default_scheme_id"
                    defaultValue={data.settings.default_scheme_id || ""}
                  >
                    <option value="">—</option>
                    {meta.schemes
                      .filter((s) => !s.archived)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                <p className="hint wide">
                  {th
                    ? "ปีการศึกษาแสดง พ.ศ. เมื่อเลือกไทย และ ค.ศ. เมื่อเลือกอังกฤษ"
                    : "Academic years display BE in Thai and CE in English."}
                </p>
              </div>
            </fieldset>
            <fieldset className="settings-section">
              <legend>{th ? "ติดต่อและช่วยเหลือ" : "Contact & support"}</legend>
              <div className="form-grid">
                <div className="wide">
                  <Field
                    label={
                      th
                        ? "ข้อมูลติดต่อ / สนับสนุนโปรเจกต์ (แสดงในคู่มือ)"
                        : "Contact / Support Project information (shown in Help)"
                    }
                  >
                    <textarea
                      rows={3}
                      name="support_info"
                      maxLength={1000}
                      defaultValue={data.settings.support_info}
                    />
                  </Field>
                </div>
              </div>
            </fieldset>
            <div className="dialog-actions">
              <button className="button primary" disabled={busy}>
                {t("save")}
              </button>
            </div>
          </form>
          <section
            id="teacher-invitations"
            className="panel dialog-body"
            style={{ marginTop: 24 }}
          >
            <h2>{t("registerTeacher")}</h2>
            <p className="hint">
              {th
                ? "1. สร้างรหัสเชิญ  2. ส่งรหัสและลิงก์สมัครให้ครู  3. มอบหมายวิชาเมื่อครูสมัครแล้ว"
                : "1. Generate a code  2. Share it with the registration link  3. Assign courses after registration"}
            </p>
            <Link className="text-link" href="/register" target="_blank">
              {th ? "เปิดหน้าสมัครครู ↗" : "Open teacher registration ↗"}
            </Link>
            <p>
              {th
                ? "ส่งรหัสให้ครูที่รู้จักเท่านั้น ครูใหม่จะยังไม่เห็นข้อมูลนักเรียนจนกว่าผู้ดูแลจะมอบหมายวิชา"
                : "Share codes only with known teachers. New teachers cannot see students until assigned courses."}
            </p>
            {data.invite && (
              <p>
                {th ? "จำนวนที่สมัครได้อีก" : "Uses remaining"}:{" "}
                {data.invite.remaining} · {th ? "หมดอายุ" : "Expires"}{" "}
                {new Date(data.invite.expires_at).toLocaleString(
                  th ? "th-TH" : "en-GB",
                )}
              </p>
            )}
            <form
              className="toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  !window.confirm(
                    th
                      ? "สร้างรหัสใหม่และยกเลิกรหัสเดิม?"
                      : "Create a new code and revoke the previous code?",
                  )
                )
                  return;
                const f = new FormData(e.currentTarget);
                void send("invite", {
                  days: Number(f.get("days")),
                  max_uses: Number(f.get("max_uses")),
                });
              }}
            >
              <Field label={th ? "ใช้ได้กี่วัน" : "Valid days"}>
                <input
                  name="days"
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={7}
                  required
                />
              </Field>
              <Field label={th ? "จำนวนบัญชีสูงสุด" : "Maximum accounts"}>
                <input
                  name="max_uses"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={5}
                  required
                />
              </Field>
              <button className="button" disabled={busy}>
                {th ? "สร้างรหัสเชิญ" : "Generate invitation code"}
              </button>
              {data.invite && (
                <button
                  className="button danger"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        th
                          ? "ปิดการสมัครด้วยรหัสปัจจุบัน?"
                          : "Close registration with the current code?",
                      )
                    )
                      void send("close-registration", {});
                  }}
                >
                  {th ? "ปิดการสมัคร" : "Close registration"}
                </button>
              )}
            </form>
            {code && (
              <div className="notice">
                <p>
                  {th
                    ? "รหัสแสดงครั้งนี้เท่านั้น คัดลอกเก็บไว้และส่งให้ครูโดยตรง"
                    : "Shown once. Copy and share privately with the teacher."}
                </p>
                <button
                  type="button"
                  className="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `${th ? "สมัครบัญชีครู" : "Teacher registration"}: ${window.location.origin}/register\n${th ? "รหัสเชิญ" : "Invitation code"}: ${code}`,
                      );
                      setMessage(
                        th
                          ? "คัดลอกรหัสพร้อมลิงก์แล้ว"
                          : "Code and link copied",
                      );
                    } catch {
                      setIssue(
                        th
                          ? "คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกคัดลอกรหัสด้านล่าง"
                          : "Please select and copy the code below",
                      );
                    }
                  }}
                >
                  {th
                    ? "คัดลอกรหัสพร้อมลิงก์สมัคร"
                    : "Copy code and registration link"}
                </button>
                <input
                  readOnly
                  value={code}
                  aria-label={th ? "รหัสเชิญ" : "Invitation code"}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
            )}
          </section>
        </>
      )}
      <ResetGrades />
    </>
  );
}
export function FeedbackPage() {
  const { meta } = useSchool();
  const { t, locale } = useLocale();
  const th = locale === "th";
  const admin = isAdmin(meta.profile.role);
  const [page, setPage] = useState(0);
  const { data, error, reload } = useLoad<{ rows: Feedback[]; total: number }>(
    `/api/account/feedback?page=${page}`,
  );
  const [busy, setBusy] = useState(false),
    [issue, setIssue] = useState(""),
    [message, setMessage] = useState("");
  const errorText = useError();
  async function send(action: string, value: unknown) {
    setBusy(true);
    setIssue("");
    try {
      await api(`/api/account/${action}`, value);
      setMessage(t("saved"));
      reload();
      return true;
    } catch (e) {
      setIssue(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("feedback")}</h1>
          <p>
            {th
              ? "แจ้งปัญหาหรือเสนอสิ่งที่ช่วยให้ใช้งานง่ายขึ้น"
              : "Report a problem or suggest an improvement."}
          </p>
        </div>
      </div>
      <Notice error={issue || (error && errorText(error))} message={message} />
      <form
        className="panel dialog-body"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          if (await send("feedback", Object.fromEntries(new FormData(f))))
            f.reset();
        }}
      >
        <div className="form-grid">
          <Field label={th ? "ประเภท" : "Type"}>
            <Select name="type">
              <option value="PROBLEM">
                {th ? "ปัญหาการใช้งาน" : "Problem"}
              </option>
              <option value="SUGGESTION">
                {th ? "ข้อเสนอแนะ" : "Suggestion"}
              </option>
              <option value="FEATURE">
                {th ? "ฟีเจอร์ที่อยากได้" : "Feature request"}
              </option>
              <option value="OTHER">{th ? "อื่น ๆ" : "Other"}</option>
            </Select>
          </Field>
          <Field label={th ? "หน้าใด" : "Page"}>
            <Select name="page">
              {[
                "",
                "/teacher",
                "/teacher/students",
                "/teacher/gradebook",
                "/teacher/import",
                "/teacher/profile",
                "/teacher/settings",
              ].map((p) => (
                <option key={p} value={p}>
                  {p || "—"}
                </option>
              ))}
            </Select>
          </Field>
          <div className="wide">
            <Field
              label={th ? "รายละเอียด" : "Message"}
              hint={
                th
                  ? "ไม่ต้องใส่รหัสผ่านหรือข้อมูลส่วนตัวของนักเรียน"
                  : "Leave out passwords and private student details."
              }
            >
              <textarea name="message" required maxLength={3000} rows={4} />
            </Field>
          </div>
          <Field
            label={th ? "ช่องทางติดต่อ (ไม่บังคับ)" : "Contact (optional)"}
          >
            <input name="contact" maxLength={254} />
          </Field>
        </div>
        <div className="dialog-actions">
          <button className="button primary" disabled={busy}>
            {th ? "ส่งความคิดเห็น" : "Send feedback"}
          </button>
        </div>
      </form>
      <section className="panel dialog-body" style={{ marginTop: 24 }}>
        <h2>
          {admin
            ? th
              ? "ความคิดเห็นทั้งหมด"
              : "All feedback"
            : th
              ? "ความคิดเห็นของฉัน"
              : "My feedback"}
        </h2>
        {!data ? (
          <Loading />
        ) : (
          data.rows.map((f) => (
            <article key={f.id}>
              <span className="badge">
                {
                  (
                    {
                      PROBLEM: th ? "ปัญหา" : "Problem",
                      SUGGESTION: th ? "ข้อเสนอแนะ" : "Suggestion",
                      FEATURE: th ? "ฟีเจอร์ที่อยากได้" : "Feature request",
                      OTHER: th ? "อื่น ๆ" : "Other",
                    } as Record<string, string>
                  )[f.type]
                }
              </span>{" "}
              <small>
                {new Date(f.created_at).toLocaleDateString(
                  th ? "th-TH" : "en-GB",
                )}{" "}
                · {f.page}
              </small>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {f.message}
              </p>
              {admin && f.contact && <p>{f.contact}</p>}
              {admin ? (
                <label className="field">
                  <span>{t("status")}</span>
                  <Select
                    disabled={busy}
                    value={f.status}
                    onChange={(e) =>
                      send("review-feedback", {
                        feedback_id: f.id,
                        new_status: e.target.value,
                      })
                    }
                  >
                    <option value="NEW">{th ? "ยังไม่อ่าน" : "New"}</option>
                    <option value="READ">{th ? "อ่านแล้ว" : "Read"}</option>
                    <option value="DONE">{th ? "จัดการแล้ว" : "Done"}</option>
                  </Select>
                </label>
              ) : (
                <span className="badge">
                  {
                    (
                      {
                        NEW: th ? "ยังไม่อ่าน" : "New",
                        READ: th ? "อ่านแล้ว" : "Read",
                        DONE: th ? "จัดการแล้ว" : "Done",
                      } as Record<string, string>
                    )[f.status]
                  }
                </span>
              )}
              <hr />
            </article>
          ))
        )}
        {data && !data.rows.length && (
          <p>{th ? "ยังไม่มีความคิดเห็น" : "No feedback yet"}</p>
        )}
        <div className="toolbar">
          <button
            className="button"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            {th ? "ก่อนหน้า" : "Previous"}
          </button>
          <span>{page + 1}</span>
          <button
            className="button"
            disabled={!data || data.total <= (page + 1) * 25}
            onClick={() => setPage(page + 1)}
          >
            {th ? "ถัดไป" : "Next"}
          </button>
        </div>
      </section>
    </>
  );
}
export function SupportProject() {
  const school = useBranding();
  const { locale } = useLocale();
  return school.support_info ? (
    <section className="panel dialog-body">
      <h2>
        {locale === "th"
          ? "ติดต่อ / สนับสนุนโปรเจกต์"
          : "Contact / Support Project"}
      </h2>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {school.support_info}
      </p>
    </section>
  ) : null;
}
