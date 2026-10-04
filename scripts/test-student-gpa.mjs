import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { request } from "@playwright/test";
import ExcelJS from "exceljs";
import { assertLocal } from "./local-guard.mjs";

const url = assertLocal();
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3120";
assert.equal(new URL(baseURL).hostname, "127.0.0.1");
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const credentials = JSON.parse(
  await readFile(".local/demo-credentials.json", "utf8"),
);
const contexts = await Promise.all(
  Array.from({ length: 4 }, () =>
    request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } }),
  ),
);
const [admin, courseTeacher, homeroomTeacher, anonymous] = contexts;
const nonce = randomBytes(6).toString("hex");
const numberPrefix = `00${BigInt(`0x${nonce}`)}`;
const fixtureIds = new Map();
const userIds = [];
let passed = 0;

function check(condition, label) {
  assert(condition, label);
  passed++;
  console.log(`PASS ${label}`);
}
async function insert(table, rows) {
  const result = await service
    .from(table)
    .insert(rows, { defaultToNull: false })
    .select("*");
  assert.ifError(result.error);
  const ids = result.data.flatMap((row) => (row.id ? [row.id] : []));
  fixtureIds.set(table, [...(fixtureIds.get(table) || []), ...ids]);
  return result.data;
}
async function post(context, path, data) {
  const response = await context.post(path, { data });
  assert(response.ok(), `${path}: HTTP ${response.status()}`);
  return response.json();
}
async function teacher(context, kind) {
  const email = `gpa-${kind}-${nonce}@local.test`;
  const password = randomBytes(24).toString("base64url");
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  const id = created.data.user.id;
  userIds.push(id);
  await insert("profiles", {
    id,
    role: "TEACHER",
    display_name: `Local GPA ${kind}`,
    school_username: email,
  });
  await post(context, "/api/auth/login", {
    kind: "teacher",
    identifier: email,
    password,
  });
  return id;
}

