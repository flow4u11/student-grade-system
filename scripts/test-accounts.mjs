import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { request } from "@playwright/test";
import { assertLocal } from "./local-guard.mjs";
const url = assertLocal();
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3120";
assert.equal(new URL(baseURL).hostname, "127.0.0.1");
const service = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pub = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const creds = JSON.parse(
  await readFile(".local/demo-credentials.json", "utf8"),
);
const admin = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  }),
  a = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  }),
  b = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  });
let ids = [],
  savedSettings,
  passed = 0;
const check = (ok, label) => {
  assert(ok, label);
  passed++;
  console.log("PASS " + label);
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
  const s = await (await admin.get("/api/account/settings")).json();
  savedSettings = {
    ...s.settings,
    default_scheme_id: s.settings.default_scheme_id || "",
  };
  delete savedSettings.id;
  assert(
    (
      await admin.post("/api/account/settings", {
        data: { ...savedSettings, login_domain: "pilot.example.test" },
      })
    ).ok(),
  );
  const ir = await admin.post("/api/account/invite", {
    data: { days: 1, max_uses: 2 },
  });
  assert(ir.ok(), "Invite generation");
  const { code } = await ir.json();
  const brand = await pub.rpc("school_branding");
  check(
    !brand.error &&
      brand.data.login_domain === "pilot.example.test" &&
      !JSON.stringify(brand.data).includes(code),
    "Branding uses configured domain without exposing invitation",
  );
  check(
    !!(
      await pub.rpc("reserve_teacher_registration", {
        code_hash: "a".repeat(64),
        base_name: "a.b",
        first_name: "A",
        last_name: "B",
      })
    ).error,
    "Anonymous direct provisioning denied",
  );
  const name =
    "Teacher" +
    randomBytes(8)
      .toString("hex")
      .replace(/[0-9]/g, (c) => String.fromCharCode(97 + Number(c)));
  const password = randomBytes(24).toString("base64url");
  const input = {
    first_name: name,
    last_name: "Example",
    first_name_th: "ครูทดสอบ",
    last_name_th: "ตัวอย่าง",
    password,
    code,
    confirmed: true,
  };
  check(
    (
      await a.post("/api/register", {
        data: { ...input, code: "invalid".repeat(5) },
      })
    ).status() === 400,
    "Invalid invitation rejected",
  );
  const one = await a.post("/api/register", { data: input });
  assert(one.ok(), "First teacher registration");
  const username = (await one.json()).username;
  const two = await b.post("/api/register", { data: input });
  assert(two.ok(), "Second teacher registration");
  const username2 = (await two.json()).username;
  check(
    username === `${name.toLowerCase()}.exam@pilot.example.test` &&
      username2 === `${name.toLowerCase()}.exam.2@pilot.example.test`,
    "Generated usernames handle collisions deterministically",
  );
  const found = await service
    .from("profiles")
    .select("*")
    .in("school_username", [username, username2]);
  assert(!found.error);
  ids = found.data.map((p) => p.id);
  check(
    found.data.length === 2 &&
      found.data.every(
        (p) =>
          p.role === "TEACHER" &&
          p.official_first_name === name &&
          p.official_first_name_th === "ครูทดสอบ" &&
          p.display_name === "ครูทดสอบ ตัวอย่าง",
      ),
    "Auth and locked TEACHER profiles created atomically",
  );
  check(
    (await a.post("/api/register", { data: input })).status() === 400,
    "Exhausted invitation rejected",
  );
  for (const [ctx, user] of [
    [a, username],
    [b, username2],
  ])
    assert(
      (
        await ctx.post("/api/auth/login", {
          data: { kind: "teacher", identifier: user, password },
        })
      ).ok(),
    );
  const meta = await (await a.get("/api/staff/meta")).json();
  check(
    meta.offerings.length === 0 &&
      (await (await a.post("/api/staff/students-query", { data: {} })).json())
        .total === 0,
    "New teacher cannot see students before assignment",
  );
  check(
    (await a.get("/teacher/profile")).ok() &&
      (await a.get("/teacher/feedback")).ok(),
    "Teacher profile and feedback pages accessible",
  );
  check(
    (await a.get("/api/account/settings")).status() === 403 &&
      (
        await a.post("/api/account/invite", { data: { days: 1, max_uses: 1 } })
      ).status() === 403,
    "Teacher cannot configure school or create invitation",
  );
  const profile = {
    nickname: "Test",
    contact_email: "",
    contact_phone: "",
    bio: "Test profile",
    teaching_request: "Math M.3/1",
    avatar: "book",
  };
  check(
    (await a.post("/api/account/profile", { data: profile })).ok(),
    "Teacher can complete onboarding and edit optional profile",
  );
  check(
    (
      await a.post("/api/account/profile", {
        data: { ...profile, role: "DEVELOPER" },
      })
    ).status() === 400,
    "Profile endpoint rejects role escalation",
  );
  const self = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  assert(
    !(await self.auth.signInWithPassword({ email: username, password })).error,
  );
  check(
    (
      await self.rpc("update_teacher_profile", {
        payload: { ...profile, official_first_name: "Other" },
      })
    ).error?.code === "42501",
    "Database rejects changes to official identity",
  );
  await self.auth.signOut({ scope: "local" });
  check(
    (
      await a.post("/api/account/feedback", {
        data: {
          type: "FEATURE",
          message: "Test feedback",
          page: "/teacher/gradebook",
          contact: "",
        },
      })
    ).ok(),
    "Feedback submission works",
  );
  const own = await (await a.get("/api/account/feedback")).json(),
    other = await (await b.get("/api/account/feedback")).json();
  check(
    own.rows.length === 1 && other.rows.length === 0,
    "Feedback is private to author and administrators",
  );
  check(
    (
      await b.post("/api/account/review-feedback", {
        data: { feedback_id: own.rows[0].id, new_status: "DONE" },
      })
    ).status() === 403 &&
      (
        await admin.post("/api/account/review-feedback", {
          data: { feedback_id: own.rows[0].id, new_status: "DONE" },
        })
      ).ok(),
    "Only administrator reviews feedback",
  );
  assert(
    (await admin.post("/api/account/close-registration", { data: {} })).ok(),
  );
  check(
    (await pub.rpc("school_branding")).data.registration_open === false,
    "Administrator can close registration",
  );
  const tr = await admin.post("/api/staff/terms", {
    data: { academic_year: 2028, name: "RESET HTTP " + name, active: false },
  });
  assert(tr.ok());
  const resetTerm = (await tr.json()).id;
  check(
    (
      await a.post("/api/account/reset-authorize", {
        data: { term: resetTerm, password },
      })
    ).status() === 403,
    "Teacher cannot authorize Hard Reset",
  );
  check(
    (
      await admin.post("/api/account/reset-authorize", {
        data: { term: resetTerm, password: "incorrect-test-password" },
      })
    ).status() === 401,
    "Hard Reset requires correct current password",
  );
  const authz = await admin.post("/api/account/reset-authorize", {
    data: { term: resetTerm, password: creds.password },
  });
  assert(authz.ok(), "Reset reauthentication");
  const proof = (await authz.json()).proof;
  check(
    (
      await admin.post("/api/account/reset-grades", {
        data: {
          term: resetTerm,
          proof,
          phrase: "RESET GRADES",
          confirmed: false,
        },
      })
    ).status() === 400,
    "Hard Reset requires final confirmation",
  );
  check(
    (
      await admin.post("/api/account/reset-grades", {
        data: {
          term: resetTerm,
          proof,
          phrase: "RESET GRADES",
          confirmed: true,
        },
      })
    ).ok(),
    "Reauthenticated administrator can reset a disposable empty test term",
  );
  check(
    (
      await admin.post("/api/account/reset-grades", {
        data: {
          term: resetTerm,
          proof,
          phrase: "RESET GRADES",
          confirmed: true,
        },
      })
    ).status() === 403,
    "Reset proof is single-use over HTTP",
  );
  await admin.post("/api/staff/delete-record", {
    data: { kind: "terms", id: resetTerm, confirmation: "DELETE" },
  });
  const newInvite = await admin.post("/api/account/invite", {
    data: { days: 1, max_uses: 1 },
  });
  assert(newInvite.ok());
  const nextCode = (await newInvite.json()).code;
  const reservation = await service.rpc("reserve_teacher_registration", {
    code_hash: createHash("sha256").update(nextCode).digest("hex"),
    base_name: name.toLowerCase() + ".test",
    first_name: name,
    last_name: "Test",
  });
  assert(!reservation.error);
  await admin.post("/api/account/close-registration", { data: {} });
  const blocked = await service.auth.admin.createUser({
    email: reservation.data.username,
    password,
    email_confirm: true,
    app_metadata: { school_registration: reservation.data.id },
  });
  check(
    !!blocked.error,
    "Revoking an invite also blocks a pending registration",
  );
  const users = await service.auth.admin.listUsers({ perPage: 1000 });
  assert(!users.error);
  check(
    !users.data.users.some((u) => u.email === reservation.data.username),
    "Rejected registration rolls back Auth user creation",
  );
  await service.rpc("cancel_teacher_registration", {
    reservation: reservation.data.id,
  });
  console.log(`Account integration: ${passed} checks passed.`);
} finally {
  if (savedSettings)
    await admin.post("/api/account/settings", { data: savedSettings });
  await admin.post("/api/account/close-registration", { data: {} });
  for (const id of ids) {
    await service.from("feedback").delete().eq("author", id);
    await service.from("teacher_assignments").delete().eq("teacher_id", id);
    await service.from("audit_logs").delete().eq("actor", id);
    await service.from("profiles").delete().eq("id", id);
    await service.auth.admin.deleteUser(id);
  }
  for (const ctx of [a, b, admin]) {
    await ctx.post("/api/auth/logout", { data: {} });
    await ctx.dispose();
  }
}
