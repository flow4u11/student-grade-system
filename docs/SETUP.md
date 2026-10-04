# Local setup (macOS)

Prerequisites: Node 24 LTS/npm, Git, Supabase CLI, and a running Docker-compatible runtime such as OrbStack. The repository already includes Supabase configuration. Do not rerun init over existing configuration.

```sh
npm ci
supabase start
npm run setup:local
supabase migration up --local
npm run seed:local
npm run dev
```

Open http://127.0.0.1:3000. The application defaults to Thai; switch to English on the sign-in screen. `setup:local` writes `.env.local` with permissions 0600 and does not print credentials. It refuses to overwrite an existing environment file. The seed script refuses remote URLs and existing student data.

Generated local administrator and student credentials are in `.local/demo-credentials.json`, readable only by your user. Open that file privately to sign in; never copy it into documentation or commit it. The fake administrator email, password and student PINs are supplied by that file. The seed includes student `00123`, a Mathematics score of 79, published pass/fail courses, and draft English grades.

## Development commands

| Command                | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `npm run dev`          | Local hot-reloading application                      |
| `npm run lint`         | ESLint                                               |
| `npm run typecheck`    | Strict TypeScript                                    |
| `npm test`             | Business, GPA, import and workbook tests             |
| `npm run test:db`      | Real local database/security integration             |
| `npm run test:e2e`     | HTTP acceptance tests, requires running app and seed |
| `npm run build`        | Production build                                     |
| `npm run start`        | Serve built app on loopback                          |
| `npm run format:check` | Formatting consistency                               |

HTTP acceptance tests use fictional records, create test classes/terms, and exercise publication. Local database tests clean their dedicated entities but leave audit evidence. Reset/reseed for a pristine demo. Do not run any test against real student data.

## Resetting disposable local data

Stop app/tests first. `supabase db reset --local` rebuilds local data from migrations and removes local Auth accounts. After a deliberate reset, remove the stale `.local/demo-credentials.json`, then run `npm run seed:local`. Keep `.env.local` unless local keys/ports changed. Never use this recovery procedure against a remote database.

Some Codex sandbox environments require host permission to access the Docker socket, Supabase CLI telemetry, Git metadata, npm network/cache and Next build worker ports. Permission failures are infrastructure failures, not reasons to disable security.

## Environment

Copy `.env.example` only when configuring manually. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` identify the target; the publishable/anon key is safe by design because RLS enforces access. `SUPABASE_SECRET_KEY` is server-only. `SESSION_SECRET` must be at least 32 random characters. `APP_URL` must match the exact browser origin used for POST requests. Use 127.0.0.1 consistently with the supplied local configuration. Never put the server key in a NEXT_PUBLIC variable.
