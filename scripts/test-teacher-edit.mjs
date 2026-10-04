import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { request } from "@playwright/test";
import { assertLocal } from "./local-guard.mjs";
const url = assertLocal();
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3120";
assert.equal(new URL(baseURL).hostname, "127.0.0.1");
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const admin = await request.newContext({
  baseURL,
  extraHTTPHeaders: { Origin: baseURL },
});
const teacher = await request.newContext({
  baseURL,
  extraHTTPHeaders: { Origin: baseURL },
});
const anonymous = await request.newContext({
  baseURL,
  extraHTTPHeaders: { Origin: baseURL },
});
const creds = JSON.parse(
  await readFile(".local/demo-credentials.json", "utf8"),
);
let id;
let passed = 0;
function check(value, label) {
  assert(value, label);
  passed++;
  console.log("PASS " + label);
}
const fetchProfile = async () => {
  const r = await service.from("profiles").select("*").eq("id", id).single();
  assert.ifError(r.error);
  return r.data;
};
const payload = {
  display_name: "ครู ทดสอบ",
  official_first_name_th: "ครู",
  official_last_name_th: "ทดสอบ",
  official_first_name: "Legacy",
  official_last_name: "Teacher",
  nickname: "Test",
  contact_email: "contact@example.test",
  contact_phone: "00000",
};
try {
  assert(
    (
      await admin.post("/api/auth/login", {
        data: {
          kind: "teacher",
          identifier: creds.email,
          password: creds.password,
        },
      })
    ).ok(),
  );
  const nonce = randomBytes(6).toString("hex"),
    email = `edit-${nonce}@local.test`,
    password = randomBytes(24).toString("hex");
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  id = created.data.user.id;
  assert.ifError(
    (
      await service.from("profiles").insert({
        id,
        role: "TEACHER",
        display_name: "Legacy",
        school_username: email,
      })
    ).error,
  );
  assert(
    (
      await teacher.post("/api/auth/login", {
        data: { kind: "teacher", identifier: email, password },
      })
    ).ok(),
  );
  const before = await fetchProfile();
  const edit = { teacher: id, expected_updated_at: before.updated_at, payload };
  check(
    (
      await anonymous.post("/api/account/edit-teacher", { data: edit })
    ).status() === 401,
    "Anonymous edit denied",
  );
  check(
    (
      await teacher.post("/api/account/edit-teacher", { data: edit })
    ).status() === 403,
    "Teacher cannot invoke administrator editor",
  );
  const login = await publicClient.auth.signInWithPassword({ email, password });
  assert.ifError(login.error);
  check(
    (await publicClient.rpc("admin_update_teacher", edit)).error?.code ===
      "42501",
    "Direct teacher RPC denied",
  );
  check(
    (
      await publicClient.rpc("update_teacher_profile", {
        payload: { official_first_name_th: "Escalate" },
      })
    ).error?.code === "42501",
    "Self profile still locks official identity",
  );
  check(
    (
      await admin.post("/api/account/edit-teacher", {
        data: { ...edit, payload: { ...payload, role: "ADMIN" } },
      })
    ).status() === 400,
    "Role escalation payload rejected",
  );
  check(
    (
      await admin.post("/api/account/edit-teacher", {
        data: {
          ...edit,
          payload: { ...payload, school_username: "changed@example.test" },
        },
      })
    ).status() === 400,
    "Login mutation payload rejected",
  );
  check(
    (
      await admin.post("/api/account/edit-teacher", {
        data: { ...edit, payload: { ...payload, official_last_name_th: "" } },
      })
    ).status() === 400,
    "Incomplete Thai name pair rejected",
  );
  check(
    (await admin.post("/api/account/edit-teacher", { data: edit })).ok(),
    "Administrator backfills legacy teacher Thai identity",
  );
  const after = await fetchProfile();
  check(
    after.official_first_name_th === "ครู" &&
      after.display_name === payload.display_name &&
      after.contact_email === payload.contact_email &&
      after.school_username === before.school_username &&
      after.role === "TEACHER" &&
      after.active === before.active,
    "Names and contact saved; login, role and active state preserved",
  );
  check(
    (
      await admin.post("/api/account/edit-teacher", {
        data: { ...edit, payload: { ...payload, nickname: "Stale" } },
      })
    ).status() === 409,
    "Stale account edit cannot overwrite newer changes",
  );
  check(
    (await fetchProfile()).nickname === payload.nickname,
    "Rejected stale write leaves profile untouched",
  );
  const listed = await (await admin.get("/api/account/teachers")).json();
  check(
    listed.rows.some(
      (p) =>
        p.id === id &&
        p.official_first_name_th === "ครู" &&
        p.updated_at === after.updated_at,
    ),
    "Account search/editor receives updated legacy names and version",
  );
  const adminMeta = await (await admin.get("/api/staff/meta")).json();
  check(
    (
      await admin.post("/api/account/edit-teacher", {
        data: { ...edit, teacher: adminMeta.profile.id },
      })
    ).status() === 403,
    "Administrator and non-teacher identities protected",
  );
  const restoredLogin = await service.auth.admin.getUserById(id);
  assert.ifError(restoredLogin.error);
  check(
    restoredLogin.data.user.email === email &&
      (
        await teacher.post("/api/auth/login", {
          data: { kind: "teacher", identifier: email, password },
        })
      ).ok(),
    "Existing teacher credentials continue working after rename",
  );
  const audit = await service
    .from("audit_logs")
    .select("action")
    .eq("entity", "profiles")
    .eq("entity_id", id)
    .eq("action", "UPDATE");
  assert.ifError(audit.error);
  check(audit.data.length >= 1, "Identity correction audited");
  console.log(`${passed} teacher-edit checks passed`);
} finally {
  await Promise.allSettled([
    admin.post("/api/auth/logout"),
    teacher.post("/api/auth/logout"),
    publicClient.auth.signOut({ scope: "local" }),
  ]);
  if (id)
    assert.ifError((await service.auth.admin.deleteUser(id, false)).error);
  await Promise.all([admin.dispose(), teacher.dispose(), anonymous.dispose()]);
}
