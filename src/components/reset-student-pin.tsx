"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useLocale } from "./providers";
import { api, Field, Modal, Notice, PasswordInput, useError } from "./ui";

export function ResetStudentPin({
  studentId,
  termId,
  studentNumber,
}: {
  studentId: string;
  termId: string;
  studentNumber: string;
}) {
  const { locale, t } = useLocale();
  const th = locale === "th";
  const errorText = useError();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (!termId || !/^\d{5}$/.test(studentNumber)) return null;
  return (
    <>
      <button
        type="button"
        className="button small"
        onClick={() => {
          setError("");
          setSaved(false);
          setOpen(true);
        }}
      >
        <KeyRound size={16} />
        {th ? "ตั้งรหัส PIN" : "Set student PIN"}
      </button>
      {open && (
        <Modal
          title={th ? "รหัสเข้าดูเกรดของนักเรียน" : "Student results PIN"}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="dialog-body"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const value = new FormData(form);
              setError("");
              if (value.get("pin") !== value.get("confirmation")) {
                setError(
                  th
                    ? "รหัส PIN ทั้งสองช่องไม่ตรงกัน"
                    : "The PIN entries do not match.",
                );
                return;
              }
              setBusy(true);
              try {
                await api("/api/staff/student-pin", {
                  student_id: studentId,
                  term_id: termId,
                  pin: value.get("pin"),
                });
                form.reset();
                setSaved(true);
              } catch (err) {
                setError(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              {th ? "ชื่อผู้ใช้ของนักเรียน" : "Student username"}:{" "}
              <strong>{studentNumber}</strong>
            </p>
            <p className="hint">
              {th
                ? "ตั้ง PIN เป็นตัวเลข 6–12 หลัก แล้วแจ้งให้นักเรียนโดยตรง นักเรียนใช้รหัสนักเรียน 5 หลักและ PIN ที่หน้าเข้าสู่ระบบนักเรียน การเปลี่ยน PIN จะออกจากระบบนักเรียนทุกเครื่อง"
                : "Set a 6–12 digit PIN and share it directly with the student. They use their five-digit ID and this PIN on the student sign-in page. Changing the PIN signs them out on every device."}
            </p>
            {!saved && (
              <>
                <Field label={t("pin")}>
                  <PasswordInput
                    required
                    name="pin"
                    inputMode="numeric"
                    pattern="[0-9]{6,12}"
                    minLength={6}
                    maxLength={12}
                    autoComplete="new-password"
                    disabled={busy}
                  />
                </Field>
                <Field label={th ? "ยืนยันรหัส PIN" : "Confirm PIN"}>
                  <PasswordInput
                    required
                    name="confirmation"
                    inputMode="numeric"
                    pattern="[0-9]{6,12}"
                    minLength={6}
                    maxLength={12}
                    autoComplete="new-password"
                    disabled={busy}
                  />
                </Field>
              </>
            )}
            <Notice
              error={error}
              message={
                saved
                  ? th
                    ? "บันทึก PIN แล้ว กรุณาแจ้งรหัสให้นักเรียน ระบบจะไม่แสดงรหัสเดิมอีก"
                    : "PIN saved. Share it with the student; the system will not show it again."
                  : undefined
              }
            />
            <div className="form-actions">
              {saved ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setOpen(false)}
                >
                  {th ? "เรียบร้อย" : "Done"}
                </button>
              ) : (
                <button className="button primary" disabled={busy}>
                  {busy ? t("loading") : t("save")}
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
