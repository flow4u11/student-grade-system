# Security model and release review

## Trust boundaries

Teachers use Supabase Auth email/password. The server validates identity with `auth.getUser()` and reads an active `profiles` row on every privileged request. ADMIN and TEACHER may manage school records; only ADMIN can read audit logs. VIEWER is reserved and has no application access in V1. There is no public signup or role assignment endpoint. Provision administrators using the operator script; create additional staff through the authenticated Supabase operator interface and assign their profile role deliberately.

Every public school table has explicit RLS. Anonymous users have no table grants. Authenticated users can only select records through staff policies; direct inserts, updates, and deletes are revoked. Public write RPCs check `is_staff()` and use a fixed empty search path. No browser receives a service role/secret key. The browser talks only to same-origin application endpoints; staff operations use the teacher's own Supabase session.

Migration 003 also removes implicit API privileges on future tables, sequences and functions created by `postgres`. Future migrations must grant access deliberately. This includes the global function default because a schema-level revoke cannot override a global grant ([PostgreSQL default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)). The local configuration disables automatic exposure of new objects. Existing application grants remain explicit and are regression-tested by `scripts/test-default-privileges.sql`.

## Student ID and PIN

Student IDs are case-sensitive text. PINs have 6–12 decimal digits. Choose at least eight random digits and distribute privately. PostgreSQL pgcrypto bcrypt (cost 12) hashes PINs in an unexposed `private` schema. Neither hashes nor PINs appear in result tables, API responses, audit logs, or exports. Imported students start without login credentials; a teacher sets their PIN individually.

A successful login creates a 256-bit random opaque session token. The database stores only its SHA-256 hash and an eight-hour absolute expiry. The cookie is HttpOnly, SameSite=Strict, and Secure on HTTPS. Only loopback development origins may use HTTP. Deactivation, PIN reset, and logout revoke student sessions; each portal request checks the active student and expiry again.

Only the server key can execute student authentication/session RPCs. The portal RPC accepts a session hash, resolves the owner internally, and returns only that student's identity, enrollments, and PUBLISHED grades. It never accepts an arbitrary student ID from a client. Students have no Supabase JWT or table-query capability.

## Brute force and CSRF

Persistent, atomic PostgreSQL counters allow 10 attempts per identifier and 30 attempts per origin-IP bucket in 15 minutes. Counts include successful logins. IDs and IPs are keyed with HMAC-SHA256 using SESSION_SECRET. Unknown and inactive students perform a bcrypt operation and return the same login error as a wrong PIN. Old limiter buckets and expired sessions are removed during related activity.

On Vercel the trusted `x-vercel-forwarded-for` header supplies the IP. Outside Vercel a shared bucket is deliberately conservative; configure a trusted ingress implementation before scaling a different hosting platform. Account buckets always apply. Do not trust arbitrary client `x-forwarded-for` headers.

Every POST requires an exact Origin match to APP_URL; JSON bodies are limited to 1 MiB. Authentication/authorization is repeated for each mutation. Cookies are not readable by browser scripts. All private API responses use `private, no-store`. Requests do not use student IDs/names as browser query parameters. Exported files are private educational records and should be handled accordingly.

## Integrity and privacy

- Database functions calculate persisted grades using numeric arithmetic. The browser calculation is only a preview.
- Grade writes/publications lock the offering and check row versions; a conflict rolls back the whole batch.
- Changed published scores return to DRAFT. Publication is intentional and confirmed.
- Schemes referenced by offerings cannot be edited. Used offering settings, term identity, and graded enrollment assignment cannot move.
- Public UI provides deactivation, not destructive student deletion.
- Audits capture record changes and actor IDs. PIN changes record only the action. School staff cannot modify or delete audit rows.
- Sample credentials are random, generated locally, git-ignored, and never part of migrations or SQL seed.
- XLSX imports reject formula/error cells. Excel exports encode text as text, including leading-zero IDs and formula-looking names.
- Security headers deny framing, object embedding, unnecessary permissions, and cross-origin data connections.

## Deployment controls still owned by the school

Before handling real records: independently review authorization, enable Supabase Auth MFA/enforcement where required, set password policy and recovery/support procedures, configure backups/PITR and retention, restrict operator access, verify the real domain and TLS, and adopt the school's privacy and PIN distribution policies. V1 has no student self-service PIN recovery, staff invitation UI, fine-grained per-class teacher permissions, or MFA enforcement UI. These are stated limits, not simulated features.

The current CSP permits inline scripts/styles because Next.js and the theme bootstrap require them. It disallows eval in production and limits script sources to self. A nonce-based CSP is a suitable future enhancement. No advertising, third-party analytics, external fonts, or error-reporting trackers are included.

## Verification

`npm run test:db` exercises real local RLS, RPC permissions, owner isolation, draft hiding, publication, session revocation, rate limiting, immutable grading history, duplicate rollback, and audit secret exclusion. `npm run test:e2e` exercises full HTTP workflows against the running app. Run only with fictional local data. See QA.md for observed browser verification and test counts.

A successful portal switch removes the previous identity in the same browser: student login signs out the current staff session and clears staff token cookies; teacher login revokes the current student token and deletes its cookie. Staff logout uses local session scope so other devices remain signed in. Browsers already displaying a previously authorized record cannot be made to forget information they have seen, but subsequent data requests always recheck authorization.

## Current beta.4 boundaries

The V1 limits above are historical: invite signup, per-course teacher scope and administrator settings now exist. Teachers may update an existing student in an authorized enrollment; central creation/permanent removal and PIN reset remain admin-only. Explicit homeroom access covers all subjects for the selected classroom and term, never arbitrary school data. Academic purge is an admin operation and includes related published grades. Course/student result reset is scoped and checks versions/current row snapshot. Private teacher photos accept actual JPEG/PNG/WebP only, are resized/reencoded without metadata, and are signed server-side for authorized profile reads. Deleting TEACHER accounts hard-deletes Auth/profile/photo/feedback/assignments, immediately revokes API access and removes stored profile audit copies; school grade records retain no account author reference. ADMIN/DEVELOPER/self deletion is blocked. Production student login remains disabled.

Beta 5 teacher identity corrections use an administrator-only RPC and a strict HTTP schema. Legacy Thai names can be backfilled without changing an Auth email/password or granting additional permissions. Other account roles cannot be edited through this endpoint. A row lock and `updated_at` comparison prevent stale dialogs from overwriting newer profile or photo updates. See the rolled-back `scripts/test-teacher-edit.sql` and local-only `scripts/test-teacher-edit.mjs` probes.
