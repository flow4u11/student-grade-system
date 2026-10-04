# Architecture

Next.js App Router, React, TypeScript, Tailwind/CSS, Supabase PostgreSQL/Auth, Zod, ExcelJS, Lucide, and next-themes. Native inputs, selects, and modal dialogs retain browser accessibility and keyboard behavior. There is no separate custom API server.

## Request flow

Browser → same-origin Next.js route → Zod validation + staff identity → Supabase authenticated RPC → PostgreSQL constraints/calculation/audit → response.

For students: browser → server-only login RPC → opaque cookie → server-only portal RPC with session hash → owner-scoped published records. A server-only Supabase key is intentionally limited in application use to student auth and durable login limiters.

## Source map

- `src/app`: route entry points, server layout authorization, error/loading pages.
- `src/app/api/auth`: staff/student login and logout, CSRF checks.
- `src/app/api/staff`: reference data, paginated student queries, exports, validated mutations.
- `src/app/api/student`: session-scoped results; the page also reads the same RPC server-side.
- `src/components`: application shell and focused records/student/import/gradebook/portal modules.
- `src/lib/grading.ts`: pure preview and weighted GPA arithmetic.
- `src/lib/validation.ts`: server input schemas.
- `src/lib/import.ts`: workbook/CSV parsing, mapping, and duplicate checks.
- `src/lib/i18n.ts`: centralized English and Thai dictionaries.
- `supabase/migrations`: schema, policies, guards, authoritative calculations.
- `scripts`: guarded local environment/seed/integration, operator administrator bootstrap.

## Deliberate choices

Explicit bulk save is easier to verify than background autosave. Publication remains a separate action. Optimistic versions prevent silent overwrites. A term's enrollments are preserved independently from students, so the same student can move to a different class in a new year without altering old grades.

Reference data (terms/classes/subjects/offerings/schemes) is fetched in bounded sets of fewer than 1,000 records per category; exceeding that produces an explicit failure instead of silently truncating. Student lists use server filtering and 50-row pages. Exports page through the database. A single gradebook/import supports at most 1,000 students, suited to a school class or a split import. Future deployments exceeding these bounds should add reference-data pagination.

Thai is the default locale; the cookie persists language. Theme preference is managed by next-themes. Locale/theme preferences never store educational records. Timestamps are UTC in PostgreSQL and displayed in Asia/Bangkok.
