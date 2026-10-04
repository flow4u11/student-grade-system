import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env.local"))
  throw new Error(".env.local exists; preserve it and update deliberately.");
const raw = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
const s = raw.status ?? raw;
const url = s.API_URL ?? s.api_url;
const anon = s.ANON_KEY ?? s.anon_key;
const secret = s.SERVICE_ROLE_KEY ?? s.service_role_key;
if (
  !url ||
  !anon ||
  !secret ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error("Could not identify local Supabase credentials.");
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${anon}\nSUPABASE_SECRET_KEY=${secret}\nAPP_URL=http://127.0.0.1:3000\nSESSION_SECRET=${randomBytes(32).toString("hex")}\n`,
  { mode: 0o600 },
);
console.log(
  "Local environment saved privately to .env.local. No credentials printed.",
);
