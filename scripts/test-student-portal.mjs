// Fictional fixtures only. Refuse any non-local API/database and remove every fixture.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { request } from "@playwright/test";
import { assertLocal } from "./local-guard.mjs";
const databaseURL = assertLocal();
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3130";
assert(["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname));
const service = createClient(databaseURL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const nonce = randomBytes(5).toString("hex");
const contexts = [];
const users = [];
const inserted = new Map();
let passed = 0;
const context = async () => {
  const c = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  });
  contexts.push(c);
  return c;
};
const check = (ok, label) => {
  assert(ok, label);
  passed++;
  console.log(`PASS ${label}`);
};
async function insert(table, rows) {
  const r = await service.from(table).insert(rows).select("*");
  assert.ifError(r.error);
  inserted.set(table, [
    ...(inserted.get(table) || []),
    ...r.data.map((x) => x.id).filter(Boolean),
  ]);
  return r.data;
}
async function post(c, url, data) {
  return c.post(url, { data });
}
async function login(c, identifier, password, kind = "teacher") {
  return post(c, "/api/auth/login", { kind, identifier, password });
}
async function teacher(role, label) {
  const password = randomBytes(24).toString("base64url");
  const email = `portal-${label}-${nonce}@local.test`;
  const r = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(r.error);
  users.push(r.data.user.id);
  await insert("profiles", {
    id: r.data.user.id,
    role,
    display_name: `${label} Example`,
  });
  const c = await context();
  assert((await login(c, email, password)).ok());
  return { c, id: r.data.user.id, email, password };
}
async function wipe(table, column, ids) {
  if (!ids?.length) return;
  const r = await service.from(table).delete().in(column, ids);
  assert.ifError(r.error);
}
try {
  const admin = await teacher("ADMIN", "Admin");
  const course = await teacher("TEACHER", "Course");
  const homeroom = await teacher("TEACHER", "Homeroom");
  const outsider = await teacher("TEACHER", "Outside");
  const anonymous = await context();
  const student = await context();
  const other = await context();
  const shared = await context();
  const [term] = await insert("academic_terms", {
    academic_year: 2026,
    name: `Portal ${nonce}`,
  });
  const [oldTerm] = await insert("academic_terms", {
    academic_year: 2025,
    name: `Portal previous ${nonce}`,
  });
  const [classroom] = await insert("classes", { name: `PORTAL-${nonce}` });
  const [wrongClass] = await insert("classes", {
    name: `PORTAL-OTHER-${nonce}`,
  });
  const [subject] = await insert("subjects", {
    code: `PT-${nonce}`,
    name_th: "วิชาทดสอบ",
    name_en: "Portal test",
  });
  const [draftSubject] = await insert("subjects", {
    code: `PD-${nonce}`,
    name_th: "ฉบับร่าง",
    name_en: "Draft test",
  });
  const scheme = await service
    .from("grade_schemes")
    .select("id")
    .limit(1)
    .single();
  assert.ifError(scheme.error);
  const o = {
    term_id: term.id,
    class_id: classroom.id,
    subject_id: subject.id,
    scheme_id: scheme.data.id,
    grading_type: "NUMERIC_GRADE",
    max_score: 100,
    credits: 1,
    include_in_gpa: true,
  };
  const [offering] = await insert("subject_offerings", o);
  const [draftOffering] = await insert("subject_offerings", {
    ...o,
    subject_id: draftSubject.id,
  });
  const [oldOffering] = await insert("subject_offerings", {
    ...o,
    term_id: oldTerm.id,
  });
  const number = String(10000 + Math.floor(Math.random() * 60000));
  const [learner] = await insert("students", {
    student_number: number,
    first_name: "Student",
    last_name: `Example ${nonce}`,
  });
  const [second] = await insert("students", {
    student_number: String(Number(number) + 1),
    first_name: "Other",
    last_name: `Example ${nonce}`,
  });
  const [brute] = await insert("students", {
    student_number: String(Number(number) + 2),
    first_name: "Rate limit",
    last_name: `Example ${nonce}`,
  });
  await insert("enrollments", [
    {
      student_id: learner.id,
      term_id: term.id,
      class_id: classroom.id,
      roll_number: 1,
    },
    {
      student_id: learner.id,
      term_id: oldTerm.id,
      class_id: classroom.id,
      roll_number: 1,
    },
    {
      student_id: second.id,
      term_id: term.id,
      class_id: wrongClass.id,
      roll_number: 1,
    },
    {
      student_id: brute.id,
      term_id: term.id,
      class_id: classroom.id,
      roll_number: 2,
    },
  ]);
  await insert("teacher_assignments", {
    teacher_id: course.id,
    offering_id: offering.id,
  });
  await insert("homeroom_assignments", {
    teacher_id: homeroom.id,
    term_id: term.id,
    class_id: classroom.id,
  });
  await insert("student_grades", [
    {
      student_id: learner.id,
      offering_id: offering.id,
      score: 80,
      state: "PUBLISHED",
      published_at: new Date().toISOString(),
    },
    {
      student_id: learner.id,
      offering_id: draftOffering.id,
      score: 65,
      state: "DRAFT",
    },
    {
      student_id: learner.id,
      offering_id: oldOffering.id,
      score: 70,
      state: "PUBLISHED",
      published_at: new Date().toISOString(),
    },
  ]);
  const pin = "624815";
  const newPin = "735926";
  const pinBody = (s = learner.id, p = pin, t = term.id) => ({
    student_id: s,
    term_id: t,
    pin: p,
  });
  check(
    (await post(anonymous, "/api/staff/student-pin", pinBody())).status() ===
      401,
    "Anonymous callers cannot set a student PIN",
  );
  check(
    (await post(outsider.c, "/api/staff/student-pin", pinBody())).status() ===
      403,
    "Unassigned teacher cannot set a student PIN",
  );
  check(
    (
      await post(course.c, "/api/staff/student-pin", pinBody(second.id))
    ).status() === 403,
    "Course teacher cannot set another class student PIN",
  );
  check(
    (
      await post(
        course.c,
        "/api/staff/student-pin",
        pinBody(learner.id, pin, oldTerm.id),
      )
    ).status() === 403,
    "PIN permission is checked for the requested term",
  );
  check(
    (
      await post(
        homeroom.c,
        "/api/staff/student-pin",
        pinBody(learner.id, "123"),
      )
    ).status() === 400,
    "Short or nonconforming PIN is rejected",
  );
  check(
    (await post(course.c, "/api/staff/student-pin", pinBody())).ok(),
    "Authorized course teacher can establish student PIN",
  );
  check(
    (await post(admin.c, "/api/staff/student-pin", pinBody(second.id))).ok(),
    "Administrator can set another classroom student PIN",
  );
  check(
    (await post(admin.c, "/api/staff/student-pin", pinBody(brute.id))).ok(),
    "Administrator can prepare fictional PIN rate-limit fixture",
  );
  const staffPage = await anonymous.get("/login");
  const staffHtml = await staffPage.text();
  const studentPage = await anonymous.get("/student/login");
  const studentHtml = await studentPage.text();
  check(
    staffPage.ok() &&
      studentPage.ok() &&
      staffHtml.includes("/student/login") &&
      studentHtml.includes('pattern="[0-9]{5}"'),
    "Staff and student have separate login pages",
  );
  check(
    !studentHtml.includes('href="/register"'),
    "Student login does not offer teacher registration",
  );
  check(
    (await login(student, "1234", pin, "student")).status() === 400,
    "Student username must contain exactly five digits",
  );
  check(
    (await login(student, "abcde", pin, "student")).status() === 400,
    "Student username rejects nonnumeric identifiers",
  );
  check(
    (await login(student, number, "000000", "student")).status() === 401,
    "Incorrect student PIN returns a generic authentication failure",
  );
  const signIn = await login(student, number, pin, "student");
  check(
    signIn.ok() && (await signIn.json()).redirect === "/student",
    "Five-digit student ID and teacher PIN sign in",
  );
  check(
    signIn.headers()["set-cookie"].includes("HttpOnly") &&
      signIn.headers()["set-cookie"].includes("SameSite=strict"),
    "Student cookie is HttpOnly and SameSite Strict",
  );
  check(
    (await student.get("/api/staff/meta")).status() === 401,
    "Student session has no staff API privileges",
  );
  const portal = await (
    await student.get(`/api/student?student_id=${second.id}`)
  ).json();
  check(
    portal.student.student_number === number && portal.grades.length === 2,
    "Student request ignores alternate target IDs and returns only own published grades",
  );
  check(
    portal.grades.every((g) => g.state === "PUBLISHED") &&
      !portal.grades.some((g) => g.code === draftSubject.code),
    "Draft grade is never exposed to the student",
  );
  check(
    portal.grades.some((g) => g.term_id === term.id) &&
      portal.grades.some((g) => g.term_id === oldTerm.id),
    "Student can view their published current and past term results",
  );
  check(
    (await login(other, second.student_number, pin, "student")).ok(),
    "Second student signs in to independent account",
  );
  const secondPortal = await (
    await other.get(`/api/student?student_id=${learner.id}`)
  ).json();
  check(
    secondPortal.student.student_number === second.student_number &&
      secondPortal.grades.length === 0,
    "A second student cannot see the first student grades",
  );
  const cached = await student.get("/api/student");
  check(
    cached.headers()["cache-control"] === "private, no-store",
    "Student results cannot be cached publicly",
  );
  check(
    (
      await post(
        homeroom.c,
        "/api/staff/student-pin",
        pinBody(learner.id, newPin),
      )
    ).ok(),
    "Homeroom teacher can reset PIN within their assigned room",
  );
  check(
    (await student.get("/api/student")).status() === 401,
    "Changing PIN revokes existing student sessions on all devices",
  );
  check(
    (await login(student, number, pin, "student")).status() === 401,
    "Old PIN fails after teacher reset",
  );
  check(
    (await login(student, number, newPin, "student")).ok(),
    "New PIN signs in after reset",
  );
  const updatedNumber = String(Number(number) + 3);
  const edit = await post(course.c, "/api/staff/students", {
    id: learner.id,
    student_number: updatedNumber,
    first_name: learner.first_name,
    last_name: learner.last_name,
    active: true,
    term_id: term.id,
    class_id: classroom.id,
    roll_number: 1,
  });
  check(edit.ok(), "Authorized teacher can edit student number");
  check(
    (await login(student, number, newPin, "student")).status() === 401,
    "Previous student username fails immediately after number edit",
  );
  check(
    (await login(student, updatedNumber, newPin, "student")).ok(),
    "Edited five-digit student number automatically becomes the login username",
  );
  const log = await admin.c.get("/api/staff/audit");
  const logs = await log.json();
  check(
    !JSON.stringify(logs).includes(pin) &&
      !JSON.stringify(logs).includes(newPin) &&
      logs.rows.some(
        (r) => r.action === "PIN_RESET" && r.actor_name === "Homeroom Example",
      ),
    "PIN audit records identify teacher without retaining plaintext PIN",
  );
  check(
    (await post(student, "/api/auth/logout", {})).ok() &&
      (await student.get("/api/student")).status() === 401,
    "Student logout revokes the session",
  );
  const missing = await anonymous.get("/student", { maxRedirects: 0 });
  const missingHTML = await missing.text();
  check(
    missing.headers().location === "/student/login" ||
      missingHTML.includes("url=/student/login"),
    "Unauthenticated student portal redirects to its separate login",
  );
  check(
    (await login(shared, admin.email, admin.password)).ok() &&
      (await shared.get("/api/staff/meta")).ok(),
    "Shared browser can begin with a staff account",
  );
  check(
    (await login(shared, updatedNumber, newPin, "student")).ok() &&
      (await shared.get("/api/staff/meta")).status() === 401,
    "Student sign-in clears the previous staff identity on a shared browser",
  );
  check(
    (await login(shared, admin.email, admin.password)).ok() &&
      (await shared.get("/api/student")).status() === 401,
    "Staff sign-in clears the previous student identity on a shared browser",
  );
  let throttled = false;
  for (let attempt = 0; attempt < 11; attempt++) {
    const result = await login(
      anonymous,
      brute.student_number,
      "000000",
      "student",
    );
    assert.equal(result.status(), 401);
  }
  throttled =
    (await login(anonymous, brute.student_number, pin, "student")).status() ===
    401;
  check(
    throttled,
    "Ten failed PIN attempts temporarily block even a correct PIN for that account",
  );
  const anonRpc = await createClient(
    databaseURL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ).rpc("reset_student_pin", { learner: learner.id, term: term.id, pin });
  check(
    Boolean(anonRpc.error),
    "Anonymous direct PIN RPC is also denied by database permissions",
  );
  console.log(`${passed} student portal integration checks passed`);
} finally {
  await wipe("student_grades", "student_id", inserted.get("students"));
  for (const table of ["teacher_assignments", "homeroom_assignments"])
    for (const user of users) await wipe(table, "teacher_id", [user]);
  await wipe("enrollments", "id", inserted.get("enrollments"));
  await wipe("students", "id", inserted.get("students"));
  await wipe("subject_offerings", "id", inserted.get("subject_offerings"));
  await wipe("subjects", "id", inserted.get("subjects"));
  await wipe("classes", "id", inserted.get("classes"));
  await wipe("academic_terms", "id", inserted.get("academic_terms"));
  for (const user of users) {
    const removed = await service.auth.admin.deleteUser(user, false);
    assert.ifError(removed.error);
  }
  for (const c of contexts) await c.dispose();
  console.log("Removed all fictional student portal fixtures");
}
