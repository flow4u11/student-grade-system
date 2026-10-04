"use client";
import { Select } from "./select";
import { useMemo, useState } from "react";
import { Upload, Download, ArrowRight } from "lucide-react";
import { useSchool } from "./data";
import { useLocale } from "./providers";
import { api, Field, Notice, useError } from "./ui";
import {
  guessMapping,
  mappedRows,
  parseFile,
  validateImport,
  type ImportCheck,
  type ImportRow,
} from "@/lib/import";
export function ImportStudents() {
  const { term, meta } = useSchool();
  const { t, locale } = useLocale();
  const [fallbackClass, setFallbackClass] = useState("");
  const [showMapping, setShowMapping] = useState(false);
  const errorText = useError();
  const [file, setFile] = useState<{
    headers: string[];
    rows: string[][];
    numericIds: boolean;
    name: string;
  } | null>(null);
  const [mapping, setMapping] = useState<Record<keyof ImportRow, number>>({
    roll_number: -1,
    student_number: -1,
    first_name: -1,
    last_name: -1,
    class_name: -1,
  });
  const [checks, setChecks] = useState<{
    term: string;
    rows: ImportCheck[];
  } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = useMemo(
    () => (file ? mappedRows(file.rows, mapping, fallbackClass) : []),
    [file, mapping, fallbackClass],
  );
  const problems = checks?.rows.filter((r) => r.errors.length).length || 0;
  const validChecks = checks?.term === term ? checks : null;
  const readyRows = validChecks
    ? rows.filter((_, i) => !validChecks.rows[i]?.errors.length)
    : [];
  async function validate(candidates: ImportRow[]) {
    const local = validateImport(candidates);
    const indexes = local.flatMap((c, i) => (c.errors.length ? [] : [i]));
    if (indexes.length) {
      const data = await api<{ checks: ImportCheck[] }>(
        "/api/staff/import-validate",
        { term_id: term, rows: indexes.map((i) => candidates[i]) },
      );
      indexes.forEach(
        (index, i) => (local[index].errors = data.checks[i].errors),
      );
    }
    setChecks({ term, rows: local });
  }
  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setFile(null);
    setChecks(null);
    setError("");
    setMessage("");
    try {
      const data = await parseFile(f);
      if (!data.rows.length) throw new Error("invalid");
      setFile({ ...data, name: f.name });
      const inferred = guessMapping(data.headers);
      setMapping(inferred);
      const complete = Object.entries(inferred).every(
        ([k, v]) => k === "roll_number" || v >= 0,
      );
      setShowMapping(!complete);
      if (complete && term)
        await validate(mappedRows(data.rows, inferred, fallbackClass));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    setBusy(true);
    setError("");
    setChecks(null);
    try {
      await validate(rows);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (
      !window.confirm(
        `${t("confirmImport")} · ${readyRows.length} ${t("students")}?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ count: number }>("/api/staff/import", {
        term_id: term,
        rows: readyRows,
      });
      setMessage(`${t("imported")}: ${data.count}`);
      setFile(null);
      setChecks(null);
    } catch (e) {
      setError(errorText(e));
      setChecks(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("students")}</span>
          <h1>{t("importExcel")}</h1>
          <p>{t("importDescription")}</p>
        </div>
        <a
          className="button"
          href={`/api/staff/template?locale=${locale}`}
          download
        >
          <Download size={16} />
          {t("template")}
        </a>
      </div>
      <Notice error={error} message={message} />
      <section className="upload-zone">
        <Upload size={30} />
        <h2>{t("upload")}</h2>
        <input
          aria-label={t("upload")}
          type="file"
          accept=".xlsx,.csv"
          onChange={choose}
          disabled={busy}
        />
        <p>{t("fileHint")}</p>
        {file && <strong>{file.name}</strong>}
      </section>
      <p className="hint">{t("importPinHint")}</p>
      {file && (
        <>
          <button
            className="button"
            onClick={() => setShowMapping(!showMapping)}
          >
            {t("mapColumns")}
          </button>
          {mapping.class_name < 0 && (
            <Field
              label={t("class")}
              hint={
                locale === "th"
                  ? "ใช้ห้องนี้เมื่อไฟล์ไม่มีคอลัมน์ห้องเรียน"
                  : "Use this classroom when it is missing from the file"
              }
            >
              <Select
                value={fallbackClass}
                onChange={(e) => {
                  setFallbackClass(e.target.value);
                  setChecks(null);
                }}
              >
                <option value="">—</option>
                {meta.classes
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          {showMapping && (
            <section className="panel">
              <div className="section-heading">
                <h2>{t("mapColumns")}</h2>
              </div>
              <div className="mapping">
                {(
                  [
                    ["roll_number", "rollNumber"],
                    ["student_number", "studentNumber"],
                    ["first_name", "firstName"],
                    ["last_name", "lastName"],
                    ["class_name", "class"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={t(label)}>
                    <Select
                      value={mapping[key]}
                      onChange={(e) => {
                        setMapping({
                          ...mapping,
                          [key]: Number(e.target.value),
                        });
                        setChecks(null);
                      }}
                    >
                      <option value={-1}>{t("chooseColumn")}</option>
                      {file.headers.map((header, i) => (
                        <option key={i} value={i}>
                          {header || `#${i + 1}`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
            </section>
          )}
          {file.numericIds && (
            <div
              className="notice"
              style={{ background: "var(--accent-soft)" }}
            >
              {t("numericWarning")}
            </div>
          )}
          <div className="toolbar">
            <button
              className={`button ${validChecks ? "" : "primary"}`}
              disabled={
                busy ||
                !term ||
                Object.entries(mapping).some(
                  ([k, i]) =>
                    k !== "roll_number" &&
                    !(k === "class_name" && fallbackClass) &&
                    i < 0,
                ) ||
                new Set(Object.values(mapping).filter((i) => i >= 0)).size !==
                  Object.values(mapping).filter((i) => i >= 0).length
              }
              onClick={preview}
            >
              {t(busy ? "loading" : "preview")}
              <ArrowRight size={16} />
            </button>
            {validChecks && readyRows.length > 0 && (
              <button
                className="button primary"
                onClick={confirm}
                disabled={busy}
              >
                {t("confirmImport")} ({readyRows.length})
              </button>
            )}
          </div>
          {validChecks && (
            <>
              <div className="import-summary">
                <div>
                  <strong>{rows.length}</strong>
                  <span>{t("detected")}</span>
                </div>
                <div>
                  <strong>{rows.length - problems}</strong>
                  <span>{t("valid")}</span>
                </div>
                <div>
                  <strong>{problems}</strong>
                  <span>{t("problems")}</span>
                </div>
              </div>
              <div className="panel table-wrap" style={{ maxHeight: 550 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t("row")}</th>
                      <th>{t("studentNumber")}</th>
                      <th>{t("name")}</th>
                      <th>{t("class")}</th>
                      <th>{t("validation")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i}>
                        <td>{row.roll_number ?? i + 1}</td>
                        <td className="id-text">{row.student_number}</td>
                        <td>
                          {row.first_name} {row.last_name}
                        </td>
                        <td>{row.class_name}</td>
                        <td>
                          {validChecks.rows[i]?.errors.length ? (
                            <span style={{ color: "var(--danger)" }}>
                              {validChecks.rows[i].errors
                                .map((code) => errorText(new Error(code)))
                                .join(" · ")}
                            </span>
                          ) : (
                            <span className="badge green">{t("ready")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
      {!term && <Notice error={t("noTerm")} />}
    </>
  );
}
