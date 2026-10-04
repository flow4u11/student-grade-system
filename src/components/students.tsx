"use client";
import { Select } from "./select";
import { ArchiveRecord } from "./archive-record";
import { isAdmin } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { Plus, Download, FileUp, Search } from "lucide-react";
import Link from "next/link";
import { useSchool } from "./data";
import { useLocale } from "./providers";
import { api, Empty, Loading, Notice, Pager, useError } from "./ui";
import { DeleteRecord } from "./delete-record";
import { RecordEditor } from "./record-editor";
import type { StudentListRow as Row } from "@/lib/types";
export function Students() {
  const { meta, term } = useSchool();
  const { t, locale } = useLocale();
  const errorText = useError();
  const [search, setSearch] = useState("");
  const [cls, setClass] = useState("");
  const [status, setStatus] = useState("active");
  const [scope, setScope] = useState("all");
  const [sort, setSort] = useState("class");
  const [direction, setDirection] = useState("asc");
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    query?: string;
    rows?: Row[];
    total?: number;
    error?: string;
  }>({ key: "" });
  const [editing, setEditing] = useState<{
    record?: Record<string, unknown>;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const query = JSON.stringify({
    group_term: term,
    term: scope === "term" || cls ? term : "",
    search,
    class: cls,
    status,
    sort,
    direction,
    page,
  });
  const key = `${query}:${version}`;
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api<{ rows: Row[]; total: number }>(
        "/api/staff/students-query",
        JSON.parse(query),
      )
        .then((r) => {
          if (active) setResult({ key, query, ...r });
        })
        .catch((e) => {
          if (active)
            setResult((previous) => ({
              key,
              query,
              error: e.message,
              ...(previous.query === query
                ? { rows: previous.rows, total: previous.total }
                : {}),
            }));
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, query]);
  const data = result.query === query ? result : undefined;
  async function download() {
    try {
      setDownloadError("");
      const response = await fetch("/api/staff/students-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...JSON.parse(query), locale }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `students-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(errorText(e));
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("workspace")}</span>
          <h1>{t("students")}</h1>
          <p>{t("studentListHint")}</p>
        </div>
        {isAdmin(meta.profile.role) && (
          <div className="toolbar" style={{ margin: 0 }}>
            <Link className="button" href="/teacher/import">
              <FileUp size={16} />
              {t("importExcel")}
            </Link>
            <button
              className="button primary"
              disabled={!term}
              onClick={() => setEditing({})}
            >
              <Plus size={17} />
              {t("addStudent")}
            </button>
          </div>
        )}
      </div>
      <div className="toolbar">
        <Search size={17} aria-hidden="true" />
        <input
          aria-label={t("search")}
          placeholder={t("search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <Select
          aria-label={t("class")}
          value={cls}
          onChange={(e) => {
            setClass(e.target.value);
            setPage(0);
          }}
        >
          <option value="">
            {t("class")} · {t("all")}
          </option>
          {meta.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t("term")}
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">
            {t("students")} · {t("all")}
          </option>
          <option value="term">{t("term")}</option>
        </Select>
        <Select
          aria-label={t("status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">
            {t("status")} · {t("all")}
          </option>
          <option value="active">{t("active")}</option>
          <option value="inactive">{t("inactive")}</option>
        </Select>
        <Select
          aria-label={t("sort")}
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(0);
          }}
        >
          <option value="class">{t("sortClass")}</option>
          <option value="id">{t("sortId")}</option>
          <option value="name">{t("sortName")}</option>
        </Select>
        <Select
          aria-label={t("ascending")}
          value={direction}
          onChange={(e) => {
            setDirection(e.target.value);
            setPage(0);
          }}
        >
          <option value="asc">{t("ascending")}</option>
          <option value="desc">{t("descending")}</option>
        </Select>
        <button className="button" onClick={download}>
          <Download size={16} />
          {t("export")}
        </button>
      </div>
      <Notice
        error={data?.error ? errorText(new Error(data.error)) : downloadError}
        message={message}
      />
      <p className="hint">
        {t("classGroupHint")}{" "}
        <Link className="text-link" href="/teacher/guide">
          {t("guideLink")}
        </Link>
      </p>
      <section className="panel">
        {!data ? (
          <Loading />
        ) : data.rows?.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("rollNumber")}</th>
                    <th>{t("studentNumber")}</th>
                    <th>{t("name")}</th>
                    <th>{t("class")}</th>
                    <th>{t("gpa")}</th>
                    <th>{t("status")}</th>
                    <th className="align-actions">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.roll_number ?? "—"}</td>
                      <td className="id-text">{row.student_number}</td>
                      <td>
                        <Link
                          className="student-name-link"
                          href={`/teacher/students/${row.id}?term=${term}`}
                        >
                          {row.first_name} {row.last_name}
                        </Link>
                      </td>
                      <td>
                        {meta.classes.find(
                          (c) =>
                            c.id ===
                            row.enrollments.find((e) => e.term_id === term)
                              ?.class_id,
                        )?.name || "—"}
                      </td>
                      <td
                        className="student-list-gpa"
                        title={`${t("gpaHint")} · ${locale === "th" ? "เฉพาะรายวิชาที่บัญชีนี้มีสิทธิ์ดู" : "Only courses this account may view"}`}
                      >
                        {row.gpa ?? "—"}
                      </td>
                      <td>
                        <span className={`badge ${row.active ? "green" : ""}`}>
                          {t(row.active ? "active" : "inactive")}
                        </span>
                      </td>
                      <td className="align-actions student-actions">
                        <div className="row-actions">
                          <Link
                            className="button small primary"
                            href={`/teacher/students/${row.id}?term=${term}`}
                          >
                            {t("profileGrades")}
                          </Link>
                          <button
                            className="button small"
                            onClick={() => {
                              setMessage("");
                              setEditing({
                                record: {
                                  ...row,
                                  class_id:
                                    row.enrollments.find(
                                      (e) => e.term_id === term,
                                    )?.class_id || "",
                                  term_id: term,
                                },
                              });
                            }}
                          >
                            {t("edit")}
                            {isAdmin(meta.profile.role) && ` / ${t("pin")}`}
                          </button>
                          {isAdmin(meta.profile.role) && (
                            <>
                              <ArchiveRecord
                                kind="students"
                                id={row.id}
                                onSaved={() => {
                                  setMessage(t("archived"));
                                  setVersion((v) => v + 1);
                                }}
                              />
                              <DeleteRecord
                                kind="students"
                                id={row.id}
                                label={`${row.first_name} ${row.last_name}`}
                                onDeleted={(result) => {
                                  setMessage(t(result));
                                  setPage(0);
                                  setVersion((v) => v + 1);
                                }}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={data.total || 0} onChange={setPage} />
          </>
        ) : data.error ? (
          <button className="button" onClick={() => setVersion((v) => v + 1)}>
            {t("retry")}
          </button>
        ) : (
          <Empty />
        )}
      </section>
      {editing && (
        <RecordEditor
          kind="students"
          record={editing.record}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setMessage(t("saved"));
            setVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
