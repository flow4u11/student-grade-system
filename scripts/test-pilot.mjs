import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { request } from "@playwright/test";
import { assertLocal } from "./local-guard.mjs";
const url = assertLocal(),
  baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3120";
assert.equal(new URL(baseURL).hostname, "127.0.0.1");
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const credentials = JSON.parse(
  await readFile(".local/demo-credentials.json", "utf8"),
);
const admin = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  }),
  teacher = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  }),
  anonymous = await request.newContext({ baseURL });
const nonce = randomBytes(6).toString("hex");
let teacherId,
  term,
  students = [],
  passed = 0;
function check(condition, label) {
  assert(condition, label);
  passed++;
  console.log("PASS " + label);
}
async function post(path, data, ctx = admin) {
  const response = await ctx.post(path, { data });
  assert(response.ok(), `${path} returned ${response.status()}`);
  return response.json();
}
try {
  await post("/api/auth/login", {
    kind: "teacher",
    identifier: credentials.email,
    password: credentials.password,
  });
  const meta = await (await admin.get("/api/staff/meta")).json();
  const password = randomBytes(24).toString("base64url"),
    email = `pilot-${nonce}@local.test`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  teacherId = created.data.user.id;
  assert.ifError(
    (
      await service
        .from("profiles")
        .insert({ id: teacherId, display_name: "Local pilot", role: "TEACHER" })
    ).error,
  );
  await post(
    "/api/auth/login",
    { kind: "teacher", identifier: email, password },
    teacher,
  );
  check(
    (await teacher.get("/api/account/teachers")).status() === 403,
    "Teacher cannot list or delete school accounts",
  );
  check(
    (await teacher.get("/api/staff/meta")).ok(),
    "Unassigned teacher account remains usable",
  );
  term = (
    await post("/api/staff/terms", {
      academic_year: 2026,
      name: `PILOT-${nonce}`,
      active: false,
    })
  ).id;
  const classes = [];
  for (const suffix of ["A", "B"])
    classes.push(
      (
        await post("/api/staff/classes", {
          name: `PILOT-${nonce}-${suffix}`,
          active: true,
        })
      ).id,
    );
  const payload = {
    term_id: term,
    grading_type: "NUMERIC_GRADE",
    max_score: 100,
    credits: 1,
    scheme_id: meta.schemes.find((s) => !s.archived).id,
    include_in_gpa: true,
    pass_mode: "AUTOMATIC",
    pass_threshold: 60,
  };
  const newSubject = {
    code: `PILOT-${nonce}`,
    name_th: "วิชาจำลอง",
    name_en: "Pilot",
    default_credits: 1,
    active: true,
  };
  check(
    (
      await post("/api/staff/offerings-compose", {
        payload,
        class_ids: classes,
        subject: newSubject,
      })
    ).count === 2,
    "Create subject and two classroom offerings in one request",
  );
  const subject = (
    await service
      .from("subjects")
      .select("id")
      .eq("code", newSubject.code)
      .single()
  ).data.id;
  const courses = (
    await service
      .from("subject_offerings")
      .select("*")
      .eq("subject_id", subject)
  ).data;
  const badCode = `FAIL-${nonce}`;
  check(
    (
      await admin.post("/api/staff/offerings-compose", {
        data: {
          payload,
          class_ids: [classes[0], classes[0]],
          subject: { ...newSubject, code: badCode },
        },
      })
    ).status() === 400,
    "Duplicate classroom selection is rejected atomically",
  );
  check(
    (await service.from("subjects").select("id").eq("code", badCode)).data
      .length === 0,
    "Failed combined creation leaves no catalog orphan",
  );
  for (let i = 0; i < 2; i++)
    students.push(
      (
        await post("/api/staff/students", {
          student_number: `00-${nonce}-${i}`,
          first_name: "Local",
          last_name: "Student",
          active: true,
          class_id: classes[i],
          term_id: term,
          roll_number: 1,
        })
      ).id,
    );
  await post("/api/staff/homerooms", {
    teacher: teacherId,
    term,
    classroom: classes[0],
    assigned: true,
  });
  const hrmeta = await (await teacher.get("/api/staff/meta")).json();
  check(
    hrmeta.homerooms.length === 1 && hrmeta.offerings.length === 1,
    "Homeroom meta includes all own-class subjects only",
  );
  const edit = {
    id: students[0],
    student_number: `00-${nonce}-0`,
    first_name: "ครูแก้ไข",
    last_name: "นักเรียน",
    active: true,
    class_id: classes[0],
    term_id: term,
    roll_number: 1,
  };
  await post("/api/staff/students", edit, teacher);
  check(
    (
      await service
        .from("students")
        .select("first_name")
        .eq("id", students[0])
        .single()
    ).data.first_name === "ครูแก้ไข",
    "Teacher API updates authorized student details",
  );
  check(
    (
      await teacher.post("/api/staff/students", {
        data: { ...edit, id: students[1] },
      })
    ).status() === 403,
    "Teacher API rejects another classroom student",
  );
  await post(
    "/api/staff/save-grades",
    {
      offering_id: courses.find((o) => o.class_id === classes[0]).id,
      rows: [
        { student_id: students[0], score: "82", result: null, version: 0 },
      ],
    },
    teacher,
  );
  const photo = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#779966" },
  })
    .png()
    .toBuffer();
  check(
    (
      await teacher.post("/api/account/avatar", {
        multipart: {
          photo: { name: "photo.png", mimeType: "image/png", buffer: photo },
        },
      })
    ).ok(),
    "Real photo upload succeeds",
  );
  const profile = await (await teacher.get("/api/account/profile")).json();
  check(
    profile.avatar_url && profile.avatar_path === `${teacherId}/avatar.jpg`,
    "Profile returns private signed photo URL",
  );
  check(
    (
      await anonymous.get(
        `${url}/storage/v1/object/public/teacher-avatars/${teacherId}/avatar.jpg`,
      )
    ).status() >= 400,
    "Photo bucket denies public unsigned access",
  );
  check(
    (
      await teacher.post("/api/account/avatar", {
        multipart: {
          photo: {
            name: "pretend.png",
            mimeType: "image/png",
            buffer: Buffer.from("<svg>not a photo</svg>"),
          },
        },
      })
    ).status() === 400,
    "Disguised non-image upload is rejected",
  );
  check(
    (
      await anonymous.post("/api/account/avatar", {
        multipart: {
          photo: { name: "photo.png", mimeType: "image/png", buffer: photo },
        },
      })
    ).status() === 403,
    "Photo upload rejects missing trusted origin/authentication",
  );
  check(
    (await admin.get("/api/account/teachers")).ok(),
    "Admin can review teacher accounts",
  );
  await post("/api/account/delete-teacher", {
    teacher: teacherId,
    confirmation: "DELETE",
  });
  check(
    !(await service.auth.admin.getUserById(teacherId)).data.user,
    "Teacher Auth account is permanently removed",
  );
  check(
    !(await service.from("profiles").select("id").eq("id", teacherId)).data
      .length,
    "Teacher profile is permanently removed",
  );
  check(
    (await teacher.get("/api/account/profile")).status() >= 400,
    "Deleted teacher session cannot access staff API",
  );
  check(
    (await service.storage.from("teacher-avatars").list(teacherId)).data
      .length === 0,
    "Teacher photo is removed without archive",
  );
  check(
    (
      await service
        .from("student_grades")
        .select("score")
        .eq("student_id", students[0])
    ).data[0].score === 82,
    "Removing teacher preserves school student results",
  );
  check(
    (
      await admin.post("/api/account/delete-teacher", {
        data: { teacher: meta.profile.id, confirmation: "DELETE" },
      })
    ).status() === 403,
    "Own admin account cannot be deleted",
  );
  await post("/api/staff/delete-record", {
    kind: "subjects",
    id: subject,
    confirmation: "DELETE",
  });
  check(
    (
      await service
        .from("subject_offerings")
        .select("id")
        .eq("subject_id", subject)
    ).data.length === 0 &&
      (
        await service
          .from("student_grades")
          .select("score")
          .eq("student_id", students[0])
      ).data.length === 0,
    "Permanent subject delete removes related courses and grades",
  );
  for (const id of classes)
    await post("/api/staff/delete-record", {
      kind: "classes",
      id,
      confirmation: "DELETE",
    });
  console.log(`Pilot HTTP: ${passed} checks passed.`);
} finally {
  for (const id of students)
    await admin.post("/api/staff/delete-record", {
      data: { kind: "students", id, confirmation: "DELETE" },
    });
  if (term)
    await admin.post("/api/staff/delete-record", {
      data: { kind: "terms", id: term, confirmation: "DELETE" },
    });
  if (teacherId) {
    await service.storage
      .from("teacher-avatars")
      .remove([`${teacherId}/avatar.jpg`]);
    await service.auth.admin.deleteUser(teacherId);
  }
  for (const context of [admin, teacher, anonymous]) await context.dispose();
}
