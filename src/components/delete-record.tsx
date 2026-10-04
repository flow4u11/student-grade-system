"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useLocale } from "./providers";
import { api, Modal, Notice, useError } from "./ui";
import type { Kind } from "./record-editor";
export function DeleteRecord({
  kind,
  id,
  label,
  onDeleted,
}: {
  kind: Kind;
  id: string;
  label: string;
  onDeleted: (result: "deleted" | "archived") => void;
}) {
  const { t, locale } = useLocale();
  const errorText = useError();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api<{ result: "deleted" | "archived" }>(
        "/api/staff/delete-record",
        {
          kind,
          id,
          confirmation: "DELETE",
        },
      );
      setOpen(false);
      onDeleted(response.result);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="button small danger"
        aria-label={`${t("deleteRecord")} ${label}`}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <Trash2 size={15} />
        {locale === "th" ? "ลบถาวร" : "Delete permanently"}
      </button>
      {open && (
        <Modal
          title={t("deleteTitle")}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form className="dialog-body" onSubmit={remove}>
            <p>
              <strong>{label}</strong>
            </p>
            <p className="notice error">
              {locale === "th"
                ? "ลบถาวรและกู้คืนไม่ได้ รวมคะแนนฉบับร่างและคะแนนที่ประกาศแล้ว"
                : "Permanently deletes related records and grades, including published results. Cannot be restored."}
            </p>
            <p className="hint">
              {locale === "th"
                ? {
                    students:
                      "ลบข้อมูลนักเรียน การลงทะเบียนทุกภาคเรียน และเกรดทั้งหมดของนักเรียน",
                    subjects:
                      "ลบทะเบียนวิชา วิชาที่เปิดสอนทุกห้อง/ทุกเทอม และเกรดที่เกี่ยวข้อง",
                    terms:
                      "ลบภาคเรียน การลงทะเบียน วิชาที่เปิดสอน และเกรดทั้งหมดในภาคเรียนนี้",
                    classes:
                      "ลบห้อง การลงทะเบียนในห้อง วิชาที่เปิดสอน และเกรดของห้อง (รายชื่อนักเรียนยังอยู่)",
                    offerings:
                      "ลบวิชาที่เปิดสอนในห้องนี้และเกรดทั้งหมดของวิชานี้",
                    schemes:
                      "ลบเกณฑ์ รวมวิชาที่ใช้เกณฑ์นี้และเกรดที่เกี่ยวข้อง",
                  }[kind]
                : "The record and its dependent academic records will be removed."}
            </p>
            <label className="field check">
              <input type="checkbox" required />
              <span>
                {locale === "th"
                  ? "ฉันตรวจสอบรายการที่จะลบและยืนยันการลบถาวร"
                  : "I checked the affected records and confirm permanent deletion"}
              </span>
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
                {t("confirmRemove")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
