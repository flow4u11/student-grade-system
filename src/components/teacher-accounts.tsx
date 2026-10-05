"use client";
import { Pencil, Search, UserRound } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useLoad, useSchool } from "./data";
import { useLocale } from "./providers";
import { api, Field, Loading, Modal, Notice, useError } from "./ui";
type Teacher = {
  id: string;
  display_name: string;
  school_username: string | null;
  role: string;
  active: boolean;
  updated_at: string;
  official_first_name_th: string;
  official_last_name_th: string;
  official_first_name: string;
  official_last_name: string;
  nickname: string;
  contact_email: string;
  contact_phone: string;
  avatar_url?: string | null;
  bio?: string;
  teaching_request?: string;
  homerooms?: { term_id: string; class_id: string }[];
};
export function TeacherAccounts() {
  const { locale, t } = useLocale();
  const th = locale === "th";
  const { meta, term } = useSchool();
  const { data, error, reload } = useLoad<{ rows: Teacher[] }>(
    "/api/account/teachers",
  );
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [viewing, setViewing] = useState<Teacher | null>(null);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [busy, setBusy] = useState(false),
    [issue, setIssue] = useState("");
  const errorText = useError();
  const rows =
    data?.rows.filter((p) =>
      [
        p.display_name,
        p.school_username,
        p.official_first_name_th,
        p.official_last_name_th,
        p.official_first_name,
        p.official_last_name,
        p.nickname,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    ) || [];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("teachers")}</h1>
          <p>
            {th
              ? "ค้นหาครู แก้ไขข้อมูลบัญชี และจัดการบัญชีที่ไม่ใช้งาน"
              : "Search teachers, correct account details and manage unused accounts."}
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
        <section className="panel">
          <div className="account-search toolbar">
            <label className="search-field">
              <Search size={18} />
              <input
                type="search"
                aria-label={th ? "ค้นหาบัญชีครู" : "Search teacher accounts"}
                placeholder={
                  th
                    ? "ค้นหาชื่อครู หรือบัญชีเข้าสู่ระบบ…"
                    : "Search name or login…"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <span className="muted" aria-live="polite">
              {rows.length} / {data.rows.length} {th ? "บัญชี" : "accounts"}
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{th ? "ชื่อครู" : "Name"}</th>
                  <th>{th ? "บัญชี" : "Login"}</th>
                  <th>{t("status")}</th>
                  <th className="align-actions">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        type="button"
                        className="teacher-profile-name text-link"
                        onClick={() => setViewing(p)}
                      >
                        {p.official_first_name_th
                          ? `${p.official_first_name_th} ${p.official_last_name_th}`
                          : p.display_name}
                      </button>
                      <span className="subline">{p.role}</span>
                      <div className="identity">
                        {p.homerooms
                          ?.filter((h) => h.term_id === term)
                          .map((h) => (
                            <span className="badge green" key={h.class_id}>
                              {th ? "ครูประจำชั้น" : "Homeroom"}{" "}
                              {meta.classes.find((c) => c.id === h.class_id)
                                ?.name || "—"}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td>{p.school_username}</td>
                    <td>{t(p.active ? "active" : "inactive")}</td>
                    <td className="align-actions">
                      {p.role === "TEACHER" && (
                        <div className="row-actions">
                          <button
                            className="button small"
                            onClick={() => {
                              setIssue("");
                              setSaved(false);
                              setEditing(p);
                            }}
                          >
                            <Pencil size={15} />
                            {t("edit")}
                          </button>
                          <button
                            className="button danger small"
                            onClick={() => {
                              setIssue("");
                              setSaved(false);
                              setSelected(p);
                            }}
                          >
                            {th ? "ลบบัญชีถาวร" : "Delete account"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={4} className="empty">
                      {th ? "ไม่พบบัญชีที่ตรงกับคำค้น" : "No matching accounts"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {viewing && (
        <Modal
          title={th ? "โปรไฟล์ครู" : "Teacher profile"}
          onClose={() => setViewing(null)}
        >
          <div className="dialog-body teacher-profile-detail">
            <div className="profile-hero">
              <span className="profile-avatar">
                {viewing.avatar_url ? (
                  <Image
                    unoptimized
                    src={viewing.avatar_url}
                    width={64}
                    height={64}
                    alt={th ? "รูปโปรไฟล์ครู" : "Teacher profile photo"}
                  />
                ) : (
                  <UserRound size={32} />
                )}
              </span>
              <div>
                <h2>
                  {viewing.official_first_name_th
                    ? `${viewing.official_first_name_th} ${viewing.official_last_name_th}`
                    : viewing.display_name}
                </h2>
                {viewing.official_first_name && (
                  <p className="muted">
                    {viewing.official_first_name} {viewing.official_last_name}
                  </p>
                )}
                <div className="identity">
                  <span className="badge">{viewing.role}</span>
                  <span className="badge">
                    {t(viewing.active ? "active" : "inactive")}
                  </span>
                </div>
                <div className="identity">
                  {viewing.homerooms
                    ?.filter((h) => h.term_id === term)
                    .map((h) => (
                      <span className="badge green" key={h.class_id}>
                        {th ? "ครูประจำชั้น" : "Homeroom"}{" "}
                        {meta.classes.find((c) => c.id === h.class_id)?.name ||
                          "—"}
                      </span>
                    ))}
                </div>
              </div>
            </div>
            <dl className="teacher-profile-facts">
              <div>
                <dt>{th ? "บัญชีเข้าสู่ระบบ" : "Login"}</dt>
                <dd>{viewing.school_username || "—"}</dd>
              </div>
              <div>
                <dt>{th ? "ชื่อเล่น" : "Nickname"}</dt>
                <dd>{viewing.nickname || "—"}</dd>
              </div>
              <div>
                <dt>{th ? "อีเมลติดต่อ" : "Contact email"}</dt>
                <dd>{viewing.contact_email || "—"}</dd>
              </div>
              <div>
                <dt>{th ? "เบอร์โทร" : "Phone"}</dt>
                <dd>{viewing.contact_phone || "—"}</dd>
              </div>
              <div>
                <dt>{th ? "วิชาและห้องที่สอน" : "Teaching request"}</dt>
                <dd>{viewing.teaching_request || "—"}</dd>
              </div>
              <div>
                <dt>{th ? "เกี่ยวกับฉัน" : "About me"}</dt>
                <dd>{viewing.bio || "—"}</dd>
              </div>
            </dl>
            <div className="dialog-actions">
              <button
                className="button"
                type="button"
                onClick={() => setViewing(null)}
              >
                {t("close")}
              </button>
              {viewing.role === "TEACHER" && (
                <button
                  className="button primary"
                  type="button"
                  onClick={() => {
                    setEditing(viewing);
                    setViewing(null);
                  }}
                >
                  <Pencil size={15} />
                  {t("edit")}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
      {editing && (
        <Modal
          title={th ? "แก้ไขข้อมูลครู" : "Edit teacher details"}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form
            className="dialog-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setIssue("");
              const payload = Object.fromEntries(new FormData(e.currentTarget));
              if (
                String(payload.official_first_name_th).trim() &&
                String(payload.official_last_name_th).trim()
              )
                payload.display_name =
                  `${String(payload.official_first_name_th).trim()} ${String(payload.official_last_name_th).trim()}`.slice(
                    0,
                    120,
                  );
              try {
                await api("/api/account/edit-teacher", {
                  teacher: editing.id,
                  expected_updated_at: editing.updated_at,
                  payload,
                });
                setEditing(null);
                setSaved(true);
                reload();
              } catch (err) {
                setIssue(errorText(err));
                if (err instanceof Error && err.message === "conflict")
                  reload();
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="account-login">
              <strong>{editing.school_username}</strong>
            </p>
            <p className="hint">
              {th
                ? "ชื่อไทยจะแสดงเป็นชื่อครูเมื่อกรอกครบทั้งชื่อและนามสกุล ชื่อบัญชีและรหัสผ่านเดิมยังใช้ได้"
                : "Complete Thai names become the display name. Login and password stay the same."}
            </p>
            <div className="form-grid">
              {(
                [
                  [
                    "official_first_name_th",
                    th ? "ชื่อ (ภาษาไทย)" : "First name (Thai)",
                    120,
                  ],
                  [
                    "official_last_name_th",
                    th ? "นามสกุล (ภาษาไทย)" : "Last name (Thai)",
                    120,
                  ],
                  [
                    "official_first_name",
                    th ? "ชื่อ (ภาษาอังกฤษ)" : "First name (English)",
                    120,
                  ],
                  [
                    "official_last_name",
                    th ? "นามสกุล (ภาษาอังกฤษ)" : "Last name (English)",
                    120,
                  ],
                  [
                    "display_name",
                    th
                      ? "ชื่อที่แสดงเมื่อไม่มีชื่อไทย"
                      : "Display name without Thai names",
                    120,
                  ],
                  ["nickname", th ? "ชื่อเล่น" : "Nickname", 60],
                  ["contact_email", th ? "อีเมลติดต่อ" : "Contact email", 254],
                  ["contact_phone", th ? "เบอร์โทร" : "Phone", 40],
                ] as const
              ).map(([key, label, max]) => (
                <Field key={key} label={label}>
                  <input
                    name={key}
                    type={key === "contact_email" ? "email" : "text"}
                    required={key === "display_name"}
                    maxLength={max}
                    defaultValue={editing[key]}
                  />
                </Field>
              ))}
            </div>
            <Notice error={issue} />
            <div className="dialog-actions">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                {t("cancel")}
              </button>
              <button className="button primary" disabled={busy}>
                {t(busy ? "saving" : "save")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title={th ? "ลบบัญชีครูถาวร" : "Permanently delete teacher"}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <form
            className="dialog-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setIssue("");
              try {
                await api("/api/account/delete-teacher", {
                  teacher: selected.id,
                  confirmation: "DELETE",
                });
                setSelected(null);
                reload();
              } catch (err) {
                setIssue(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              <strong>{selected.display_name}</strong> ·{" "}
              {selected.school_username}
            </p>
            <p className="hint">
              {th
                ? "ลบบัญชี รูป โปรไฟล์ ข้อเสนอแนะ และการมอบหมายงาน ครูจะเข้าสู่ระบบไม่ได้อีก ไม่มีการจัดเก็บบัญชีเพื่อกู้คืน ผลการเรียนของนักเรียนยังเป็นข้อมูลของโรงเรียน"
                : "Deletes login, photo, profile, feedback and assignments. No account recovery. Student results remain school records."}
            </p>
            <label className="field check">
              <input type="checkbox" required />
              <span>
                {th
                  ? "ยืนยันว่าต้องการลบบัญชีนี้ถาวร"
                  : "Confirm permanent account deletion"}
              </span>
            </label>
            <Notice error={issue} />
            <div className="dialog-actions">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                {t("cancel")}
              </button>
              <button className="button danger" disabled={busy}>
                {t(busy ? "loading" : "deleteRecord")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
