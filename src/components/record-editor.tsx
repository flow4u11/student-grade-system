"use client";
import { Select } from "./select";
import { PasswordInput } from "./ui";
import { isAdmin } from "@/lib/permissions";
import { academicYear, canonicalYear } from "@/lib/presentation";
import { CriteriaEditor } from "./criteria-editor";
import { useState } from "react";
import { useSchool } from "./data";
import { useBranding, useLocale } from "./providers";
import { api, Field, Modal, Notice, useError } from "./ui";
import type { MessageKey } from "@/lib/i18n";
import type { Rule } from "@/lib/types";
export type Kind =
  "terms" | "classes" | "students" | "subjects" | "offerings" | "schemes";
type Values = Record<string, unknown>;
export function RecordEditor({
  kind,
  record,
  onClose,
  onSaved,
}: {
  kind: Kind;
  record?: Values;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { meta, term } = useSchool();
  const { t, locale } = useLocale();
  const errorText = useError();
  const school = useBranding();
  const [classIds, setClassIds] = useState<string[]>([]);
  const [subjectId, setSubjectId] = useState(String(record?.subject_id || ""));
  const [offeringTerm, setOfferingTerm] = useState(
    String(record?.term_id || term),
  );
  const availableClasses = meta.classes.filter(
    (c) =>
      c.active &&
      !meta.offerings.some(
        (o) =>
          o.subject_id === subjectId &&
          o.term_id === offeringTerm &&
          o.class_id === c.id,
      ),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [grading, setGrading] = useState(
    String(record?.grading_type || "NUMERIC_GRADE"),
  );
  const field = (
    name: string,
    label: MessageKey,
    type = "text",
    fallback = "",
    required = true,
  ) => (
    <Field key={name} label={t(label)}>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={
          name === "academic_year"
            ? academicYear(Number(record?.[name] ?? fallback), locale)
            : String(record?.[name] ?? fallback)
        }
        maxLength={type === "text" ? 150 : undefined}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
      />
    </Field>
  );
  const select = (
    name: string,
    label: MessageKey,
    options: { id: string; label: string }[],
    fallback = "",
  ) => (
    <Field key={name} label={t(label)}>
      <Select
        name={name}
        onChange={(e) => {
          if (kind === "offerings" && !record?.id) {
            if (name === "subject_id") {
              setSubjectId(e.target.value);
              setClassIds([]);
            }
            if (name === "term_id") {
              setOfferingTerm(e.target.value);
              setClassIds([]);
            }
          }
        }}
        required
        defaultValue={
          name === "academic_year"
            ? academicYear(Number(record?.[name] ?? fallback), locale)
            : String(record?.[name] ?? fallback)
        }
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
  const check = (name: string, label: MessageKey, fallback = true) => (
    <label className="field check">
      <input
        name={name}
        type="checkbox"
        defaultChecked={
          record?.[name] === undefined ? fallback : !!record[name]
        }
      />
      <span>{t(label)}</span>
    </label>
  );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const value: Values = Object.fromEntries(f);
    if (record?.id) value.id = record.id;
    if (kind === "terms")
      value.academic_year = canonicalYear(Number(value.academic_year));
    if (kind === "students") value.reset_on_move = f.has("reset_on_move");
    if (kind === "students")
      value.roll_number = value.roll_number ? Number(value.roll_number) : null;
    if (["terms", "classes", "students", "subjects"].includes(kind))
      value.active = f.has("active");
    if (
      record?.active === true &&
      value.active === false &&
      !window.confirm(t("confirmDeactivate"))
    )
      return;
    if (kind === "subjects")
      value.default_credits =
        value.default_credits === "" ? null : Number(value.default_credits);
    if (kind === "students" && !value.pin) delete value.pin;
    if (kind === "offerings") {
      value.include_in_gpa =
        grading === "NUMERIC_GRADE" && f.has("include_in_gpa");
      if (grading === "PASS_FAIL") value.scheme_id = "";
    }
    try {
      if (kind === "schemes") {
        value.rules = String(f.get("rules"))
          .trim()
          .split("\n")
          .map((line) => {
            const parts = line.split(",");
            if (parts.length !== 2 || parts.some((p) => !p.trim()))
              throw new Error("invalid");
            return { minimum: Number(parts[0]), points: Number(parts[1]) };
          });
      }
      setBusy(true);
      if (kind === "offerings" && !record?.id) {
        const chosen = classIds.filter((id) =>
          availableClasses.some((c) => c.id === id),
        );
        if (!chosen.length) throw new Error("chooseAtLeastOne");
        delete value.class_id;
        let subject = null;
        if (subjectId === "__new__") {
          subject = {
            code: value.subject_code,
            name_th: value.subject_name_th,
            name_en: value.subject_name_en || value.subject_name_th,
            default_credits: Number(value.credits),
            active: true,
          };
          delete value.subject_id;
        }
        delete value.subject_code;
        delete value.subject_name_th;
        delete value.subject_name_en;
        await api("/api/staff/offerings-compose", {
          payload: value,
          class_ids: chosen,
          subject,
        });
      } else await api(`/api/staff/${kind}`, value);
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${t(record?.id ? "edit" : "add")} · ${t(kind)}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="dialog-body" onSubmit={submit}>
        <div className="form-grid">
          {kind === "terms" && (
            <>
              {field(
                "academic_year",
                "academicYear",
                "number",
                String(new Date().getFullYear()),
              )}
              {field("name", "termName")}
              {check("active", "activeTerm", false)}
            </>
          )}
          {kind === "classes" && (
            <>
              {field("name", "className")}
              {check("active", "active")}
            </>
          )}
          {kind === "students" && (
            <>
              {field("student_number", "studentNumber")}
              {field("roll_number", "rollNumber", "number", "", false)}
              {field("first_name", "firstName")}
              {field("last_name", "lastName")}
              {select(
                "class_id",
                "class",
                meta.classes
                  .filter((c) => c.active || c.id === record?.class_id)
                  .map((c) => ({ id: c.id, label: c.name })),
              )}
              {select(
                "term_id",
                "term",
                meta.terms
                  .filter((v) => !v.archived || v.id === record?.term_id)
                  .map((v) => ({
                    id: v.id,
                    label: `${academicYear(v.academic_year, locale)} · ${v.name}`,
                  })),
                term,
              )}
              {check("active", "active")}
              {record?.id && (
                <label className="field check wide">
                  <input type="checkbox" name="reset_on_move" />
                  <span>
                    {locale === "th"
                      ? "หากย้ายห้อง ยืนยันล้างเกรดภาคเรียนนี้เพื่อกรอกใหม่ (ครูประจำชั้น/ผู้ดูแล)"
                      : "If moving classes, reset this term’s grades (homeroom/admin)"}
                  </span>
                </label>
              )}
              {isAdmin(meta.profile.role) && (
                <div className="wide">
                  <Field label={t("resetPin")} hint={t("studentNoPinHint")}>
                    <PasswordInput
                      aria-label={t("resetPin")}
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{6,12}"
                      minLength={6}
                      maxLength={12}
                      autoComplete="new-password"
                      required={false}
                    />
                  </Field>
                </div>
              )}
            </>
          )}
          {kind === "subjects" && (
            <>
              {field("code", "subjectCode")}
              {field("name_th", "nameTh")}
              {field("name_en", "nameEn")}
              {field("default_credits", "credits", "number", "", false)}
              <p className="hint wide">
                {locale === "th"
                  ? "เว้นว่างได้หากยังไม่ทราบหน่วยกิต ระบุตอนเปิดสอนได้"
                  : "Leave blank if unknown; enter credits when offering the subject."}
              </p>
              {check("active", "active")}
            </>
          )}
          {kind === "offerings" && (
            <>
              {select("subject_id", "subject", [
                ...(!record?.id
                  ? [
                      {
                        id: "__new__",
                        label:
                          locale === "th"
                            ? "+ เพิ่มวิชาใหม่ในหน้านี้"
                            : "+ Create a new subject here",
                      },
                    ]
                  : []),
                ...meta.subjects
                  .filter((s) => s.active || s.id === record?.subject_id)
                  .map((s) => ({
                    id: s.id,
                    label: `${s.code} · ${locale === "th" ? s.name_th : s.name_en}`,
                  })),
              ])}
              {select(
                "term_id",
                "term",
                meta.terms
                  .filter((v) => !v.archived || v.id === record?.term_id)
                  .map((v) => ({
                    id: v.id,
                    label: `${academicYear(v.academic_year, locale)} · ${v.name}`,
                  })),
                term,
              )}
              {!record?.id && subjectId === "__new__" && (
                <fieldset className="wide classroom-picker">
                  <legend>
                    {locale === "th"
                      ? "รายละเอียดวิชาใหม่"
                      : "New subject details"}
                  </legend>
                  <div className="form-grid">
                    <Field label={t("subjectCode")}>
                      <input name="subject_code" required maxLength={40} />
                    </Field>
                    <Field label={t("nameTh")}>
                      <input name="subject_name_th" required maxLength={150} />
                    </Field>
                    <Field
                      label={t("nameEn")}
                      hint={
                        locale === "th"
                          ? "เว้นว่างเพื่อใช้ชื่อภาษาไทย"
                          : "Leave blank to reuse the Thai name"
                      }
                    >
                      <input name="subject_name_en" maxLength={150} />
                    </Field>
                  </div>
                </fieldset>
              )}
              {record?.id ? (
                select(
                  "class_id",
                  "class",
                  meta.classes
                    .filter((c) => c.active || c.id === record.class_id)
                    .map((c) => ({ id: c.id, label: c.name })),
                )
              ) : (
                <fieldset className="wide classroom-picker">
                  <legend>{t("chooseClasses")}</legend>
                  <p className="hint">{t("chooseClassHint")}</p>
                  <div className="toolbar">
                    <button
                      type="button"
                      className="button small"
                      onClick={() =>
                        setClassIds(availableClasses.map((c) => c.id))
                      }
                    >
                      {t("selectAll")}
                    </button>
                    <button
                      type="button"
                      className="button small"
                      onClick={() => setClassIds([])}
                    >
                      {t("clearSelection")}
                    </button>
                    <span>
                      {classIds.length} {t("selectedClasses")}
                    </span>
                  </div>
                  <div className="classroom-options">
                    {meta.classes
                      .filter((c) => c.active)
                      .map((c) => {
                        const exists = !availableClasses.some(
                          (v) => v.id === c.id,
                        );
                        return (
                          <label
                            key={c.id}
                            className={`classroom-option ${classIds.includes(c.id) ? "chosen" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={classIds.includes(c.id)}
                              disabled={exists || busy}
                              onChange={(e) =>
                                setClassIds((ids) =>
                                  e.target.checked
                                    ? [...ids, c.id]
                                    : ids.filter((id) => id !== c.id),
                                )
                              }
                            />
                            <span>
                              {c.name}
                              {exists && <small>{t("alreadyOffered")}</small>}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </fieldset>
              )}
              <Field label={t("gradingType")}>
                <Select
                  name="grading_type"
                  value={grading}
                  onChange={(e) => setGrading(e.target.value)}
                >
                  <option value="NUMERIC_GRADE">{t("numeric")}</option>
                  <option value="PASS_FAIL">{t("passFail")}</option>
                </Select>
              </Field>
              {field("max_score", "maximum", "number", "100")}
              <div key={record?.id ? "existing-credits" : subjectId}>
                {field(
                  "credits",
                  "credits",
                  "number",
                  String(
                    meta.subjects.find((s) => s.id === subjectId)
                      ?.default_credits ?? "",
                  ),
                )}
              </div>
              {grading === "NUMERIC_GRADE" ? (
                <>
                  {select(
                    "scheme_id",
                    "scheme",
                    meta.schemes
                      .filter((s) => !s.archived || s.id === record?.scheme_id)
                      .map((s) => ({ id: s.id, label: s.name })),
                    meta.schemes.find(
                      (s) => s.id === school.default_scheme_id && !s.archived,
                    )?.id || meta.schemes.find((s) => !s.archived)?.id,
                  )}
                  {check("include_in_gpa", "includeGpa")}
                </>
              ) : (
                <input type="hidden" name="scheme_id" value="" />
              )}
              {grading === "PASS_FAIL" ? (
                <>
                  {select(
                    "pass_mode",
                    "passMode",
                    [
                      { id: "AUTOMATIC", label: t("automatic") },
                      { id: "MANUAL", label: t("manual") },
                    ],
                    "AUTOMATIC",
                  )}
                  {field("pass_threshold", "threshold", "number", "60")}
                </>
              ) : (
                <>
                  <input type="hidden" name="pass_mode" value="AUTOMATIC" />
                  <input type="hidden" name="pass_threshold" value="60" />
                </>
              )}
              <p className="hint wide">{t("offeringHint")}</p>
            </>
          )}
          {kind === "schemes" && (
            <>
              <div className="wide">
                {field("name", "schemeName")}
                <CriteriaEditor
                  initial={
                    (record?.grade_scheme_rules as Rule[] | undefined) ||
                    meta.schemes.find((s) => s.name === "Standard 0–4")
                      ?.grade_scheme_rules ||
                    meta.schemes[0]?.grade_scheme_rules ||
                    []
                  }
                />
                <p className="hint">{t("immutableHint")}</p>
              </div>
            </>
          )}
        </div>
        <Notice error={error} />
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            {t("cancel")}
          </button>
          <button className="button primary" disabled={busy}>
            {t(busy ? "saving" : "save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