try {
  await post(admin, "/api/auth/login", {
    kind: "teacher",
    identifier: credentials.email,
    password: credentials.password,
  });
  const courseId = await teacher(courseTeacher, "course");
  const homeroomId = await teacher(homeroomTeacher, "homeroom");
  const [current, past] = await insert("academic_terms", [
    { academic_year: 2026, name: `GPA-${nonce}-A`, active: false },
    { academic_year: 2025, name: `GPA-${nonce}-B`, active: false },
  ]);
  const [ownClass, otherClass] = await insert("classes", [
    { name: `GPA-${nonce}-A` },
    { name: `GPA-${nonce}-B` },
  ]);
  const [scheme] = await insert("grade_schemes", { name: `GPA-${nonce}` });
  await insert("grade_scheme_rules", [
    { scheme_id: scheme.id, minimum: 0, points: 0 },
    { scheme_id: scheme.id, minimum: 50, points: 1 },
    { scheme_id: scheme.id, minimum: 60, points: 2 },
    { scheme_id: scheme.id, minimum: 80, points: 4 },
  ]);
  const subjects = await insert(
    "subjects",
    ["MATH", "ENG", "DRAFT", "EXCLUDED", "ZERO", "PASS"].map((name) => ({
      code: `GPA-${nonce}-${name}`,
      name_th: "วิชาทดสอบ GPA",
      name_en: `GPA ${name}`,
    })),
  );
  const makeOffering = (index, changes = {}) => ({
    subject_id: subjects[index].id,
    term_id: current.id,
    class_id: ownClass.id,
    grading_type: "NUMERIC_GRADE",
    scheme_id: scheme.id,
    include_in_gpa: true,
    ...changes,
  });
  const [
    math,
    english,
    draft,
    excluded,
    zeroCredits,
    passFail,
    oldMath,
    outsiderMath,
  ] = await insert("subject_offerings", [
    makeOffering(0, { credits: 3 }),
    makeOffering(1, { credits: 1 }),
    makeOffering(2, { credits: 100 }),
    makeOffering(3, { credits: 100, include_in_gpa: false }),
    makeOffering(4, { credits: 0 }),
    makeOffering(5, {
      credits: 0,
      grading_type: "PASS_FAIL",
      scheme_id: null,
      include_in_gpa: false,
      pass_mode: "MANUAL",
    }),
    makeOffering(0, { term_id: past.id, credits: 1 }),
    makeOffering(0, { class_id: otherClass.id, credits: 1 }),
  ]);
  const [main, zeroGrade, draftOnly, outsider] = await insert(
    "students",
    ["Main", "Zero", "Draft", "Outside"].map((name, index) => ({
      student_number: `${numberPrefix}${index + 1}`,
      first_name: `Local GPA ${name}`,
      last_name: nonce,
    })),
  );
  await insert("enrollments", [
    ...[main, zeroGrade, draftOnly].map((student, index) => ({
      student_id: student.id,
      class_id: ownClass.id,
      term_id: current.id,
      roll_number: index + 1,
    })),
    {
      student_id: main.id,
      class_id: ownClass.id,
      term_id: past.id,
      roll_number: 1,
    },
    {
      student_id: outsider.id,
      class_id: otherClass.id,
      term_id: current.id,
      roll_number: 1,
    },
  ]);
  const result = (
    student,
    offering,
    score,
    published = true,
    changes = {},
  ) => ({
    student_id: student.id,
    offering_id: offering.id,
    score,
    state: published ? "PUBLISHED" : "DRAFT",
    published_at: published ? new Date().toISOString() : null,
    ...changes,
  });
  await insert("student_grades", [
    result(main, math, 80),
    result(main, english, 60),
    result(main, draft, 0, false),
    result(main, excluded, 0),
    result(main, zeroCredits, 0),
    result(main, passFail, null, true, { result: "PASS" }),
    result(main, oldMath, 50),
    result(zeroGrade, math, 0),
    result(draftOnly, draft, 80, false),
    result(outsider, outsiderMath, 0),
  ]);
  await insert(
    "teacher_assignments",
    [math, draft, excluded, zeroCredits, passFail, oldMath].map((offering) => ({
      teacher_id: courseId,
      offering_id: offering.id,
    })),
  );
  await insert("homeroom_assignments", [
    { teacher_id: homeroomId, term_id: current.id, class_id: ownClass.id },
    { teacher_id: homeroomId, term_id: past.id, class_id: ownClass.id },
  ]);

  const filters = {
    group_term: current.id,
    term: current.id,
    search: numberPrefix,
    status: "active",
    sort: "roll",
    direction: "asc",
  };
  check(
    (
      await anonymous.post("/api/staff/students-query", { data: filters })
    ).status() === 401,
    "Anonymous student GPA request is denied",
  );
  for (const [context, label, expected, seesEnglish] of [
    [courseTeacher, "Course teacher", "4.00", false],
    [homeroomTeacher, "Homeroom teacher", "3.50", true],
    [admin, "Administrator", "3.50", true],
  ]) {
    const query = { ...filters, class: ownClass.id };
    const listed = await post(context, "/api/staff/students-query", query);
    check(
      listed.total === 3 &&
        listed.rows.map((row) => row.id).join() ===
          [main, zeroGrade, draftOnly].map((row) => row.id).join(),
      `${label}: list preserves classroom filter and roll order`,
    );
    check(
      listed.rows[0].gpa === expected,
      `${label}: GPA respects real RLS and published credit weighting (${expected})`,
    );
    check(
      listed.rows[1].gpa === "0.00" && listed.rows[2].gpa === null,
      `${label}: a published zero counts; draft-only GPA is empty`,
    );
    const profileResponse = await context.get(
      `/api/staff/student-profile?student=${main.id}&term=${current.id}`,
    );
    assert(profileResponse.ok());
    const profile = await profileResponse.json();
    check(
      profile.offerings.some((offering) => offering.id === english.id) ===
        seesEnglish &&
        profile.grades.some((grade) => grade.offering_id === english.id) ===
          seesEnglish,
      `${label}: profile and list share assigned offering visibility`,
    );
    const counted = profile.grades.flatMap((grade) => {
      const offering = profile.offerings.find(
        (value) => value.id === grade.offering_id,
      );
      return grade.state === "PUBLISHED" &&
        offering.grading_type === "NUMERIC_GRADE" &&
        offering.include_in_gpa &&
        offering.credits > 0 &&
        grade.grade_points !== null
        ? [{ points: grade.grade_points, credits: offering.credits }]
        : [];
    });
    check(
      (
        counted.reduce((sum, grade) => sum + grade.points * grade.credits, 0) /
        counted.reduce((sum, grade) => sum + grade.credits, 0)
      ).toFixed(2) === listed.rows[0].gpa,
      `${label}: list GPA equals the published results in the real profile`,
    );
    const old = await post(context, "/api/staff/students-query", {
      ...query,
      term: past.id,
      search: main.student_number,
    });
    check(
      old.total === 1 && old.rows[0].gpa === "1.00",
      `${label}: requested term overrides grouping term and excludes current results`,
    );
    const grouping = await post(context, "/api/staff/students-query", {
      ...query,
      term: "",
    });
    check(
      grouping.rows[0].gpa === expected,
      `${label}: all-students grouping uses the selected term for GPA`,
    );
    const download = await context.post("/api/staff/students-download", {
      data: { ...query, locale: "th" },
    });
    assert(download.ok(), `${label} export: HTTP ${download.status()}`);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(await download.body()).buffer);
    const sheet = book.getWorksheet("Records");
    const records = [2, 3, 4].map((row) => sheet.getRow(row));
    check(
      sheet.rowCount === 4 &&
        records.every(
          (row, index) =>
            row.getCell(1).value === listed.rows[index].student_number,
        ) &&
        records[0].getCell(1).value.startsWith("00"),
      `${label}: Excel contains the same filtered students and preserves leading zeros`,
    );
    check(
      sheet.getCell("G1").value === "เกรดเฉลี่ย (GPA)" &&
        records[0].getCell(7).value === Number(expected) &&
        records[0].getCell(7).numFmt === "0.00" &&
        records[1].getCell(7).value === 0 &&
        (records[2].getCell(7).value ?? "") === "",
      `${label}: Excel GPA is numeric, formatted to two decimals, and matches visible results`,
    );
  }
  for (const [context, label] of [
    [courseTeacher, "Course teacher"],
    [homeroomTeacher, "Homeroom teacher"],
  ]) {
    const listed = await post(context, "/api/staff/students-query", filters);
    check(
      listed.total === 3 && !listed.rows.some((row) => row.id === outsider.id),
      `${label}: another classroom stays outside the list`,
    );
    check(
      (
        await context.get(
          `/api/staff/student-profile?student=${outsider.id}&term=${current.id}`,
        )
      ).status() === 404,
      `${label}: another classroom's profile is denied`,
    );
  }
  const school = await post(admin, "/api/staff/students-query", filters);
  check(
    school.total === 4 &&
      school.rows.find((row) => row.id === outsider.id)?.gpa === "0.00",
    "Administrator sees the separate classroom with its own GPA",
  );
} finally {
  const failures = [];
  const erase = async (table, column, values) => {
    if (!values.length) return;
    try {
      assert.ifError(
        (await service.from(table).delete().in(column, values)).error,
      );
    } catch (error) {
      failures.push(`${table}: ${error.message}`);
    }
  };
  await erase("student_grades", "student_id", fixtureIds.get("students") || []);
  await erase("teacher_assignments", "teacher_id", userIds);
  await erase("homeroom_assignments", "teacher_id", userIds);
  for (const table of [
    "enrollments",
    "students",
    "subject_offerings",
    "subjects",
    "grade_scheme_rules",
    "grade_schemes",
    "classes",
    "academic_terms",
    "profiles",
  ])
    await erase(table, "id", fixtureIds.get(table) || []);
  await erase("audit_logs", "entity_id", [...fixtureIds.values()].flat());
  for (const id of userIds) {
    try {
      assert.ifError((await service.auth.admin.deleteUser(id, false)).error);
      assert(!(await service.auth.admin.getUserById(id)).data.user);
    } catch (error) {
      failures.push(`Auth cleanup: ${error.message}`);
    }
  }
  for (const [table, ids] of fixtureIds) {
    if (!ids.length) continue;
    const result = await service.from(table).select("id").in("id", ids);
    if (result.error || result.data.length)
      failures.push(`Remaining ${table} fixtures`);
  }
  await Promise.all(contexts.map((context) => context.dispose()));
  assert.equal(failures.length, 0, failures.join("; "));
  check(true, "All disposable GPA fixture rows and Auth users are removed");
}
console.log(`Local GPA integration: ${passed} checks passed.`);
