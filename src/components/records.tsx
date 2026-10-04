"use client";
import { ArchiveRecord } from "./archive-record";
import { academicYear } from "@/lib/presentation";
import { useState } from "react";
import { Plus, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useSchool } from "./data";
import { useLocale } from "./providers";
import { api, Empty, Notice, useError } from "./ui";
import { DeleteRecord } from "./delete-record";
import { RecordEditor, type Kind } from "./record-editor";
import type { MessageKey } from "@/lib/i18n";
export function Records({
  section,
}: {
  section: "terms" | "classes" | "subjects" | "schemes";
}) {
  const { meta, term, refresh } = useSchool();
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<"subjects" | "offerings">("offerings");
  const [editing, setEditing] = useState<{
    kind: Kind;
    record?: Record<string, unknown>;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const errorText = useError();
  async function restore(id: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/staff/restore-record", { kind, id });
      setMessage(t("saved"));
      refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const kind = section === "subjects" ? tab : section;
  const allRows: Record<string, unknown>[] = (kind === "offerings"
    ? meta.offerings.filter((o) => !term || o.term_id === term)
    : meta[kind]) as unknown as Record<string, unknown>[];
  const rows = allRows.filter(
    (row) =>
      !!row.archived === showArchived &&
      values(row).some(
        (value) =>
          typeof value === "string" &&
          value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
      ),
  );
  const archivedCount = allRows.filter((row) => row.archived).length;
  const columns: MessageKey[] =
    kind === "terms"
      ? ["academicYear", "termName", "status"]
      : kind === "classes"
        ? ["className", "status"]
        : kind === "subjects"
          ? ["subjectCode", "nameTh", "credits", "status"]
          : kind === "schemes"
            ? ["schemeName", "rules"]
            : ["subject", "class", "gradingType", "maximum", "credits"];
  function values(row: Record<string, unknown>): React.ReactNode[] {
    const status = (
      <span className={`badge ${row.active ? "green" : ""}`}>
        {t(row.active ? "active" : "inactive")}
      </span>
    );
    if (kind === "terms")
      return [
        academicYear(Number(row.academic_year), locale),
        String(row.name),
        status,
      ];
    if (kind === "classes") return [String(row.name), status];
    if (kind === "subjects")
      return [
        String(row.code),
        String(row.name_th),
        row.default_credits == null
          ? locale === "th"
            ? "ยังไม่ระบุ"
            : "Not specified"
          : String(row.default_credits),
        status,
      ];
    if (kind === "schemes")
      return [
        String(row.name),
        (row.grade_scheme_rules as { minimum: number; points: number }[])
          .slice()
          .sort((a, b) => b.minimum - a.minimum)
          .map((r) => `${r.minimum}% → ${r.points}`)
          .join("  ·  "),
      ];
    const sub = meta.subjects.find((s) => s.id === row.subject_id);
    return [
      `${sub?.code} · ${locale === "th" ? sub?.name_th : sub?.name_en}`,
      meta.classes.find((c) => c.id === row.class_id)?.name,
      t(row.grading_type === "NUMERIC_GRADE" ? "numeric" : "passFail"),
      String(row.max_score),
      String(row.credits),
    ];
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("academics")}</span>
          <h1>{t(section)}</h1>
          <p>
            {t(
              section === "schemes"
                ? "immutableHint"
                : section === "subjects"
                  ? "offeringHint"
                  : "overviewDescription",
            )}
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setSaved(false);
            setEditing({ kind });
          }}
        >
          <Plus size={17} />
          {t("add")} {t(kind)}
        </button>
      </div>
      {section === "subjects" && (
        <div className="toolbar">
          <div className="segmented">
            <button
              className={tab === "subjects" ? "selected" : ""}
              onClick={() => setTab("subjects")}
            >
              {t("catalog")}
            </button>
            <button
              className={tab === "offerings" ? "selected" : ""}
              onClick={() => setTab("offerings")}
            >
              {t("offerings")}
            </button>
          </div>
        </div>
      )}
      <div className="toolbar">
        <input
          aria-label={locale === "th" ? "ค้นหารายการ" : "Search records"}
          placeholder={locale === "th" ? "ค้นหารายการ…" : "Search records…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className={`button ${!showArchived ? "primary" : ""}`}
          onClick={() => setShowArchived(false)}
        >
          {locale === "th" ? "รายการปกติ" : "Current records"} (
          {allRows.length - archivedCount})
        </button>
        <button
          className={`button ${showArchived ? "primary" : ""}`}
          onClick={() => setShowArchived(true)}
        >
          {t("archived")} ({archivedCount})
        </button>
      </div>
      {showArchived && (
        <p className="hint">
          {locale === "th"
            ? "นำออกจากรายการใช้งานแล้ว แต่เก็บประวัติคะแนนไว้ กดกู้คืนเมื่อต้องการใช้ต่อ"
            : "Removed from current records; academic history is retained. Restore to use again."}
        </p>
      )}
      <Notice error={error} message={saved ? t("saved") : message} />
      <section className="panel">
        {!rows.length ? (
          <Empty />
        ) : (
          <div className="table-wrap">
            <table className="records-table">
              <thead>
                <tr>
                  {columns.map((k) => (
                    <th key={k}>{t(k)}</th>
                  ))}
                  <th className="record-actions">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.id)}>
                    {values(row).map((value, i) => (
                      <td key={i}>
                        {value}
                        {i === 0 && !!row.archived && (
                          <span className="badge">{t("archived")}</span>
                        )}
                      </td>
                    ))}
                    <td className="record-actions">
                      <div className="row-actions record-action-grid">
                        <button
                          className="button small"
                          onClick={() => {
                            setSaved(false);
                            setEditing({ kind, record: row });
                          }}
                        >
                          {t("edit")}
                        </button>
                        {row.archived ? (
                          <button
                            className="button small"
                            disabled={busy}
                            onClick={() => restore(String(row.id))}
                          >
                            {t("restore")}
                          </button>
                        ) : (
                          <ArchiveRecord
                            kind={kind}
                            id={String(row.id)}
                            onSaved={() => {
                              setMessage(t("archived"));
                              refresh();
                            }}
                          />
                        )}
                        <DeleteRecord
                          kind={kind}
                          id={String(row.id)}
                          label={String(row.name || row.code || values(row)[0])}
                          onDeleted={(result) => {
                            setMessage(t(result));
                            setSaved(false);
                            refresh();
                          }}
                        />
                        {kind === "schemes" && (
                          <button
                            className="button small"
                            onClick={() =>
                              setEditing({
                                kind,
                                record: {
                                  ...row,
                                  id: undefined,
                                  name: `${row.name} v2`,
                                },
                              })
                            }
                          >
                            {t("newVersion")}
                          </button>
                        )}
                        {kind === "offerings" && (
                          <Link
                            className="icon-button"
                            href={`/teacher/gradebook?offering=${row.id}`}
                            aria-label={t("openGradebook")}
                          >
                            <ArrowUpRight size={17} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <RecordEditor
          {...editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setSaved(true);
            refresh();
          }}
        />
      )}
    </>
  );
}
