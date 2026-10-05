# Supabase setup

Local Supabase runs on the existing OrbStack/Docker runtime. Ports: API 54321, PostgreSQL 54322, Studio 54323; full configuration is in `supabase/config.toml`. The CLI uses PostgreSQL 17, matching the intended remote project.

```sh
supabase start
supabase migration up --local
npm run setup:local
npm run seed:local
```

`supabase status` may print secrets; do not paste its raw output into chats, logs, screenshots or recovery documents. The setup script consumes status privately and writes only the required values to an ignored mode-0600 environment file.

## Remote workflow

Create a separate Supabase project for your school. Check the selected project and region before linking. Apply all migrations shipped in this repository; do not assume an existing project has the same schema.

```sh
supabase projects list
supabase link --project-ref YOUR_VERIFIED_PROJECT_REF
supabase migration list --linked
supabase db push --dry-run
```

Only after the local reset, tests, RLS review and committed checkpoint:

```sh
supabase db push
```

Do not pass `--include-seed`: development seed is local-only. The SQL seed is intentionally empty. Do not use `db reset --linked`, delete the remote project, or use the cloud database as a scratch environment.

Public tables receive explicit RLS and role grants in migrations. Private PIN/session/rate tables are in an unexposed schema. Never expose `private` through Supabase API settings.

Use the Supabase dashboard's project API settings to obtain production project URL, publishable key and server-only secret. Put these directly into Vercel's environment settings. Do not paste the secret into chat. Disable public signups in Authentication settings if not already disabled. Accounts without an active authorized profile still cannot access any school table.

If the CLI requests a database password, enter it in its secure interactive prompt; obtain/reset it through Supabase project database settings. Do not write it in source or terminal command arguments. The current implementation does not require a PostgreSQL connection string in Vercel.

For the teacher beta, disable public Supabase signups, configure the exact hosted URL and redirect URLs, and keep `STUDENT_PORTAL_ENABLED=false` until PIN/session isolation tests pass, then enable explicitly with `true` after all migrations are applied. Invitation registration uses an authorized server endpoint. Never push the local configuration to production: it contains development URLs. Do not import development fixtures or run tests against the hosted database.
