import assert from "node:assert/strict";

const origin = new URL(process.env.BETA_BASE_URL || "http://127.0.0.1:3110")
  .origin;
if (
  !["127.0.0.1", "localhost"].includes(new URL(origin).hostname) &&
  !origin.startsWith("https://")
)
  throw new Error("Public beta checks require HTTPS");

const login = await fetch(`${origin}/login`);
assert.equal(login.status, 200);
const html = await login.text();
assert(html.includes("เวอร์ชันเบต้าสำหรับครู"));
assert(!html.includes('class="segmented"'));
console.log("PASS teacher beta notice and hidden student sign-in option");

const page = await fetch(`${origin}/student`, { redirect: "manual" });
const pageBody = await page.text();
assert(
  page.headers.get("location") === "/login" ||
    (page.status === 200 &&
      /<meta[^>]+http-equiv="refresh"[^>]+url=\/login/.test(pageBody)),
);
console.log(
  "PASS student page redirects to login, including streaming responses",
);

const student = await fetch(`${origin}/api/student`);
assert.equal(student.status, 403);
console.log("PASS student data endpoint disabled");

const signIn = await fetch(`${origin}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({
    kind: "student",
    identifier: "beta-access-probe",
    password: "not-a-real-pin",
  }),
});
assert.equal(signIn.status, 403);
console.log("PASS student authentication endpoint disabled");

const staff = await fetch(`${origin}/api/staff/meta`);
assert.equal(staff.status, 401);
console.log("PASS anonymous staff data access denied");

const wrongOrigin = await fetch(`${origin}/api/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://untrusted.example",
  },
  body: "{}",
});
assert.equal(wrongOrigin.status, 403);
console.log("PASS cross-origin authentication request denied");
