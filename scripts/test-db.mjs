import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertLocal } from "./local-guard.mjs";
const url = assertLocal();
const credentials = JSON.parse(
  readFileSync(".local/demo-credentials.json", "utf8"),
);
const client = (key) =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const admin = client(process.env.SUPABASE_SECRET_KEY);
const staff = client(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const anon = client(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const login = await staff.auth.signInWithPassword({
  email: credentials.email,
  password: credentials.password,
});
assert.ifError(login.error);
let passed = 0;
async function check(label, fn) {
  await fn();
  passed++;
  console.log(`PASS ${label}`);
}
async function rpc(name, args) {
  const r = await staff.rpc(name, args);
  assert.ifError(r.error);
  return r.data;
}
const id = randomBytes(4).toString("hex");
const term = await rpc("manage_record", {
  kind: "terms",
  payload: { academic_year: 2026, name: `DB test ${id}`, active: false },
});
const cls = await rpc("manage_record", {
  kind: "classes",
  payload: { name: `TEST-${id}`, active: true },
});
const pin = randomBytes(4).readUInt32BE().toString().padStart(10, "0");
const number = `00${id}`;
const student = await rpc("manage_record", {
  kind: "students",
  payload: {
    student_number: number,
    first_name: "Test",
    last_name: "Student",
    active: true,
    class_id: cls,
    term_id: term,
    pin,
  },
});
const other = await rpc("manage_record", {
  kind: "students",
  payload: {
    student_number: `01${id}`,
    first_name: "Other",
    last_name: "Student",
    active: true,
    class_id: cls,
    term_id: term,
    pin,
  },
});
const sub = await rpc("manage_record", {
  kind: "subjects",
  payload: {
    code: `TEST-${id}`,
    name_th: "ทดสอบ",
    name_en: "Test",
    active: true,
  },
});
const scheme = "10000000-0000-4000-8000-000000000001";
const offering = await rpc("manage_record", {
  kind: "offerings",
  payload: {
    subject_id: sub,
    term_id: term,
    class_id: cls,
    grading_type: "NUMERIC_GRADE",
    max_score: 100,
    credits: 1,
    scheme_id: scheme,
    include_in_gpa: true,
    pass_mode: "AUTOMATIC",
    pass_threshold: 60,
  },
});
const row = (score, version = 0, sid = student) => ({
  student_id: sid,
  score,
  result: null,
  version,
});
const current = async (sid) =>
  (
    await staff
      .from("student_grades")
      .select("*")
      .eq("student_id", sid)
      .eq("offering_id", offering)
      .single()
  ).data;
await check("anonymous cannot enumerate students or grades", async () => {
  for (const table of [
    "students",
    "enrollments",
    "student_grades",
    "audit_logs",
    "profiles",
  ]) {
    const r = await anon.from(table).select("*");
    assert.ok(r.error || r.data.length === 0);
  }
});
await check(
  "anonymous cannot call staff/student authentication RPCs",
  async () => {
    assert.ok(
      (
        await anon.rpc("manage_record", {
          kind: "classes",
          payload: { name: "ATTACK" },
        })
      ).error,
    );
    assert.ok(
      (await anon.rpc("student_portal", { session_hash: "forged" })).error,
    );
    assert.ok(
      (
        await anon.rpc("student_login", {
          number,
          pin,
          token_hash: "forged",
          account_bucket: "x",
          ip_bucket: "y",
        })
      ).error,
    );
  },
);
await check(
  "staff cannot directly write grades or access PIN/session tables",
  async () => {
    assert.ok(
      (
        await staff
          .from("student_grades")
          .insert({ student_id: student, offering_id: offering, score: 100 })
      ).error,
    );
    assert.ok(
      (await staff.schema("private").from("student_credentials").select("*"))
        .error,
    );
  },
);
await check("leading zero identifiers are preserved", async () => {
  const r = await staff
    .from("students")
    .select("student_number")
    .eq("id", student)
    .single();
  assert.equal(r.data.student_number, number);
});
await check("database calculates all grade boundaries", async () => {
  let version = 0;
  for (const [score, points] of [
    ["79", 3.5],
    ["79.99", 3.5],
    ["80", 4],
    ["74.99", 3],
    ["75", 3.5],
    ["49.99", 0],
    ["50", 1],
  ]) {
    await rpc("save_grades", { offering, rows: [row(score, version++)] });
    assert.equal((await current(student)).grade_points, points);
  }
});
await check(
  "invalid/negative/excessive/overprecise scores cannot persist",
  async () => {
    const g = await current(student);
    for (const score of ["-1", "101", "79.999", "NaN", "", null])
      assert.ok(
        (
          await staff.rpc("save_grades", {
            offering,
            rows: [row(score, g.version)],
          })
        ).error,
      );
    assert.equal((await current(student)).version, g.version);
  },
);
await check("stale bulk save rolls back every row", async () => {
  const g = await current(student);
  const r = await staff.rpc("save_grades", {
    offering,
    rows: [row("85", 0, other), row("90", g.version - 1)],
  });
  assert.equal(r.error.code, "40001");
  assert.equal(await current(other), null);
  assert.equal((await current(student)).score, g.score);
});
await check(
  "duplicate import rolls back every row and never overwrites",
  async () => {
    const first = `NEW-${id}`;
    const r = await staff.rpc("import_students", {
      term,
      rows: [
        {
          student_number: first,
          first_name: "New",
          last_name: "Example",
          class_name: `TEST-${id}`,
        },
        {
          student_number: number,
          first_name: "Changed",
          last_name: "Example",
          class_name: `TEST-${id}`,
        },
      ],
    });
    assert.equal(r.error.code, "23505");
    assert.equal(
      (await staff.from("students").select("*").eq("student_number", first))
        .data.length,
      0,
    );
  },
);
const token = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(token).digest("hex");
await check("correct PIN establishes opaque student session", async () => {
  const r = await admin.rpc("student_login", {
    number,
    pin,
    token_hash: tokenHash,
    account_bucket: `account-${id}`,
    ip_bucket: `ip-${id}`,
  });
  assert.ifError(r.error);
  assert.equal(r.data, true);
});
await check("student sees no draft results or other students", async () => {
  await rpc("save_grades", { offering, rows: [row("90", 0, other)] });
  await rpc("publish_grades", {
    offering,
    rows: [{ student_id: other, version: 1 }],
    publish: true,
  });
  const r = await admin.rpc("student_portal", { session_hash: tokenHash });
  assert.ifError(r.error);
  assert.equal(r.data.student.student_number, number);
  assert.equal(r.data.grades.length, 0);
  assert.equal(JSON.stringify(r.data).includes(`01${id}`), false);
});
await check(
  "publish reveals own grade; stale publish is rejected",
  async () => {
    const g = await current(student);
    await rpc("publish_grades", {
      offering,
      rows: [{ student_id: student, version: g.version }],
      publish: true,
    });
    const r = await admin.rpc("student_portal", { session_hash: tokenHash });
    assert.equal(r.data.grades.length, 1);
    assert.equal(r.data.grades[0].grade_points, 1);
    assert.equal(
      (
        await staff.rpc("publish_grades", {
          offering,
          rows: [{ student_id: student, version: g.version }],
          publish: false,
        })
      ).error.code,
      "40001",
    );
  },
);
await check(
  "published grade requires explicit unpublish before editing",
  async () => {
    const g = await current(student);
    const locked = await staff.rpc("save_grades", {
      offering,
      rows: [row("79", g.version)],
    });
    assert.equal(locked.error?.message, "PUBLISHED_LOCKED");
    await rpc("publish_grades", {
      offering,
      rows: [{ student_id: student, version: g.version }],
      publish: false,
    });
    await rpc("save_grades", { offering, rows: [row("79", g.version + 1)] });
    assert.equal(
      (await admin.rpc("student_portal", { session_hash: tokenHash })).data
        .grades.length,
      0,
    );
  },
);
await check(
  "used grading scheme/configuration and academic history are locked",
  async () => {
    assert.ok(
      (
        await staff.rpc("manage_record", {
          kind: "schemes",
          payload: {
            id: scheme,
            name: "Tamper",
            rules: [
              { minimum: 0, points: 4 },
              { minimum: 50, points: 4 },
            ],
          },
        })
      ).error,
    );
    assert.ok(
      (
        await staff.rpc("manage_record", {
          kind: "terms",
          payload: {
            id: term,
            academic_year: 2027,
            name: `DB test ${id}`,
            active: false,
          },
        })
      ).error,
    );
  },
);
await check("PIN reset revokes existing sessions", async () => {
  await rpc("manage_record", {
    kind: "students",
    payload: {
      id: student,
      student_number: number,
      first_name: "Test",
      last_name: "Student",
      active: true,
      class_id: cls,
      term_id: term,
      pin,
    },
  });
  assert.equal(
    (await admin.rpc("student_portal", { session_hash: tokenHash })).data,
    null,
  );
});
await check("rate limit is persistent and atomic", async () => {
  const r = await Promise.all(
    Array.from({ length: 12 }, () =>
      admin.rpc("consume_limit", {
        bucket_key: `limit-${id}`,
        max_attempts: 10,
      }),
    ),
  );
  assert.equal(r.filter((x) => x.data === true).length, 10);
  assert.equal(r.filter((x) => x.data === false).length, 2);
});
await check(
  "audit contains grade history without PINs/hashes/tokens",
  async () => {
    const r = await staff
      .from("audit_logs")
      .select("*")
      .eq("entity_id", student);
    assert.ifError(r.error);
    assert.ok(r.data.length);
    const text = JSON.stringify(r.data);
    assert.equal(text.includes(pin), false);
    assert.equal(text.includes("pin_hash"), false);
    assert.equal(text.includes(tokenHash), false);
  },
);
await check("forged session rejected", async () =>
  assert.equal(
    (await admin.rpc("student_portal", { session_hash: "forged" })).data,
    null,
  ),
);
const outsider = client(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const password = randomBytes(20).toString("hex");
const out = await admin.auth.admin.createUser({
  email: `outsider-${id}@test.invalid`,
  password,
  email_confirm: true,
});
assert.ifError(out.error);
await outsider.auth.signInWithPassword({
  email: `outsider-${id}@test.invalid`,
  password,
});
await check("authenticated user without staff role has no access", async () => {
  const r = await outsider.from("students").select("*");
  assert.ifError(r.error);
  assert.equal(r.data.length, 0);
  assert.ok(
    (
      await outsider.rpc("manage_record", {
        kind: "classes",
        payload: { name: "Denied" },
      })
    ).error,
  );
});
await check(
  "staff cannot promote themselves or alter audit records",
  async () => {
    assert.ok(
      (
        await staff
          .from("profiles")
          .update({ role: "ADMIN" })
          .eq("id", login.data.user.id)
      ).error,
    );
    assert.ok(
      (await staff.from("audit_logs").delete().eq("entity_id", student)).error,
    );
  },
);
await check(
  "unassigned TEACHER cannot manage school records or read admin audit",
  async () => {
    assert.ifError(
      (
        await admin.from("profiles").insert({
          id: out.data.user.id,
          display_name: "Test teacher",
          role: "TEACHER",
        })
      ).error,
    );
    const r = await outsider.rpc("manage_record", {
      kind: "classes",
      payload: { name: `TEACHER-${id}`, active: true },
    });
    assert.equal(r.error?.code, "42501");
    const logs = await outsider.from("audit_logs").select("*");
    assert.ifError(logs.error);
    assert.equal(logs.data.length, 0);
  },
);
await check("inactive staff and VIEWER role are denied", async () => {
  await admin
    .from("profiles")
    .update({ active: false })
    .eq("id", out.data.user.id);
  assert.equal((await outsider.from("students").select("*")).data.length, 0);
  assert.ok(
    (
      await outsider.rpc("manage_record", {
        kind: "classes",
        payload: { name: "Denied" },
      })
    ).error,
  );
  await admin
    .from("profiles")
    .update({ active: true, role: "VIEWER" })
    .eq("id", out.data.user.id);
  assert.equal((await outsider.from("students").select("*")).data.length, 0);
});
await admin.from("audit_logs").delete().eq("actor", out.data.user.id);
await admin.from("profiles").delete().eq("id", out.data.user.id);
await admin.auth.admin.deleteUser(out.data.user.id);
await check(
  "automatic and manual pass/fail persist authoritative results",
  async () => {
    for (const mode of ["AUTOMATIC", "MANUAL"]) {
      const subId = await rpc("manage_record", {
        kind: "subjects",
        payload: {
          code: `PF-${mode}-${id}`,
          name_th: "ทดสอบ",
          name_en: "Pass fail",
          active: true,
        },
      });
      const o = await rpc("manage_record", {
        kind: "offerings",
        payload: {
          subject_id: subId,
          term_id: term,
          class_id: cls,
          grading_type: "PASS_FAIL",
          max_score: 100,
          credits: 0,
          scheme_id: "",
          include_in_gpa: false,
          pass_mode: mode,
          pass_threshold: 60,
        },
      });
      await rpc("save_grades", {
        offering: o,
        rows: [
          {
            student_id: student,
            version: 0,
            score: mode === "AUTOMATIC" ? "59.99" : null,
            result: mode === "MANUAL" ? "FAIL" : null,
          },
        ],
      });
      let result = await staff
        .from("student_grades")
        .select("*")
        .eq("offering_id", o)
        .single();
      assert.equal(result.data.result, "FAIL");
      assert.equal(result.data.grade_points, null);
      await rpc("save_grades", {
        offering: o,
        rows: [
          {
            student_id: student,
            version: 1,
            score: mode === "AUTOMATIC" ? "60" : null,
            result: mode === "MANUAL" ? "PASS" : null,
          },
        ],
      });
      result = await staff
        .from("student_grades")
        .select("*")
        .eq("offering_id", o)
        .single();
      assert.equal(result.data.result, "PASS");
      await admin.from("student_grades").delete().eq("offering_id", o);
      await admin.from("subject_offerings").delete().eq("id", o);
      await admin.from("subjects").delete().eq("id", subId);
    }
  },
);
await check("deactivation revokes a fresh student session", async () => {
  const sessionHash = createHash("sha256")
    .update(randomBytes(32))
    .digest("hex");
  assert.equal(
    (
      await admin.rpc("student_login", {
        number,
        pin,
        token_hash: sessionHash,
        account_bucket: `deactive-${id}`,
        ip_bucket: `deactive-ip-${id}`,
      })
    ).data,
    true,
  );
  await rpc("manage_record", {
    kind: "students",
    payload: {
      id: student,
      student_number: number,
      first_name: "Test",
      last_name: "Student",
      active: false,
      class_id: cls,
      term_id: term,
    },
  });
  assert.equal(
    (await admin.rpc("student_portal", { session_hash: sessionHash })).data,
    null,
  );
});

// Clean only this uniquely named local fixture, retaining the ordinary seeded data.
await admin.from("student_grades").delete().eq("offering_id", offering);
await admin.from("subject_offerings").delete().eq("id", offering);
await admin.from("subjects").delete().eq("id", sub);
await admin.from("enrollments").delete().eq("term_id", term);
await admin.from("students").delete().in("id", [student, other]);
await admin.from("classes").delete().eq("id", cls);
await admin.from("academic_terms").delete().eq("id", term);
console.log(`Database security and integration: ${passed} checks passed.`);
