"use client";
import { Select } from "./select";
import { NavTooltip } from "./nav-tooltip";
import { ConnectionStatus } from "./connection-status";
import { ThaiClock, WelcomeScreen } from "./workspace-extras";
import { NavigationScroll } from "./navigation-scroll";
import type { WorkRow } from "./course-picker";
import { isAdmin } from "@/lib/permissions";
import { useStaffIdentity } from "./staff-identity";
import { APP_VERSION } from "@/lib/version";
import { academicYear } from "@/lib/presentation";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Users,
  FileUp,
  CalendarDays,
  School,
  Library,
  Grid3X3,
  History,
  CircleHelp,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  ArrowUpRight,
  ShieldCheck,
  Settings,
  ClipboardList,
} from "lucide-react";
import Image from "next/image";
import {
  useBranding,
  useLocale,
  Preferences,
  useNavigationPreferences,
} from "./providers";
import { api, Loading, Notice, useError } from "./ui";
import { useLoad, SchoolContext, useSchool } from "./data";
import type { Meta } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";
const navGroups = [
  {
    th: "งานสอน",
    en: "Daily work",
    items: [
      ["dashboard", LayoutDashboard],
      ["gradebook", Grid3X3],
      ["students", Users],
      ["homeroom", School],
    ],
  },
  {
    th: "ทะเบียนการเรียน",
    en: "Academic records",
    admin: true,
    items: [
      ["subjects", Library],
      ["classes", School],
      ["terms", CalendarDays],
      ["schemes", ClipboardList],
    ],
  },
  {
    th: "ดูแลโรงเรียน",
    en: "School administration",
    admin: true,
    items: [
      ["import", FileUp],
      ["assignments", ShieldCheck],
      ["teachers", Users],
      ["audit", History],
    ],
  },
  {
    th: "ตั้งค่าและช่วยเหลือ",
    en: "Account & help",
    items: [
      ["settings", Settings],
      ["guide", CircleHelp],
      ["feedback", CircleHelp],
    ],
  },
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const { t, locale } = useLocale();
  const identity = useStaffIdentity();
  const school = useBranding();
  const errorText = useError();
  const { data: meta, error, reload } = useLoad<Meta>("/api/staff/meta");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const section = pathname.split("/")[2] || "dashboard";
  const [selectedTerm, setTerm] = useState(searchParams.get("term") || "");
  const { collapsed, setCollapsed } = useNavigationPreferences();
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(
    undefined,
  );
  const [mobile, setMobile] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const [studentDirection, setStudentDirection] = useState<"next" | "previous">(
    "next",
  );
  const queryTerm = searchParams.get("term");
  const term =
    (meta?.terms.some((t) => t.id === queryTerm) ? queryTerm : "") ||
    (meta?.terms.some((t) => t.id === selectedTerm) ? selectedTerm : "") ||
    meta?.terms.find((t) => t.active && !t.archived)?.id ||
    meta?.terms.find((t) => !t.archived)?.id ||
    "";
  async function logout() {
    if (unsaved && !window.confirm(t("discard"))) return;
    try {
      await api("/api/auth/logout", {});
      window.location.replace(new URL("/login", window.location.origin).href);
    } catch (e) {
      setLogoutError(errorText(e));
    }
  }
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#main">
        {t("workspace")}
      </a>
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link
          href="/teacher"
          className="brand"
          scroll={false}
          aria-label={school.short_name}
          onClick={() => setMobile(false)}
        >
          <span
            className="brand-icon"
            style={{
              color: school.primary_color,
              background: school.secondary_color,
            }}
          >
            {school.logo_url ? (
              <Image
                unoptimized
                src={school.logo_url}
                width={28}
                height={28}
                alt=""
              />
            ) : (
              <BookOpen size={22} />
            )}
          </span>
          <strong>{school.short_name}</strong>
        </Link>
        <button
          className="button small desktop-collapse"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={
            locale === "th"
              ? "ย่อหรือขยายเมนู"
              : "Collapse or expand navigation"
          }
        >
          {collapsed ? (
            <PanelLeftOpen size={19} />
          ) : (
            <>
              <PanelLeftClose size={19} />
              <span>{locale === "th" ? "ย่อเมนู" : "Collapse menu"}</span>
            </>
          )}
        </button>
        <NavigationScroll>
          {navGroups
            .filter(
              (group) =>
                !("admin" in group) ||
                isAdmin(meta?.profile.role || identity?.role),
            )
            .map((group) => (
              <div className="nav-group" key={group.en}>
                <p className="nav-label">
                  {locale === "th" ? group.th : group.en}
                </p>
                {group.items
                  .filter(
                    ([key]) =>
                      key !== "homeroom" ||
                      meta?.homerooms.some(
                        (h) =>
                          h.teacher_id === meta.profile.id &&
                          h.term_id === term,
                      ),
                  )
                  .map(([key, Icon]) => (
                    <NavTooltip
                      key={key}
                      label={t(key)}
                      enabled={collapsed && !mobile}
                    >
                      <Link
                        href={
                          key === "dashboard" ? "/teacher" : `/teacher/${key}`
                        }
                        scroll={false}
                        onNavigate={() =>
                          window.scrollTo({ top: 0, behavior: "instant" })
                        }
                        aria-label={t(key)}
                        onClick={() => setMobile(false)}
                        className={`nav-item ${section === key ? "current" : ""}`}
                        aria-current={section === key ? "page" : undefined}
                      >
                        <Icon size={19} />
                        <span>{t(key)}</span>
                      </Link>
                    </NavTooltip>
                  ))}
              </div>
            ))}
        </NavigationScroll>
        <div className="sidebar-bottom">
          <div className="profile">
            <NavTooltip label={t("profile")} enabled={collapsed && !mobile}>
              <Link
                href="/teacher/profile"
                onClick={() => setMobile(false)}
                scroll={false}
                onNavigate={() =>
                  window.scrollTo({ top: 0, behavior: "instant" })
                }
                className="profile-link"
                aria-label={t("profile")}
              >
                <span className="avatar">
                  {(avatarUrl ?? meta?.profile.avatar_url) ? (
                    <Image
                      unoptimized
                      src={avatarUrl ?? meta?.profile.avatar_url ?? ""}
                      width={35}
                      height={35}
                      alt=""
                    />
                  ) : (
                    (
                      meta?.profile.display_name ||
                      identity?.display_name ||
                      t("teacher")
                    ).slice(0, 1)
                  )}
                  <ConnectionStatus dot />
                </span>
                <div>
                  <strong>
                    {meta?.profile.display_name ||
                      identity?.display_name ||
                      t("teacher")}
                  </strong>
                  <small>{t("profile")} ↗</small>
                </div>
              </Link>
            </NavTooltip>
            <button
              className="icon-button"
              aria-label={t("signOut")}
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="scrim"
          aria-label={t("close")}
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-toggle"
              aria-label={t("workspace")}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={22} />
            </button>
            <span>{t("teacherPortal")}</span>
            <span className="separator">/</span>
            <strong>{t(section as MessageKey)}</strong>
          </div>
          <div className="topbar-tools">
            {isAdmin(meta?.profile.role || identity?.role) && (
              <Link
                className="button small invite-shortcut"
                href="/teacher/settings#teacher-invitations"
              >
                <UserPlus size={16} />
                {locale === "th" ? "เชิญครู" : "Invite teacher"}
              </Link>
            )}
            <ThaiClock />
            <Preferences compact />
            <label className="term-picker">
              <span className="sr-only">{t("term")}</span>
              <Select
                aria-label={t("term")}
                disabled={!meta}
                value={term}
                onChange={(e) => {
                  if (!unsaved || window.confirm(t("discard"))) {
                    setUnsaved(false);
                    setTerm(e.target.value);
                    const query = new URLSearchParams(searchParams.toString());
                    query.set("term", e.target.value);
                    router.replace(`${pathname}?${query}`, { scroll: false });
                  }
                }}
              >
                {meta?.terms.length ? (
                  meta.terms
                    .filter((t) => !t.archived || t.id === term)
                    .map((term) => (
                      <option key={term.id} value={term.id}>
                        {academicYear(term.academic_year, locale)} · {term.name}
                      </option>
                    ))
                ) : (
                  <option value="">{t(meta ? "noTerm" : "loading")}</option>
                )}
              </Select>
            </label>
          </div>
        </header>
        <main id="main" className="workspace">
          <Notice error={logoutError} />
          {error ? (
            <>
              <Notice error={errorText(error)} />
              <button className="button" onClick={reload}>
                {t("retry")}
              </button>
            </>
          ) : meta ? (
            <SchoolContext.Provider
              value={{
                meta: {
                  ...meta,
                  profile: {
                    ...meta.profile,
                    avatar_url: avatarUrl ?? meta.profile.avatar_url,
                  },
                },
                setAvatarUrl,
                term,
                setTerm,
                refresh: reload,
                unsaved,
                setUnsaved,
                studentDirection,
                setStudentDirection,
              }}
            >
              {children}
            </SchoolContext.Provider>
          ) : (
            <Loading />
          )}
        </main>
        <WelcomeScreen
          name={
            meta?.profile.display_name || identity?.display_name || t("teacher")
          }
        />
        <footer className="workspace-footer">
          <ShieldCheck size={14} />
          {t("privacyNote")} · v{APP_VERSION}
        </footer>
      </div>
    </div>
  );
}
export function Dashboard() {
  const { t, locale } = useLocale();
  const th = locale === "th";
  const { meta, term } = useSchool();
  const errorText = useError();
  const { data, error, reload } = useLoad<{ rows: WorkRow[] }>(
    term ? `/api/staff/work?term=${term}` : null,
  );
  const [filter, setFilter] = useState<"all" | "pending" | "complete">("all");
  const { data: summary } = useLoad<{ counts: number[] }>(
    "/api/staff/dashboard",
  );
  const rows = data?.rows || [];
  const total = rows.reduce((n, r) => n + r.total, 0);
  const recorded = rows.reduce((n, r) => n + r.recorded, 0);
  const published = rows.reduce((n, r) => n + r.published, 0);
  const pending = rows.filter((r) => r.recorded < r.total).length;
  const visible = rows.filter(
    (r) =>
      filter === "all" ||
      (filter === "pending" ? r.recorded < r.total : r.recorded >= r.total),
  );
  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">{t("dashboard")}</span>
          <h1>
            {th ? "สวัสดี คุณครู" : "Hello, "}
            {th ? " " : ""}
            {meta.profile.display_name}
          </h1>
          <p>{t("myWork")}</p>
        </div>
        <div className="dashboard-heading-actions">
          <div className="student-total">
            <Users size={18} />
            <strong>{summary?.counts[0] ?? "—"}</strong>
            <span>
              {isAdmin(meta.profile.role)
                ? th
                  ? "นักเรียนทั้งหมด"
                  : "All students"
                : th
                  ? "นักเรียนที่มีสิทธิ์ดู"
                  : "Accessible students"}
            </span>
          </div>{" "}
          <Link className="button" href="/teacher/guide">
            <CircleHelp size={17} />
            {t("guide")}
          </Link>
        </div>
      </div>
      <Notice error={error && errorText(error)} />
      {error ? (
        <button className="button" onClick={reload}>
          {t("retry")}
        </button>
      ) : !data && term ? (
        <Loading />
      ) : !rows.length ? (
        <section className="panel">
          <div className="empty">
            <p>
              {isAdmin(meta.profile.role)
                ? t("noAssignments")
                : t("awaitAssignment")}
            </p>
            {isAdmin(meta.profile.role) && (
              <Link className="button primary" href="/teacher/subjects">
                {t("offerings")}
              </Link>
            )}
          </div>
        </section>
      ) : (
        <>
          <section
            className="dashboard-overview panel"
            aria-label={th ? "ความคืบหน้าการกรอกเกรด" : "Grading progress"}
          >
            <div className="dashboard-progress">
              <span className="muted">
                {th ? "ความคืบหน้าทั้งหมด" : "Overall progress"}
              </span>
              <strong>
                {total ? Math.round((recorded / total) * 100) : 0}
                <small>%</small>
              </strong>
              <progress
                aria-label={th ? "ความคืบหน้าทั้งหมด" : "Overall progress"}
                max={Math.max(1, total)}
                value={recorded}
              />
            </div>
            <div className="dashboard-stat">
              <strong>{rows.length}</strong>
              <span>{th ? "รายวิชาที่เปิดสอน" : "Courses"}</span>
            </div>
            <div className="dashboard-stat">
              <strong>{Math.max(0, total - recorded)}</strong>
              <span>{th ? "คะแนนที่ยังไม่กรอก" : "Results remaining"}</span>
            </div>
            <div className="dashboard-stat">
              <strong>{published}</strong>
              <span>{th ? "ผลที่ประกาศแล้ว" : "Published results"}</span>
            </div>
          </section>
          <div className="work-heading">
            <h2>{th ? "รายวิชาของคุณ" : "Your courses"}</h2>
            <div
              className="work-filters"
              role="group"
              aria-label={th ? "กรองงาน" : "Filter courses"}
            >
              {(
                [
                  ["all", th ? "ทั้งหมด" : "All", rows.length],
                  ["pending", th ? "ยังไม่ครบ" : "In progress", pending],
                  [
                    "complete",
                    th ? "กรอกครบแล้ว" : "Completed",
                    rows.length - pending,
                  ],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  className={`button small ${filter === value ? "primary" : ""}`}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="work-grid">
            {visible.map((o) => {
              const sub = meta.subjects.find((s) => s.id === o.subject_id);
              const name =
                (th ? sub?.name_th : sub?.name_en) || sub?.name_th || "—";
              const room = meta.classes.find((c) => c.id === o.class_id)?.name;
              return (
                <Link
                  className="panel work-card work-card-link"
                  key={o.id}
                  href={`/teacher/gradebook?offering=${o.id}&term=${term}`}
                >
                  <div className="work-card-top">
                    <span className="badge">{room}</span>
                    <span className="muted">{sub?.code}</span>
                    <ArrowUpRight size={18} />
                  </div>
                  <h2>{name}</h2>
                  <div className="work-card-count">
                    <span>{t("recordedCount")}</span>
                    <strong>
                      {o.recorded}
                      <span> / {o.total}</span>
                    </strong>
                  </div>
                  <progress
                    aria-label={`${name} ${room} ${t("recordedCount")}`}
                    max={Math.max(1, o.total)}
                    value={o.recorded}
                  />
                  <div className="work-card-bottom">
                    <span>
                      {o.published} {t("published")}
                    </span>
                    <span className="text-link">
                      {t(
                        o.total > o.recorded
                          ? "continueGrading"
                          : "openGradebook",
                      )}{" "}
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          {!visible.length && (
            <p className="empty">
              {th ? "ไม่มีรายวิชาในรายการนี้" : "No courses in this view"}
            </p>
          )}
        </>
      )}
    </>
  );
}
