import {
  test,
  expect,
  request as requestFactory,
  type APIRequestContext,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import ExcelJS from "exceljs";
const credentials = JSON.parse(
  readFileSync(
    process.env.TEST_CREDENTIALS_FILE || ".local/demo-credentials.json",
    "utf8",
  ),
);
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
if (!["127.0.0.1", "localhost"].includes(new URL(origin).hostname))
  throw new Error("HTTP tests are restricted to local development.");
let teacher: APIRequestContext;
let student: APIRequestContext;
let secondStudent: APIRequestContext;
let meta: {
  terms: { id: string; active: boolean }[];
  classes: { id: string; name: string }[];
  offerings: { id: string; subject_id: string; class_id: string }[];
  subjects: { id: string; code: string }[];
};
let offering: string;
let studentId: string;
let importedNumber: string;
let importedId: string;
const suffix = randomBytes(3).toString("hex");
const post = async (ctx: APIRequestContext, path: string, data: unknown) =>
  ctx.post(`/api/${path}`, { data, headers: { Origin: origin } });
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  teacher = await requestFactory.newContext({ baseURL: origin });
  student = await requestFactory.newContext({ baseURL: origin });
  secondStudent = await requestFactory.newContext({ baseURL: origin });
});
test.afterAll(async () => {
  await teacher.dispose();
  await student.dispose();
  await secondStudent.dispose();
});
test("unauthenticated teacher routes and APIs are blocked", async ({
  request,
}) => {
  const response = await request.get("/teacher", { maxRedirects: 0 });
  if (response.status() === 307) {
    expect(response.headers().location).toContain("/login");
  } else {
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("NEXT_REDIRECT;replace;/login");
  }
  expect((await request.get("/api/staff/meta")).status()).toBe(401);
  expect((await request.get("/api/student")).status()).toBe(401);
});
test("login rejects cross-origin and absent-origin requests", async ({
  request,
}) => {
  const data = {
    kind: "teacher",
    identifier: credentials.email,
    password: credentials.password,
  };
  expect((await request.post("/api/auth/login", { data })).status()).toBe(403);
  expect(
    (
      await request.post("/api/auth/login", {
        data,
        headers: { Origin: "https://untrusted.invalid" },
      })
    ).status(),
  ).toBe(403);
});
test("teacher signs in and receives a private secure cookie", async () => {
  const r = await post(teacher, "auth/login", {
    kind: "teacher",
    identifier: credentials.email,
    password: credentials.password,
  });
  expect(r.ok()).toBeTruthy();
  expect(r.headers()["set-cookie"]).toContain("HttpOnly");
  expect(r.headers()["set-cookie"]).toContain("SameSite=lax");
  const response = await teacher.get("/api/staff/meta");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toContain("no-store");
  meta = await response.json();
  const sub = meta.subjects.find((s) => s.code === "MATH101")!;
  offering = meta.offerings.find(
    (o) => o.subject_id === sub.id && o.class_id === credentials.classes[0],
  )!.id;
  const list = await (
    await post(teacher, "staff/students-query", {
      term: credentials.term,
      search: "00123",
    })
  ).json();
  studentId = list.rows[0].id;
});
test("term, class, subject, scheme and offering creation work over protected HTTP", async () => {
  const term = await post(teacher, "staff/terms", {
    academic_year: 2027,
    name: `API ${suffix}`,
    active: false,
  });
  expect(term.ok()).toBeTruthy();
  const cls = await post(teacher, "staff/classes", {
    name: `API-${suffix}`,
    active: true,
  });
  expect(cls.ok()).toBeTruthy();
  const subject = await post(teacher, "staff/subjects", {
    code: `API-${suffix}`,
    name_th: "ทดสอบ",
    name_en: "API example",
    active: true,
  });
  expect(subject.ok()).toBeTruthy();
  const scheme = await post(teacher, "staff/schemes", {
    name: `API scheme ${suffix}`,
    rules: [
      { minimum: 0, points: 0 },
      { minimum: 50, points: 2 },
      { minimum: 80, points: 4 },
    ],
  });
  expect(scheme.ok()).toBeTruthy();
  const result = await post(teacher, "staff/offerings", {
    subject_id: (await subject.json()).id,
    term_id: (await term.json()).id,
    class_id: (await cls.json()).id,
    grading_type: "NUMERIC_GRADE",
    max_score: 100,
    credits: 1,
    scheme_id: (await scheme.json()).id,
    include_in_gpa: true,
    pass_mode: "AUTOMATIC",
    pass_threshold: 60,
  });
  expect(result.ok()).toBeTruthy();
});
test("import preview performs no writes and confirmation preserves text ID", async () => {
  importedNumber = `00${suffix}`;
  const rows = [
    {
      student_number: importedNumber,
      first_name: "API import",
      last_name: "Example",
      class_name: "M.1/1",
    },
  ];
  const preview = await post(teacher, "staff/import-validate", {
    term_id: credentials.term,
    rows,
  });
  expect(preview.ok()).toBeTruthy();
  expect((await preview.json()).checks[0].errors).toEqual([]);
  const before = await post(teacher, "staff/students-query", {
    search: importedNumber,
  });
  expect((await before.json()).total).toBe(0);
  const imported = await post(teacher, "staff/import", {
    term_id: credentials.term,
    rows,
  });
  expect((await imported.json()).count).toBe(1);
  const after = await (
    await post(teacher, "staff/students-query", { search: importedNumber })
  ).json();
  expect(after.rows[0].student_number).toBe(importedNumber);
  importedId = after.rows[0].id;
  expect(
    (
      await post(teacher, "staff/import", { term_id: credentials.term, rows })
    ).status(),
  ).toBe(400);
});
test("students sign in using ID/PIN and cannot access staff APIs", async () => {
  for (const [ctx, details] of [
    [student, credentials.students[0]],
    [secondStudent, credentials.students[1]],
  ] as const) {
    const r = await post(ctx, "auth/login", {
      kind: "student",
      identifier: details.student_number,
      password: details.pin,
    });
    expect(r.ok()).toBeTruthy();
    expect(r.headers()["set-cookie"]).toContain("HttpOnly");
    expect(r.headers()["set-cookie"]).toContain("SameSite=strict");
    expect((await ctx.get("/api/staff/meta")).status()).toBe(401);
  }
  const r = await student.get("/api/student?student_id=anything");
  expect((await r.json()).student.student_number).toBe("00123");
});
test("79 computes 3.5 as draft, then publication exposes only own result", async () => {
  const book = await (
    await teacher.get(`/api/staff/gradebook?offering=${offering}`)
  ).json();
  const current = book.grades.find(
    (g: { student_id: string }) => g.student_id === studentId,
  );
  if (current.state === "PUBLISHED") {
    expect(
      (
        await post(teacher, "staff/save-grades", {
          offering_id: offering,
          rows: [
            {
              student_id: studentId,
              score: "79",
              result: null,
              version: current.version,
            },
          ],
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await post(teacher, "staff/publish-grades", {
          offering_id: offering,
          rows: [{ student_id: studentId, version: current.version }],
          publish: false,
        })
      ).ok(),
    ).toBeTruthy();
    current.version++;
  }
  const save = await post(teacher, "staff/save-grades", {
    offering_id: offering,
    rows: [
      {
        student_id: studentId,
        score: "79",
        result: null,
        version: current.version,
      },
    ],
  });
  expect(save.ok()).toBeTruthy();
  const privateView = await (await student.get("/api/student")).json();
  expect(
    privateView.grades.some((g: { code: string }) => g.code === "MATH101"),
  ).toBe(false);
  const updated = await (
    await teacher.get(`/api/staff/gradebook?offering=${offering}`)
  ).json();
  const g = updated.grades.find(
    (g: { student_id: string }) => g.student_id === studentId,
  );
  expect(g.grade_points).toBe(3.5);
  expect(g.state).toBe("DRAFT");
  const publish = await post(teacher, "staff/publish-grades", {
    offering_id: offering,
    rows: [{ student_id: studentId, version: g.version }],
    publish: true,
  });
  expect(publish.ok()).toBeTruthy();
  const portal = await (await student.get("/api/student")).json();
  expect(
    portal.grades.find((g: { code: string }) => g.code === "MATH101")
      .grade_points,
  ).toBe(3.5);
  expect(portal.student.student_number).toBe("00123");
  const other = await (await secondStudent.get("/api/student")).json();
  expect(other.student.student_number).toBe(
    credentials.students[1].student_number,
  );
  expect(
    other.grades.find((g: { code: string }) => g.code === "MATH101").score,
  ).toBe(85);
});
test("student results include published manual/automatic pass-fail and exclude English draft", async () => {
  const portal = await (await student.get("/api/student")).json();
  expect(
    portal.grades.find((g: { code: string }) => g.code === "ACT101").result,
  ).toBe("PASS");
  expect(
    portal.grades.find((g: { code: string }) => g.code === "PE101").result,
  ).toBe("PASS");
  expect(portal.grades.some((g: { code: string }) => g.code === "ENG101")).toBe(
    false,
  );
});
test("stale save returns a conflict and invalid precision is rejected", async () => {
  expect(
    (
      await post(teacher, "staff/save-grades", {
        offering_id: offering,
        rows: [
          { student_id: studentId, score: "99", result: null, version: 0 },
        ],
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await post(teacher, "staff/save-grades", {
        offering_id: offering,
        rows: [
          { student_id: studentId, score: "79.999", result: null, version: 0 },
        ],
      })
    ).status(),
  ).toBe(400);
});
test("real XLSX template and exports preserve leading zeroes", async () => {
  for (const path of [
    "/api/staff/template",
    `/api/staff/gradebook-export?offering=${offering}`,
  ]) {
    const response = await teacher.get(path);
    expect(response.ok()).toBeTruthy();
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(new Uint8Array(await response.body()).buffer);
    const ids: ExcelJS.Cell[] = [];
    book.worksheets[0].eachRow((row) => ids.push(row.getCell(1)));
    const idCell = ids.find((cell) => cell.value === "00123");
    expect(idCell).toBeDefined();
    expect(idCell!.numFmt).toBe("@");
  }
  const response = await post(teacher, "staff/students-download", {
    search: "00123",
  });
  expect(response.ok()).toBeTruthy();
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(await response.body()).buffer);
  expect(book.worksheets[0].getCell("A2").value).toBe("00123");
});
test("deactivation preserves student history and admin audit is available", async () => {
  const r = await post(teacher, "staff/students", {
    id: importedId,
    student_number: importedNumber,
    first_name: "API import",
    last_name: "Example",
    active: false,
    term_id: credentials.term,
    class_id: credentials.classes[0],
  });
  expect(r.ok()).toBeTruthy();
  const list = await (
    await post(teacher, "staff/students-query", {
      search: importedNumber,
      status: "inactive",
    })
  ).json();
  expect(list.total).toBe(1);
  const audit = await teacher.get("/api/staff/audit");
  expect(audit.ok()).toBeTruthy();
  expect((await audit.json()).rows.length).toBeGreaterThan(0);
});
test("logout revokes access; security headers present", async () => {
  expect((await post(student, "auth/logout", {})).ok()).toBeTruthy();
  expect((await student.get("/api/student")).status()).toBe(401);
  const r = await teacher.get("/login");
  expect(r.headers()["x-frame-options"]).toBe("DENY");
  expect(r.headers()["x-content-type-options"]).toBe("nosniff");
  expect(r.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect((await post(teacher, "auth/logout", {})).ok()).toBeTruthy();
  expect((await teacher.get("/api/staff/meta")).status()).toBe(401);
});

test("switching portals on a shared browser removes the previous identity", async () => {
  const shared = await requestFactory.newContext({ baseURL: origin });
  try {
    expect(
      (
        await post(shared, "auth/login", {
          kind: "teacher",
          identifier: credentials.email,
          password: credentials.password,
        })
      ).ok(),
    ).toBeTruthy();
    expect((await shared.get("/api/staff/meta")).ok()).toBeTruthy();
    expect(
      (
        await post(shared, "auth/login", {
          kind: "student",
          identifier: credentials.students[0].student_number,
          password: credentials.students[0].pin,
        })
      ).ok(),
    ).toBeTruthy();
    expect((await shared.get("/api/staff/meta")).status()).toBe(401);
    expect((await shared.get("/api/student")).ok()).toBeTruthy();
    expect(
      (
        await post(shared, "auth/login", {
          kind: "teacher",
          identifier: credentials.email,
          password: credentials.password,
        })
      ).ok(),
    ).toBeTruthy();
    expect((await shared.get("/api/student")).status()).toBe(401);
    expect((await shared.get("/api/staff/meta")).ok()).toBeTruthy();
    await post(shared, "auth/logout", {});
  } finally {
    await shared.dispose();
  }
});
