# Security model — beta.8

## Public and private surfaces

`/` is a public product page. `/demo` contains invented fixtures and in-memory actions; neither route loads school branding, authentication state or student data from Supabase. Refreshing the demo discards edits. Public source does not contain live credentials, rosters, uploads or private Git history.

The school workspace requires an active Supabase staff profile. ADMIN/DEVELOPER manage central records. TEACHER reads only assigned teaching classes/courses and explicit homeroom classes in the relevant term. School-table RLS remains enforced independently of the UI. Authenticated direct writes are revoked; mutation RPCs validate authorization with a fixed search path. Server secrets never reach browser code.

## Homeroom reads and teaching writes

Migration013 separates `can_access_offering` from `can_edit_offering`. Homeroom teachers may read every subject/result in their class and term. Saving, publishing, unpublishing, resetting and bulk grade writes require explicit teaching assignment, unless the user is an administrator. Permissions are checked again after offering locks. Destructive class moves cannot clear unassigned-course grades through a homeroom permission.

Read-only inputs and controls reflect this policy, but the database is the authority. Revoked permissions cannot be bypassed by a stale page or a manually constructed request.

## Student ID and PIN

Student access is fail-closed unless `STUDENT_PORTAL_ENABLED=true`. Student login has a separate `/student/login` route and accepts exactly five digits plus a PIN of 6–12 digits. The username is resolved from the current `students.student_number`; changing that record changes the login username automatically. PINs are stored as bcrypt hashes in the private schema.

Migration014 allows authorized staff to reset a PIN only for an active student in a term/class the staff member can access. It locks the student/enrollment, validates the ID/PIN and revokes all existing student sessions. Audit records contain the actor and student/term identifiers, never the plaintext PIN or hash. Anonymous callers have no direct PIN RPC access.

Student sessions contain a random browser token while the database stores its keyed hash. The cookie is HttpOnly, Secure on HTTPS, SameSite=Strict and expires after eight hours. The server-only student portal returns only that student's published results and enrollment history; draft results and staff APIs remain inaccessible. Logout revokes the student session. Switching between staff/student sign-in clears the other identity, including stale staff cookie chunks on shared browsers.

## Requests and integrity

Mutation endpoints enforce the exact application origin and bounded validated input. Staff/student login has account and IP attempt limits. Limits retain keyed identifiers rather than raw account names/IP addresses. Malformed inputs do not become SQL strings.

Version checks prevent silent grade overwrites. Published grades require an explicit unpublish or confirmed scoped reset before changing real results. Atomic bulk operations roll back on permission or conflict failures. Positive-credit published numeric results alone contribute to GPA; imported unknown credits are never guessed.

## Teacher profiles and activity

Admin teacher-profile views are authenticated and include signed photo URLs. Uploaded JPEG/PNG/WebP images are validated, resized and reencoded without metadata. Teacher actions appear by display name in audit and authorized admin student activity views. Permanently deleted accounts remain anonymized in retained school history; the application does not reconstruct deleted private profiles.

## Deployment and source publication

Use HTTPS and store server secrets only in hosting configuration. Disable public Supabase Auth signup; teacher registration requires a valid server-checked school invitation. Apply all migrations before enabling the student feature. Never publish `.local`, `.env` secrets, spreadsheet imports, uploaded photos, school exports or screenshots containing private records. The original private checkout's push URL is disabled; publish from a clean public clone/snapshot.

## Verification for this release

Local regression covers homeroom read/write separation, mixed-batch rollback, destructive-move restrictions, PIN authorization, session revocation, published-only student results, username changes, cross-student isolation, shared-browser identity switching, rate limits, anonymous RPC denial and absence of PIN audit leakage. Tests use invented local fixtures and remove their accounts/records afterward. Production smoke is read-only; academic-table fingerprints are compared before/after release.
