"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutDashboard,
  MessageSquare,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Select } from "./select";
import {
  demoGrade,
  demoStudents,
  demoSubjects,
  demoTeachers,
  type DemoStudent,
} from "@/lib/demo-data";

type View =
  | "dashboard"
  | "students"
  | "profile"
  | "grades"
  | "classrooms"
  | "courses"
  | "terms"
  | "criteria"
  | "teachers"
  | "teacher-profile"
  | "assignments"
  | "audit"
  | "settings"
  | "guide"
  | "feedback";
type ScoreBook = Record<string, number[]>;
const initialScores = () =>
  Object.fromEntries(
    demoStudents.map((student) => [student.id, [...student.scores]]),
  );
const allPublished = () =>
  new Set(
    demoStudents.flatMap((student) =>
      demoSubjects.map((_, index) => `${student.id}:${index}`),
    ),
  );
const menuGroups = [
  {
    title: "การสอน",
    items: [
      { view: "dashboard", label: "ภาพรวม", Icon: LayoutDashboard },
      { view: "students", label: "นักเรียน", Icon: Users },
      { view: "grades", label: "บันทึกผลการเรียน", Icon: ClipboardList },
      { view: "classrooms", label: "ห้องเรียน", Icon: Home },
    ],
  },
  {
    title: "จัดการโรงเรียน",
    items: [
      { view: "courses", label: "รายวิชา", Icon: BookOpen },
      { view: "terms", label: "ภาคเรียน", Icon: CalendarDays },
      { view: "criteria", label: "เกณฑ์การตัดเกรด", Icon: SlidersHorizontal },
      { view: "teachers", label: "บัญชีครู", Icon: UserRound },
      { view: "assignments", label: "มอบหมายวิชา", Icon: GraduationCap },
      { view: "audit", label: "ประวัติการเปลี่ยนแปลง", Icon: Activity },
    ],
  },
  {
    title: "เพิ่มเติม",
    items: [
      { view: "settings", label: "ตั้งค่า", Icon: Settings },
      { view: "guide", label: "วิธีใช้งาน", Icon: HelpCircle },
      { view: "feedback", label: "ข้อเสนอแนะ", Icon: MessageSquare },
    ],
  },
];
const viewTitles: Record<View, string> = {
  dashboard: "ภาพรวม",
  students: "นักเรียน",
  profile: "โปรไฟล์นักเรียน",
  grades: "บันทึกผลการเรียน",
  classrooms: "ห้องเรียน",
  courses: "รายวิชา",
  terms: "ภาคเรียน",
  criteria: "เกณฑ์การตัดเกรด",
  teachers: "บัญชีครู",
  "teacher-profile": "โปรไฟล์ครู",
  assignments: "มอบหมายวิชา",
  audit: "ประวัติการเปลี่ยนแปลง",
  settings: "ตั้งค่า",
  guide: "วิธีใช้งาน",
  feedback: "ข้อเสนอแนะ",
};

