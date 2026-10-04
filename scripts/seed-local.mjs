import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomInt } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { assertLocal } from "./local-guard.mjs";
const url = assertLocal();
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const existing = await admin
  .from("students")
  .select("id", { head: true, count: "exact" });
if (existing.error)
  throw new Error("Local schema unavailable. Run supabase db reset --local.");
if (existing.count > 0 || existsSync(".local/demo-credentials.json"))
  throw new Error(
    "Local seed already exists. Preserve data, or deliberately reset LOCAL DB and remove .local/demo-credentials.json before reseeding.",
  );
const email = "demo.admin@school.test";
const password = randomBytes(24).toString("base64url");
const u = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (u.error) throw new Error(u.error.message);
const profile = await admin.from("profiles").insert({
  id: u.data.user.id,
  display_name: "Demo Administrator",
  role: "ADMIN",
});
if (profile.error) throw profile.error;
const staff = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const auth = await staff.auth.signInWithPassword({ email, password });
if (auth.error) throw auth.error;
async function rpc(name, args) {
  const r = await staff.rpc(name, args);
  if (r.error) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
}
const term = await rpc("manage_record", {
  kind: "terms",
  payload: { academic_year: 2026, name: "Semester 1", active: true },
});
const past = await rpc("manage_record", {
  kind: "terms",
  payload: { academic_year: 2025, name: "Semester 2", active: false },
});
const classes = [];
for (const name of ["M.1/1", "M.1/2", "M.2/1"])
  classes.push(
    await rpc("manage_record", {
      kind: "classes",
      payload: { name, active: true },
    }),
  );
const students = [];
const pins = [];
for (let i = 0; i < 24; i++) {
  const pin = String(randomInt(10000000, 100000000));
  const number = i === 0 ? "00123" : String(200 + i).padStart(5, "0");
  const id = await rpc("manage_record", {
    kind: "students",
    payload: {
      student_number: number,
      first_name: ["Anan", "Mali", "Niran", "Ploy", "Somchai", "Suda"][i % 6],
      last_name: `Example ${i + 1}`,
      class_id: classes[Math.floor(i / 8)],
      term_id: term,
      pin,
    },
  });
  students.push(id);
  pins.push({ student_number: number, pin });
}
const scheme = "10000000-0000-4000-8000-000000000001";
const offerings = [];
for (const [code, th, en, type, mode] of [
  ["MATH101", "คณิตศาสตร์", "Mathematics", "NUMERIC_GRADE", "AUTOMATIC"],
  ["ENG101", "ภาษาอังกฤษ", "English", "NUMERIC_GRADE", "AUTOMATIC"],
  [
    "ACT101",
    "กิจกรรมพัฒนาผู้เรียน",
    "Student activities",
    "PASS_FAIL",
    "MANUAL",
  ],
  ["PE101", "พลศึกษา", "Physical education", "PASS_FAIL", "AUTOMATIC"],
]) {
  const sub = await rpc("manage_record", {
    kind: "subjects",
    payload: { code, name_th: th, name_en: en, active: true },
  });
  for (const cls of classes) {
    const o = await rpc("manage_record", {
      kind: "offerings",
      payload: {
        subject_id: sub,
        term_id: term,
        class_id: cls,
        grading_type: type,
        max_score: 100,
        credits: type === "NUMERIC_GRADE" ? 1 : 0,
        scheme_id: type === "NUMERIC_GRADE" ? scheme : "",
        include_in_gpa: type === "NUMERIC_GRADE",
        pass_mode: mode,
        pass_threshold: 60,
      },
    });
    offerings.push(o);
    const group = students.slice(
      classes.indexOf(cls) * 8,
      classes.indexOf(cls) * 8 + 8,
    );
    await rpc("save_grades", {
      offering: o,
      rows: group.map((id, i) => ({
        student_id: id,
        version: 0,
        score:
          mode === "MANUAL"
            ? null
            : String([79, 85, 64, 74.99, 80, 50, 92, 59.99][i]),
        result: mode === "MANUAL" ? (i === 7 ? "FAIL" : "PASS") : null,
      })),
    });
    if (code !== "ENG101")
      await rpc("publish_grades", {
        offering: o,
        rows: group.map((id) => ({ student_id: id, version: 1 })),
        publish: true,
      });
  }
}
mkdirSync(".local", { recursive: true, mode: 0o700 });
writeFileSync(
  ".local/demo-credentials.json",
  JSON.stringify(
    { email, password, students: pins, term, past, classes, offerings },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  "Seeded 24 fictional students, 3 classes, 2 terms, 4 subjects and 12 offerings. Generated credentials saved only in .local/demo-credentials.json.",
);
