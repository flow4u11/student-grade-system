"use client";
import { isAdmin } from "@/lib/permissions";
import { useState } from "react";
import { useLoad, useSchool } from "./data";
import { useLocale } from "./providers";
import { Empty, Loading, Notice, Pager, useError } from "./ui";
type Log = {
  id: number;
  actor: string | null;
  action: string;
  entity: string;
  created_at: string;
  before_data: unknown;
  after_data: unknown;
};
export function Audit() {
  const { meta } = useSchool();
  const { t, locale } = useLocale();
  const errorText = useError();
  const [page, setPage] = useState(0);
  const { data, error } = useLoad<{ rows: Log[]; total: number }>(
    isAdmin(meta.profile.role) ? `/api/staff/audit?page=${page}` : null,
  );
  if (!isAdmin(meta.profile.role)) return <Notice error={t("forbidden")} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("workspace")}</span>
          <h1>{t("audit")}</h1>
          <p>{t("auditDescription")}</p>
        </div>
      </div>
      <Notice error={error && errorText(error)} />
      <section className="panel">
        {!data && !error ? (
          <Loading />
        ) : !data?.rows.length ? (
          <Empty />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("timestamp")}</th>
                    <th>{t("actor")}</th>
                    <th>{t("action")}</th>
                    <th>{t("entity")}</th>
                    <th>{t("details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {new Intl.DateTimeFormat(
                          locale === "th" ? "th-TH" : "en-GB",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Asia/Bangkok",
                          },
                        ).format(new Date(row.created_at))}
                      </td>
                      <td className="id-text">
                        {row.actor === meta.profile.id
                          ? meta.profile.display_name
                          : row.actor || t("systemActor")}
                      </td>
                      <td>
                        <span className="badge">{row.action}</span>
                      </td>
                      <td>{row.entity}</td>
                      <td>
                        <details>
                          <summary>{t("details")}</summary>
                          <div className="audit-detail">
                            <strong>{t("before")}</strong>
                            <pre>
                              {JSON.stringify(row.before_data, null, 2)}
                            </pre>
                            <strong>{t("after")}</strong>
                            <pre>{JSON.stringify(row.after_data, null, 2)}</pre>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={data.total} onChange={setPage} />
          </>
        )}
      </section>
    </>
  );
}