export function DemoWorkspace() {
  const [view, setView] = useState<View>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState(demoStudents[0].id);
  const [teacherId, setTeacherId] = useState(demoTeachers[0].id);
  const [course, setCourse] = useState("0");
  const [classroom, setClassroom] = useState("all");
  const [role, setRole] = useState("admin");
  const [scores, setScores] = useState<ScoreBook>(initialScores);
  const [draft, setDraft] = useState<ScoreBook>(initialScores);
  const [published, setPublished] = useState(allPublished);
  const [theme, setTheme] = useState("light");
  const [primary, setPrimary] = useState("#4968b4");
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState("");
  const [clock, setClock] = useState("");
  const [audit, setAudit] = useState([
    {
      action: "ประกาศผลการเรียนตัวอย่าง",
      actor: "ครูภาษาไทย ตัวอย่าง",
      time: "ข้อมูลสาธิต",
    },
    {
      action: "บันทึกคะแนนตัวอย่าง",
      actor: "ครูคณิตศาสตร์ ตัวอย่าง",
      time: "ข้อมูลสาธิต",
    },
    {
      action: "สร้างภาคเรียนและห้องเรียนตัวอย่าง",
      actor: "ผู้ดูแล ตัวอย่าง",
      time: "ข้อมูลสาธิต",
    },
  ]);
  const student = demoStudents.find((item) => item.id === studentId)!;
  const teacher = demoTeachers.find((item) => item.id === teacherId)!;
  const currentCourse = Number(course);
  const dirty = demoStudents.some((item) =>
    draft[item.id].some((score, index) => score !== scores[item.id][index]),
  );
  const invalid = demoStudents.some((item) =>
    draft[item.id].some(
      (score) => !Number.isFinite(score) || score < 0 || score > 100,
    ),
  );
  const visibleStudents = demoStudents.filter(
    (item) =>
      (classroom === "all" || item.classroom === classroom) &&
      `${item.name} ${item.code} ${item.classroom}`.includes(search.trim()),
  );

  useEffect(() => {
    const update = () =>
      setClock(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Bangkok",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  function navigate(next: View) {
    setView(next);
    setSearch("");
  }
  function openStudent(item: DemoStudent) {
    setStudentId(item.id);
    navigate("profile");
  }
  function addAudit(action: string) {
    setAudit((items) => [
      {
        action,
        actor: role === "admin" ? "ผู้ดูแล ตัวอย่าง" : "ครูภาษาไทย ตัวอย่าง",
        time: "เมื่อสักครู่",
      },
      ...items,
    ]);
  }
  function gpa(item: DemoStudent) {
    let credits = 0,
      total = 0;
    demoSubjects.forEach((subject, index) => {
      if (published.has(`${item.id}:${index}`)) {
        credits += subject.credits;
        total += demoGrade(scores[item.id][index]) * subject.credits;
      }
    });
    return credits ? total / credits : null;
  }
  function changeScore(item: DemoStudent, index: number, value: string) {
    setDraft((items) => ({
      ...items,
      [item.id]: items[item.id].map((score, position) =>
        position === index ? Number(value) : score,
      ),
    }));
  }
  function save() {
    if (invalid) {
      setNotice("คะแนนตัวอย่างต้องอยู่ระหว่าง 0–100");
      return;
    }
    setPublished((items) => {
      const next = new Set(items);
      demoStudents.forEach((item) =>
        draft[item.id].forEach((score, index) => {
          if (score !== scores[item.id][index])
            next.delete(`${item.id}:${index}`);
        }),
      );
      return next;
    });
    setScores(
      Object.fromEntries(
        Object.entries(draft).map(([id, values]) => [id, [...values]]),
      ),
    );
    setNotice("บันทึกฉบับร่างในเดโมแล้ว · ข้อมูลจะคืนค่าเมื่อรีเฟรช");
    addAudit("บันทึกคะแนนฉบับร่างในเดโม");
  }
  function publish() {
    setPublished((items) => {
      const next = new Set(items);
      demoStudents.forEach((item) =>
        demoSubjects.forEach((_, index) => {
          if (role === "admin" || index === 0) next.add(`${item.id}:${index}`);
        }),
      );
      return next;
    });
    setNotice("ประกาศผลในเดโมแล้ว · ไม่ได้ส่งข้อมูลไปยังระบบจริง");
    addAudit("ประกาศผลการเรียนในเดโม");
  }
  function reset() {
    setScores(initialScores());
    setDraft(initialScores());
    setPublished(allPublished());
    setNotice("คืนค่าข้อมูลสมมติเริ่มต้นแล้ว");
  }
  function exportSample() {
    const rows = [
      ["เลขที่", "รหัสนักเรียน", "ชื่อ", "ห้องเรียน", "GPA"],
      ...visibleStudents.map((item) => [
        String(item.number),
        `="${item.code}"`,
        item.name,
        item.classroom,
        gpa(item)?.toFixed(2) ?? "",
      ]),
    ];
    const content = rows
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "school-ledger-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("ดาวน์โหลดเฉพาะข้อมูลสมมติเป็น CSV แล้ว");
  }
  function gradeBadge(value: number | null, label?: string) {
    return (
      <span
        className={`demo-grade ${value === null ? "" : value >= 4 ? "gold" : value >= 3 ? "good" : value >= 2 ? "fair" : "low"}`}
      >
        {label}
        {value === null ? "—" : value.toFixed(2)}
      </span>
    );
  }
  function searchField(placeholder: string) {
    return (
      <label className="demo-search">
        <Search size={18} aria-hidden="true" />
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
    );
  }
  function scoreField(item: DemoStudent, index: number) {
    return (
      <input
        className="demo-score-input"
        aria-label={`คะแนน ${item.name} ${demoSubjects[index].name}`}
        type="number"
        min="0"
        max="100"
        step="1"
        disabled={role === "teacher" && index !== 0}
        value={draft[item.id][index]}
        onChange={(event) => changeScore(item, index, event.target.value)}
      />
    );
  }
  function gradeToolbar() {
    return (
      <div className="demo-toolbar demo-grade-toolbar">
        <span>{dirty ? "มีการเปลี่ยนแปลงในเดโม" : "บันทึกครบแล้ว"}</span>
        <div className="demo-actions">
          <button
            className="demo-button demo-primary"
            disabled={!dirty || invalid}
            onClick={save}
          >
            <Save size={16} />
            บันทึกเดโม
          </button>
          <button
            className="demo-button"
            disabled={
              dirty ||
              demoStudents.every((item) =>
                demoSubjects.every((_, index) =>
                  role === "teacher" && index !== 0
                    ? true
                    : published.has(`${item.id}:${index}`),
                ),
              )
            }
            onClick={publish}
          >
            <Send size={16} />
            ประกาศผลเดโม
          </button>
        </div>
      </div>
    );
  }
  function studentTable(items: DemoStudent[]) {
    return (
      <div className="demo-table-scroll">
        <table className="demo-table">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>รหัสนักเรียน</th>
              <th>ชื่อ</th>
              <th>ห้องเรียน</th>
              <th>GPA</th>
              <th className="demo-align-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.number}</td>
                <td className="demo-muted">{item.code}</td>
                <td>
                  <button
                    className="demo-text-link"
                    onClick={() => openStudent(item)}
                  >
                    {item.name}
                  </button>
                </td>
                <td>{item.classroom}</td>
                <td>{gradeBadge(gpa(item))}</td>
                <td className="demo-align-right">
                  <button
                    className="demo-button demo-small"
                    onClick={() => openStudent(item)}
                  >
                    โปรไฟล์ / กรอกเกรด <ChevronRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div className="demo-empty">ไม่พบข้อมูลสมมติที่ตรงกับการค้นหา</div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`demo-workspace ${collapsed ? "demo-collapsed" : ""} ${theme === "dark" ? "demo-dark" : ""}`}
      style={{ "--demo-primary": primary } as CSSProperties}
    >
      <aside className="demo-sidebar">
        <Link href="/" className="demo-brand" aria-label="กลับหน้าแรก">
          <span>
            <GraduationCap size={23} />
          </span>
          {!collapsed && (
            <strong>
              School Ledger<small>พื้นที่ทดลอง</small>
            </strong>
          )}
        </Link>
        <div className="demo-nav-scroll">
          <nav aria-label="เมนูเดโม">
            {menuGroups.map((group) => (
              <section className="demo-nav-group" key={group.title}>
                {!collapsed && <h2>{group.title}</h2>}
                {group.items.map(({ view: next, label, Icon }) => (
                  <button
                    key={next}
                    aria-current={view === next ? "page" : undefined}
                    aria-label={label}
                    className={`demo-nav-item ${view === next || (next === "students" && view === "profile") || (next === "teachers" && view === "teacher-profile") ? "active" : ""}`}
                    onClick={() => navigate(next as View)}
                  >
                    <Icon size={19} aria-hidden="true" />
                    {!collapsed && <span>{label}</span>}
                    {collapsed && (
                      <span className="demo-nav-tooltip" role="tooltip">
                        {label}
                      </span>
                    )}
                  </button>
                ))}
              </section>
            ))}
          </nav>
        </div>
        <div className="demo-sidebar-footer">
          <button
            className="demo-nav-item"
            aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
            {!collapsed && <span>ย่อเมนู</span>}
          </button>
          <button
            className="demo-account"
            onClick={() => {
              setTeacherId(demoTeachers[0].id);
              navigate("teacher-profile");
            }}
            aria-label="ดูโปรไฟล์ครูตัวอย่าง"
          >
            <span className="demo-avatar">
              <UserRound size={20} />
              <i aria-hidden="true" />
            </span>
            {!collapsed && (
              <span>
                <strong>
                  {role === "admin"
                    ? "ผู้ดูแล ตัวอย่าง"
                    : "ครูภาษาไทย ตัวอย่าง"}
                </strong>
                <small>บัญชีสาธิต</small>
              </span>
            )}
          </button>
        </div>
      </aside>
      <div className="demo-main">
        <header className="demo-topbar">
          <div>
            <span className="demo-muted">พื้นที่ทดลอง</span>
            <ChevronRight size={14} />
            <strong>{viewTitles[view]}</strong>
          </div>
          <div>
            <span className="demo-clock" aria-label="วันที่และเวลาประเทศไทย">
              {clock ? `${clock} · ไทย` : "เวลาประเทศไทย"}
            </span>
            <span className="demo-term">
              <CalendarDays size={16} />
              2569 · ภาคเรียนที่ 1
            </span>
            <Select
              aria-label="บทบาทตัวอย่าง"
              value={role}
              disabled={dirty}
              onChange={(event) => {
                setRole(event.target.value);
                setNotice(
                  "เปลี่ยนบทบาทสาธิตแล้ว · สิทธิ์ในระบบจริงต้องได้รับจากผู้ดูแล",
                );
              }}
            >
              <option value="admin">ผู้ดูแล ตัวอย่าง</option>
              <option value="teacher">ครู ตัวอย่าง</option>
            </Select>
          </div>
        </header>
        <div className="demo-banner">
          <ShieldCheck size={18} />
          <p>
            <strong>เดโมสาธารณะ</strong> ข้อมูลทั้งหมดสมมติ
            ทดลองแก้คะแนนได้ในหน้านี้เท่านั้น และจะคืนค่าเมื่อรีเฟรช
          </p>
          <Link href="/login" prefetch={false}>
            เข้าสู่ระบบจริง <ArrowRight size={15} />
          </Link>
        </div>
        <main className="demo-content">
          <div className="demo-page-heading">
            <div>
              <span className="demo-overline">SCHOOL LEDGER DEMO</span>
              <h1>{viewTitles[view]}</h1>
            </div>
            <button className="demo-button demo-small" onClick={reset}>
              <RotateCcw size={15} />
              คืนค่าตัวอย่าง
            </button>
          </div>
          <div
            className="demo-view"
            key={view === "profile" ? `${view}:${studentId}` : view}
          >
            {view === "dashboard" && (
              <>
                <section className="demo-welcome">
                  <div>
                    <span className="demo-overline">
                      เริ่มต้นได้โดยไม่ต้องเข้าสู่ระบบ
                    </span>
                    <h2>ยินดีต้อนรับสู่ School Ledger</h2>
                    <p>
                      ลองค้นหานักเรียน เปิดโปรไฟล์ และแก้คะแนนในพื้นที่ทดลองนี้
                    </p>
                    <button
                      className="demo-button demo-primary"
                      onClick={() => navigate("students")}
                    >
                      สำรวจนักเรียน <ArrowRight size={16} />
                    </button>
                  </div>
                  <Sparkles size={70} strokeWidth={1} />
                </section>
                <div className="demo-stats">
                  {[
                    {
                      label: "นักเรียนทั้งหมด",
                      value: demoStudents.length,
                      Icon: Users,
                    },
                    { label: "ห้องเรียน", value: 2, Icon: Home },
                    {
                      label: "รายวิชา",
                      value: demoSubjects.length,
                      Icon: BookOpen,
                    },
                    {
                      label: "ผลที่ประกาศแล้ว",
                      value: published.size,
                      Icon: CheckCircle2,
                    },
                  ].map(({ label, value, Icon }) => (
                    <article className="demo-card demo-stat" key={label}>
                      <span>
                        <Icon size={20} />
                      </span>
                      <strong>{value}</strong>
                      <small>{label}</small>
                    </article>
                  ))}
                </div>
                <div className="demo-two-column">
                  <section className="demo-card">
                    <div className="demo-card-heading">
                      <h2>รายวิชาในภาคเรียนนี้</h2>
                      <button
                        className="demo-text-link"
                        onClick={() => navigate("grades")}
                      >
                        บันทึกผลการเรียน <ArrowRight size={15} />
                      </button>
                    </div>
                    {demoSubjects.map((subject, index) => (
                      <button
                        className="demo-course-row"
                        key={subject.code}
                        onClick={() => {
                          setCourse(String(index));
                          navigate("grades");
                        }}
                      >
                        <div>
                          <strong>{subject.name}</strong>
                          <small>
                            {subject.code} · {subject.teacher}
                          </small>
                        </div>
                        <span>
                          {
                            demoStudents.filter((item) =>
                              published.has(`${item.id}:${index}`),
                            ).length
                          }
                          /{demoStudents.length} ประกาศแล้ว{" "}
                          <ChevronRight size={16} />
                        </span>
                      </button>
                    ))}
                  </section>
                  <section className="demo-card">
                    <h2>กิจกรรมล่าสุด</h2>
                    <div className="demo-timeline">
                      {audit.slice(0, 4).map((entry, index) => (
                        <div key={index}>
                          <i />
                          <span>
                            <strong>{entry.action}</strong>
                            <small>
                              {entry.actor} · {entry.time}
                            </small>
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      className="demo-text-link"
                      onClick={() => navigate("audit")}
                    >
                      ดูประวัติทั้งหมด <ArrowRight size={15} />
                    </button>
                  </section>
                </div>
              </>
            )}
            {view === "students" && (
              <>
                <div className="demo-toolbar">
                  {searchField("ค้นหาชื่อหรือรหัสนักเรียน")}
                  <Select
                    aria-label="ห้องเรียนตัวอย่าง"
                    value={classroom}
                    onChange={(event) => setClassroom(event.target.value)}
                  >
                    <option value="all">ห้องเรียน · ทั้งหมด</option>
                    <option value="ม.1/1">ม.1/1</option>
                    <option value="ม.1/2">ม.1/2</option>
                  </Select>
                  <button className="demo-button" onClick={exportSample}>
                    <Download size={16} />
                    ดาวน์โหลด CSV ตัวอย่าง
                  </button>
                </div>
                <p className="demo-muted">
                  {visibleStudents.length} คน · GPA
                  คำนวณจากผลตัวอย่างที่ประกาศแล้ว
                </p>
                <section className="demo-card demo-flush">
                  {studentTable(visibleStudents)}
                </section>
              </>
            )}
            {view === "profile" && (
              <>
                <div className="demo-profile-header demo-card">
                  <span className="demo-large-avatar">
                    <UserRound size={35} />
                  </span>
                  <div>
                    <h2>{student.name}</h2>
                    <p>
                      รหัส {student.code} · เลขที่ {student.number} ·{" "}
                      {student.classroom}
                    </p>
                    <small className="demo-muted">
                      ครูประจำชั้น:{" "}
                      {student.classroom === "ม.1/1"
                        ? demoTeachers[0].name
                        : demoTeachers[1].name}
                    </small>
                  </div>
                  <div className="demo-profile-gpa">
                    <small>GPA ที่ประกาศแล้ว</small>
                    {gradeBadge(gpa(student))}
                  </div>
                </div>
                <div className="demo-toolbar">
                  <div className="demo-actions">
                    <button
                      className="demo-button"
                      disabled={demoStudents.indexOf(student) === 0 || dirty}
                      onClick={() =>
                        setStudentId(
                          demoStudents[demoStudents.indexOf(student) - 1].id,
                        )
                      }
                    >
                      <ArrowLeft size={16} />
                      คนก่อนหน้า
                    </button>
                    <button
                      className="demo-button"
                      disabled={
                        demoStudents.indexOf(student) ===
                          demoStudents.length - 1 || dirty
                      }
                      onClick={() =>
                        setStudentId(
                          demoStudents[demoStudents.indexOf(student) + 1].id,
                        )
                      }
                    >
                      คนถัดไป <ArrowRight size={16} />
                    </button>
                  </div>
                  <button
                    className="demo-text-link"
                    onClick={() => navigate("students")}
                  >
                    กลับรายชื่อนักเรียน
                  </button>
                </div>
                <section className="demo-card demo-flush">
                  {gradeToolbar()}
                  <div className="demo-table-scroll">
                    <table className="demo-table">
                      <thead>
                        <tr>
                          <th>รายวิชา</th>
                          <th>ครูผู้สอน</th>
                          <th>คะแนน / 100</th>
                          <th>เกรด</th>
                          <th>สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {demoSubjects.map((subject, index) => (
                          <tr key={subject.code}>
                            <td>
                              <strong>{subject.name}</strong>
                              <small className="demo-cell-subtitle">
                                {subject.code} · {subject.credits} หน่วยกิต
                              </small>
                            </td>
                            <td>{subject.teacher}</td>
                            <td>{scoreField(student, index)}</td>
                            <td>
                              {gradeBadge(demoGrade(draft[student.id][index]))}
                            </td>
                            <td>
                              <span className="demo-status">
                                {published.has(`${student.id}:${index}`)
                                  ? "ประกาศแล้ว"
                                  : "ฉบับร่าง"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <p className="demo-muted">
                  แก้คะแนน → บันทึกเดโม → ประกาศผลเดโม แล้วดู GPA
                  เปลี่ยนตามผลที่ประกาศ
                </p>
              </>
            )}
            {view === "grades" && (
              <>
                <div className="demo-toolbar">
                  <div className="demo-segment">
                    <button className="active">ตามรายวิชา</button>
                    <button onClick={() => openStudent(demoStudents[0])}>
                      ตามนักเรียน
                    </button>
                  </div>
                  {searchField("ค้นหาชื่อหรือรหัสวิชา")}
                </div>
                <div className="demo-subject-grid">
                  {demoSubjects
                    .map((subject, index) => ({ ...subject, index }))
                    .filter((subject) =>
                      `${subject.name} ${subject.code}`.includes(search.trim()),
                    )
                    .map((subject) => (
                      <button
                        key={subject.code}
                        className={`demo-subject ${subject.index === currentCourse ? "selected" : ""}`}
                        onClick={() => setCourse(String(subject.index))}
                      >
                        <span className="demo-overline">
                          {subject.code} · 2 ห้องเรียน
                        </span>
                        <strong>{subject.name}</strong>
                        <small>
                          {demoStudents.length}/{demoStudents.length}{" "}
                          คนที่กรอกแล้ว ·{" "}
                          {
                            demoStudents.filter((item) =>
                              published.has(`${item.id}:${subject.index}`),
                            ).length
                          }{" "}
                          ประกาศแล้ว
                        </small>
                        <div className="demo-progress">
                          <span style={{ width: "100%" }} />
                        </div>
                      </button>
                    ))}
                </div>
                <section className="demo-card demo-flush">
                  <div className="demo-card-heading demo-padded">
                    <h2>{demoSubjects[currentCourse].name}</h2>
                    <span className="demo-muted">
                      ครูผู้สอน: {demoSubjects[currentCourse].teacher}
                    </span>
                  </div>
                  {gradeToolbar()}
                  <div className="demo-table-scroll">
                    <table className="demo-table">
                      <thead>
                        <tr>
                          <th>เลขที่</th>
                          <th>นักเรียน</th>
                          <th>ห้องเรียน</th>
                          <th>คะแนน / 100</th>
                          <th>เกรด</th>
                          <th>สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {demoStudents.map((item) => (
                          <tr key={item.id}>
                            <td>{item.number}</td>
                            <td>
                              <button
                                className="demo-text-link"
                                onClick={() => openStudent(item)}
                              >
                                {item.name}
                              </button>
                            </td>
                            <td>{item.classroom}</td>
                            <td>{scoreField(item, currentCourse)}</td>
                            <td>
                              {gradeBadge(
                                demoGrade(draft[item.id][currentCourse]),
                              )}
                            </td>
                            <td>
                              <span className="demo-status">
                                {published.has(`${item.id}:${currentCourse}`)
                                  ? "ประกาศแล้ว"
                                  : "ฉบับร่าง"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
            {view === "classrooms" && (
              <>
                <div className="demo-two-column">
                  {["ม.1/1", "ม.1/2"].map((name, index) => (
                    <article className="demo-card" key={name}>
                      <div className="demo-card-heading">
                        <h2>{name}</h2>
                        <span className="demo-status">ใช้งาน</span>
                      </div>
                      <p className="demo-muted">
                        ครูประจำชั้น: {demoTeachers[index].name}
                      </p>
                      <div className="demo-class-stat">
                        <strong>
                          {
                            demoStudents.filter(
                              (item) => item.classroom === name,
                            ).length
                          }
                        </strong>
                        <span>นักเรียน · 4 รายวิชา</span>
                      </div>
                      <button
                        className="demo-button"
                        onClick={() => {
                          setClassroom(name);
                          navigate("students");
                        }}
                      >
                        ดูนักเรียนในห้อง <ArrowRight size={16} />
                      </button>
                    </article>
                  ))}
                </div>
                <section className="demo-card">
                  <h2>นักเรียนในห้องเรียนตัวอย่าง</h2>
                  {studentTable(demoStudents)}
                </section>
              </>
            )}
            {view === "courses" && (
              <section className="demo-card demo-flush">
                <div className="demo-padded">
                  {searchField("ค้นหาชื่อหรือรหัสวิชา")}
                </div>
                <div className="demo-table-scroll">
                  <table className="demo-table">
                    <thead>
                      <tr>
                        <th>รหัสวิชา</th>
                        <th>รายวิชา</th>
                        <th>หน่วยกิต</th>
                        <th>ห้องเรียนที่เปิดสอน</th>
                        <th>ครูผู้สอน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demoSubjects
                        .filter((subject) =>
                          `${subject.name} ${subject.code}`.includes(
                            search.trim(),
                          ),
                        )
                        .map((subject) => (
                          <tr key={subject.code}>
                            <td>{subject.code}</td>
                            <td>
                              <strong>{subject.name}</strong>
                            </td>
                            <td>{subject.credits}</td>
                            <td>ม.1/1 · ม.1/2</td>
                            <td>{subject.teacher}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {view === "terms" && (
              <section className="demo-card">
                <div className="demo-card-heading">
                  <div>
                    <span className="demo-overline">ปีการศึกษา 2569</span>
                    <h2>ภาคเรียนที่ 1</h2>
                  </div>
                  <span className="demo-status">ภาคเรียนปัจจุบัน</span>
                </div>
                <div className="demo-stats demo-term-stats">
                  <div>
                    <strong>2</strong>
                    <small>ห้องเรียน</small>
                  </div>
                  <div>
                    <strong>6</strong>
                    <small>นักเรียน</small>
                  </div>
                  <div>
                    <strong>4</strong>
                    <small>รายวิชา</small>
                  </div>
                </div>
                <p className="demo-muted">
                  ระบบจริงแยกทะเบียนห้องเรียนและผลการเรียนตามภาคเรียน
                  เดโมแสดงตัวอย่างหนึ่งภาคเรียน
                </p>
              </section>
            )}
            {view === "criteria" && (
              <section className="demo-card">
                <h2>เกณฑ์ตัวอย่าง Standard 0–4</h2>
                <p className="demo-muted">
                  คะแนนเต็ม 100 · เกรดตัวเลข · ใช้หน่วยกิตถ่วงน้ำหนัก GPA
                </p>
                <div className="demo-table-scroll">
                  <table className="demo-table">
                    <thead>
                      <tr>
                        <th>คะแนนต่ำสุด</th>
                        <th>เกรด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [80, 4],
                        [75, 3.5],
                        [70, 3],
                        [65, 2.5],
                        [60, 2],
                        [55, 1.5],
                        [50, 1],
                        [0, 0],
                      ].map(([minimum, grade]) => (
                        <tr key={minimum}>
                          <td>{minimum}</td>
                          <td>{gradeBadge(grade)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {view === "teachers" && (
              <>
                <div className="demo-toolbar">
                  {searchField("ค้นหาชื่อครูตัวอย่าง")}
                </div>
                <div className="demo-two-column">
                  {demoTeachers
                    .filter((item) =>
                      `${item.name} ${item.subject}`.includes(search.trim()),
                    )
                    .map((item) => (
                      <button
                        className="demo-card demo-teacher-card"
                        key={item.id}
                        onClick={() => {
                          setTeacherId(item.id);
                          navigate("teacher-profile");
                        }}
                      >
                        <span className="demo-large-avatar">
                          <UserRound size={30} />
                        </span>
                        <div>
                          <h2>{item.name}</h2>
                          <p>{item.subject}</p>
                          {item.homeroom && (
                            <span className="demo-status">
                              ครูประจำชั้น {item.homeroom}
                            </span>
                          )}
                        </div>
                        <ChevronRight size={18} />
                      </button>
                    ))}
                </div>
              </>
            )}
            {view === "teacher-profile" && (
              <section className="demo-card">
                <div className="demo-profile-header">
                  <span className="demo-large-avatar">
                    <UserRound size={38} />
                  </span>
                  <div>
                    <h2>{teacher.name}</h2>
                    <p>บัญชีครูตัวอย่าง · ไม่มีข้อมูลติดต่อจริง</p>
                    {teacher.homeroom && (
                      <span className="demo-status">
                        ครูประจำชั้น {teacher.homeroom}
                      </span>
                    )}
                  </div>
                </div>
                <div className="demo-profile-details">
                  <div>
                    <small>รายวิชาที่ได้รับมอบหมาย</small>
                    <strong>{teacher.subject}</strong>
                  </div>
                  <div>
                    <small>ห้องเรียนที่สอน</small>
                    <strong>ม.1/1 · ม.1/2</strong>
                  </div>
                  <div>
                    <small>ภาคเรียน</small>
                    <strong>2569 / 1</strong>
                  </div>
                </div>
                <p className="demo-muted">
                  ครูประจำชั้นดูผลการเรียนทุกวิชาของห้องตนเอง
                  การแก้คะแนนในระบบจริงขึ้นอยู่กับรายวิชาที่ได้รับมอบหมาย
                </p>
              </section>
            )}
            {view === "assignments" && (
              <section className="demo-card">
                <h2>ครูผู้สอนและครูประจำชั้น</h2>
                <p className="demo-muted">
                  ตัวอย่างการมอบหมายในภาคเรียน 2569 / 1 ·
                  หน้านี้ใช้ดูข้อมูลสมมติ
                </p>
                {searchField("ค้นหารายวิชาหรือครูผู้สอน")}
                <div className="demo-assignment-list">
                  {demoSubjects
                    .filter((subject) =>
                      `${subject.name} ${subject.code} ${subject.teacher}`.includes(
                        search.trim(),
                      ),
                    )
                    .map((subject) => (
                      <div className="demo-assignment-row" key={subject.code}>
                        <span>
                          <strong>{subject.name}</strong>
                          <small>{subject.code} · ม.1/1 และ ม.1/2</small>
                        </span>
                        <span>
                          <Check size={16} />
                          {subject.teacher}
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            )}
            {view === "audit" && (
              <section className="demo-card demo-flush">
                <div className="demo-table-scroll">
                  <table className="demo-table">
                    <thead>
                      <tr>
                        <th>เวลา</th>
                        <th>ผู้ดำเนินการ</th>
                        <th>การเปลี่ยนแปลง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((entry, index) => (
                        <tr key={index}>
                          <td>{entry.time}</td>
                          <td>
                            <strong>{entry.actor}</strong>
                          </td>
                          <td>{entry.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {view === "settings" && (
              <section className="demo-card">
                <div className="demo-card-heading">
                  <h2>
                    <Palette size={21} />
                    ธีม
                  </h2>
                  <span className="demo-status">เฉพาะเดโม</span>
                </div>
                <p className="demo-muted">
                  ทดลองเปลี่ยนธีมได้ทันที โดยไม่เปลี่ยนการตั้งค่าของโรงเรียนจริง
                </p>
                <div className="demo-theme-options">
                  <button
                    className={theme === "light" ? "selected" : ""}
                    onClick={() => setTheme("light")}
                  >
                    <span className="demo-theme-preview" />
                    <strong>สว่าง</strong>
                    {theme === "light" && <Check size={16} />}
                  </button>
                  <button
                    className={theme === "dark" ? "selected" : ""}
                    onClick={() => setTheme("dark")}
                  >
                    <span className="demo-theme-preview dark" />
                    <strong>มืด</strong>
                    {theme === "dark" && <Check size={16} />}
                  </button>
                </div>
                <div className="demo-setting-row">
                  <label htmlFor="demo-primary-color">
                    <strong>สีหลัก</strong>
                    <small>ตัวอย่างสีเฉพาะหน้านี้</small>
                  </label>
                  <input
                    id="demo-primary-color"
                    type="color"
                    value={primary}
                    onChange={(event) => setPrimary(event.target.value)}
                  />
                </div>
                <div className="demo-setting-row">
                  <span>
                    <strong>ชื่อโรงเรียน</strong>
                    <small>ข้อมูลตัวอย่าง</small>
                  </span>
                  <strong>โรงเรียน ตัวอย่าง</strong>
                </div>
                <div className="demo-setting-row">
                  <span>
                    <strong>การสมัครบัญชีครู</strong>
                    <small>ในระบบจริงต้องใช้คำเชิญจากผู้ดูแล</small>
                  </span>
                  <span className="demo-status">Invite only</span>
                </div>
              </section>
            )}
            {view === "guide" && (
              <section className="demo-card">
                <h2>เริ่มลองใช้งานใน 4 ขั้นตอน</h2>
                <ol className="demo-guide">
                  <li>
                    <strong>เปิดนักเรียน</strong>
                    <p>
                      ค้นหารายชื่อ ดูห้องเรียน เลขที่ และ GPA
                      แล้วกดชื่อเพื่อเปิดโปรไฟล์
                    </p>
                  </li>
                  <li>
                    <strong>ทดลองกรอกเกรด</strong>
                    <p>
                      เลือกบันทึกตามรายวิชาหรือตามนักเรียน
                      แล้วเปลี่ยนคะแนนตัวอย่างระหว่าง 0–100
                    </p>
                  </li>
                  <li>
                    <strong>บันทึก แล้วประกาศผล</strong>
                    <p>
                      กดบันทึกเดโมก่อน ผลที่แก้จะกลับเป็นฉบับร่าง
                      จากนั้นประกาศผลเดโมและตรวจ GPA
                    </p>
                  </li>
                  <li>
                    <strong>สำรวจเมนูผู้ดูแล</strong>
                    <p>
                      ดูรายวิชา ภาคเรียน ครู และประวัติ
                      ลองเปลี่ยนธีมได้ในตั้งค่า
                    </p>
                  </li>
                </ol>
                <Link
                  className="demo-button"
                  href="/"
                  aria-label="กลับหน้าแนะนำระบบ"
                >
                  กลับหน้าแนะนำระบบ <ArrowRight size={16} />
                </Link>
              </section>
            )}
            {view === "feedback" && (
              <section className="demo-card">
                <h2>ทดลองส่งข้อเสนอแนะ</h2>
                <p className="demo-muted">
                  ช่องนี้แสดงการทำงานตัวอย่างเท่านั้น
                  ไม่ส่งข้อความออกจากเบราว์เซอร์ หากต้องการแจ้งปัญหาจริง ใช้
                  GitHub ของโครงการ และไม่ใส่ข้อมูลส่วนตัว
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setNotice(
                      "รับข้อความไว้ในพื้นที่ทดลองแล้ว · ไม่มีการส่งออกหรือบันทึกข้อความ",
                    );
                    setFeedback("");
                  }}
                >
                  <label
                    className="demo-feedback-label"
                    htmlFor="demo-feedback"
                  >
                    ข้อความตัวอย่าง
                  </label>
                  <textarea
                    id="demo-feedback"
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="เช่น อยากให้ค้นหารายวิชาได้ง่ายขึ้น"
                    required
                    maxLength={1000}
                  />
                  <button className="demo-button demo-primary" type="submit">
                    ลองส่งข้อความ <Send size={16} />
                  </button>
                </form>
              </section>
            )}
          </div>
          <p className="demo-footnote">
            School Ledger Demo · ข้อมูลสมมติทั้งหมด ·{" "}
            <Link href="/">หน้าแนะนำระบบ</Link>
          </p>
        </main>
      </div>
      {notice && (
        <div className="demo-toast" role="status">
          <CheckCircle2 size={19} />
          <span>{notice}</span>
          <button aria-label="ปิดข้อความ" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
