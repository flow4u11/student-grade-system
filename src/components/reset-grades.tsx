"use client";
import { PasswordInput } from "./ui";
import { useState } from "react";
import { isAdmin } from "@/lib/permissions";
import { academicYear } from "@/lib/presentation";
import { useSchool } from "./data";
import { useLocale } from "./providers";
import { api, Field, Modal, Notice, useError } from "./ui";
export function ResetGrades() {
  const { meta, term } = useSchool();
  return isAdmin(meta.profile.role) ? (
    <ResetForm key={term} term={term} />
  ) : null;
}
function ResetForm({ term }: { term: string }) {
  const { meta } = useSchool();
  const { locale, t } = useLocale();
  const th = locale === "th";
  const errorText = useError();
  const chosen = meta.terms.find((v) => v.id === term);
  const [proof, setProof] = useState<{
      proof: string;
      preview: { count: number; published: number };
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [phrase, setPhrase] = useState(""),
    [confirm, setConfirm] = useState(false);
  const label = chosen
    ? `${academicYear(chosen.academic_year, locale)} · ${chosen.name}`
    : "—";
  async function authorize(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const password = String(new FormData(form).get("password"));
    form.reset();
    setBusy(true);
    setError("");
    setProof(null);
    setMessage("");
    setPhrase("");
    try {
      setProof(await api("/api/account/reset-authorize", { term, password }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!proof) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ count: number }>("/api/account/reset-grades", {
        term,
        proof: proof.proof,
        phrase,
        confirmed: true,
      });
      setMessage(`${th ? "ล้างคะแนนแล้ว" : "Grades reset"}: ${r.count}`);
      setProof(null);
      setPhrase("");
    } catch (e) {
      setError(errorText(e));
      setProof(null);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  return (
    <details
      className="panel dialog-body"
      style={{ marginTop: 24, borderColor: "var(--danger)" }}
    >
      <summary style={{ color: "var(--danger)", cursor: "pointer" }}>
        {th
          ? "พื้นที่อันตราย: ล้างคะแนนทั้งภาคเรียน"
          : "Danger Zone: reset term grades"}
      </summary>
      <h2>{label}</h2>
      <p>
        {th
          ? "ลบคะแนนฉบับร่างและคะแนนที่ประกาศแล้วทั้งหมดของภาคเรียนที่เลือกทุกวิชา กู้กลับจากหน้านี้ไม่ได้ รายชื่อนักเรียน ห้องเรียน วิชา บัญชีผู้ใช้ และประวัติการเปลี่ยนแปลงจะยังอยู่"
          : "Deletes all draft and published grades in the selected term across all subjects. This screen cannot restore them. Students, enrollments, subjects, accounts and audit history remain."}
      </p>
      <Notice error={error} message={message} />
      <form className="toolbar" onSubmit={authorize}>
        <Field
          label={th ? "ยืนยันรหัสผ่านของคุณอีกครั้ง" : "Re-enter your password"}
        >
          <PasswordInput
            type="password"
            name="password"
            required
            maxLength={128}
            autoComplete="current-password"
          />
        </Field>
        <button className="button" disabled={busy || !term}>
          {th ? "ตรวจสอบก่อนล้างคะแนน" : "Review reset"}
        </button>
      </form>
      {proof && (
        <div className="notice">
          <p>
            {label} · {th ? "คะแนนทั้งหมด" : "Total grades"}{" "}
            {proof.preview.count} · {th ? "ประกาศแล้ว" : "Published"}{" "}
            {proof.preview.published}
          </p>
          <p>
            {th
              ? "การยืนยันมีอายุ 5 นาที หากคะแนนเปลี่ยน ระบบจะให้ตรวจใหม่"
              : "Confirmation expires in 5 minutes. If grades change, a new review is required."}
          </p>
          <Field
            label={
              th
                ? "พิมพ์ RESET GRADES เพื่อยืนยัน"
                : "Type RESET GRADES to confirm"
            }
          >
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <button
            className="button danger"
            disabled={busy || phrase !== "RESET GRADES" || !proof.preview.count}
            onClick={() => setConfirm(true)}
          >
            {th ? "ล้างคะแนนในภาคเรียนนี้" : "Reset this term’s grades"}
          </button>
        </div>
      )}
      {confirm && proof && (
        <Modal
          title={th ? "ยืนยันครั้งสุดท้าย" : "Final confirmation"}
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <div className="dialog-body">
            <p>{label}</p>
            <p>
              {th ? "กำลังจะลบคะแนน" : "You are about to delete"}{" "}
              {proof.preview.count}{" "}
              {th
                ? "รายการ รวมคะแนนที่ประกาศแล้ว"
                : "grade records, including published results"}
              .
            </p>
            <div className="dialog-actions">
              <button
                className="button"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                {t("cancel")}
              </button>
              <button className="button danger" disabled={busy} onClick={reset}>
                {th ? "ยืนยันล้างคะแนน" : "Confirm reset"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </details>
  );
}
