import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key)
  throw new Error(
    "Set the target Supabase URL and server-only secret in .env.local.",
  );
const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log(`Target: ${new URL(url).origin}`);
const email = (await rl.question("Administrator email: ")).trim();
const name = (await rl.question("Display name: ")).trim();
const confirmed = await rl.question(
  "Type CREATE to create an administrator on this target: ",
);
rl.close();
if (confirmed !== "CREATE" || !email.includes("@") || !name)
  throw new Error("Cancelled or invalid input.");
const db = createClient(url, key, { auth: { persistSession: false } });
const password = randomBytes(24).toString("base64url");
const { data, error } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) throw new Error(error.message);
const profile = await db
  .from("profiles")
  .insert({ id: data.user.id, display_name: name, role: "ADMIN" });
if (profile.error) {
  await db.auth.admin.deleteUser(data.user.id);
  throw new Error("Profile creation failed; new auth user removed.");
}
mkdirSync(".local", { recursive: true, mode: 0o700 });
const file = `.local/admin-${Date.now()}.json`;
writeFileSync(
  file,
  JSON.stringify({ target: new URL(url).origin, email, password }, null, 2),
  { mode: 0o600 },
);
console.log(
  `Administrator created. Read the generated credential privately in ${file}. Store it in a password manager, then remove this local credential file.`,
);
