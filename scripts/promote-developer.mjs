// Operator-only bootstrap for an existing, explicitly selected account. No password is created.
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !process.env.SUPABASE_SECRET_KEY)
  throw new Error("Target environment required");
const db = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const rl = createInterface({ input: process.stdin, output: process.stdout });
try {
  console.log(`Target: ${new URL(url).origin}`);
  const email = (await rl.question("Existing account email to promote: "))
    .trim()
    .toLowerCase();
  const profile = await db
    .from("profiles")
    .select("id,display_name,role,active")
    .eq("school_username", email)
    .single();
  if (profile.error || !profile.data.active)
    throw new Error("Active account not found");
  console.log(
    `Selected existing account: ${profile.data.display_name} (${profile.data.role})`,
  );
  if (
    (await rl.question("Type PROMOTE DEVELOPER to confirm: ")) !==
    "PROMOTE DEVELOPER"
  )
    throw new Error("Cancelled");
  const r = await db
    .from("profiles")
    .update({ role: "DEVELOPER" })
    .eq("id", profile.data.id)
    .eq("active", true);
  if (r.error) throw new Error("Promotion failed");
  console.log(
    "Developer role assigned. Existing password unchanged; audit trigger recorded the change.",
  );
} finally {
  rl.close();
}
