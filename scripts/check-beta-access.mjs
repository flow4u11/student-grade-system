import assert from "node:assert/strict";

const origin = new URL(process.env.BETA_BASE_URL || "http://127.0.0.1:3110")
  .origin;
const studentEnabled = process.env.BETA_STUDENT_ENABLED === "true";
if (
  !["127.0.0.1", "localhost"].includes(new URL(origin).hostname) &&
  !origin.startsWith("https://")
)
  throw new Error("Public beta checks require HTTPS");

const login = await fetch(`${origin}/login`);
assert.equal(login.status, 200);
const html = await login.text();
assert(
  studentEnabled
    ? html.includes('href="/student/login"')
    : html.includes("เวอร์ชันเบต้าสำหรับครู"),
);
assert(!html.includes('class="segmented"'));
console.log(
  "PASS separate staff login and correctly gated student sign-in link",
);

const page = await fetch(`${origin}/student`, { redirect: "manual" });
const pageBody = await page.text();
assert(
  page.headers.get("location") ===
    (studentEnabled ? "/student/login" : "/login") ||
    (page.status === 200 &&
      (studentEnabled
        ? /<meta[^>]+http-equiv="refresh"[^>]+url=\/student\/login/
        : /<meta[^>]+http-equiv="refresh"[^>]+url=\/login/
      ).test(pageBody)),
);
console.log(
  "PASS student page redirects to login, including streaming responses",
);

const student = await fetch(`${origin}/api/student`);
assert.equal(student.status, studentEnabled ? 401 : 403);
console.log("PASS unauthenticated student data access denied");

const signIn = await fetch(`${origin}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({
    kind: "student",
    identifier: "beta-access-probe",
    password: "not-a-real-pin",
  }),
});
assert.equal(signIn.status, studentEnabled ? 400 : 403);
console.log(
  "PASS disabled portal or invalid student identifier rejected before login",
);

if (studentEnabled) {
  const studentLogin = await fetch(`${origin}/student/login`);
  const studentHtml = await studentLogin.text();
  assert.equal(studentLogin.status, 200);
  assert(studentHtml.includes('pattern="[0-9]{5}"'));
  assert(!studentHtml.includes('href="/register"'));
  console.log(
    "PASS separate five-digit student login without teacher registration",
  );
}

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
