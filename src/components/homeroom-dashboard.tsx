"use client";
import { useState } from "react";
import Link from "next/link";
import { Users, BookOpen, ArrowUpRight, Search } from "lucide-react";
import { useSchool, useLoad } from "./data";
import { useLocale } from "./providers";
import { Select } from "./select";
import { Loading, Notice, Pager, useError } from "./ui";
import { isAdmin } from "@/lib/permissions";
import type { StudentListRow } from "@/lib/types";
import type { WorkRow } from "./course-picker";
export function HomeroomDashboard() {
  const { meta, term } = useSchool();
  const { locale, t } = useLocale();
  const th = locale === "th";
  const classes = meta.classes.filter((c) =>
    meta.homerooms.some(
      (h) =>
        h.class_id === c.id &&
        h.term_id === term &&
        (isAdmin(meta.profile.role) || h.teacher_id === meta.profile.id),
    ),
  );
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const room = classes.some((c) => c.id === selected)
    ? selected
    : classes[0]?.id;
  const query = new URLSearchParams({
    group_term: term,
    term,
    class: room || "",
    search,
    status: "active",
    sort: "class",
    direction: "asc",
    page: String(page),
  });
  const { data, error, reload } = useLoad<{
    rows: StudentListRow[];
    total: number;
  }>(room && term ? `/api/staff/students?${query}` : null);
  const { data: work } = useLoad<{ rows: WorkRow[] }>(
    room && term ? `/api/staff/work?term=${term}` : null,
  );
  const errorText = useError();
  const courses = work?.rows.filter((o) => o.class_id === room) || [];
  const expected = courses.reduce((n, o) => n + o.total, 0);
  const published = courses.reduce((n, o) => n + o.published, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{th ? "ครูประจำชั้น" : "Homeroom"}</span>
          <h1>{t("homeroom")}</h1>
          <p>
            {th
              ? "ดูนักเรียนและผลการเรียนทุกวิชา แก้ไขเกรดได้เฉพาะวิชาที่คุณสอน"
              : "View every subject in your class. Edit grades only for courses you teach."}
          </p>
        </div>
        {classes.length > 0 && (
          <Select
            aria-label={t("class")}
            value={room || ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setPage(0);
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      {!room ? (
        <div className="panel empty">
          {th
            ? "ยังไม่ได้รับมอบหมายห้องประจำชั้นในภาคเรียนนี้"
            : "No homeroom assignment in this term."}
        </div>
      ) : (
        <>
          <div className="classroom-overview">
            <div className="panel classroom-stat">
              <Users size={20} />
              <strong>{data?.total ?? "—"}</strong>
              <span>
                {search
                  ? th
                    ? "นักเรียนที่ค้นพบ"
                    : "Matching students"
                  : t("students")}
              </span>
            </div>
            <div className="panel classroom-stat">
              <BookOpen size={20} />
              <strong>{courses.length}</strong>
              <span>{th ? "รายวิชาของห้อง" : "Class subjects"}</span>
            </div>
            <div className="panel classroom-stat">
              <strong>
                {expected ? Math.round((published / expected) * 100) : 0}%
              </strong>
              <span>{th ? "ประกาศผลแล้ว" : "Published"}</span>
              <progress
                value={published}
                max={expected || 1}
                aria-label={t("published")}
              />
            </div>
          </div>
          <div className="toolbar">
            <Search size={17} />
            <input
              aria-label={t("search")}
              placeholder={t("search")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            <button className="button small" onClick={reload}>
              {t("refresh")}
            </button>
          </div>
          <Notice error={error && errorText(error)} />
          {!data && !error ? (
            <Loading layout="table" />
          ) : (
            data && (
              <section className="panel table-panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("rollNumber")}</th>
                        <th>{t("studentNumber")}</th>
                        <th>{t("student")}</th>
                        <th>GPA</th>
                        <th className="actions-cell">{t("actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((student) => (
                        <tr key={student.id}>
                          <td>{student.roll_number ?? "—"}</td>
                          <td>{student.student_number}</td>
                          <td>
                            <Link
                              className="student-name-link"
                              href={`/teacher/students/${student.id}?term=${term}`}
                            >
                              {student.first_name} {student.last_name}
                            </Link>
                          </td>
                          <td>{student.gpa ?? "—"}</td>
                          <td className="actions-cell">
                            <Link
                              className="button small"
                              href={`/teacher/students/${student.id}?term=${term}`}
                            >
                              {th ? "ดูโปรไฟล์" : "View profile"}
                              <ArrowUpRight size={15} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={page} total={data.total} onChange={setPage} />
              </section>
            )
          )}
          <div className="work-grid homeroom-course-grid">
            {courses.map((course) => {
              const subject = meta.subjects.find(
                (s) => s.id === course.subject_id,
              );
              return (
                <Link
                  className="panel work-card work-card-link"
                  key={course.id}
                  href={`/teacher/gradebook?offering=${course.id}&term=${term}`}
                >
                  <span className="muted">{subject?.code}</span>
                  <h2>
                    {(th ? subject?.name_th : subject?.name_en) ||
                      subject?.name_th}
                  </h2>
                  <progress
                    max={course.total || 1}
                    value={course.recorded}
                    aria-label={t("recordedCount")}
                  />
                  <small>
                    {course.recorded}/{course.total} {t("recordedCount")} ·{" "}
                    {course.published} {t("published")}
                  </small>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
