# School Ledger — Student Grade Management

A real, local-first school grade system with teacher and student portals. Built with Next.js App Router, TypeScript, Tailwind, Supabase/PostgreSQL/Auth, Zod and ExcelJS.

Version 2.0.0-beta.7. The hosted beta is restricted to authorized staff. Student login is disabled. Read the detailed [Thai user guide](../README.md) before testing.

## Features

- Supabase staff authentication, ADMIN/DEVELOPER/TEACHER roles and assigned-course access enforced by RLS/RPCs.
- Expiring code-gated teacher registration, locked official identity, optional profile/onboarding, school settings, feedback and guarded term-grade reset.
- Academic terms, classes, historical enrollments and bilingual subject offerings.
- Student search/filter/sort with pagination, selected-term published GPA, matching numeric Excel export, editing, deactivation and PIN reset.
- XLSX/CSV import with mapping, validation, preview and atomic confirmation; text IDs retain leading zeroes.
- Configurable versioned grade schemes, numeric and automatic/manual pass/fail courses.
- Keyboard gradebook, explicit bulk save, conflict detection and separate publication.
- Private student ID/PIN sessions, published results only and weighted GPA.
- Thai/English, light/dark/system themes, responsive screens, audit trail and XLSX exports.

## Beta.4 teacher pilot

Teachers can edit authorized student details. Admin-assigned homeroom teachers access all course results in their own class/term. Real profile photos, Thai/English registration names, role-specific guides, student Previous/Next, compact GPA and combined subject/offering creation are available. Permanent deletion and Archive are separate commands; published grades can be explicitly reset. Admins can permanently remove teacher accounts while retaining school student results. Read [the current guide](BETA_START.md) and [teacher test checklist](../README.md#รายการทดสอบสำหรับคุณครู).

## Run locally

Requirements: Node 24, npm, Supabase CLI, Docker/OrbStack.

```sh
npm ci
supabase start
supabase migration up --local
npm run setup:local
npm run seed:local
npm run dev
```

Open **http://127.0.0.1:3000**. If `.env.local` and local seed data already exist, skip setup/seed. Generated demo credentials are saved privately in `.local/demo-credentials.json`; they are not committed. Open that file locally to sign in. See [setup](SETUP.md) for safe local reset instructions.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run start
# With the application running in another terminal:
npm run test:e2e
```

Tests use fictional local data only. Never point them at production. Tests must use disposable local fixtures, never the hosted school database.

## Documentation

- [Detailed teacher/admin guide](../README.md)
- [Local setup](SETUP.md)
- [Supabase setup](SUPABASE_SETUP.md)
- [Architecture](ARCHITECTURE.md)
- [Database and grading rules](DATABASE.md)
- [Security model](SECURITY.md)
- [Excel import](EXCEL_IMPORT.md)
- [Public source release](PUBLIC_RELEASE.md)

The public repository starts with a clean source snapshot. The original development history, operator notes, screenshots, school data, environment files and credentials are excluded. Future updates must follow the public release procedure; never push the private development history into the public repository.
