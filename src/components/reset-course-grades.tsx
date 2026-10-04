"use client";
import { useState } from "react";
import { useLocale } from "./providers";
import { api, Modal, Notice, useError } from "./ui";
export function ResetCourseGrades({
  offering,
  learner = null,
  version = null,
  rows,
  disabled = false,
  onSaved,
}: {
  offering: string;
  learner?: string | null;
  version?: number | null;
  rows?: { student_id: string; version: number }[];
  disabled?: boolean;
  onSaved: () => void;
}) {
  const { locale, t } = useLocale();
  const th = locale === "th";
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const errorText = useError();
  return (
    <>
      <button
        className="button small danger"
        disabled={disabled}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {th ? "ล้างเกรด" : "Reset grades"}
      </button>
      {open && (
        <Modal
          title={th ? "ล้างเกรดเพื่อกรอกใหม่" : "Reset grades for new entry"}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="dialog-body"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("/api/staff/reset-course-grades", {
                  offering,
                  learner,
                  expected_version: version,
                  expected_rows: rows?.map(({ student_id, version }) => ({
                    student_id,
                    version,
                  })),
                  confirmation: "RESET",
                });
                setOpen(false);
                onSaved();
              } catch (err) {
                setError(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="notice error">
              {th
                ? learner
                  ? "ลบเกรดวิชานี้ของนักเรียนคนนี้ รวมเกรดที่ประกาศแล้ว"
                  : "ลบเกรดวิชานี้ของนักเรียนทุกคนในห้อง รวมเกรดที่ประกาศแล้ว"
                : "Deletes draft and published grades in the selected scope."}
            </p>
            <p className="hint">
              {th
                ? "รายชื่อและวิชายังอยู่ ผลจะกลับเป็นยังไม่บันทึก และต้องกรอก/ประกาศใหม่ กู้คืนคะแนนไม่ได้"
                : "Students and course remain. Results return to Not recorded; enter and publish again."}
            </p>
            <label className="field check">
              <input type="checkbox" required />
              <span>{th ? "ยืนยันว่าต้องการล้างเกรด" : "Confirm reset"}</span>
            </label>
            <Notice error={error} />
            <div className="dialog-actions">
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </button>
              <button className="button danger" disabled={busy}>
                {th ? "ล้างเกรด" : "Reset grades"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
